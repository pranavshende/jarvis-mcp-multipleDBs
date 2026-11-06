import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { fileURLToPath } from 'url';
import { pool } from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ModelConfig {
  model_id: string;
  provider: string;
  cost_in_per_m: number;
  cost_out_per_m: number;
  context_window: number;
  max_output_tokens: number;
  supports_tools: boolean;
  enabled: boolean;
}

export interface ModelTierConfig {
  description: string;
  primary: ModelConfig;
  fallback: ModelConfig;
  timeout_ms: number;
}

export interface ModelRegistryData {
  version: string;
  default_tier: string;
  tiers: Record<string, ModelTierConfig>;
  providers?: Record<string, { env_key: string; status: string }>;
}

export interface BudgetStatus {
  department: string;
  allowed: boolean;
  isExhausted: boolean;
  warning: boolean;
  monthlySpendLimitUsd: number;
  currentUsdSpend: number;
  utilizationPct: number;
}

export class ModelRouter {
  private static registry: ModelRegistryData | null = null;

  public static loadRegistry(): ModelRegistryData {
    if (this.registry) return this.registry;

    const candidates = [
      path.resolve(__dirname, '../config/models_registry.yaml'),
      path.resolve(__dirname, '../../src/config/models_registry.yaml'),
      path.resolve(process.cwd(), 'src/config/models_registry.yaml'),
      path.resolve(process.cwd(), 'gateway/src/config/models_registry.yaml'),
      path.resolve(process.cwd(), 'server/gateway/src/config/models_registry.yaml'),
    ];

    let yamlPath = '';
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        yamlPath = p;
        break;
      }
    }

    if (!yamlPath) {
      throw new Error(`Model registry file not found across search paths: ${candidates.join(', ')}`);
    }

    const fileContent = fs.readFileSync(yamlPath, 'utf-8');
    this.registry = YAML.parse(fileContent) as ModelRegistryData;
    return this.registry;
  }

  /**
   * Determine whether a query requires FAST TIER or DEEP REASONING TIER
   */
  public static determineTier(query: string): 'fast_tier' | 'deep_tier' {
    const q = query.trim().toLowerCase();

    // Deep Reasoning Indicators
    const isDeepQuery =
      q.includes('why') ||
      q.includes('explain') ||
      q.includes('reconcil') ||
      q.includes('trend') ||
      q.includes('investigat') ||
      q.includes('briefing') ||
      q.includes('executive') ||
      q.includes('strategic') ||
      q.includes('root cause') ||
      q.includes('synthesis') ||
      q.includes('factors') ||
      q.includes('corrective action') ||
      q.includes('risk analysis');

    return isDeepQuery ? 'deep_tier' : 'fast_tier';
  }

  public static selectModel(
    tierName = 'fast_tier',
    useFallback = false
  ): { model: ModelConfig; tier: ModelTierConfig } {
    const reg = this.loadRegistry();
    const tier = reg.tiers[tierName] || reg.tiers[reg.default_tier];

    if (!tier) {
      throw new Error(`Requested model tier '${tierName}' not defined in registry.`);
    }

    const model = useFallback ? tier.fallback : tier.primary;
    if (!model.enabled) {
      // Automatic fallback if primary disabled
      return { model: tier.fallback, tier };
    }

    return { model, tier };
  }

  public static calculateCost(
    model: ModelConfig,
    inputTokens: number,
    outputTokens: number
  ): { inputCost: number; outputCost: number; totalCost: number } {
    const inputCost = (inputTokens / 1_000_000) * model.cost_in_per_m;
    const outputCost = (outputTokens / 1_000_000) * model.cost_out_per_m;
    const totalCost = inputCost + outputCost;

    return {
      inputCost: Math.round(inputCost * 1_000_000) / 1_000_000,
      outputCost: Math.round(outputCost * 1_000_000) / 1_000_000,
      totalCost: Math.round(totalCost * 1_000_000) / 1_000_000,
    };
  }

  /**
   * Verify department token & dollar spend limits
   */
  public static async checkDepartmentBudget(
    department: string,
    isSecurityAlert = false
  ): Promise<BudgetStatus> {
    // Critical security or operational alerts are NEVER blocked by discretionary budgets
    if (isSecurityAlert) {
      return {
        department,
        allowed: true,
        isExhausted: false,
        warning: false,
        monthlySpendLimitUsd: 1000.0,
        currentUsdSpend: 0,
        utilizationPct: 0,
      };
    }

    const deptNorm = (department || 'OPERATIONS').toUpperCase();
    try {
      const res = await pool.query(
        `SELECT monthly_spend_limit_usd, current_usd_spend, warning_threshold_pct, is_exhausted 
         FROM jarvis_system.department_budgets 
         WHERE department = $1;`,
        [deptNorm]
      );

      if (res.rows.length === 0) {
        // Fallback default
        return {
          department: deptNorm,
          allowed: true,
          isExhausted: false,
          warning: false,
          monthlySpendLimitUsd: 100.0,
          currentUsdSpend: 0,
          utilizationPct: 0,
        };
      }

      const row = res.rows[0];
      const limit = parseFloat(row.monthly_spend_limit_usd) || 100.0;
      const spend = parseFloat(row.current_usd_spend) || 0.0;
      const pct = Math.round((spend / limit) * 100);
      const isExhausted = spend >= limit;
      const warning = pct >= (row.warning_threshold_pct || 80);

      return {
        department: deptNorm,
        allowed: !isExhausted,
        isExhausted,
        warning,
        monthlySpendLimitUsd: limit,
        currentUsdSpend: spend,
        utilizationPct: pct,
      };
    } catch {
      return {
        department: deptNorm,
        allowed: true,
        isExhausted: false,
        warning: false,
        monthlySpendLimitUsd: 100.0,
        currentUsdSpend: 0,
        utilizationPct: 0,
      };
    }
  }

  /**
   * Record spend in token ledger and department budget
   */
  public static async recordSpend(params: {
    userId: string;
    email: string;
    department: string;
    model: string;
    provider: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    requestId: string;
    fromCache?: boolean;
    routingReason?: string;
  }): Promise<void> {
    const deptNorm = (params.department || 'OPERATIONS').toUpperCase();

    // 1. Record in token_usage_ledger
    try {
      await pool.query(
        `INSERT INTO jarvis_system.token_usage_ledger 
         (request_id, user_id, corporate_email, department, model_provider, model_name, 
          input_tokens, output_tokens, total_tokens, total_estimated_cost, from_cache, routing_reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);`,
        [
          params.requestId,
          params.userId,
          params.email,
          deptNorm,
          params.provider,
          params.model,
          params.inputTokens,
          params.outputTokens,
          params.inputTokens + params.outputTokens,
          params.costUsd,
          params.fromCache || false,
          params.routingReason || 'DIRECT',
        ]
      );
    } catch (err) {
      console.error('[SPEND_LEDGER_ERROR]', err);
    }

    // 2. Increment department budget
    try {
      await pool.query(
        `UPDATE jarvis_system.department_budgets 
         SET current_token_spend = current_token_spend + $1,
             current_usd_spend = current_usd_spend + $2,
             is_exhausted = (current_usd_spend + $2 >= monthly_spend_limit_usd),
             updated_at = NOW()
         WHERE department = $3;`,
        [params.inputTokens + params.outputTokens, params.costUsd, deptNorm]
      );
    } catch (err) {
      console.error('[DEPARTMENT_BUDGET_UPDATE_ERROR]', err);
    }
  }

  /**
   * Retrieve all department budgets
   */
  public static async getDepartmentBudgets(): Promise<any[]> {
    const res = await pool.query(
      `SELECT department, monthly_token_budget as "tokenBudget", monthly_spend_limit_usd as "spendLimitUsd",
              current_token_spend as "tokenSpend", current_usd_spend as "usdSpend",
              warning_threshold_pct as "warningThresholdPct", is_exhausted as "isExhausted",
              ROUND((current_usd_spend / NULLIF(monthly_spend_limit_usd, 0) * 100)::numeric, 1) as "utilizationPct",
              updated_at as "updatedAt"
       FROM jarvis_system.department_budgets
       ORDER BY department ASC;`
    );
    return res.rows;
  }

  public static getTiersSummary() {
    const reg = this.loadRegistry();
    return reg.tiers;
  }
}
