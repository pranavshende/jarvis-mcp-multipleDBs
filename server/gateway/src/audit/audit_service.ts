import { pool } from '../config/db.js';
import { UserContext } from '../security/request_context.js';
import { ModelConfig, ModelRouter } from '../orchestrator/model_router.js';

export class AuditService {
  public static async logRequest(params: {
    user: UserContext;
    toolName?: string;
    actionType?: string;
    querySummary?: string;
    model?: ModelConfig;
    status: 'SUCCESS' | 'DENIED' | 'ERROR' | 'CONFIRMATION_REQUIRED';
    latencyMs: number;
    errorMessage?: string;
  }): Promise<void> {
    try {
      const query = `
        INSERT INTO jarvis_system.audit_logs (
          request_id, user_id, corporate_email, role, client_type,
          query_summary, tool_name, action_type, model_provider, model_name,
          status, latency_ms, error_message
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
        );
      `;

      await pool.query(query, [
        params.user.requestId,
        params.user.userId,
        params.user.email,
        params.user.role,
        params.user.clientType,
        params.querySummary ? params.querySummary.substring(0, 500) : null,
        params.toolName || null,
        params.actionType || null,
        params.model?.provider || null,
        params.model?.model_id || null,
        params.status,
        params.latencyMs,
        params.errorMessage || null,
      ]);
    } catch (err) {
      console.error('[AUDIT_LOG_ERROR]', err);
    }
  }

  public static async recordTokenUsage(params: {
    user: UserContext;
    model: ModelConfig;
    inputTokens: number;
    outputTokens: number;
    cachedTokens?: number;
    requestStatus?: string;
  }): Promise<void> {
    try {
      const costs = ModelRouter.calculateCost(params.model, params.inputTokens, params.outputTokens);

      const query = `
        INSERT INTO jarvis_system.token_usage_ledger (
          request_id, user_id, corporate_email, model_provider, model_name,
          input_tokens, output_tokens, cached_tokens, estimated_input_cost,
          estimated_output_cost, total_estimated_cost, currency, request_status
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'USD', $12
        );
      `;

      await pool.query(query, [
        params.user.requestId,
        params.user.userId,
        params.user.email,
        params.model.provider,
        params.model.model_id,
        params.inputTokens,
        params.outputTokens,
        params.cachedTokens || 0,
        costs.inputCost,
        costs.outputCost,
        costs.totalCost,
        params.requestStatus || 'SUCCESS',
      ]);
    } catch (err) {
      console.error('[USAGE_LEDGER_ERROR]', err);
    }
  }

  public static async getUsageLedgerSummary(days = 30) {
    const query = `
      SELECT 
        corporate_email as "email",
        model_name as "modelName",
        SUM(input_tokens) as "totalInputTokens",
        SUM(output_tokens) as "totalOutputTokens",
        SUM(total_estimated_cost) as "totalCostUsd",
        COUNT(*) as "requestCount"
      FROM jarvis_system.token_usage_ledger
      WHERE created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY corporate_email, model_name
      ORDER BY "totalCostUsd" DESC;
    `;
    const res = await pool.query(query);
    return res.rows;
  }
}
