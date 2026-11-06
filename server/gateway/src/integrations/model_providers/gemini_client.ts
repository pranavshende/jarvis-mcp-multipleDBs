import { config } from '../../config/environment.js';
import { ModelConfig, ModelRouter } from '../../orchestrator/model_router.js';
import { UserContext } from '../../security/request_context.js';
import { AuditService } from '../../audit/audit_service.js';
import { ToolRegistry } from '../../mcp/tool_registry.js';

export interface GeminiMessage {
  role: 'user' | 'model';
  parts: Array<{ text?: string; functionCall?: any; functionResponse?: any }>;
}

export interface GeminiGenerateOptions {
  prompt?: string;
  messages?: GeminiMessage[];
  modelTier?: 'fast_tier' | 'deep_tier';
  user: UserContext;
  systemInstruction?: string;
  enableTools?: boolean;
  responseMimeType?: 'text/plain' | 'application/json';
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface GeminiResponse {
  text: string;
  json?: any;
  functionCalls?: Array<{ name: string; args: any }>;
  inputTokens: number;
  outputTokens: number;
  modelUsed: string;
  latencyMs: number;
  fallbackTriggered: boolean;
}

export class GeminiClient {
  private static baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  /**
   * Generates content via Google Gemini with retry, exponential backoff,
   * automatic model tier fallback, and optional structured JSON decoding.
   */
  public static async generateContent(params: GeminiGenerateOptions): Promise<GeminiResponse> {
    const startTime = performance.now();
    const apiKey = config.geminiApiKey;
    const modelTier = params.modelTier || 'fast_tier';
    const maxRetries = params.maxRetries ?? 2;

    const { model: primaryModel, tier } = ModelRouter.selectModel(modelTier, false);
    const fallbackModel = tier.fallback;

    // If API key is missing, return a deterministic structured stub for offline testing
    if (!apiKey) {
      const isJson = params.responseMimeType === 'application/json';
      return {
        text: isJson ? JSON.stringify({ status: 'API_KEY_MISSING', message: 'Set GEMINI_API_KEY in .env' }) : '[GEMINI_OFFLINE] Set GEMINI_API_KEY in .env.',
        json: isJson ? { status: 'API_KEY_MISSING' } : undefined,
        inputTokens: 0,
        outputTokens: 0,
        modelUsed: primaryModel.model_id,
        latencyMs: performance.now() - startTime,
        fallbackTriggered: false,
      };
    }

    // Attempt primary model first, failover to fallback model if transient or rate-limited
    let lastError: Error | null = null;
    let fallbackTriggered = false;

    for (const currentModel of [primaryModel, fallbackModel]) {
      if (currentModel !== primaryModel) {
        fallbackTriggered = true;
      }

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const timeoutMs = params.timeoutMs || tier.timeout_ms || 15000;
          const outcome = await this.executeSingleCall({
            apiKey,
            model: currentModel,
            params,
            timeoutMs,
          });

          const latencyMs = Math.round((performance.now() - startTime) * 100) / 100;

          // Record token spend asynchronously in database audit ledger
          AuditService.recordTokenUsage({
            user: params.user,
            model: currentModel,
            inputTokens: outcome.inputTokens,
            outputTokens: outcome.outputTokens,
            requestStatus: 'SUCCESS',
          }).catch(() => {});

          return {
            ...outcome,
            modelUsed: currentModel.model_id,
            latencyMs,
            fallbackTriggered,
          };
        } catch (err: any) {
          lastError = err;
          const status = err.status || 0;

          // If rate-limited (429) or transient server error (500, 503), wait with exponential backoff
          const isRetryable = status === 429 || status === 500 || status === 503 || err.name === 'AbortError' || err.message?.includes('timeout');
          if (isRetryable && attempt < maxRetries) {
            const delay = Math.pow(2, attempt) * 500 + Math.random() * 200;
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }

          // Otherwise break to model fallback
          break;
        }
      }
    }

    throw lastError || new Error(`Gemini invocation failed after retries and fallback across tier '${modelTier}'.`);
  }

  private static async executeSingleCall(options: {
    apiKey: string;
    model: ModelConfig;
    params: GeminiGenerateOptions;
    timeoutMs: number;
  }): Promise<{ text: string; json?: any; functionCalls?: Array<{ name: string; args: any }>; inputTokens: number; outputTokens: number }> {
    const { apiKey, model, params, timeoutMs } = options;
    const endpoint = `${this.baseUrl}/models/${model.model_id}:generateContent?key=${apiKey}`;

    let contents: any[] = [];
    if (params.messages && params.messages.length > 0) {
      contents = params.messages.map((m) => ({
        role: m.role,
        parts: m.parts,
      }));
    } else {
      contents = [
        {
          role: 'user',
          parts: [{ text: params.prompt || '' }],
        },
      ];
    }

    const generationConfig: any = {
      maxOutputTokens: params.maxOutputTokens || model.max_output_tokens || 4096,
      temperature: params.temperature ?? 0.2,
    };

    if (params.responseMimeType === 'application/json') {
      generationConfig.responseMimeType = 'application/json';
    }

    const body: any = {
      contents,
      generationConfig,
    };

    if (params.systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: params.systemInstruction }],
      };
    }

    // Attach function declarations if tools are enabled
    if (params.enableTools) {
      const allowedTools = ToolRegistry.listTools(params.user);
      const functionDeclarations = allowedTools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      }));
      body.tools = [{ functionDeclarations }];
    }

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        const err = new Error(`Gemini API Error (HTTP ${res.status}): ${errText}`);
        (err as any).status = res.status;
        throw err;
      }

      const data: any = await res.json();
      const candidate = data.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      let text = '';
      const functionCalls: Array<{ name: string; args: any }> = [];

      for (const p of parts) {
        if (p.text) text += p.text;
        if (p.functionCall) functionCalls.push({ name: p.functionCall.name, args: p.functionCall.args });
      }

      let parsedJson: any = undefined;
      if (params.responseMimeType === 'application/json' && text) {
        try {
          parsedJson = JSON.parse(text);
        } catch {
          // Fallback regex extraction if raw json wrapping includes markdown backticks
          const clean = text.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();
          try {
            parsedJson = JSON.parse(clean);
          } catch {}
        }
      }

      const inputTokens = data.usageMetadata?.promptTokenCount || 0;
      const outputTokens = data.usageMetadata?.candidatesTokenCount || 0;

      return {
        text,
        json: parsedJson,
        functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
        inputTokens,
        outputTokens,
      };
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}
