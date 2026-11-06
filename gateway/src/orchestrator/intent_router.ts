import { UserContext } from '../security/request_context.js';
import { ToolRegistry } from '../mcp/tool_registry.js';
import { ModelRouter } from './model_router.js';

export interface RouteResult {
  route: 'METRIC' | 'KNOWLEDGE' | 'DUAL_SYNTHESIS' | 'RESTRICTED_ACTION' | 'UNSUPPORTED';
  response: string;
  citations?: string[];
  toolsInvoked: string[];
  latencyMs: number;
}

export class IntentRouter {
  public static async routeAndExecute(query: string, user: UserContext): Promise<RouteResult> {
    const startTime = performance.now();
    const cleanQuery = query.trim().toLowerCase();
    const toolsInvoked: string[] = [];
    const citations: string[] = [];

    // 1. Detect Restricted Action Proposal or Confirmation
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
      cleanQuery.includes('place on credit hold') ||
      cleanQuery.includes('set credit hold') ||
      cleanQuery.includes('quarantine inventory')
    ) {
      return {
        route: 'RESTRICTED_ACTION',
        response:
          'To perform this restricted operational change, please invoke the "propose_business_action" tool. Jarvis will generate an explicit confirmation token requiring human authorization before any database update.',
        toolsInvoked: [],
        latencyMs: performance.now() - startTime,
      };
    }

    // 2. Intent Classification: Dual Synthesis vs Metric vs Knowledge
    const isMetricQuery =
      cleanQuery.includes('ar aging') ||
      cleanQuery.includes('overdue ar') ||
      cleanQuery.includes('inventory valuation') ||
      cleanQuery.includes('fifo') ||
      cleanQuery.includes('receiving summary') ||
      cleanQuery.includes('dock to stock') ||
      cleanQuery.includes('packages received') ||
      cleanQuery.includes('units received');

    const isKnowledgeQuery =
      cleanQuery.includes('policy') ||
      cleanQuery.includes('terms') ||
      cleanQuery.includes('sop') ||
      cleanQuery.includes('procedure') ||
      cleanQuery.includes('incident') ||
      cleanQuery.includes('who is on call') ||
      cleanQuery.includes('glossary') ||
      cleanQuery.includes('rules for') ||
      cleanQuery.includes('what are our');

    // PATH C: DUAL SYNTHESIS ROUTE
    if (isMetricQuery && isKnowledgeQuery) {
      // Step 1: Metric lookup
      let metricData = '';
      if (cleanQuery.includes('ar') || cleanQuery.includes('overdue')) {
        toolsInvoked.push('get_partner_ar_aging');
        const metricRes = await ToolRegistry.executeTool('get_partner_ar_aging', {}, user);
        metricData = metricRes?.content?.[0]?.text || '';
      } else {
        toolsInvoked.push('get_business_metric');
        const metricRes = await ToolRegistry.executeTool('get_business_metric', { metric_id: 'DAILY_PACKAGES_RECEIVED' }, user);
        metricData = metricRes?.content?.[0]?.text || '';
      }

      // Step 2: Knowledge lookup
      toolsInvoked.push('search_company_knowledge');
      const ragRes = await ToolRegistry.executeTool('search_company_knowledge', { query, top_k: 3 }, user);
      const ragText = ragRes?.content?.[0]?.text || '';

      const combinedResponse = `### Jarvis Dual-Synthesis Operational Response\n\n#### 1. Certified Operational Metrics (Phase 1)\n\`\`\`json\n${metricData}\n\`\`\`\n\n#### 2. Authoritative Company Policies & SOPs (Phase 3)\n${ragText}\n\n*Synthesized under Role: ${user.role} (${user.email})*`;

      return {
        route: 'DUAL_SYNTHESIS',
        response: combinedResponse,
        toolsInvoked,
        latencyMs: performance.now() - startTime,
      };
    }

    // PATH A: BUSINESS METRIC ROUTE
    if (isMetricQuery) {
      let metricId = 'DAILY_PACKAGES_RECEIVED';
      let toolName = 'get_business_metric';

      if (cleanQuery.includes('ar') || cleanQuery.includes('overdue')) {
        metricId = 'PARTNER_AR_AGING';
        toolName = 'get_partner_ar_aging';
      } else if (cleanQuery.includes('inventory') || cleanQuery.includes('fifo')) {
        metricId = 'FIFO_INVENTORY_VALUATION';
        toolName = 'get_inventory_valuation';
      } else if (cleanQuery.includes('receiving') || cleanQuery.includes('dock')) {
        metricId = 'WAREHOUSE_RECEIVING_SUMMARY';
        toolName = 'get_dock_receiving_summary';
      }

      toolsInvoked.push(toolName);
      const res = await ToolRegistry.executeTool(toolName, { metric_id: metricId }, user);
      const resultText = res?.content?.[0]?.text || 'No data returned';

      return {
        route: 'METRIC',
        response: `### Certified Business Metric Result\n\n${resultText}`,
        toolsInvoked,
        latencyMs: performance.now() - startTime,
      };
    }

    // PATH B: DOCUMENT KNOWLEDGE ROUTE
    toolsInvoked.push('search_company_knowledge');
    const ragRes = await ToolRegistry.executeTool('search_company_knowledge', { query, top_k: 5 }, user);
    const ragText = ragRes?.content?.[0]?.text || 'No matching MSC knowledge found.';

    return {
      route: 'KNOWLEDGE',
      response: `### Meridian Company Knowledge Base\n\n${ragText}`,
      toolsInvoked,
      latencyMs: performance.now() - startTime,
    };
  }
}
