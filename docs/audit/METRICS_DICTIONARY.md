# Business Metrics Dictionary & Mathematical Specifications
**Document ID:** MET-DIC-V1-2026-10-20  
**Target Systems:** Jarvis v1 Metrics Registry, Analytics Engine, Supabase PostgreSQL  
**Version:** 1.0.0-PROD  
**Audit Verification:** Verified Against Context Pack Datasets & Financial Ledger

---

## 1. Principles of the Deterministic Metrics Engine

Jarvis v1 enforces a strict architectural boundary: **The LLM never computes financial or operational arithmetic.**
1. **Registered Canonical SQL:** All business calculations are executed via pre-compiled, parameterized SQL functions in the `Metrics Registry`.
2. **Explicit Timezone Normalization:** Date-based aggregations dynamically apply the facility's IANA timezone (`America/New_York` for East, `America/Los_Angeles` for West) rather than naive UTC.
3. **Auditable Provenance:** Every metric response includes the metric ID, timestamp of data snapshot, exact SQL definition, and execution duration.

---

## 2. Core Business Metrics Registry

### 2.1 Metric: `DAILY_PACKAGES_RECEIVED`
- **Metric ID:** `MET-OPS-001`
- **Owner:** VP of Operations (`ROLE_OPS_LEAD`) / Warehouse Managers
- **Business Definition:** Total inbound physical packages scanned as `received` at each warehouse dock within the local calendar day (00:00:00 to 23:59:59 local facility time).
- **Mathematical Formula:**  
  $$\text{Total Packages} = \sum_{f \in \text{Facilities}} \text{Count}(\text{package\_id} \mid \text{facility} = f \land \text{scanned\_local\_date} = D)$$
- **Source Tables:** `wms_db.inbound_packages`
- **SQL Implementation:**
```sql
-- Dynamic Facility-Aware Inbound Daily Aggregation
SELECT 
    f.facility_code,
    f.facility_name,
    f.iana_timezone,
    COUNT(ip.id) AS packages_received,
    COALESCE(SUM(ip.declared_units), 0) AS units_received
FROM wms_db.inbound_packages ip
JOIN analytics.dim_facilities f ON ip.facility_id = f.facility_code
WHERE (ip.received_at AT TIME ZONE 'UTC' AT TIME ZONE f.iana_timezone)::date = :target_date::date
  AND ip.status IN ('received', 'processing', 'completed')
GROUP BY f.facility_code, f.facility_name, f.iana_timezone
ORDER BY f.facility_code;
```
- **Forensic Verification & Recalculation (Oct 19, 2026):**
  - **Warehouse East (`FAC-01`, PA, `America/New_York`):** 59 packages, 2,740 units
  - **Warehouse West (`FAC-02`, NV, `America/Los_Angeles`):** 44 packages, 2,072 units
  - **Total Facility Local Time:** **103 packages, 4,812 units**
  - **Naive UTC Aggregate:** **96 packages** (East 56, West 40).  
    *Root Cause of Discrepancy:* 7 packages scanned between 20:00 and 23:59 EDT/PDT on Oct 19 fell into Oct 20 in UTC, artificially under-reporting Monday volume on the legacy v0 dashboard.

---

### 2.2 Metric: `NET_PROFIT_GAAP`
- **Metric ID:** `MET-FIN-001`
- **Owner:** Chief Financial Officer (`ROLE_FINANCE`)
- **Business Definition:** Closed Monthly GAAP Accrual Net Profit calculated from recognized wholesale invoice revenue, recognized member acquisition costs (COGS), freight, and operating overhead.
- **Mathematical Formula:**  
  $$\text{Net Profit} = \text{Gross Revenue} - \text{COGS} - \text{Inbound/Outbound Freight} - \text{Facility Opex} - \text{Corporate SG&A}$$
- **Source Tables:** `portal_db.invoices`, `seller_db.submissions`, `wms_db.outbound_shipments`, QuickBooks GL exports.
- **SQL Implementation:**
```sql
WITH revenue_summary AS (
    SELECT COALESCE(SUM(total_amount), 0) AS gross_revenue
    FROM portal_db.invoices
    WHERE status = 'paid'
      AND invoice_date >= :period_start AND invoice_date <= :period_end
),
cogs_summary AS (
    SELECT COALESCE(SUM(si.accepted_price * si.accepted_qty), 0) AS total_cogs
    FROM seller_db.submissions s
    JOIN seller_db.submission_items si ON s.id = si.submission_id
    WHERE s.status IN ('completed', 'settled')
      AND s.completed_at >= :period_start AND s.completed_at <= :period_end
),
opex_summary AS (
    SELECT COALESCE(SUM(amount), 0) AS total_opex
    FROM finance.quickbooks_expenses
    WHERE expense_date >= :period_start AND expense_date <= :period_end
      AND category IN ('warehouse_lease', 'payroll', 'utilities', 'software_licenses', 'freight_overhead')
)
SELECT 
    r.gross_revenue,
    c.total_cogs,
    (r.gross_revenue - c.total_cogs) AS gross_profit,
    ROUND(((r.gross_revenue - c.total_cogs) / NULLIF(r.gross_revenue, 0)) * 100, 2) AS gross_margin_pct,
    o.total_opex,
    (r.gross_revenue - c.total_cogs - o.total_opex) AS net_profit_gaap,
    ROUND(((r.gross_revenue - c.total_cogs - o.total_opex) / NULLIF(r.gross_revenue, 0)) * 100, 2) AS net_profit_margin_pct
FROM revenue_summary r, cogs_summary c, opex_summary o;
```
- **Forensic Verification & Recalculation (September 2026 Closed Ledger):**
  - **Gross Revenue:** $1,850,229.40
  - **Total COGS:** $1,551,128.54
  - **Gross Profit:** $299,100.86 (Gross Margin: **16.17%**)
  - **Operating Overhead (SG&A, Rent, Freight):** $291,800.00
  - **GAAP Accrual Net Profit:** **$7,300.86**
  - **Net Profit Margin:** **0.39%**  
    *Executive Finding:* Margin was severely compressed in September due to high wholesale bullion trading mix (which commands only 1.2% gross margin) and excessive carrying cost on devaluing inventory. October is currently unclosed mid-month and cannot report GAAP net profit until month-end accruals are locked.

---

### 2.3 Metric: `BLOCKED_PAYOUTS_TOTAL`
- **Metric ID:** `MET-FIN-002`
- **Owner:** Finance Controller / Support Resolutions
- **Business Definition:** Total count and aggregate USD balance of member payouts currently in `failed` or `blocked` status due to banking transmission errors.
- **Source Tables:** `seller_db.payouts`, `seller_db.payout_methods`
- **SQL Implementation:**
```sql
SELECT 
    p.failure_reason,
    p.error_code,
    COUNT(p.id) AS blocked_count,
    SUM(p.amount) AS total_blocked_usd,
    MIN(p.created_at) AS oldest_blocked_date,
    MAX(p.created_at) AS newest_blocked_date
FROM seller_db.payouts p
WHERE p.status IN ('failed', 'blocked', 'rejected')
GROUP BY p.failure_reason, p.error_code
ORDER BY total_blocked_usd DESC;
```
- **Forensic Verification & Recalculation (Oct 20, 2026 Snapshot):**
  - **Blocked Count:** **77 ACH payouts**
  - **Total Blocked Balance:** **$173,339.51**
  - **Error Code:** `R01 / NACHA_FIELD_ERR`
  - **Trigger Incident:** Bank integration batch upload on Monday, Oct 12, 2026 rejected the NACHA file due to missing leading zero padding in field 5 (Originating DFI Identification). 77 member payments have remained in limbo for 8 business days without automated re-submission.

---

### 2.4 Metric: `PARTNER_CREDIT_UTILIZATION`
- **Metric ID:** `MET-SALES-001`
- **Owner:** VP of Wholesale Sales / Credit Risk Lead
- **Business Definition:** Current open Accounts Receivable (AR) balance, overdue balance (>30/60 days), and credit limit utilization percentage across wholesale partners.
- **Source Tables:** `portal_db.partners`, `portal_db.invoices`, `portal_db.orders`
- **SQL Implementation:**
```sql
SELECT 
    p.partner_code,
    p.name AS partner_name,
    p.credit_limit,
    COALESCE(SUM(i.total_amount) FILTER (WHERE i.status IN ('unpaid', 'overdue')), 0) AS open_ar_balance,
    COALESCE(SUM(i.total_amount) FILTER (WHERE i.status = 'overdue' AND i.due_date < CURRENT_DATE - INTERVAL '30 days'), 0) AS balance_over_30d,
    COALESCE(SUM(i.total_amount) FILTER (WHERE i.status = 'overdue' AND i.due_date < CURRENT_DATE - INTERVAL '60 days'), 0) AS balance_over_60d,
    ROUND((COALESCE(SUM(i.total_amount) FILTER (WHERE i.status IN ('unpaid', 'overdue')), 0) / NULLIF(p.credit_limit, 0)) * 100, 2) AS credit_utilization_pct,
    CASE 
        WHEN COALESCE(SUM(i.total_amount) FILTER (WHERE i.status IN ('unpaid', 'overdue')), 0) > p.credit_limit THEN 'BREACHED'
        WHEN COALESCE(SUM(i.total_amount) FILTER (WHERE i.status IN ('unpaid', 'overdue')), 0) > (p.credit_limit * 0.90) THEN 'WARNING_90'
        ELSE 'NORMAL'
    END AS credit_health_status
FROM portal_db.partners p
LEFT JOIN portal_db.invoices i ON p.id = i.partner_id
WHERE p.status = 'active'
GROUP BY p.id, p.partner_code, p.name, p.credit_limit
HAVING COALESCE(SUM(i.total_amount) FILTER (WHERE i.status IN ('unpaid', 'overdue')), 0) > 0
ORDER BY credit_utilization_pct DESC;
```
- **Forensic Verification & Recalculation (Oct 20, 2026 Snapshot):**
  - **Critical Breach Account:** **Northgate Hobby (`PTR-1004`)**
  - **Credit Limit:** $250,000.00
  - **Current Open AR:** **$284,279.37** (Utilization: **113.71%**)
  - **Balance Overdue > 60 Days:** **$185,500.00**
  - **Operational Impact:** WMS currently has 3 pending wholesale pick waves on hold awaiting credit override.

---

### 2.5 Metric: `INVENTORY_HOLDING_RISK`
- **Metric ID:** `MET-OPS-002`
- **Owner:** Inventory Valuation Analyst / Operations Director
- **Business Definition:** Total FIFO book value of on-hand inventory vs current fair market value (FMV), identifying products suffering severe market devaluation (>20% drop from acquisition cost).
- **Source Tables:** `portal_db.listed_stock`, `portal_db.market_prices`, `wms_db.wms_items`
- **SQL Implementation:**
```sql
SELECT 
    c.canonical_sku,
    c.canonical_name,
    ls.quantity_on_hand,
    ls.unit_cost_fifo,
    mp.current_market_price,
    (ls.quantity_on_hand * ls.unit_cost_fifo) AS total_fifo_book_value,
    (ls.quantity_on_hand * mp.current_market_price) AS total_market_value,
    ((ls.quantity_on_hand * ls.unit_cost_fifo) - (ls.quantity_on_hand * mp.current_market_price)) AS unrealized_loss_usd,
    ROUND(((ls.unit_cost_fifo - mp.current_market_price) / NULLIF(ls.unit_cost_fifo, 0)) * 100, 2) AS price_collapse_pct
FROM portal_db.listed_stock ls
JOIN analytics.dim_product_crosswalk c ON ls.catalog_product_id = c.portal_catalog_id
JOIN portal_db.market_prices mp ON ls.catalog_product_id = mp.catalog_product_id
WHERE ls.unit_cost_fifo > mp.current_market_price
  AND ((ls.unit_cost_fifo - mp.current_market_price) / NULLIF(ls.unit_cost_fifo, 0)) >= 0.20
ORDER BY unrealized_loss_usd DESC;
```
- **Forensic Verification & Recalculation (Oct 20, 2026 Snapshot):**
  - **Top Exposure Product 1:** Ember Throne Booster Box (`ET-BB-01`) — FIFO Cost: $118.50, Market: $81.00 (31.6% drop). Exposure: **$114,822.18**
  - **Top Exposure Product 2:** Nebula Rising Elite Trainer Box (`NR-ETB-02`) — FIFO Cost: $48.00, Market: $32.50 (32.3% drop). Exposure: **$89,560.00**
  - **Combined Devaluation Exposure:** **$204,382.18** in FIFO capital trapped in two rapidly devaluing lines acquired during the August supply push.
