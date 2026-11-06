# Jarvis v1 — Database Architecture & Schema Topology
**Document ID:** DB-ARCH-V1-2026-11-06  
**Schema Namespace:** `staging_seller`, `staging_wms`, `staging_portal`, `analytics`, `app`, `vector`  
**Classification:** DATA ARCHITECTURE SPECIFICATION  
**Status:** DEPLOYED & LIVE

---

## 1. Six-Schema Topology Overview

To prevent data silos while ensuring clean data lineage and security boundaries, Jarvis v1 uses **one single PostgreSQL database** partitioned into 6 schemas:

```
postgres (Database)
├── staging_seller/           <-- Raw sanitized replication from seller_db (10 tables, 29,864 rows)
├── staging_wms/              <-- Raw replication from wms_db (9 tables, 18,054 rows)
├── staging_portal/           <-- Raw replication from portal_db (16 tables, 19,840 rows)
├── analytics/                <-- Reconciled Star Schema (Dimensions, Facts, MVs)
├── app/                      <-- Jarvis application state (Audit logs, Alert rules, Actions)
└── vector/                   <-- pgvector 1536-dim document embeddings for RAG
```

---

## 2. Analytics Star Schema Model

### Dimensional Tables (`analytics`)
- **`dim_members` (6,040 rows):** Sanitized retail card sellers from `staging_seller.members`. Email is pseudonymized via `sha256(email + salt)`. Zero banking or Tax ID columns.
- **`dim_partners` (400 rows):** Wholesale B2B retail partner organizations from `staging_portal.partners`, including credit limits and payment terms.
- **`dim_warehouses` (2 rows):** Operational fulfillment facilities (`EWR1` / `ONT1`) mapped to IANA timezones (`America/New_York` and `America/Los_Angeles`).
- **`dim_products` (600 rows):** Canonical product dimension cross-referencing WMS 12-digit barcodes with Portal manufacturer SKUs.
- **`dim_product_crosswalk` (600 rows):** Crosswalk mapping table with confidence scores and quarantine flags.

### Fact Tables (`analytics`)
- **`fact_dock_receipts` (4,148 rows):** Inbound shipments received at warehouse docks with arrival timestamps and carrier tracking numbers.
- **`fact_inspections` (7,483 rows):** Receiving line inspection results with accepted, passed, and damaged quantities.
- **`fact_orders` (1,168 rows):** Wholesale sales orders with total amount and normalized order reference (`s/[^A-Za-z0-9]//g`).
- **`fact_invoices` (1,147 rows):** Invoiced receivables, due dates, payments, open balances, and overdue days.
- **`fact_payouts` (3,689 rows):** Seller ACH and PayPal payouts, including failure reasons and batch identifiers.
- **`fact_cost_layers` (1,130 rows):** FIFO inventory valuation layers tracking physical bin locations and unit acquisition costs.

---

## 3. Materialized Views

1. **`analytics.mv_daily_receiving_summary`:** Pre-aggregated daily receiving volumes (packages and units) grouped by facility local calendar date.
2. **`analytics.mv_partner_ar_aging`:** Accounts Receivable aging buckets (Current, 1-30d, 31-60d, >60d) and credit breach status.
3. **`analytics.mv_fifo_inventory_valuation`:** Comprehensive on-hand inventory book valuation ($8,117,870.16 across 18,854 units).
