import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { fileURLToPath } from 'url';

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

  public static getTiersSummary() {
    const reg = this.loadRegistry();
    return reg.tiers;
  }
}
