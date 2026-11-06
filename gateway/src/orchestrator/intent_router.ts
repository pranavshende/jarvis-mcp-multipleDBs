import { UserContext } from '../security/request_context.js';
import { ToolRegistry } from '../mcp/tool_registry.js';
import { ModelRouter } from './model_router.js';
import { CompositeCache, CacheCategory } from '../cache/composite_cache.js';
import { PromptGuard } from '../security/prompt_guard.js';
import { GeminiClient } from '../integrations/model_providers/gemini_client.js';
import { FlaskClient } from '../integrations/flask_client.js';
import { ConversationMemoryManager } from './conversation_memory.js';
import { QueryUnderstandingEngine, QueryUnderstandingResult } from './query_understanding_engine.js';

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
}

export class IntentRouter {
  public static async routeAndExecute(
    query: string,
    user: UserContext,
    sessionId = 'default'
  ): Promise<RouteResult> {
    const startTime = performance.now();
    const cleanQuery = query.trim().toLowerCase();
    const toolsInvoked: string[] = [];
    const citations: string[] = [];

    // 0. Adversarial Prompt Guard Inspection
    const guardCheck = PromptGuard.inspectInput(query);
    if (!guardCheck.isSafe) {
      return {
        route: 'UNSUPPORTED',
        response: `[SECURITY NOTICE: Direct instruction override or boundary evasion pattern detected (${
          guardCheck.attackCategory || 'PROMPT_INJECTION'
        }). Request refused under MSC safety policies.]`,
        toolsInvoked: [],
        latencyMs: performance.now() - startTime,
      };
    }

    // 1. Detect Restricted Action Confirmation or Proposal Directives
    if (
      cleanQuery.startsWith('confirm ') ||
      cleanQuery.startsWith('approve action ') ||
      cleanQuery.includes('confirm_business_action')
    ) {
      return {
        route: 'RESTRICTED_ACTION',
        response:
          'Please invoke the "confirm_business_action" tool directly with the action UUID and confirmation token, or use the Jarvis Action Center in the dashboard.',
        toolsInvoked: [],
        latencyMs: performance.now() - startTime,
      };
    }

    if (
      (cleanQuery.includes('credit hold') && (cleanQuery.includes('place') || cleanQuery.includes('set') || cleanQuery.includes('put') || cleanQuery.includes('apply'))) ||
      cleanQuery.includes('quarantine inventory') ||
      cleanQuery.includes('quarantine lot')
    ) {
      return {
        route: 'RESTRICTED_ACTION',
        response:
          'To perform this restricted operational change, please invoke the "propose_business_action" tool. Jarvis will generate an explicit confirmation token requiring human authorization before any database update.',
        toolsInvoked: [],
        latencyMs: performance.now() - startTime,
      };
    }

    // 2. Fast Composite Semantic Cache Check (< 15ms target)
    const category: CacheCategory =
      cleanQuery.includes('my ') || cleanQuery.includes('private') ? 'USER_SPECIFIC' : 'KNOWLEDGE_SOP';

    const cached = await CompositeCache.get(query, {}, user, category);
    if (cached.hit && cached.data) {
      return {
        route: cached.data.route || 'KNOWLEDGE',
        response: cached.data.response,
        citations: cached.data.citations || [],
        toolsInvoked: ['composite_semantic_cache'],
        latencyMs: performance.now() - startTime,
        fromCache: true,
      };
    }

    // 3. Advanced NLU Analysis via Gemini Query Understanding Engine
    let nlu: QueryUnderstandingResult;
    try {
      nlu = await QueryUnderstandingEngine.analyzeQuery(query, user, sessionId);
    } catch (err: any) {
      // Fallback deterministic classification if Gemini call fails
      nlu = this.fallbackHeuristicClassification(query);
    }

    const { classification, businessDomain, entities, resolvedQuery, retrievalQueries, executionPlan } = nlu;

    // 4. Handle Clarification
    if (classification === 'CLARIFICATION_REQUIRED' && executionPlan.clarificationPrompt) {
      const resp = executionPlan.clarificationPrompt;
      this.recordSessionTurns(user.userId, sessionId, query, resp, 'UNSUPPORTED', [], [], entities);
      return {
        route: 'UNSUPPORTED',
        response: resp,
        toolsInvoked: [],
        latencyMs: performance.now() - startTime,
        classification,
        businessDomain,
      };
    }

    // 5. Handle General Conversation
    if (classification === 'GENERAL_CONVERSATION') {
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

      const responseText = genRes.text || 'Hello! I am Jarvis, your Meridian Supply Chain intelligence assistant. How can I assist you with operational metrics, partner accounts, or SOPs today?';

      this.recordSessionTurns(user.userId, sessionId, query, responseText, 'KNOWLEDGE', [], [], entities);

      return {
        route: 'KNOWLEDGE',
        response: responseText,
        toolsInvoked: [],
        latencyMs: performance.now() - startTime,
        classification,
        businessDomain,
      };
    }

    // =========================================================================
    // PATH C: DUAL SYNTHESIS (HYBRID SQL + RAG)
    // =========================================================================
    if (classification === 'HYBRID_SQL_RAG') {
      // Step A: Live SQL Metric Tool Execution
      let metricData = '';
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
      try {
        const metricRes = await ToolRegistry.executeTool(sqlToolName, sqlParams, user);
        metricData = metricRes?.content?.[0]?.text || '';
      } catch (err: any) {
        metricData = `Metric retrieval error: ${err.message}`;
      }

      // Step B: Parallel Multi-Query Hybrid RAG Retrieval
      toolsInvoked.push('search_company_knowledge');
      const queriesToSearch = retrievalQueries && retrievalQueries.length > 0 ? retrievalQueries.slice(0, 3) : [resolvedQuery || query];
      
      const ragResults = await Promise.all(
        queriesToSearch.map(q => FlaskClient.retrieveKnowledge(q, 3, user.role).catch(() => null))
      );

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
      const fullRagContext = retrievedContexts.join('\n\n---\n\n') || 'No certified SOP or policy document found for this specific query.';

      // Step C: Grounded Dual-Synthesis via Gemini
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

      const responseText = genRes.text || `### Jarvis Dual-Synthesis Operational Response\n\n#### 1. Certified Operational Metrics\n\`\`\`json\n${metricData}\n\`\`\`\n\n#### 2. Authoritative Company Policies & SOPs\n${fullRagContext}\n\n*Synthesized under Role: ${user.role} (${user.email})*`;

      const routeResult: RouteResult = {
        route: 'DUAL_SYNTHESIS',
        response: responseText,
        citations: deduplicatedCitations,
        toolsInvoked,
        latencyMs: performance.now() - startTime,
        businessDomain,
        entities,
        classification,
        nluAnalysis: {
          intent: nlu.intent,
          resolvedQuery: nlu.resolvedQuery,
          pronounsResolved: nlu.contextualReferences.pronounsResolved,
        },
      };

      // Record in conversational memory and semantic cache
      this.recordSessionTurns(
        user.userId,
        sessionId,
        query,
        responseText,
        'DUAL_SYNTHESIS',
        toolsInvoked,
        deduplicatedCitations,
        entities
      );

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
      let metricId = 'DAILY_PACKAGES_RECEIVED';
      let toolName = executionPlan.sqlTool || 'get_business_metric';
      let toolParams: Record<string, any> = executionPlan.sqlParams || {};

      if (cleanQuery.includes('ar') || cleanQuery.includes('overdue') || entities.partnerId) {
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
      const res = await ToolRegistry.executeTool(toolName, toolParams, user);
      const resultText = res?.content?.[0]?.text || 'No data returned';

      // Conversational summary synthesis with exact figures
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

      const readableSummary = genRes.text ? `${genRes.text}\n\n` : '';
      const responseText = `### Certified Business Metric Result (${metricId})\n\n${readableSummary}\`\`\`json\n${resultText}\n\`\`\``;

      const routeResult: RouteResult = {
        route: 'METRIC',
        response: responseText,
        toolsInvoked,
        latencyMs: performance.now() - startTime,
        businessDomain,
        entities,
        classification,
        nluAnalysis: {
          intent: nlu.intent,
          resolvedQuery: nlu.resolvedQuery,
          pronounsResolved: nlu.contextualReferences.pronounsResolved,
        },
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
    toolsInvoked.push('search_company_knowledge');
    const queriesToSearch = retrievalQueries && retrievalQueries.length > 0 ? retrievalQueries.slice(0, 3) : [resolvedQuery || query];

    const ragResults = await Promise.all(
      queriesToSearch.map(q => FlaskClient.retrieveKnowledge(q, 4, user.role).catch(() => null))
    );

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

    let responseText = '';
    if (!fullRagContext || fullRagContext.includes('could not find a verified company source')) {
      responseText = `### Meridian Company Knowledge Base\n\nI could not find verified company records or certified SOP documentation regarding "${resolvedQuery || query}". Please verify the topic or check with the operations department.`;
    } else {
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

      responseText = genRes.text || `### Meridian Company Knowledge Base\n\n${fullRagContext}`;
    }

    const routeResult: RouteResult = {
      route: 'KNOWLEDGE',
      response: responseText,
      citations: deduplicatedCitations,
      toolsInvoked,
      latencyMs: performance.now() - startTime,
      businessDomain,
      entities,
      classification,
      nluAnalysis: {
        intent: nlu.intent,
        resolvedQuery: nlu.resolvedQuery,
        pronounsResolved: nlu.contextualReferences.pronounsResolved,
      },
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

  /**
   * Safe fallback heuristic classifier if Gemini is temporarily unreachable
   */
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
