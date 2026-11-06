import { config } from '../../config/environment.js';
import { ModelConfig, ModelRouter } from '../../orchestrator/model_router.js';
import { UserContext } from '../../security/request_context.js';
import { AuditService } from '../../audit/audit_service.js';
import { ToolRegistry } from '../../mcp/tool_registry.js';

export interface GeminiMessage {
  role: 'user' | 'model';
  parts: Array<{ text?: string; functionCall?: any; functionResponse?: any }>;
}

export interface GeminiResponse {
  text: string;
  functionCalls?: Array<{ name: string; args: any }>;
  inputTokens: number;
  outputTokens: number;
}

export class GeminiClient {
  private static baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  public static async generateContent(params: {
    prompt: string;
    modelTier?: 'fast_tier' | 'deep_tier';
    user: UserContext;
    systemInstruction?: string;
    enableTools?: boolean;
  }): Promise<GeminiResponse> {
    const apiKey = config.geminiApiKey;
    const { model } = ModelRouter.selectModel(params.modelTier || 'fast_tier');

    // If API key is not yet set in environment, return structured response
    if (!apiKey) {
      return {
        text: `[GEMINI_CLIENT_INFO] Ready to invoke ${model.model_id}. Set GEMINI_API_KEY in .env to enable live cloud model generation.`,
        inputTokens: 0,
        outputTokens: 0,
      };
    }

    const endpoint = `${this.baseUrl}/models/${model.model_id}:generateContent?key=${apiKey}`;

    const body: any = {
      contents: [
        {
          role: 'user',
          parts: [{ text: params.prompt }],
        },
      ],
      generationConfig: {
        maxOutputTokens: model.max_output_tokens,
      },
    };

    if (params.systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: params.systemInstruction }],
      };
    }

    // Attach Gemini Function Declarations if tools are enabled
    if (params.enableTools) {
      const allowedTools = ToolRegistry.listTools(params.user);
      const functionDeclarations = allowedTools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      }));

      body.tools = [{ functionDeclarations }];
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API Error (HTTP ${res.status}): ${errText}`);
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

    const inputTokens = data.usageMetadata?.promptTokenCount || 0;
    const outputTokens = data.usageMetadata?.candidatesTokenCount || 0;

    // Record token spend asynchronously in jarvis_system.token_usage_ledger
    AuditService.recordTokenUsage({
      user: params.user,
      model,
      inputTokens,
      outputTokens,
      requestStatus: 'SUCCESS',
    }).catch(() => {});

    return {
      text,
      functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
      inputTokens,
      outputTokens,
    };
  }
}
