import { GeminiClient } from '../integrations/model_providers/gemini_client.js';
import { UserContext } from '../security/request_context.js';
import { ConversationMemoryManager, ConversationTurn, EntityMemoryState } from './conversation_memory.js';

export type QueryClassification =
  | 'RAG_ONLY'
  | 'SQL_ONLY'
  | 'HYBRID_SQL_RAG'
  | 'GENERAL_CONVERSATION'
  | 'CLARIFICATION_REQUIRED'
  | 'RESTRICTED_ACTION';

export interface ExtractedEntities {
  partnerName?: string;
  partnerId?: string;
  warehouseCode?: string;
  productNames?: string[];
  dateRange?: string;
  targetDate?: string;
  monetaryAmount?: number;
  department?: string;
  policyName?: string;
  incidentRef?: string;
  employeeName?: string;
}

export interface QueryUnderstandingResult {
  businessObjective: string;
  businessDomain: string;
  intent: string;
  classification: QueryClassification;
  entities: ExtractedEntities;
  resolvedQuery: string;
  contextualReferences: {
    pronounsResolved: string[];
    previousContextApplied: boolean;
  };
  retrievalQueries: string[];
  executionPlan: {
    needsSql: boolean;
    sqlTool?: string;
    sqlParams?: Record<string, any>;
    needsRag: boolean;
    ragTopK: number;
    clarificationRequired: boolean;
    clarificationPrompt?: string;
  };
}

export class QueryUnderstandingEngine {
  private static KNOWN_PARTNER_MAPPINGS: Record<string, { id: string; name: string }> = {
    northgate: { id: '301', name: 'Northgate Hobby Distributors' },
    '301': { id: '301', name: 'Northgate Hobby Distributors' },
    prairie: { id: '984', name: 'Prairie Comics & Cards' },
    '984': { id: '984', name: 'Prairie Comics & Cards' },
    cardinal: { id: '980', name: 'Cardinal Bullion' },
    '980': { id: '980', name: 'Cardinal Bullion' },
    union: { id: '648', name: 'Union Hobby LLC' },
    '648': { id: '648', name: 'Union Hobby LLC' },
    riverbend: { id: '739', name: 'Riverbend Bullion Distributors' },
    '739': { id: '739', name: 'Riverbend Bullion Distributors' },
    'blue ridge': { id: '600', name: 'Blue Ridge Card Club' },
    '600': { id: '600', name: 'Blue Ridge Card Club' },
    highland: { id: '1143', name: 'Highland Sports Cards Inc.' },
    '1143': { id: '1143', name: 'Highland Sports Cards Inc.' },
    harbor: { id: '1216', name: 'Harbor Collectibles Wholesale' },
    '1216': { id: '1216', name: 'Harbor Collectibles Wholesale' },
    sunset: { id: '409', name: 'Sunset Games Wholesale' },
    '409': { id: '409', name: 'Sunset Games Wholesale' },
  };

  /**
   * Analyzes an incoming query using Gemini NLU:
   * Resolves conversational references, extracts domain entities,
   * classifies intent, rewrites queries for RAG, and produces a structured execution plan.
   */
  public static async analyzeQuery(
    rawQuery: string,
    user: UserContext,
    sessionId = 'default'
  ): Promise<QueryUnderstandingResult> {
    const memory = ConversationMemoryManager.getSession(user.userId, sessionId);
    const recentHistory = memory.turns.slice(-4);
    const activeEntities = memory.entityState;

    const systemPrompt = `You are the Principal AI Query Understanding Engine for Meridian Supply Chain (MSC) Jarvis v1.
Your task is to analyze employee inquiries across supply chain operations, warehouse procedures (EWR1, ONT1), wholesale partner credit, inventory valuation (FIFO), banking payouts (ACH), and operational SOPs.

CRITICAL INSTRUCTIONS:
1. Understand the employee's underlying business objective even if the question is informal, incomplete, misspelled, or uses abbreviations/slang.
2. Resolve contextual references and pronouns ("it", "they", "that partner", "the other warehouse", "what about tomorrow?") using the provided conversation history and active entities.
3. Classify the query dynamically into:
   - "RAG_ONLY": Exclusively SOPs, procedural steps, historical incident post-mortems, compliance guidelines, grading rules with no requirement for live numerical metrics or partner ledger balances.
   - "SQL_ONLY": Exclusively deterministic numerical metrics (e.g. "what is the AR aging for partner 301?", "how many packages received yesterday at EWR1?", "total FIFO inventory valuation").
   - "HYBRID_SQL_RAG": Inquiries requiring live operational/balance data AND policy/SOP context (e.g. "Why is Northgate blocked and what is their overdue balance?", "Why can't we ship to partner 301?", inquiries about partner credit holds, exposure limits, payment terms release rules). Always set needsSql: true, needsRag: true.
   - "GENERAL_CONVERSATION": Greetings, meta capabilities, capabilities inquiries.
   - "RESTRICTED_ACTION": Requests or proposals to alter database state (e.g. place credit hold, override credit limit, release shipment, quarantine lot).
4. Extract all operational entities (partnerName, partnerId, warehouseCode: EWR1/ONT1, dates, amounts, policies, incidents).
5. Generate 2 to 4 optimized retrieval search queries suitable for hybrid vector + keyword search against company documents.
6. Output STRICT, VALID JSON ONLY conforming to the exact schema. No markdown backticks, no commentary.`;

    const userPromptPayload = {
      currentQuery: rawQuery,
      userRole: user.role,
      userDepartment: user.department,
      activeSessionEntities: activeEntities,
      recentConversationHistory: recentHistory.map((h) => ({
        role: h.role,
        text: h.content.slice(0, 160),
      })),
    };

    try {
      const response = await GeminiClient.generateContent({
        prompt: JSON.stringify(userPromptPayload),
        systemInstruction: systemPrompt,
        modelTier: 'fast_tier',
        user,
        responseMimeType: 'application/json',
        temperature: 0.1,
        timeoutMs: 8000,
      });

      if (response.json && typeof response.json === 'object') {
        return this.normalizeAndValidateResult(response.json, rawQuery, activeEntities);
      }
    } catch {
      // If live cloud model fails or times out, perform deterministic fallback analysis
    }

    return this.fallbackDeterministicAnalysis(rawQuery, activeEntities);
  }

  private static normalizeAndValidateResult(
    raw: any,
    originalQuery: string,
    activeEntities: EntityMemoryState
  ): QueryUnderstandingResult {
    const cleanLower = originalQuery.toLowerCase();
    const entities: ExtractedEntities = raw.entities || {};

    // Standardize known partner IDs if partner was mentioned by name
    for (const [key, mapping] of Object.entries(this.KNOWN_PARTNER_MAPPINGS)) {
      if (cleanLower.includes(key) || cleanLower.includes(mapping.name.toLowerCase())) {
        entities.partnerName = entities.partnerName || mapping.name;
        entities.partnerId = entities.partnerId || mapping.id;
        break;
      }
    }

    // Resolve carryover partner from conversation memory if missing in current utterance
    if (!entities.partnerId && activeEntities.partnerId && (cleanLower.includes('they') || cleanLower.includes('them') || cleanLower.includes('their') || cleanLower.includes('that partner') || cleanLower.includes('pay tomorrow') || cleanLower.includes('hold'))) {
      entities.partnerId = activeEntities.partnerId;
      entities.partnerName = entities.partnerName || activeEntities.partnerName;
    }

    // Resolve carryover warehouse
    if (!entities.warehouseCode && activeEntities.warehouseCode) {
      if (cleanLower.includes('the other warehouse') || cleanLower.includes('other facility')) {
        entities.warehouseCode = activeEntities.warehouseCode.toUpperCase() === 'EWR1' ? 'ONT1' : 'EWR1';
      } else if (cleanLower.includes('there') || cleanLower.includes('that facility')) {
        entities.warehouseCode = activeEntities.warehouseCode;
      }
    }

    let classification: QueryClassification = [
      'RAG_ONLY',
      'SQL_ONLY',
      'HYBRID_SQL_RAG',
      'GENERAL_CONVERSATION',
      'CLARIFICATION_REQUIRED',
      'RESTRICTED_ACTION',
    ].includes(raw.classification)
      ? raw.classification
      : 'RAG_ONLY';

    const isMetricQuery =
      cleanLower.includes('ar aging') ||
      cleanLower.includes('overdue ar') ||
      cleanLower.includes('inventory valuation') ||
      cleanLower.includes('fifo') ||
      cleanLower.includes('receiving summary') ||
      cleanLower.includes('dock to stock') ||
      cleanLower.includes('packages received') ||
      cleanLower.includes('package counts') ||
      cleanLower.includes('aged debtor') ||
      cleanLower.includes('61-90') ||
      cleanLower.includes('units received');

    const isKnowledgeQuery =
      cleanLower.includes('policy') ||
      cleanLower.includes('terms') ||
      cleanLower.includes('sop') ||
      cleanLower.includes('procedure') ||
      cleanLower.includes('incident') ||
      cleanLower.includes('who is on call') ||
      cleanLower.includes('glossary') ||
      cleanLower.includes('rules for') ||
      cleanLower.includes('guidelines') ||
      cleanLower.includes('sla');

    if (isMetricQuery && isKnowledgeQuery) {
      classification = 'HYBRID_SQL_RAG';
    } else if (isMetricQuery && classification !== 'HYBRID_SQL_RAG') {
      classification = 'SQL_ONLY';
    }

    const retrievalQueries: string[] = Array.isArray(raw.retrievalQueries) && raw.retrievalQueries.length > 0
      ? raw.retrievalQueries
      : [originalQuery];

    // Determine execution plan
    const needsSql = classification === 'SQL_ONLY' || classification === 'HYBRID_SQL_RAG';
    const needsRag = classification === 'RAG_ONLY' || classification === 'HYBRID_SQL_RAG';

    let sqlTool = raw.executionPlan?.sqlTool;
    let sqlParams = raw.executionPlan?.sqlParams || {};

    if (needsSql && !sqlTool) {
      if (entities.partnerId || cleanLower.includes('ar') || cleanLower.includes('credit') || cleanLower.includes('overdue')) {
        sqlTool = 'get_partner_ar_aging';
        sqlParams = { partner_id: entities.partnerId || '301' };
      } else if (cleanLower.includes('package') || cleanLower.includes('receiving') || cleanLower.includes('dock') || entities.warehouseCode) {
        sqlTool = 'get_dock_receiving_summary';
        sqlParams = { warehouse_code: entities.warehouseCode || 'EWR1' };
      } else if (cleanLower.includes('inventory') || cleanLower.includes('fifo') || cleanLower.includes('valuation')) {
        sqlTool = 'get_inventory_valuation';
        sqlParams = {};
      } else {
        sqlTool = 'get_business_metric';
        sqlParams = { metric_id: 'DAILY_PACKAGES_RECEIVED' };
      }
    }

    return {
      businessObjective: raw.businessObjective || 'Operational inquiry investigation',
      businessDomain: raw.businessDomain || 'SUPPLY_CHAIN',
      intent: raw.intent || 'INFORMATION_RETRIEVAL',
      classification,
      entities,
      resolvedQuery: raw.resolvedQuery || originalQuery,
      contextualReferences: {
        pronounsResolved: raw.contextualReferences?.pronounsResolved || [],
        previousContextApplied: Boolean(raw.contextualReferences?.previousContextApplied || activeEntities.partnerId),
      },
      retrievalQueries,
      executionPlan: {
        needsSql,
        sqlTool,
        sqlParams,
        needsRag,
        ragTopK: raw.executionPlan?.ragTopK || 4,
        clarificationRequired: Boolean(raw.executionPlan?.clarificationRequired),
        clarificationPrompt: raw.executionPlan?.clarificationPrompt,
      },
    };
  }

  private static fallbackDeterministicAnalysis(
    query: string,
    activeEntities: EntityMemoryState
  ): QueryUnderstandingResult {
    const q = query.toLowerCase().trim();
    const entities: ExtractedEntities = {};

    for (const [key, mapping] of Object.entries(this.KNOWN_PARTNER_MAPPINGS)) {
      if (q.includes(key)) {
        entities.partnerName = mapping.name;
        entities.partnerId = mapping.id;
        break;
      }
    }

    if (!entities.partnerId && activeEntities.partnerId && (q.includes('they') || q.includes('them') || q.includes('that partner') || q.includes('miss it') || q.includes('pay tomorrow'))) {
      entities.partnerId = activeEntities.partnerId;
      entities.partnerName = activeEntities.partnerName;
    }

    if (q.includes('ewr1') || q.includes('east')) entities.warehouseCode = 'EWR1';
    if (q.includes('ont1') || q.includes('west')) entities.warehouseCode = 'ONT1';

    const isSql = q.includes('how many') || q.includes('package') || q.includes('balance') || q.includes('open ar') || q.includes('inventory valuation');
    const isRag = q.includes('policy') || q.includes('terms') || q.includes('sop') || q.includes('procedure') || q.includes('why') || q.includes('grading') || q.includes('what happens') || q.includes('miss it') || q.includes('ach');

    let classification: QueryClassification = 'RAG_ONLY';
    if (isSql && isRag) classification = 'HYBRID_SQL_RAG';
    else if (isSql) classification = 'SQL_ONLY';
    else classification = 'RAG_ONLY';

    const retrievalQueries = [query];
    if (entities.partnerName) retrievalQueries.push(`${entities.partnerName} credit terms payment policy`);
    if (entities.warehouseCode) retrievalQueries.push(`${entities.warehouseCode} warehouse dock receiving standard operating procedure`);

    let sqlTool = 'get_business_metric';
    let sqlParams: any = {};
    if (entities.partnerId || q.includes('ar') || q.includes('credit')) {
      sqlTool = 'get_partner_ar_aging';
      sqlParams = { partner_id: entities.partnerId || '301' };
    } else if (entities.warehouseCode || q.includes('dock') || q.includes('receiving')) {
      sqlTool = 'get_dock_receiving_summary';
      sqlParams = { warehouse_code: entities.warehouseCode || 'EWR1' };
    }

    return {
      businessObjective: 'Supply chain inquiry evaluation',
      businessDomain: 'OPERATIONS',
      intent: 'QUERY_LOOKUP',
      classification,
      entities,
      resolvedQuery: query,
      contextualReferences: {
        pronounsResolved: entities.partnerName ? [`they -> ${entities.partnerName}`] : [],
        previousContextApplied: Boolean(activeEntities.partnerId),
      },
      retrievalQueries,
      executionPlan: {
        needsSql: classification === 'SQL_ONLY' || classification === 'HYBRID_SQL_RAG',
        sqlTool,
        sqlParams,
        needsRag: classification === 'RAG_ONLY' || classification === 'HYBRID_SQL_RAG',
        ragTopK: 4,
        clarificationRequired: false,
      },
    };
  }
}
