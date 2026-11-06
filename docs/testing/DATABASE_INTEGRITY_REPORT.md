# Jarvis v1 — Database & Data Integrity Audit Report
## Phase 3: PostgreSQL Schema, Financial Exactness & Constraint Verification

**Audit Date:** November 6, 2026  
**Auditor:** Principal Backend Architect & Database Administrator  
**Execution Script:** [`scripts/test_phase3_db_integrity.py`](file:///d:/eigi.ai/scripts/test_phase3_db_integrity.py)  
**Database Engine:** Supabase PostgreSQL 17.11 on x86_64-pc-linux-gnu (Compiled by GCC 15.2.0, 64-bit)  
**Status:** **9 / 9 TESTS PASSED (100.0%)**

---

## 1. Schema Topology & Table Inventory

The live PostgreSQL database contains 5 core operational schemas and 3 staging micro-batch schemas:
1. **`public`**: Contains core extensions including `pgvector` v0.8.2.
2. **`analytics`**: The star schema housing 14 dimensional and fact tables:
   - Dimensions: `dim_facilities`, `dim_members`, `dim_partners`, `dim_product_crosswalk`, `dim_products`, `dim_warehouses`
   - Facts: `fact_cost_layers`, `fact_dock_receipts`, `fact_inspections`, `fact_invoices`, `fact_orders`, `fact_payouts`
   - Audit/Lookup: `reconciliation_logs`, `v_scanner_product_lookup`
3. **`jarvis_alerts`**: Incident life-cycle and deduplication:
   - `alert_definitions`, `alert_feedback`, `alert_history`, `alert_snoozes`
4. **`jarvis_memory`**: Three-tier memory governance and pgvector chunk embeddings:
   - `document_chunks`, `knowledge_sources`, `memory_approvals`, `memory_facts`, `session_candidates`
5. **`jarvis_system`**: Platform control plane and cross-cutting ledgers:
   - `action_audit_ledger`, `api_tokens`, `audit_logs`, `department_budgets`, `dlq_audit_log`, `evaluation_results`, `evaluation_runs`, `semantic_cache`, `token_usage_ledger`, `user_preferences`
6. **Staging Schemas**: `staging_portal` (16 tables), `staging_seller` (10 tables), `staging_wms` (9 tables) storing 67,758 raw replicated rows.

---

## 2. Financial Precision & Exact Match Audit

Financial numbers were verified by executing SQL aggregate formulas and comparing against mathematical invariants:

### 2.1. Accounts Receivable (AR) Invariant
- **Formula**:
  $$\text{Total Open AR} = \sum(\text{Bucket}_{1\text{--}30}) + \sum(\text{Bucket}_{31\text{--}60}) + \sum(\text{Bucket}_{61\text{--}90}) + \sum(\text{Bucket}_{>90})$$
- **Database Query Result**:
  - Open Invoices: 270 ($1,342,586.79)
  - Overdue Invoices: 53 ($346,086.60)
  - Paid Invoices: 824 ($0.00 open balance)
  - **Total Open AR**: **$1,688,673.39**
  - **Sum of Aging Buckets**: **$1,688,673.39**
  - **Delta**: **$0.00** (Exact mathematical match)

### 2.2. FIFO Inventory Valuation
- **Formula**:
  $$\text{Total Valuation} = \sum(\text{qty\_on\_hand} \times \text{unit\_cost\_fifo})$$
- **Database Query Result**:
  - Total Active Bins: 1,061 bins with positive quantity
  - Total Valuation: **$8,117,870.16**
  - Data Type: Standard PostgreSQL `NUMERIC` avoiding floating point IEEE 754 precision errors.

### 2.3. Facility Timezone Boundaries
Warehouse receiving operates under local facility calendars:
- **EWR1**: `America/New_York` (UTC-5 / UTC-4 EDT)
- **ONT1**: `America/Los_Angeles` (UTC-8 / UTC-7 PDT)
- Verified that daily receiving packages and dock receipts reconcile by facility local date rather than naive UTC timestamps, preventing cross-midnight receipt distortions.

---

## 3. Transaction Isolation, Rollback & Statement Timeouts

1. **Transaction Rollback Test**:
   - An insert into `jarvis_system.audit_logs` within an active transaction followed by a forced `conn.rollback()` was verified to leave zero uncommitted state in the database.
2. **Statement Timeout**:
   - Active database timeout verified at **8,000 ms** (`8s`). Long-running runaway queries are automatically terminated by the PostgreSQL server before exhausting connection pool threads.
