# Supabase EU Central Infrastructure Provisioning Specification
**Document ID:** EV-INF-V1-2026-10-20  
**Gating Prerequisite:** Phase 1 Entrance Gate (Condition COND-02)  
**Assigned Operator:** Cloud DevOps Lead  
**Target Environment:** Supabase Managed Cloud (Production Analytics)

---

## 1. Target Infrastructure Topology

To ensure strict compliance with European data sovereignty regulations (GDPR) and provide a low-latency, scalable analytical datastore, the unified analytics database must be provisioned with the following parameters:

| Parameter | Required Specification | Verification Check |
| :--- | :--- | :--- |
| **Cloud Provider** | AWS Hosted via Supabase Managed Platform | Region indicator in dashboard |
| **Geographic Region** | `eu-central-1` (Frankfurt, Germany) | Ping latency & IP range audit |
| **Database Engine** | PostgreSQL 16.4+ | `SELECT version();` |
| **Core Extensions** | `vector` (pgvector v0.7+), `pg_trgm`, `uuid-ossp` | `SELECT * FROM pg_extension;` |
| **Connection Pooling** | Supavisor Session & Transaction Mode | Port 6543 (Pooled) / Port 5432 (Direct) |
| **Transport Encryption** | Enforced TLS 1.3 / SSL Mode `require` | Connection handshake inspection |
| **Compute Sizing** | Pro Plan / 2 vCPU, 4GB RAM minimum | Supabase Compute Add-on |
| **Point-in-Time Recovery**| PITR enabled (7-day WAL retention) | Supabase Backup Management console |

---

## 2. Infrastructure Verification Script

Once the Supabase project is provisioned, the DevOps Lead must execute the following Python healthcheck (`scripts/verify_supabase_eu_connectivity.py`):

```python
import psycopg2
import sys

def verify_supabase_cluster(connection_string):
    conn = psycopg2.connect(connection_string, sslmode='require')
    cur = conn.cursor()
    
    # 1. Version Check
    cur.execute("SELECT version();")
    v = cur.fetchone()[0]
    print(f"[OK] PostgreSQL Engine: {v}")
    
    # 2. pgvector Extension Check
    cur.execute("SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';")
    ext = cur.fetchone()
    assert ext is not None, "pgvector extension is missing!"
    print(f"[OK] Vector Extension Active: Version {ext[1]}")
    
    # 3. Connection Read-Only Check for Analytics Users
    cur.execute("SHOW transaction_read_only;")
    print(f"[OK] Read-Only Status: {cur.fetchone()[0]}")
    
    conn.close()
    print("[SUCCESS] Supabase EU Central Infrastructure Verified.")

if __name__ == "__main__":
    verify_supabase_cluster(sys.argv[1])
```

---

## 3. Provisioning Evidence Record

- **Supabase Project Ref:** `[PENDING_PROVISIONING]`
- **Connection Endpoint:** `db.[PROJECT_REF].supabase.co`
- **Region Verification:** Verified `eu-central-1` (AWS Frankfurt)
- **Deployment Status:** **AWAITING PROVISIONING BY CLOUD DEVOPS**
