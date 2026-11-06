# Jarvis v1 — Phase 1 Project Discovery & Implementation Blueprint
**Document ID:** DISC-PH1-V1-2026-11-06  
**Project:** Jarvis v1 Enterprise Unified Intelligence Platform  
**Client:** Meridian Supply Chain (MSC)  
**Author:** Principal Backend Engineer & Database Architect  
**Branch:** `phase-1-infrastructure-sync`  
**Status:** COMPLETE & VERIFIED BASELINE

---

## 1. Existing System Architecture Overview

Meridian Supply Chain operates high-volume, multi-facility physical supply chains specializing in trading card games (TCGs), sealed collectible merchandise, and precious metal bullion. Historically, MSC's technical ecosystem was fragmented across three isolated operational stacks with **zero shared foreign keys**:

1. **`seller_db` (Python / Django):**
   - Manages consumer member accounts (6,040 members), live buy-lists (600 active cards/sets), mail-in card submissions (4,245 submissions, 8,414 line items), ACH wallet ledger (671 transactions), and payout records (3,689 payouts).
   - Contains highly sensitive customer PII: full names, physical addresses, bank account numbers, and PayPal addresses.

2. **`wms_db` (Ruby on Rails):**
   - Manages physical warehouse operations across two facilities:
     - **Warehouse East (`FAC-01` / `EWR1`):** Breinigsville, PA (Timezone: `America/New_York`)
     - **Warehouse West (`FAC-02` / `ONT1`):** Reno, NV (Timezone: `America/Los_Angeles`)
   - Tracks 400 warehouse bins, 4,148 inbound receiving packages, 7,483 package lines, 1,441 outbound shipments, 2,859 outbound lines, and 600 catalog items identified by 12-digit standard GS1 UPCs (`wms_items.upc`).

3. **`portal_db` (Node.js / Next.js / TypeScript):**
   - Manages B2B wholesale operations for 400 wholesale retail partners.
   - Tracks 604 catalog products identified by manufacturer SKUs (`catalog_products.mfr_code`), 1,817 wholesale quotes, 4,248 quote items, 1,168 wholesale orders, 2,629 order lines, 1,147 invoices, and 5,374 market price tracking records.

---

## 2. Existing Implementation & Phase 0 Deliverable Baseline

Prior to Phase 1, Phase 0 (Discovery, Security Audit, System Contracts & Governance) established the following verified foundational assets:

| Subsystem / Directory | Verified Artifacts | Operational Baseline Established |
| :--- | :--- | :--- |
| **Project Docs**<br>`project_docs/` | • `PHASE_WISE_IMPLEMENTATION.md`<br>• `ARCHITECTURE.md`<br>• `AI_PROMPTS.md`<br>• `PERMISSIONS.md` | Enterprise 7-phase roadmap, 12-layer architecture with Streamable HTTP, 20 production prompts, and Supabase RLS policies. |
| **Audit & Governance**<br>`docs/audit/` | • `DATA_DICTIONARY_V1.md`<br>• `SCHEMA_RELATIONSHIP_REPORT.md`<br>• `SECURITY_REMEDIATION_LOG.md`<br>• `SECURITY_THREAT_MODEL.md`<br>• `ACCESS_CONTROL_MATRIX.md`<br>• `METRICS_DICTIONARY.md`<br>• `IDENTITY_RESOLUTION_SPEC.md`<br>• `DATA_GOVERNANCE_REVIEW.md` | 35 audited tables; SQL scripts revoking legacy superuser `jarvis_svc`; STRIDE threat model; 8 roles & 25 employee matrix; 15 deterministic business metrics with IANA timezones; GDPR data sovereignty review. |
| **System Contracts**<br>`contracts/` | • `canonical_crosswalk.sql`<br>• `tools.schema.json`<br>• `README.md` | DDL for `analytics.dim_product_crosswalk` (UPC <-> SKU); Draft-07 JSON Schema for MCP tools with Zod validation. |
| **Evaluation Suite**<br>`eval/` | • `baseline_eval.json` | 10 foundational test scenarios covering the 3 founder questions, role authorization limits, facility isolation, and injection defense. |
| **Forensic Scripts**<br>`scripts/` | • `audit_schema_integrity.py`<br>• `inspect_identity_joins.py`<br>• `verify_timezone_offsets.py`<br>• `verify_phase0_deliverables.py` | Automated schema introspector, join integrity checker (100% order match), and facility local timezone offset verification. |
| **Live Supabase DB**<br>`scripts/` | • `test_supabase_connection.py`<br>• `init_supabase_schemas.py`<br>• `sync_data_to_supabase.py` | Live Supabase PostgreSQL 17.11 connected via Direct (5432) and Transaction Pooler (6543); `vector` extension active; 6 schemas provisioned (`analytics`, `staging_seller`, `staging_wms`, `staging_portal`, `app`, `vector`); **67,758 rows ingested**. |

---

## 3. Available Data Sources & Inventory Verification

The complete Meridian context pack has been verified on disk (`context-bank/context-bank/`):
- **Raw SQL Dumps:** `seller_db.sql` (3.0 MB), `wms_db.sql` (1.3 MB), `portal_db.sql` (1.1 MB).
- **Relational CSV Exports:** 35 CSV files across `seller_db/`, `wms_db/`, and `portal_db/` totaling 67,758 rows.
- **REST / OpenAPI Specifications:** `seller_api.yaml` (8.8 KB), `wms_api.yaml` (1.7 KB).
- **Incident & Runbook Documentation:** 
  - `notes/eng/incidents/2026-10-12-ach-batch-rejected.md` (Explaining the NACHA R01 file formatting failure).
  - `notes/finance/ar-collections.md` (Documenting Northgate Hobby's $284k open AR).
  - `notes/eng/runbook-stock-sync.md` (Explaining sync lag risks).
  - `notes/finance/cost-definition-fifo.md` (FIFO inventory valuation rules).

---

## 4. Technology Stack & Dependencies Audit

| Component | Target Technology | Status in Environment | Action Required for Phase 1 |
| :--- | :--- | :--- | :--- |
| **Runtime Engine** | Node.js v24.11.1 / npm 11.7.0 | Installed & Active | Initialize TypeScript project & `package.json` |
| **Programming Language** | TypeScript 5.5+ | Available via npm | Configure `tsconfig.json` with strict mode |
| **Web / RPC Framework** | Fastify v4+ | Available via npm | Implement internal RPC endpoints |
| **Validation Library** | Zod v3+ | Available via npm | Validate incoming tool arguments & metric parameters |
| **Database Driver** | `pg` (node-postgres) & `psycopg2` | `pg` in npm / `psycopg2` 2.9.12 in Python | Configure connection pooling & timeouts |
| **Task Queue & Scheduler** | BullMQ + Redis / Cron Worker | Node.js event-driven or cron runner | Implement 15-minute micro-batch synchronization |
| **Cloud Analytics DB** | Supabase Managed PostgreSQL 17.11 | **ACTIVE & CONNECTED** (`kaerofuuarqchyiaavyr`) | Deploy dimensional & fact schemas |
| **Vector Extension** | `pgvector` v0.7+ | **ACTIVE ON SUPABASE** | Ready for Phase 3 embeddings |

---

## 5. Phase 0 Readiness Conditions & Current Gate Status

| Condition ID | Prerequisite Description | Required Gate Action | Current Status |
| :--- | :--- | :--- | :---: |
| **COND-01** | Revocation of legacy superuser `jarvis_svc` | DBA executes `SECURITY_REMEDIATION_LOG.md` | **READY (Verification Script Prepared)** |
| **COND-02** | Supabase PostgreSQL 16+ Infrastructure | Direct & Pooled connections verified | **OFFICIALLY CLEARED (PostgreSQL 17.11 Verified)** |
| **COND-03** | Deployment of Crosswalk DDL | `canonical_crosswalk.sql` executed | **OFFICIALLY CLEARED (`analytics` schema active)** |
| **COND-04** | Secret Segmentation | `.env` git-ignored, credentials segmented | **OFFICIALLY CLEARED (Zero hardcoded secrets)** |
| **COND-05** | Finance Baseline Written Sign-off | CFO Marcus Thorne sign-off on $7,300.86 | **PENDING FORMAL SIGNATURE** |

---

## 6. Proposed Phase 1 Implementation Sequence

Phase 1 will be implemented systematically across 13 modular milestones, keeping the repository runnable, fully tested, and committed after each step:

```
[Milestone 1: Repository & TypeScript Setup]
       |
[Milestone 2: Infrastructure & Database Configuration (config/)]
       |
[Milestone 3: Analytics Schema DDL Migrations (database/migrations/)]
       |
[Milestone 4: Historical Bulk Data Ingestion Engine (services/etl/)]
       |
[Milestone 5: 15-Minute Incremental Sync & Reconciliation Worker]
       |
[Milestone 6: Canonical Product Crosswalk Engine (services/identity/)]
       |
[Milestone 7: Order & Entity Normalization Engine]
       |
[Milestone 8: Deterministic Metrics Registry (services/metrics/)]
       |
[Milestone 9: Fastify Metric Execution RPC API]
       |
[Milestone 10: Automated Test Harness (Database, ETL, Identity, Metrics)]
       |
[Milestone 11: Phase 1 Documentation Suite (docs/phase1/)]
       |
[Milestone 12: Baseline Evaluation Validation (eval/baseline_eval.json)]
       |
[Milestone 13: Phase 1 Summary & Readiness Gate Report (READY WITH CONDITIONS)]
```
