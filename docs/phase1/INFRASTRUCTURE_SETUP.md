# Jarvis v1 — Infrastructure Setup & Configuration Specification
**Document ID:** INF-SET-V1-2026-11-06  
**Target:** Supabase Managed Cloud PostgreSQL Cluster  
**Version:** 1.0.0-PROD  
**Status:** VERIFIED & LIVE

---

## 1. Cloud Database Architecture & Connectivity

The core data foundation for Jarvis v1 is provisioned on Supabase Managed PostgreSQL:
- **Database Engine:** PostgreSQL 17.11 on `x86_64-pc-linux-gnu` (compiled by gcc 15.2.0, 64-bit).
- **Active Extensions:** `uuid-ossp` (v1.1) and `vector` (`pgvector` v0.7+).
- **Transport Security:** Enforced TLS 1.3 / SSL Mode `require`.
- **Base Server Timezone:** Standard UTC (All analytical timezones transformed dynamically in SQL).

### Dual-Port Connection Pooling Topology
1. **Direct / Session Mode (`DIRECT_URL` - Port 5432):**
   - Dedicated connection port used strictly for DDL operations, migrations, and schema definition.
   - Bypasses transaction-level pgbouncer pooling to allow session-level table locks and extension activation.
2. **Transaction Pooler (`DATABASE_URL` - Port 6543):**
   - High-throughput connection port running via **Supavisor** with `?pgbouncer=true`.
   - Used by the Flask analytical API (`server/services/db_pool.py`) for parameterized query execution.
   - Bound by `statement_timeout = '8000ms'` and `default_transaction_read_only = 'on'`.

---

## 2. Environment Configuration & Secret Management

All credentials are strictly externalized into `.env` (which is excluded from source control via `.gitignore`):

```bash
# Example Configuration (.env.example)
DATABASE_URL="postgresql://[USER]:[PASSWORD]@[HOST]:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://[USER]:[PASSWORD]@[HOST]:5432/postgres"
PORT=5000
HOST=0.0.0.0
DB_MIN_CONN=2
DB_MAX_CONN=10
STATEMENT_TIMEOUT_MS=8000
```

---

## 3. Disaster Recovery & Backup Considerations

- **Supabase PITR (Point-in-Time Recovery):** Managed WAL archiving with a 7-day rollback window.
- **Controlled Ingestion Re-runnability:** All staging ingestion scripts use `COPY ... FROM STDIN` inside idempotent transactional blocks. If a replication cycle fails, the staging table is safely truncated and reloaded without corrupting analytical facts.
