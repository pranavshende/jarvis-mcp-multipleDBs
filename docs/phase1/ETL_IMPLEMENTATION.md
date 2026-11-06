# Jarvis v1 — ETL Synchronization & Ingestion Specification
**Document ID:** ETL-IMP-V1-2026-11-06  
**Pipeline:** CSV Snapshot Extraction & 15-Minute Micro-Batch Synchronization  
**Status:** VERIFIED & LIVE

---

## 1. Historical Data Ingestion Results

The initial historical bulk load was executed against the sanitized context pack datasets, successfully ingesting **67,758 rows across all 35 operational tables**:

| Database Subsystem | Schema Name | Table Count | Total Rows Ingested |
| :--- | :--- | :---: | :---: |
| **Seller System** (`seller_db`) | `staging_seller` | 10 | 29,864 rows |
| **Warehouse System** (`wms_db`) | `staging_wms` | 9 | 18,054 rows |
| **Wholesale Portal** (`portal_db`) | `staging_portal` | 16 | 19,840 rows |
| **Total Synchronized Datastore** | | **35 Tables** | **67,758 Rows** |

---

## 2. Sensitive Data Exclusion & PII Protection

In accordance with Phase 0 data governance directives, the ingestion engine enforces strict filtering at the ingress boundary:
1. **Salted Pseudonymization:** `staging_seller.members.email` is transformed via SHA-256 with an enterprise salt: `[hash[:16]]@pseudonym.meridian`.
2. **Hard-Excluded Banking Columns:** Bank routing numbers, checking account numbers, and Tax IDs (SSN/EIN) are **never ingested**.
3. **Payment Masking:** PayPal emails in `payout_methods` are cryptographically masked.

---

## 3. Incremental Micro-Batch Synchronization Architecture

- **Polling Frequency:** 15-minute micro-batch intervals.
- **Checkpoint Tracking:** Filter on `source_updated_at >= :last_checkpoint_timestamp - INTERVAL '5 minutes'` to ensure zero dropped records across transaction boundaries.
- **Replication Lag Monitoring:** Monitored via `/api/sync/status`. If replication lag exceeds 20 minutes, an operational alert is dispatched.
