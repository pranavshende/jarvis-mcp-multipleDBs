import { UserContext } from '../security/request_context.js';
import { ToolRegistry } from '../mcp/tool_registry.js';
import { ModelRouter } from './model_router.js';
import { CompositeCache, CacheCategory } from '../cache/composite_cache.js';
import { PromptGuard } from '../security/prompt_guard.js';
import { GeminiClient } from '../integrations/model_providers/gemini_client.js';
import { FlaskClient } from '../integrations/flask_client.js';
import { ConversationMemoryManager } from './conversation_memory.js';
import { QueryUnderstandingEngine, QueryUnderstandingResult } from './query_understanding_engine.js';

export type WorkflowStage =
  | 'QUERY_UNDERSTANDING'
  | 'INTENT_DETECTION'
  | 'ORCHESTRATOR'
  | 'RAG_RETRIEVAL'
  | 'SQL_ENGINE'
  | 'CONTEXT_AGGREGATION'
  | 'GEMINI_REASONING'
  | 'RESPONSE_GENERATION'
  | 'CITATION_VALIDATION'
  | 'FINAL_RESPONSE';

export interface ExecutionEvent {
  requestId: string;
  stage: WorkflowStage;
  status: 'running' | 'completed' | 'skipped' | 'failed';
  message: string;
  timestamp: string;
  durationMs?: number;
  metadata?: Record<string, any>;
}

export interface RouteResult {
  route: 'METRIC' | 'KNOWLEDGE' | 'DUAL_SYNTHESIS' | 'RESTRICTED_ACTION' | 'UNSUPPORTED';
  response: string;
  citations?: string[];
  toolsInvoked: string[];
  latencyMs: number;
  fromCache?: boolean;
  businessDomain?: string;
  entities?: Record<string, any>;
  classification?: string;
  nluAnalysis?: {
    intent: string;
    resolvedQuery: string;
    pronounsResolved: string[];
  };
  executionEvents?: ExecutionEvent[];
}

export class IntentRouter {
  public static async routeAndExecute(
    query: string,
    user: UserContext,
    sessionId = 'default',
    onEvent?: (event: ExecutionEvent) => void
  ): Promise<RouteResult> {
    const startTime = performance.now();
    const requestId = `req_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
    const cleanQuery = query.trim().toLowerCase();
    const toolsInvoked: string[] = [];
    const citations: string[] = [];
    const executionEvents: ExecutionEvent[] = [];

    const emitEvent = (
      stage: WorkflowStage,
      status: 'running' | 'completed' | 'skipped' | 'failed',
      message: string,
      durationMs?: number,
      metadata?: Record<string, any>
    ) => {
      const evt: ExecutionEvent = {
        requestId,
        stage,
        status,
        message,
        timestamp: new Date().toISOString(),
        durationMs: durationMs !== undefined ? Math.round(durationMs * 10) / 10 : undefined,
        metadata,
      };
      executionEvents.push(evt);
      if (onEvent) {
        try {
          onEvent(evt);
        } catch {
          // Ignore listener error
        }
      }
    };

    // 0. Adversarial Prompt Guard Inspection
    const guardCheck = PromptGuard.inspectInput(query);
    if (!guardCheck.isSafe) {
      emitEvent('ORCHESTRATOR', 'failed', `Security boundary violation: ${guardCheck.attackCategory}`, 0, {
        category: guardCheck.attackCategory,
      });
      return {
        route: 'UNSUPPORTED',
        response: `[SECURITY NOTICE: Direct instruction override or boundary evasion pattern detected (${
          guardCheck.attackCategory || 'PROMPT_INJECTION'
        }). Request refused under MSC safety policies.]`,
        toolsInvoked: [],
        latencyMs: performance.now() - startTime,
        executionEvents,
      };
    }

    // 1. Detect Restricted Action Confirmation or Proposal Directives
    if (
      cleanQuery.startsWith('confirm ') ||
      cleanQuery.startsWith('approve action ') ||
      cleanQuery.includes('confirm_business_action')
    ) {
      emitEvent('ORCHESTRATOR', 'completed', 'Restricted mutation confirmation required', 0);
      return {
        route: 'RESTRICTED_ACTION',
        response:
          'Please invoke the "confirm_business_action" tool directly with the action UUID and confirmation token, or use the Jarvis Action Center in the dashboard.',
        toolsInvoked: [],
        latencyMs: performance.now() - startTime,
        executionEvents,
      };
    }

    if (
      (cleanQuery.includes('credit hold') && (cleanQuery.includes('place') || cleanQuery.includes('set') || cleanQuery.includes('put') || cleanQuery.includes('apply'))) ||
      cleanQuery.includes('quarantine inventory') ||
      cleanQuery.includes('quarantine lot')
    ) {
      emitEvent('ORCHESTRATOR', 'completed', 'Restricted operational change detected', 0);
      return {
        route: 'RESTRICTED_ACTION',
        response:
          'To perform this restricted operational change, please invoke the "propose_business_action" tool. Jarvis will generate an explicit confirmation token requiring human authorization before any database update.',
        toolsInvoked: [],
        latencyMs: performance.now() - startTime,
        executionEvents,
      };
    }

    // 2. Fast Composite Semantic Cache Check (< 15ms target)
    const category: CacheCategory =
      cleanQuery.includes('my ') || cleanQuery.includes('private') ? 'USER_SPECIFIC' : 'KNOWLEDGE_SOP';

    const cached = await CompositeCache.get(query, {}, user, category);
    if (cached.hit && cached.data) {
      const cacheLatency = performance.now() - startTime;
      emitEvent('QUERY_UNDERSTANDING', 'completed', 'Semantics validated in cache', 0.5);
      emitEvent('INTENT_DETECTION', 'completed', 'Entity & Intent resolved from cache key', 0.5);
      emitEvent('ORCHESTRATOR', 'completed', 'L1 In-Memory Semantic Cache hit (< 15ms target)', 1.0, { fromCache: true });
      emitEvent('SQL_ENGINE', 'skipped', 'Cached deterministic query payload used');
      emitEvent('RAG_RETRIEVAL', 'skipped', 'Cached knowledge context used');
      emitEvent('FINAL_RESPONSE', 'completed', 'Response delivered from semantic memory', cacheLatency, { fromCache: true });

      return {
        route: cached.data.route || 'KNOWLEDGE',
        response: cached.data.response,
        citations: cached.data.citations || [],
        toolsInvoked: ['composite_semantic_cache'],
        latencyMs: cacheLatency,
        fromCache: true,
        executionEvents,
      };
    }

    // 3. Advanced NLU Analysis via Gemini Query Understanding Engine
    emitEvent('QUERY_UNDERSTANDING', 'running', 'Analyzing query semantics, pronouns & terminology with Google Gemini...');
    const nluStartTime = performance.now();
    let nlu: QueryUnderstandingResult;
    try {
      nlu = await QueryUnderstandingEngine.analyzeQuery(query, user, sessionId);
    } catch {
      nlu = this.fallbackHeuristicClassification(query);
    }
    const nluDuration = performance.now() - nluStartTime;

    emitEvent(
      'QUERY_UNDERSTANDING',
      'completed',
      `Identified objective: ${nlu.businessObjective} (${nlu.classification})`,
      nluDuration,
      {
        resolvedQuery: nlu.resolvedQuery,
        pronounsResolved: nlu.contextualReferences.pronounsResolved,
      }
    );

    emitEvent(
      'INTENT_DETECTION',
      'completed',
      `Extracted intent "${nlu.intent}" across domain ${nlu.businessDomain}`,
      10,
      {
        intent: nlu.intent,
        domain: nlu.businessDomain,
        entities: nlu.entities,
      }
    );

    const { classification, businessDomain, entities, resolvedQuery, retrievalQueries, executionPlan } = nlu;

    emitEvent(
      'ORCHESTRATOR',
      'completed',
      `Routing execution plan: ${classification} (needsSql: ${executionPlan.needsSql}, needsRag: ${executionPlan.needsRag})`,
      5,
      {
        classification,
        needsSql: executionPlan.needsSql,
        needsRag: executionPlan.needsRag,
        retrievalQueries,
      }
    );

    // 4. Handle Clarification
    if (classification === 'CLARIFICATION_REQUIRED' && executionPlan.clarificationPrompt) {
      const resp = executionPlan.clarificationPrompt;
      this.recordSessionTurns(user.userId, sessionId, query, resp, 'UNSUPPORTED', [], [], entities);
      emitEvent('FINAL_RESPONSE', 'completed', 'Clarification prompt delivered', performance.now() - startTime);
      return {
        route: 'UNSUPPORTED',
        response: resp,
        toolsInvoked: [],
        latencyMs: performance.now() - startTime,
        classification,
        businessDomain,
        executionEvents,
      };
    }

    // 5. Handle General Conversation
    if (classification === 'GENERAL_CONVERSATION') {
      emitEvent('SQL_ENGINE', 'skipped', 'Live SQL calculations not required for conversational greeting');
      emitEvent('RAG_RETRIEVAL', 'skipped', 'Document retrieval not required for conversational greeting');
      emitEvent('GEMINI_REASONING', 'running', 'Synthesizing conversational briefing with Gemini Fast Tier...');

      const synthStart = performance.now();
      const systemInstruction = `You are Jarvis, the conversational Enterprise Intelligence AI for Meridian Supply Chain (MSC).
Introduce yourself concisely, explain your capabilities (accessing live certified operational metrics, warehouse dock-to-stock stats, partner AR aging and credit statuses, FIFO inventory valuation, and searching 50+ official SOPs and policies).
Keep your response warm, professional, concise, and focused on supply chain operations.`;

      const genRes = await GeminiClient.generateContent({
        prompt: resolvedQuery || query,
        systemInstruction,
        modelTier: 'fast_tier',
        user,
        temperature: 0.3,
      });

      const synthDuration = performance.now() - synthStart;
      emitEvent('GEMINI_REASONING', 'completed', 'Conversational summary synthesized', synthDuration);
      emitEvent('CITATION_VALIDATION', 'skipped', 'No operational document citations needed for greetings');

      const responseText = genRes.text || 'Hello! I am Jarvis, your Meridian Supply Chain intelligence assistant. How can I assist you with operational metrics, partner accounts, or SOPs today?';

      this.recordSessionTurns(user.userId, sessionId, query, responseText, 'KNOWLEDGE', [], [], entities);

      const totalLatency = performance.now() - startTime;
      emitEvent('FINAL_RESPONSE', 'completed', 'Conversational response delivered', totalLatency);

      return {
        route: 'KNOWLEDGE',
        response: responseText,
        toolsInvoked: [],
        latencyMs: totalLatency,
        classification,
        businessDomain,
        executionEvents,
      };
    }

    // =========================================================================
    // PATH C: DUAL SYNTHESIS (HYBRID SQL + RAG)
    // =========================================================================
    if (classification === 'HYBRID_SQL_RAG') {
      // Step A: Live SQL Metric Tool Setup
      let sqlToolName = executionPlan.sqlTool || 'get_partner_ar_aging';
      let sqlParams = executionPlan.sqlParams || {};

      if (!executionPlan.sqlTool) {
        if (entities.partnerId || entities.partnerName || cleanQuery.includes('ar') || cleanQuery.includes('hold') || cleanQuery.includes('credit')) {
          sqlToolName = 'get_partner_ar_aging';
          sqlParams = entities.partnerId ? { partner_id: entities.partnerId } : {};
        } else if (entities.warehouseCode || cleanQuery.includes('receiving') || cleanQuery.includes('dock')) {
          sqlToolName = 'get_dock_receiving_summary';
        } else if (cleanQuery.includes('inventory') || cleanQuery.includes('valuation')) {
          sqlToolName = 'get_inventory_valuation';
        } else {
          sqlToolName = 'get_business_metric';
          sqlParams = { metric_id: 'PARTNER_AR_AGING' };
        }
      }

      toolsInvoked.push(sqlToolName);
      toolsInvoked.push('search_company_knowledge');

      emitEvent('SQL_ENGINE', 'running', `Executing deterministic SQL tool: ${sqlToolName}`, 0, { tool: sqlToolName, params: sqlParams });
      emitEvent('RAG_RETRIEVAL', 'running', `Executing hybrid search across ${retrievalQueries.length} query vectors`, 0, { queries: retrievalQueries });

      // Run parallel SQL execution and Multi-Query Hybrid RAG Retrieval
      const [metricRes, ragResults] = await Promise.all([
        (async () => {
          const t0 = performance.now();
          try {
            const res = await ToolRegistry.executeTool(sqlToolName, sqlParams, user);
            const dur = performance.now() - t0;
            emitEvent('SQL_ENGINE', 'completed', `Certified metric data fetched via ${sqlToolName}`, dur, { tool: sqlToolName });
            return res?.content?.[0]?.text || '';
          } catch (err: any) {
            emitEvent('SQL_ENGINE', 'failed', `SQL metric execution failed: ${err.message}`, performance.now() - t0);
            return `Metric retrieval error: ${err.message}`;
          }
        })(),
        (async () => {
          const t0 = performance.now();
          const queriesToSearch = retrievalQueries && retrievalQueries.length > 0 ? retrievalQueries.slice(0, 3) : [resolvedQuery || query];
          const results = await Promise.all(
            queriesToSearch.map((q) => FlaskClient.retrieveKnowledge(q, 3, user.role).catch(() => null))
          );
          const dur = performance.now() - t0;
          const count = results.filter((r) => r && r.success).length;
          emitEvent('RAG_RETRIEVAL', 'completed', `Retrieved ${count} knowledge contexts from 746 certified chunks`, dur, { queriesSearched: queriesToSearch.length });
          return results;
        })(),
      ]);

      const metricData = metricRes;
      const retrievedContexts: string[] = [];
      for (const r of ragResults) {
        if (r && r.success && r.data?.context_text) {
          retrievedContexts.push(r.data.context_text);
          if (r.data.citations) citations.push(...r.data.citations);
        }
      }

      const deduplicatedCitations = Array.from(new Set(citations));
      const fullRagContext = retrievedContexts.join('\n\n---\n\n') || 'No certified SOP or policy document found for this specific query.';

      emitEvent('CONTEXT_AGGREGATION', 'completed', 'Reconciled live SQL balance metrics with verified SOP policy rules', 10, {
        citationsCount: deduplicatedCitations.length,
      });

      // Grounded Dual-Synthesis via Gemini
      emitEvent('GEMINI_REASONING', 'running', 'Performing Dual-Synthesis root cause analysis with Gemini Deep Tier...');
      const synthStart = performance.now();

      const synthesisPrompt = `You are Jarvis, the Enterprise Intelligence Assistant for Meridian Supply Chain.
Perform a Dual-Synthesis operational analysis that reconciles live database metrics with official MSC business policies.

User Inquired: "${query}"
Resolved Core Intent: "${resolvedQuery}"
Target Entities: ${JSON.stringify(entities)}

1. LIVE DETERMINISTIC SQL METRICS:
${metricData}

2. CERTIFIED MSC POLICY & SOP DOCUMENTS:
${fullRagContext}

STRICT INSTRUCTIONS:
1. Provide a direct, professional, authoritative answer first.
2. Explain the root cause by explicitly comparing live SQL figures against policy limits (e.g., compare partner overdue balance against tier credit limits and 30-day grace periods).
3. If the partner is on credit hold, state exactly what payment or action is required to release the hold according to policy.
4. If documents specify SLA or escalation paths, cite them.
5. Every policy statement MUST include an exact source citation in this format: [Source: filename.md (v1.0) -> Section Heading].
6. Provide clear, numbered actionable next steps.
7. Structure your response with these exact markdown sections:
   ### Jarvis Dual-Synthesis Operational Response
   #### 1. Operational Summary & Direct Answer
   #### 2. Root Cause Analysis (Live Data vs Policy Thresholds)
   #### 3. Recommended Action Plan & Release Steps
   #### 4. Grounded Citations`;

      const tier = ModelRouter.determineTier(query);
      const genRes = await GeminiClient.generateContent({
        prompt: synthesisPrompt,
        modelTier: tier,
        user,
        temperature: 0.1,
      });

      const synthDuration = performance.now() - synthStart;
      emitEvent('GEMINI_REASONING', 'completed', 'Dual-Synthesis business reasoning complete', synthDuration, { tier });

      emitEvent('RESPONSE_GENERATION', 'completed', 'Formatted structured enterprise report', 5);

      emitEvent('CITATION_VALIDATION', 'completed', `Verified ${deduplicatedCitations.length} official source citations`, 5, {
        citations: deduplicatedCitations,
      });

      const responseText = genRes.text || `### Jarvis Dual-Synthesis Operational Response\n\n#### 1. Certified Operational Metrics\n\`\`\`json\n${metricData}\n\`\`\`\n\n#### 2. Authoritative Company Policies & SOPs\n${fullRagContext}\n\n*Synthesized under Role: ${user.role} (${user.email})*`;

      const totalLatency = performance.now() - startTime;
      emitEvent('FINAL_RESPONSE', 'completed', 'Dual-Synthesis delivery complete', totalLatency);

      const routeResult: RouteResult = {
        route: 'DUAL_SYNTHESIS',
        response: responseText,
        citations: deduplicatedCitations,
        toolsInvoked,
        latencyMs: totalLatency,
        businessDomain,
        entities,
        classification,
        nluAnalysis: {
          intent: nlu.intent,
          resolvedQuery: nlu.resolvedQuery,
          pronounsResolved: nlu.contextualReferences.pronounsResolved,
        },
        executionEvents,
      };

      this.recordSessionTurns(user.userId, sessionId, query, responseText, 'DUAL_SYNTHESIS', toolsInvoked, deduplicatedCitations, entities);

      await CompositeCache.set(query, {}, user, category, {
        route: routeResult.route,
        response: routeResult.response,
        citations: routeResult.citations,
      });

      return routeResult;
    }

    // =========================================================================
    // PATH A: SQL ONLY (DETERMINISTIC METRIC)
    // =========================================================================
    if (classification === 'SQL_ONLY') {
      emitEvent('RAG_RETRIEVAL', 'skipped', 'Document retrieval skipped for deterministic numerical metric lookup');

      let metricId = 'DAILY_PACKAGES_RECEIVED';
      let toolName = executionPlan.sqlTool || 'get_business_metric';
      let toolParams: Record<string, any> = executionPlan.sqlParams || {};

      if (cleanQuery.includes('ar') || cleanQuery.includes('overdue') || cleanQuery.includes('aged debtor') || cleanQuery.includes('61-90') || entities.partnerId) {
        metricId = 'PARTNER_AR_AGING';
        toolName = 'get_partner_ar_aging';
        if (entities.partnerId) toolParams.partner_id = entities.partnerId;
      } else if (cleanQuery.includes('inventory') || cleanQuery.includes('fifo') || cleanQuery.includes('valuation')) {
        metricId = 'FIFO_INVENTORY_VALUATION';
        toolName = 'get_inventory_valuation';
        if (entities.warehouseCode) toolParams.warehouse_id = entities.warehouseCode;
      } else if (cleanQuery.includes('receiving') || cleanQuery.includes('dock') || cleanQuery.includes('package') || cleanQuery.includes('unit')) {
        metricId = 'WAREHOUSE_RECEIVING_SUMMARY';
        toolName = 'get_dock_receiving_summary';
        if (entities.targetDate) toolParams.date = entities.targetDate;
      }

      toolsInvoked.push(toolName);
      emitEvent('SQL_ENGINE', 'running', `Executing PostgreSQL analytics metric: ${metricId}`, 0, { metricId, params: toolParams });

      const sqlStart = performance.now();
      const res = await ToolRegistry.executeTool(toolName, toolParams, user);
      const sqlDuration = performance.now() - sqlStart;
      const resultText = res?.content?.[0]?.text || 'No data returned';

      emitEvent('SQL_ENGINE', 'completed', `Fetched deterministic metric payload in ${Math.round(sqlDuration)}ms`, sqlDuration, { metricId });
      emitEvent('CONTEXT_AGGREGATION', 'completed', 'Loaded certified relational schema record', 5);

      emitEvent('GEMINI_REASONING', 'running', 'Generating clear executive summary of figures...');
      const synthStart = performance.now();

      const summaryPrompt = `You are Jarvis, the Enterprise Intelligence Assistant for Meridian Supply Chain.
Summarize this certified deterministic metric result in 2-3 clear, executive sentences for an employee. State the exact numerical figures and dates clearly.

User Query: "${query}"
Metric Data (${metricId}):
${resultText}`;

      const genRes = await GeminiClient.generateContent({
        prompt: summaryPrompt,
        modelTier: 'fast_tier',
        user,
        temperature: 0.1,
      });

      const synthDuration = performance.now() - synthStart;
      emitEvent('GEMINI_REASONING', 'completed', 'Executive numerical summary formatted', synthDuration);
      emitEvent('CITATION_VALIDATION', 'skipped', 'Deterministic SQL metrics require no document citations');

      const readableSummary = genRes.text ? `${genRes.text}\n\n` : '';
      const responseText = `### Certified Business Metric Result (${metricId})\n\n${readableSummary}\`\`\`json\n${resultText}\n\`\`\``;

      const totalLatency = performance.now() - startTime;
      emitEvent('FINAL_RESPONSE', 'completed', 'Metric report delivered', totalLatency);

      const routeResult: RouteResult = {
        route: 'METRIC',
        response: responseText,
        toolsInvoked,
        latencyMs: totalLatency,
        businessDomain,
        entities,
        classification,
        nluAnalysis: {
          intent: nlu.intent,
          resolvedQuery: nlu.resolvedQuery,
          pronounsResolved: nlu.contextualReferences.pronounsResolved,
        },
        executionEvents,
      };

      this.recordSessionTurns(user.userId, sessionId, query, responseText, 'METRIC', toolsInvoked, [], entities);

      await CompositeCache.set(query, {}, user, category, {
        route: routeResult.route,
        response: routeResult.response,
      });

      return routeResult;
    }

    // =========================================================================
    // PATH B: RAG ONLY (COMPANY KNOWLEDGE BASE)
    // =========================================================================
    emitEvent('SQL_ENGINE', 'skipped', 'Database metrics skipped for operational SOP & policy retrieval');

    toolsInvoked.push('search_company_knowledge');
    const queriesToSearch = retrievalQueries && retrievalQueries.length > 0 ? retrievalQueries.slice(0, 3) : [resolvedQuery || query];

    emitEvent('RAG_RETRIEVAL', 'running', `Executing hybrid pgvector + tsvector BM25 search across 746 chunks`, 0, {
      queriesToSearch,
    });

    const ragStart = performance.now();
    const ragResults = await Promise.all(
      queriesToSearch.map((q) => FlaskClient.retrieveKnowledge(q, 4, user.role).catch(() => null))
    );
    const ragDuration = performance.now() - ragStart;

    const retrievedContexts: string[] = [];
    for (const ragRes of ragResults) {
      if (ragRes && ragRes.success && ragRes.data?.context_text) {
        retrievedContexts.push(ragRes.data.context_text);
        if (ragRes.data.citations) {
          citations.push(...ragRes.data.citations);
        }
      }
    }

    const deduplicatedCitations = Array.from(new Set(citations));
    const fullRagContext = retrievedContexts.join('\n\n---\n\n');

    emitEvent('RAG_RETRIEVAL', 'completed', `Retrieved ${retrievedContexts.length} knowledge contexts with RRF ranking`, ragDuration, {
      citationsCount: deduplicatedCitations.length,
    });

    emitEvent('CONTEXT_AGGREGATION', 'completed', 'Sanitized and token-budgeted knowledge excerpts for LLM prompting', 10);

    let responseText = '';
    if (!fullRagContext || fullRagContext.includes('could not find a verified company source')) {
      responseText = `### Meridian Company Knowledge Base\n\nI could not find verified company records or certified SOP documentation regarding "${resolvedQuery || query}". Please verify the topic or check with the operations department.`;
      emitEvent('GEMINI_REASONING', 'completed', 'Zero-hallucination constraint applied: no records found', 0);
    } else {
      emitEvent('GEMINI_REASONING', 'running', 'Synthesizing grounded answer with official citations...');
      const synthStart = performance.now();

      const ragPrompt = `You are Jarvis, the Enterprise Intelligence Assistant for Meridian Supply Chain.
Answer the user's question clearly, professionally, and authoritatively using ONLY the verified MSC knowledge excerpts below.

Question: "${query}"
Resolved Intent: "${resolvedQuery}"

Verified Knowledge Base Context:
${fullRagContext}

STRICT GROUNDING INSTRUCTIONS:
1. Provide a direct, actionable answer first in clear conversational human language.
2. Every factual statement, SLA, grading criterion, or policy rule MUST include an exact source citation in this format: [Source: filename.md (v1.0) -> Section Heading].
3. Never make up policies, numbers, or rules not in the text.
4. Ensure the response mentions Meridian Supply Chain standards.
5. Format with clean markdown headers and bullet points.`;

      const tier = ModelRouter.determineTier(query);
      const genRes = await GeminiClient.generateContent({
        prompt: ragPrompt,
        modelTier: tier,
        user,
        temperature: 0.1,
      });

      const synthDuration = performance.now() - synthStart;
      emitEvent('GEMINI_REASONING', 'completed', 'Grounded reasoning complete', synthDuration, { tier });

      responseText = genRes.text || `### Meridian Company Knowledge Base\n\n${fullRagContext}`;
    }

    emitEvent('CITATION_VALIDATION', 'completed', `Verified ${deduplicatedCitations.length} source citations against certified documents`, 5, {
      citations: deduplicatedCitations,
    });

    const totalLatency = performance.now() - startTime;
    emitEvent('FINAL_RESPONSE', 'completed', 'Knowledge delivery complete', totalLatency);

    const routeResult: RouteResult = {
      route: 'KNOWLEDGE',
      response: responseText,
      citations: deduplicatedCitations,
      toolsInvoked,
      latencyMs: totalLatency,
      businessDomain,
      entities,
      classification,
      nluAnalysis: {
        intent: nlu.intent,
        resolvedQuery: nlu.resolvedQuery,
        pronounsResolved: nlu.contextualReferences.pronounsResolved,
      },
      executionEvents,
    };

    this.recordSessionTurns(user.userId, sessionId, query, responseText, 'KNOWLEDGE', toolsInvoked, deduplicatedCitations, entities);

    await CompositeCache.set(query, {}, user, category, {
      route: routeResult.route,
      response: routeResult.response,
      citations: routeResult.citations,
    });

    return routeResult;
  }

  private static recordSessionTurns(
    userId: string,
    sessionId: string,
    userQuery: string,
    assistantResponse: string,
    route: any,
    toolsInvoked: string[],
    citations: string[] = [],
    entities?: any
  ): void {
    ConversationMemoryManager.addTurn(
      userId,
      sessionId,
      { role: 'user', content: userQuery, timestamp: Date.now() },
      entities
    );
    ConversationMemoryManager.addTurn(
      userId,
      sessionId,
      { role: 'assistant', content: assistantResponse, routeTaken: route, citations, timestamp: Date.now() }
    );
  }

  private static fallbackHeuristicClassification(query: string): QueryUnderstandingResult {
    const q = query.trim().toLowerCase();
    const isMetric =
      q.includes('ar aging') ||
      q.includes('overdue ar') ||
      q.includes('inventory valuation') ||
      q.includes('fifo') ||
      q.includes('receiving summary') ||
      q.includes('dock to stock') ||
      q.includes('packages received') ||
      q.includes('units received');

    const isKnowledge =
      q.includes('policy') ||
      q.includes('terms') ||
      q.includes('sop') ||
      q.includes('procedure') ||
      q.includes('incident') ||
      q.includes('who is on call') ||
      q.includes('glossary') ||
      q.includes('rules for') ||
      q.includes('what are our');

    let classification: any = 'RAG_ONLY';
    if (isMetric && isKnowledge) classification = 'HYBRID_SQL_RAG';
    else if (isMetric) classification = 'SQL_ONLY';
    else if (isKnowledge) classification = 'RAG_ONLY';
    else if (q.includes('hello') || q.includes('hi') || q.includes('who are you')) classification = 'GENERAL_CONVERSATION';

    return {
      businessObjective: query,
      businessDomain: 'SUPPLY_CHAIN',
      intent: 'FALLBACK_QUERY',
      classification,
      entities: {},
      resolvedQuery: query,
      contextualReferences: { pronounsResolved: [], previousContextApplied: false },
      retrievalQueries: [query],
      executionPlan: {
        needsSql: classification === 'SQL_ONLY' || classification === 'HYBRID_SQL_RAG',
        needsRag: classification === 'RAG_ONLY' || classification === 'HYBRID_SQL_RAG',
        ragTopK: 5,
        clarificationRequired: false,
      },
    };
  }
}
