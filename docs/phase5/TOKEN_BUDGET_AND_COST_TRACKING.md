# Jarvis v1 — Departmental Token Budgeting & Spend Tracking
**Phase 5: Evaluation, Reliability & Optimization**  
**Table Schema:** `jarvis_system.department_budgets`, `jarvis_system.token_usage_ledger`  
**Author:** AI Financial Operations & Corporate Governance  
**Date:** 2026-11-06  

---

## 1. Multi-Tier Departmental Budgets

To prevent runaway AI expenses, Jarvis v1 establishes hard dollar spend limits and token budgets per corporate department:

| Department | Monthly Token Budget | Monthly Spend Limit | Warning Threshold | Status |
|---|---|---|---|---|
| **OPERATIONS** | 10,000,000 | $100.00 | 80% ($80.00) | ACTIVE |
| **FINANCE** | 15,000,000 | $150.00 | 80% ($120.00) | ACTIVE |
| **SALES** | 8,000,000 | $80.00 | 80% ($64.00) | ACTIVE |
| **EXECUTIVE** | 20,000,000 | $200.00 | 80% ($160.00) | ACTIVE |

---

## 2. Spend Tracking & Cost Accounting Protocol

Every model execution triggers an atomic write to `jarvis_system.token_usage_ledger` recording:
- `user_id` & `corporate_email`
- `department`
- `model_provider` & `model_name`
- `input_tokens` & `output_tokens`
- `total_estimated_cost` (calculated dynamically using registry pricing)
- `from_cache` (boolean flag)
- `routing_reason` (e.g. `FAST_TIER_METRIC`, `DEEP_TIER_SYNTHESIS`)

Simultaneously, `jarvis_system.department_budgets` updates `current_usd_spend` and `current_token_spend`.

---

## 3. Non-Blockable Critical Safety Exception

**Strict Rule:** Discretionary conversational questions and exploratory queries may be throttled or rejected when a department exhausts its budget (`is_exhausted = true`). However, **critical operational alerts, dock emergency escalations, and security anomaly detections are NEVER blocked** by budget exhaustion.

