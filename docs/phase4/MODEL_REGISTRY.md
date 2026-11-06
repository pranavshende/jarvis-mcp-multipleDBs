# Jarvis v1 — Configurable Model Registry & Financial Cost Ledger

The Model Registry (`gateway/src/config/models_registry.yaml`) decouples application code from external LLM model identifiers, context limits, and pricing shifts.

---

## 1. Configured Tiers (Powered by Google Gemini)

```yaml
version: "1.0"
default_tier: "fast_tier"

tiers:
  fast_tier:
    description: "Low-latency deterministic intent classification, parameter extraction, and basic SOP lookups"
    primary:
      model_id: "gemini-2.5-flash"
      provider: "google"
      cost_in_per_m: 0.075
      cost_out_per_m: 0.30
      context_window: 1048576
      max_output_tokens: 8192
      supports_tools: true
      enabled: true
    fallback:
      model_id: "gemini-1.5-flash-8b"
      provider: "google"
      cost_in_per_m: 0.0375
      cost_out_per_m: 0.15
      context_window: 1048576
      max_output_tokens: 8192
      supports_tools: true
      enabled: true
    timeout_ms: 10000

  deep_tier:
    description: "Multi-step analytical synthesis, complex financial reconciliation explanations, and cross-domain reasoning"
    primary:
      model_id: "gemini-2.5-pro"
      provider: "google"
      cost_in_per_m: 1.25
      cost_out_per_m: 5.00
      context_window: 2097152
      max_output_tokens: 8192
      supports_tools: true
      enabled: true
    fallback:
      model_id: "gemini-2.5-flash"
      provider: "google"
      cost_in_per_m: 0.075
      cost_out_per_m: 0.30
      context_window: 1048576
      max_output_tokens: 8192
      supports_tools: true
      enabled: true
    timeout_ms: 30000
```

---

## 2. Dynamic Routing & Cost Calculation
- **Selection:** Simple intent classification and metric lookups default to `fast_tier` (`gemini-2.5-flash`). Multi-step financial reconciliation and incident analysis route to `deep_tier` (`gemini-2.5-pro`).
- **Cost Formula:**
  $$\text{Total Cost} = \left(\frac{\text{Input Tokens}}{1,000,000} \times \text{cost\_in\_per\_m}\right) + \left(\frac{\text{Output Tokens}}{1,000,000} \times \text{cost\_out\_per\_m}\right)$$
- **Immutable Ledger:** Every completed generation asynchronously appends a record to `jarvis_system.token_usage_ledger` with `user_id`, `corporate_email`, model name, exact token counts, and dollar cost in USD.
