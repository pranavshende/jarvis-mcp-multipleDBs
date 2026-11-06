# Jarvis v1 — Deterministic Rules Engine Documentation

## 1. Design Principles

The Jarvis Rules Engine executes deterministic operational queries against Meridian's operational and analytical data. All rules follow strict operational guidelines:
- Zero LLM hallucination: alert triggers and financial exposures are computed with mathematical precision.
- Idempotent and non-destructive: rules perform read-only evaluations.
- Real-time deduplication: repeated runs emit deduplicated events to prevent alert floods.

---

## 2. Rule Specifications

### 2.1 ACH Payout Failure Monitor (`ACHPayoutMonitor`)
- **Module**: `server/services/rules/ach_payout_monitor.py`
- **Schedule**: Every 15 minutes (`*/15 * * * *`)
- **Target Schema**: `staging_seller.payouts`
- **Condition**: Payouts with `status IN ('failed', 'on_hold')`.
- **Live Ground Truth**:
  - Total blocked payouts: **77**
  - Total blocked amount: **\$173,339.51**
  - Failed: 9 payouts (\$19,641.44)
  - On-Hold: 68 payouts (\$153,698.07)
  - Root Cause: NACHA R01 account/routing formatting mismatch on Oct 12 batch.
- **Alert Type**: `ACH_PAYOUT_FAILURE` (Severity: `CRITICAL`)

---

### 2.2 Partner Credit Breach Monitor (`PartnerCreditMonitor`)
- **Module**: `server/services/rules/partner_credit_monitor.py`
- **Schedule**: Hourly (`0 * * * *`)
- **Target Schema**: `analytics.mv_partner_ar_aging`
- **Condition**: `credit_utilization_pct > 100` OR `credit_status = 'BREACHED'`.
- **Live Ground Truth**:
  - Target Partner: **Partner 301 (Northgate Hobby Distributors)**
  - Credit Limit: **\$250,000.00**
  - Total Open AR: **\$284,279.37**
  - Credit Utilization: **113.71% (BREACHED)**
  - Severely Overdue (>60 Days): **\$26,475.94** across 26 open invoices.
- **Action Generated**: Prepares proposal for `ACTION_CREDIT_HOLD`.
- **Alert Type**: `PARTNER_CREDIT_BREACH` (Severity: `CRITICAL`)

---

### 2.3 Inventory Price Inversion Monitor (`InventoryInversionMonitor`)
- **Module**: `server/services/rules/inventory_inversion_monitor.py`
- **Schedule**: Daily (`0 0 * * *`)
- **Target Schema**: `analytics.dim_products`, `analytics.fact_cost_layers`, `staging_portal.market_prices`
- **Condition**: FIFO lot unit cost (`unit_cost_fifo`) > catalog list price (`list_price`) OR median market price.
- **Live Ground Truth**:
  - Market Price Records Evaluated: **5,374 records**
  - Inverted Lots Found: **0** (Valuations healthy across active inventory).
- **Alert Type**: `INVENTORY_PRICE_INVERSION` (Severity: `WARNING` / `CRITICAL`)
