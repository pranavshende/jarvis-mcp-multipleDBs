# Jarvis v1 — Deterministic Metrics Engine Documentation
**Document ID:** MET-DOC-V1-2026-11-06  
**Implementation:** `server/services/metrics_engine.py` (Flask RPC Endpoint `/api/metrics/execute`)  
**Status:** VERIFIED & LIVE

---

## 1. Architectural Philosophy

> *"The LLM never computes financial or operational arithmetic."*

All calculations are executed by pre-compiled parameterized SQL against Supabase PostgreSQL. The LLM only formats and explains verified numbers.

---

## 2. Implemented Business Metrics Catalog (15 Metrics)

| Metric ID | Category | Business Definition | Reporting Timezone | Provenance Source |
| :--- | :--- | :--- | :--- | :--- |
| `DAILY_PACKAGES_RECEIVED` | Operations | Inbound packages scanned by facility local operating date | `America/New_York` & `America/Los_Angeles` | `staging_wms.inbound_packages` |
| `DAILY_UNITS_RECEIVED` | Operations | Physical units inspected on receiving dock | Local Facility Time | `staging_wms.package_lines` |
| `WAREHOUSE_RECEIVING_SUMMARY`| Operations | Timezone variance comparison (Local vs UTC) | Dynamic IANA | `staging_wms.warehouses` |
| `PARTNER_AR_TOTAL` | Finance | Total open wholesale accounts receivable | Standard UTC | `staging_portal.invoices` |
| `PARTNER_AR_AGING` | Finance | Overdue AR aging buckets (Current, 1-30d, 31-60d, >60d)| Standard UTC | `staging_portal.invoices` |
| `PARTNER_CREDIT_UTILIZATION` | Credit Risk| Partner credit utilization and breach detection | Standard UTC | `staging_portal.partners` |
| `MONTHLY_REVENUE` | Finance | Recognized wholesale revenue for target month | Standard UTC | `staging_portal.invoices` |
| `FIFO_COGS` | Finance | FIFO acquisition cost of goods sold | Standard UTC | `staging_seller.submissions` |
| `GROSS_PROFIT` | Finance | Recognized revenue minus recognized COGS | Standard UTC | Portal Invoices + Seller Submissions |
| `GROSS_MARGIN_PCT` | Finance | Gross profit as a percentage of revenue | Standard UTC | Closed Ledger Calculation |
| `GAAP_NET_INCOME` | Finance | Final GAAP Accrual Net Profit (accounting for $291.8k OPEX)| Closed Month Ledger | Invoices + Submissions + Fixed OPEX |
| `NET_MARGIN_PCT` | Finance | Net GAAP profit margin percentage | Closed Month Ledger | September Closed: 0.39% |
| `INVENTORY_FIFO_VALUATION` | Inventory | Total on-hand book valuation across bins | Standard UTC | `stock_levels` + `wms_items` |
| `INVENTORY_MARKET_COMPARISON`| Inventory | Inventory book value vs fair market value drops | Standard UTC | Stock Levels + Market Prices |
| `PAYOUT_STATUS_SUMMARY` | Finance | Member payout status breakdown & NACHA errors | Standard UTC | `staging_seller.payouts` |

---

## 3. Verified Calculations: The Three Founder Questions

1. **Packages Received Yesterday (Oct 19, 2026):** Local facility time records **46 packages (East 35, West 11)**, whereas naive UTC reports **96 packages** because late-evening shifts were misattributed to Oct 20.
2. **Making Money:** September Closed GAAP Net Profit was **$7,300.86 (0.39% margin)** on $1.85M revenue due to thin bullion margins (~10% mix, 1.2% margin) and $291.8k fixed overhead. October is currently **UNCLOSED MID-MONTH**.
3. **Top Worries Today:** **77 blocked ACH member payouts ($173,339.51)** from Oct 12 NACHA R01 file format error, and **Northgate Hobby credit breach** ($284,279.37 open AR, 113.7% utilization).
