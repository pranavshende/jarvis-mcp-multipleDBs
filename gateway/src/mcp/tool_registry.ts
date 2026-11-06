import { z } from 'zod';
import { UserContext } from '../security/request_context.js';
import { RBACService } from '../auth/rbac.js';
import { FlaskClient } from '../integrations/flask_client.js';
import { AuditService } from '../audit/audit_service.js';
import { PromptGuard } from '../security/prompt_guard.js';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodObject<any>;
  handler: (args: any, user: UserContext) => Promise<any>;
}

export class ToolRegistry {
  private static tools: Map<string, ToolDefinition> = new Map();

  public static registerTool(tool: ToolDefinition) {
    this.tools.set(tool.name, tool);
  }

  public static getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  public static listTools(user?: UserContext): Array<{ name: string; description: string; inputSchema: any }> {
    const list: Array<{ name: string; description: string; inputSchema: any }> = [];
    for (const [name, tool] of this.tools.entries()) {
      if (user) {
        const access = RBACService.canAccessTool(user, name);
        if (!access.allowed) continue;
      }
      list.push({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      });
    }
    return list;
  }

  public static async executeTool(toolName: string, rawArgs: any, user: UserContext): Promise<any> {
    const startTime = performance.now();
    const tool = this.getTool(toolName);

    if (!tool) {
      await AuditService.logRequest({
        user,
        toolName,
        status: 'DENIED',
        latencyMs: performance.now() - startTime,
        errorMessage: `Unknown tool '${toolName}'`,
      });
      return { isError: true, content: [{ type: 'text', text: `Error: Tool '${toolName}' not found.` }] };
    }

    // RBAC Check
    const rbac = RBACService.canAccessTool(user, toolName);
    if (!rbac.allowed) {
      await AuditService.logRequest({
        user,
        toolName,
        status: 'DENIED',
        latencyMs: performance.now() - startTime,
        errorMessage: rbac.reason,
      });
      return { isError: true, content: [{ type: 'text', text: `Access Denied: ${rbac.reason}` }] };
    }

    // Input Validation via Zod
    const parsed = tool.inputSchema.safeParse(rawArgs);
    if (!parsed.success) {
      const err = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
      await AuditService.logRequest({
        user,
        toolName,
        status: 'ERROR',
        latencyMs: performance.now() - startTime,
        errorMessage: `Validation failed: ${err}`,
      });
      return { isError: true, content: [{ type: 'text', text: `Argument Validation Error: ${err}` }] };
    }

    // Prompt Injection Check on string arguments
    for (const [k, v] of Object.entries(parsed.data)) {
      if (typeof v === 'string') {
        const guard = PromptGuard.inspectInput(v);
        if (!guard.isSafe) {
          await AuditService.logRequest({
            user,
            toolName,
            status: 'DENIED',
            latencyMs: performance.now() - startTime,
            errorMessage: `Prompt injection pattern detected: ${guard.detectedPattern}`,
          });
          return {
            isError: true,
            content: [{ type: 'text', text: `Security Rejection: Malicious delimiter or injection sequence detected in argument '${k}'.` }],
          };
        }
      }
    }

    try {
      const result = await tool.handler(parsed.data, user);
      const latencyMs = Math.round((performance.now() - startTime) * 100) / 100;

      await AuditService.logRequest({
        user,
        toolName,
        status: 'SUCCESS',
        latencyMs,
      });

      return result;
    } catch (err: any) {
      const latencyMs = Math.round((performance.now() - startTime) * 100) / 100;
      await AuditService.logRequest({
        user,
        toolName,
        status: 'ERROR',
        latencyMs,
        errorMessage: err.message,
      });
      return { isError: true, content: [{ type: 'text', text: `Execution Error in '${toolName}': ${err.message}` }] };
    }
  }
}

// ============================================================================
// REGISTER ALL STANDARD JARVIS BUSINESS TOOLS
// ============================================================================

// 1. Phase 1: get_business_metric
ToolRegistry.registerTool({
  name: 'get_business_metric',
  description: 'Retrieve certified deterministic operational metrics from Meridian Supply Chain analytics database.',
  inputSchema: z.object({
    metric_id: z.enum([
      'DAILY_PACKAGES_RECEIVED',
      'DAILY_UNITS_RECEIVED',
      'WAREHOUSE_RECEIVING_SUMMARY',
      'PARTNER_AR_TOTAL',
      'PARTNER_AR_AGING',
      'FIFO_INVENTORY_VALUATION',
      'ORDER_FULFILLMENT_CYCLE_TIME',
      'DOCK_TO_STOCK_HOURS',
      'INSPECTION_FAILURE_RATE',
      'DIRECT_MARGIN_RATE',
      'CONSIGNMENT_PAYOUT_VOLUME',
      'STORAGE_REVENUE_ACCRUED',
      'OVERDUE_INVOICE_BALANCE',
      'CROSS_FACILITY_TRANSFER_RATE',
      'RETURN_TO_VENDOR_VOLUME',
    ]),
    params: z.record(z.any()).optional().default({}),
  }),
  handler: async (args) => {
    const res = await FlaskClient.executeMetric(args.metric_id, args.params);
    if (!res.success) {
      return { isError: true, content: [{ type: 'text', text: `Metric calculation failed: ${res.error}` }] };
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(res.data, null, 2) }],
    };
  },
});

// 2. Phase 1: get_partner_ar_aging
ToolRegistry.registerTool({
  name: 'get_partner_ar_aging',
  description: 'Retrieve partner accounts receivable aging breakdown across 1-30, 31-60, 61-90, and 90+ day buckets.',
  inputSchema: z.object({
    partner_id: z.string().optional(),
  }),
  handler: async (args) => {
    const res = await FlaskClient.executeMetric('PARTNER_AR_AGING', args);
    if (!res.success) {
      return { isError: true, content: [{ type: 'text', text: `AR aging query failed: ${res.error}` }] };
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(res.data, null, 2) }],
    };
  },
});

// 3. Phase 1: get_inventory_valuation
ToolRegistry.registerTool({
  name: 'get_inventory_valuation',
  description: 'Retrieve certified FIFO inventory valuation across all Meridian warehouse facilities.',
  inputSchema: z.object({
    warehouse_id: z.string().optional(),
  }),
  handler: async (args) => {
    const res = await FlaskClient.executeMetric('FIFO_INVENTORY_VALUATION', args);
    if (!res.success) {
      return { isError: true, content: [{ type: 'text', text: `FIFO inventory query failed: ${res.error}` }] };
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(res.data, null, 2) }],
    };
  },
});

// 4. Phase 1: get_dock_receiving_summary
ToolRegistry.registerTool({
  name: 'get_dock_receiving_summary',
  description: 'Retrieve daily receiving packages, unit counts, and inspection pass/fail volumes for warehouse docks.',
  inputSchema: z.object({
    date: z.string().optional().describe('YYYY-MM-DD date'),
  }),
  handler: async (args) => {
    const res = await FlaskClient.executeMetric('WAREHOUSE_RECEIVING_SUMMARY', args);
    if (!res.success) {
      return { isError: true, content: [{ type: 'text', text: `Receiving summary query failed: ${res.error}` }] };
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(res.data, null, 2) }],
    };
  },
});

// 5. Phase 3: search_company_knowledge
ToolRegistry.registerTool({
  name: 'search_company_knowledge',
  description: 'Execute hybrid semantic and full-text keyword retrieval across certified MSC policies, SOPs, and incidents.',
  inputSchema: z.object({
    query: z.string().min(2).describe('Operational search inquiry'),
    top_k: z.number().int().min(1).max(10).optional().default(5),
  }),
  handler: async (args, user) => {
    const res = await FlaskClient.retrieveKnowledge(args.query, args.top_k, user.role);
    if (!res.success) {
      return { isError: true, content: [{ type: 'text', text: `Knowledge retrieval failed: ${res.error}` }] };
    }

    const chunks = res.data?.chunks || res.data?.results || [];
    if (chunks.length === 0 && !res.data?.context_text) {
      return { content: [{ type: 'text', text: 'No relevant MSC company documents found for this query.' }] };
    }

    if (res.data?.context_text) {
      return { content: [{ type: 'text', text: res.data.context_text }] };
    }

    const formatted = chunks
      .map(
        (c: any, i: number) =>
          `### [${i + 1}] ${c.citation}\n${c.content}\n*(Relevance Score: ${c.rerank_score || 1.0})*\n`
      )
      .join('\n---\n\n');

    return { content: [{ type: 'text', text: formatted }] };
  },
});

// 6. Phase 3: stage_knowledge_candidate
ToolRegistry.registerTool({
  name: 'stage_knowledge_candidate',
  description: 'Stage an unverified candidate operational fact into Tier 2 knowledge governance for 3x corroboration review.',
  inputSchema: z.object({
    candidate_fact: z.string().min(10).describe('Specific operational fact to stage'),
    category: z.string().default('OPERATIONS'),
  }),
  handler: async (args, user) => {
    const res = await FlaskClient.stageCandidateFact(
      args.candidate_fact,
      user.email,
      `gateway_sess_${user.userId}`,
      args.category
    );
    if (!res.success) {
      return { isError: true, content: [{ type: 'text', text: `Failed to stage candidate: ${res.error}` }] };
    }
    return { content: [{ type: 'text', text: JSON.stringify(res.data, null, 2) }] };
  },
});

// 7. Phase 2: propose_business_action
ToolRegistry.registerTool({
  name: 'propose_business_action',
  description: 'Propose a restricted operational mutation (credit hold, quarantine, tier override). Requires human confirmation token.',
  inputSchema: z.object({
    action_type: z.enum([
      'ACTION_CREDIT_HOLD',
      'SET_PARTNER_CREDIT_HOLD',
      'RELEASE_PARTNER_CREDIT_HOLD',
      'ADJUST_INVENTORY_QUARANTINE',
      'ACTION_QUARANTINE_LOT',
      'OVERRIDE_PARTNER_TIER',
      'ACTION_TIER_OVERRIDE',
      'APPROVE_CONSIGNMENT_PAYOUT',
      'ACTION_CANCEL_PAYOUT',
    ]),
    payload: z.record(z.any()).describe('Target entity ID and mutation parameters'),
    reason: z.string().min(5).describe('Business justification for the action'),
  }),
  handler: async (args, user) => {
    let mappedType = args.action_type;
    if (mappedType === 'SET_PARTNER_CREDIT_HOLD') mappedType = 'ACTION_CREDIT_HOLD';
    if (mappedType === 'ADJUST_INVENTORY_QUARANTINE') mappedType = 'ACTION_QUARANTINE_LOT';
    if (mappedType === 'OVERRIDE_PARTNER_TIER') mappedType = 'ACTION_TIER_OVERRIDE';

    const res = await FlaskClient.proposeAction(
      mappedType,
      args.payload,
      user.email,
      user.role,
      args.reason
    );
    if (!res.success) {
      return { isError: true, content: [{ type: 'text', text: `Action proposal failed: ${res.error}` }] };
    }
    return {
      content: [
        {
          type: 'text',
          text: `Action Proposed Successfully (ID: ${res.data?.action_id || res.data?.id}).\n\nREQUIRED HUMAN CONFIRMATION:\nTo execute, run 'confirm_business_action' with token: "${res.data?.required_confirmation || res.data?.confirmation_token}"`,
        },
      ],
    };
  },
});

// 8. Phase 2: confirm_business_action
ToolRegistry.registerTool({
  name: 'confirm_business_action',
  description: 'Confirm and execute a proposed restricted business action using the single-use confirmation token.',
  inputSchema: z.object({
    action_id: z.string().uuid(),
    confirmation_token: z.string().min(3),
    idempotency_key: z.string().optional(),
  }),
  handler: async (args, user) => {
    const res = await FlaskClient.confirmAction(
      args.action_id,
      args.confirmation_token,
      user.email,
      user.role,
      args.idempotency_key
    );
    if (!res.success) {
      return { isError: true, content: [{ type: 'text', text: `Action execution rejected: ${res.error}` }] };
    }
    return {
      content: [
        {
          type: 'text',
          text: `Action Confirmed & Executed.\nLedger Record: ${JSON.stringify(res.data, null, 2)}`,
        },
      ],
    };
  },
});

// 9. Phase 2: get_active_alerts
ToolRegistry.registerTool({
  name: 'get_active_alerts',
  description: 'Retrieve active operational anomalies and alerts from the deterministic alert engine.',
  inputSchema: z.object({
    status: z.enum(['ACTIVE', 'SNOOZED', 'RESOLVED']).optional().default('ACTIVE'),
  }),
  handler: async (args) => {
    const res = await FlaskClient.getAlerts(args.status);
    if (!res.success) {
      return { isError: true, content: [{ type: 'text', text: `Alert query failed: ${res.error}` }] };
    }
    return { content: [{ type: 'text', text: JSON.stringify(res.data, null, 2) }] };
  },
});
