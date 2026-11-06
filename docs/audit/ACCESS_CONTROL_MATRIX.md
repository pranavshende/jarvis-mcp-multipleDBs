# Enterprise Access Control Matrix & Identity Governance
**Document ID:** SEC-ACM-V1-2026-10-20  
**Target Systems:** Jarvis v1 Orchestrator, MCP Gateway, Supabase Analytics, Slack Bot  
**Classification:** STRICTLY CONFIDENTIAL — AUDIT & HR COMPLIANCE

---

## 1. Role Definitions & Authorization Tiers

The Meridian Supply Chain organization operates across 8 standardized security roles:

| Role Identifier | Role Name | Scope / Department | Clearance Level | Employment Type |
| :--- | :--- | :--- | :--- | :--- |
| `ROLE_FOUNDER` | Executive / CEO / Co-Founder | Enterprise-wide strategic & financial | Tier 1 (Unrestricted Global) | Executive Staff |
| `ROLE_FINANCE` | CFO / Controller / Senior Accountant | Full Financial Ledger, Payouts, Audit | Tier 2 (Financial Master) | Permanent Staff |
| `ROLE_OPS_LEAD` | VP Operations / Supply Chain Director | Multi-facility WMS, Logistics, Inbound/Outbound | Tier 2 (Operational Master) | Permanent Staff |
| `ROLE_WH_MGR` | Warehouse Floor Manager (East/West) | Facility-specific inventory, bins, receiving | Tier 3 (Facility Scoped) | Permanent Staff |
| `ROLE_SUPPORT` | Customer Support Specialist | Member submissions, tickets, shipping status | Tier 4 (Customer Scoped) | Permanent Staff |
| `ROLE_SALES` | B2B Account Executive / Wholesale Rep | Assigned partner quotes, catalog, order fulfillment | Tier 4 (Partner Scoped) | Permanent Staff |
| `ROLE_CONTRACTOR` | Warehouse Temp / Logistics Contractor | Receiving package scanning, bin movement only | Tier 5 (Restricted Operational) | External Contractor |
| `ROLE_SYSTEM` | Background Sync & Alerting Daemon | Pre-scheduled ingestion & metric computation | Service Account | Automated Worker |

---

## 2. Table-Level Permission Matrix (Supabase Analytics)

| Target Table / View | FOUNDER | FINANCE | OPS_LEAD | WH_MGR | SUPPORT | SALES | CONTRACTOR | SYSTEM |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `analytics.dim_members` (Sanitized) | Full | Full | Read | Read | Read (Lookup) | None | None | Read |
| `analytics.dim_partners` | Full | Full | Full | Read | Read | Assigned Only | None | Read |
| `analytics.dim_products` (Crosswalk) | Full | Full | Full | Full | Read | Read | Read (SKU/UPC) | Read |
| `analytics.fact_orders` | Full | Full | Full | Read | Read (Status) | Assigned Only | None | Read |
| `analytics.fact_order_items` | Full | Full | Full | Read | Read (Status) | Assigned Only | None | Read |
| `analytics.fact_inbound_packages` | Full | Full | Full | Facility Only | Read (Tracking) | None | Facility Only | Read |
| `analytics.fact_submissions` | Full | Full | Full | Facility Only | Full | None | None | Read |
| `analytics.fact_payouts` (Status Only)| Full | Full | None | None | Status Only | None | None | Read |
| `analytics.fact_inventory_valuation` | Full | Full | Full | Units Only | None | None | None | Read |
| `analytics.dim_financial_gl` (QuickBooks)| Full | Full | None | None | None | None | None | Read |
| `raw_prod.members` (Direct PII) | **DENIED** | **DENIED** | **DENIED** | **DENIED** | **DENIED** | **DENIED** | **DENIED** | **DENIED** |
| `raw_prod.payout_methods` (Bank Routing)| **DENIED** | **DENIED** | **DENIED** | **DENIED** | **DENIED** | **DENIED** | **DENIED** | **DENIED** |

*Note: Direct access to production database PII and banking tables is globally DENIED to all Jarvis interfaces and analytics consumers.*

---

## 3. Tool-Level Execution Matrix (MCP Tools)

| Tool Name | FOUNDER | FINANCE | OPS_LEAD | WH_MGR | SUPPORT | SALES | CONTRACTOR |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `execute_metric(metric_id='DAILY_PACKAGES_RECEIVED')` | YES | YES | YES | Facility Only | Facility Only | NO | NO |
| `execute_metric(metric_id='NET_PROFIT_GAAP')` | YES | YES | NO | NO | NO | NO | NO |
| `execute_metric(metric_id='BLOCKED_PAYOUTS_TOTAL')` | YES | YES | NO | NO | NO | NO | NO |
| `execute_metric(metric_id='PARTNER_CREDIT_UTILIZATION')`| YES | YES | YES | NO | NO | Assigned Only | NO |
| `execute_metric(metric_id='INVENTORY_HOLDING_RISK')` | YES | YES | YES | Units Only | NO | NO | NO |
| `search_company_knowledge(query, scope='ALL')` | YES | YES | YES | NO | NO | NO | NO |
| `search_company_knowledge(query, scope='SOP_PUBLIC')` | YES | YES | YES | YES | YES | YES | YES |
| `get_active_alerts()` | All | Financial | Operational | Facility | Ticket Alerts | Sales Alerts | None |
| `request_action_execution(action='OVERRIDE_CREDIT')` | YES | YES | NO | NO | NO | NO | NO |
| `request_action_execution(action='UNBLOCK_PAYOUT')` | YES | Dual-Sign | NO | NO | NO | NO | NO |

---

## 4. Meridian Personnel Roster & Role Mapping (25 Employees)

The following 25 personnel from Meridian Supply Chain's active roster are mapped to their validated security roles:

| Employee ID | Name | Official Job Title | Department | Assigned Role | Contractor Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `EMP-001` | David Vance | Chief Executive Officer & Co-Founder | Executive | `ROLE_FOUNDER` | Regular Staff |
| `EMP-002` | Elena Rostova | Chief Technology Officer & Co-Founder| Executive | `ROLE_FOUNDER` | Regular Staff |
| `EMP-003` | Marcus Thorne | Chief Financial Officer | Finance | `ROLE_FINANCE` | Regular Staff |
| `EMP-004` | Sarah Lin | Senior Corporate Controller | Finance | `ROLE_FINANCE` | Regular Staff |
| `EMP-005` | Arthur Pendelton | Lead Financial Auditor | Finance | `ROLE_FINANCE` | Regular Staff |
| `EMP-006` | Rachel Zhang | VP of Global Operations | Operations | `ROLE_OPS_LEAD` | Regular Staff |
| `EMP-007` | Thomas Miller | Director of Logistics & Freight | Operations | `ROLE_OPS_LEAD` | Regular Staff |
| `EMP-008` | Kevin Patel | General Manager — Warehouse East (PA)| Operations | `ROLE_WH_MGR` | Regular Staff |
| `EMP-009` | Brian O'Connor | General Manager — Warehouse West (NV)| Operations | `ROLE_WH_MGR` | Regular Staff |
| `EMP-010` | Carlos Mendez | Inbound Receiving Supervisor (East) | Warehouse East | `ROLE_WH_MGR` | Regular Staff |
| `EMP-011` | Travis Scott | Outbound Logistics Supervisor (West)| Warehouse West | `ROLE_WH_MGR` | Regular Staff |
| `EMP-012` | Emily Watson | Head of Customer Experience | Support | `ROLE_SUPPORT` | Regular Staff |
| `EMP-013` | Jessica Alba | Senior Member Care Advocate | Support | `ROLE_SUPPORT` | Regular Staff |
| `EMP-014` | Michael Chang | Member Payout Resolutions Agent | Support | `ROLE_SUPPORT` | Regular Staff |
| `EMP-015` | Samantha Reed | Support Operations Specialist | Support | `ROLE_SUPPORT` | Regular Staff |
| `EMP-016` | Jonathan Blake | VP of B2B Wholesale Sales | Sales | `ROLE_SALES` | Regular Staff |
| `EMP-017` | Derek Fox | Senior Enterprise Account Executive | Sales | `ROLE_SALES` | Regular Staff |
| `EMP-018` | Chloe Bennett | B2B Partner Relations Specialist | Sales | `ROLE_SALES` | Regular Staff |
| `EMP-019` | Victor Vance | Inventory Valuation Analyst | Operations | `ROLE_OPS_LEAD` | Regular Staff |
| `EMP-020` | Hannah Abbott | Compliance & Legal Counsel | Executive | `ROLE_FOUNDER` | Regular Staff |
| `EMP-021` | Liam Davis | Warehouse Receiving Associate (East)| Warehouse East | `ROLE_CONTRACTOR` | Contractor (Temp) |
| `EMP-022` | Noah Wilson | Warehouse Inbound Scanner (East) | Warehouse East | `ROLE_CONTRACTOR` | Contractor (Temp) |
| `EMP-023` | Mason Taylor | Warehouse Pick/Pack Associate (West)| Warehouse West | `ROLE_CONTRACTOR` | Contractor (Temp) |
| `EMP-024` | Ethan Martinez | Warehouse Logistics Handler (West) | Warehouse West | `ROLE_CONTRACTOR` | Contractor (Temp) |
| `EMP-025` | Lucas Anderson | Logistics Data Entry Clerk | Operations | `ROLE_CONTRACTOR` | Contractor (Temp) |

---

## 5. Staff vs. Contractor Security Boundary Rules

1. **Zero Financial Visibility for Contractors:** Contractors (`EMP-021` through `EMP-025`) are strictly forbidden from querying purchase orders, dollar totals, unit acquisition costs, customer margins, or corporate metrics.
2. **Facility-Bounded Scoping:** Warehouse managers and contractors at Warehouse East (`FAC-01`, PA) have zero query visibility into bins, inventory, or receiving queues at Warehouse West (`FAC-02`, NV).
3. **No Direct Production DB Access:** Contractors access system interfaces solely through physical RF barcode scanners and facility-locked Jarvis Slack channels with restricted command menus.
4. **Automated Session Revocation:** Contractor API tokens expire automatically every 8 hours and require re-authentication via the facility badge management bridge.
