# Jarvis v1 — Testing Discovery Report
## Phase 0: System Architecture & Repository Exploration

**Audit Date:** November 6, 2026  
**Auditor:** Principal QA Automation Engineer & Enterprise Software Auditor  
**Scope:** Complete repository inspection, dependency discovery, route registry, service modules, test inventories, and architectural risk assessment.

---

## 1. Actual System Architecture

The Jarvis v1 platform implements a decoupled, event-driven enterprise architecture designed for Meridian Supply Chain (MSC):

```
+-----------------------------------------------------------------------------------+
|                            CLIENT PRESENTATION LAYER                              |
|   +--------------------------+  +--------------------------+  +-----------------+ |
|   |  Claude Desktop / Cursor |  |   Slack Socket App       |  |  React Web App  | |
|   |  (MCP stdio transport)   |  |   (WebSocket transport)  |  |  (Port 3001)    | |
|   +------------+-------------+  +------------+-------------+  +--------+--------+ |
+----------------|-----------------------------|-------------------------|----------+
                 |                             |                         |
                 v                             v                         v
+-----------------------------------------------------------------------------------+
|                     FASTIFY GATEWAY CONTROL PLANE (Port 4000)                    |
|   - Authentication & RBAC (Bearer token validation, identity contexts)            |
|   - Multi-Transport Protocol Hub (MCP Streamable HTTP & stdio)                    |
|   - Security Guardrail Engine (15-vector regex & Base64 auto-decoding)            |
|   - Composite Semantic Cache (Redis/Memory L1 + Postgres L2 persistence)          |
|   - Intent Orchestrator (Metric, Knowledge, and Dual-Synthesis routing)          |
|   - Dynamic Model Router (Fast Tier vs. Deep Reasoning Tier + Budget caps)        |
|   - BullMQ DLQ Failure Recovery (3 exponential retries + Circuit breaker)         |
|   - Audit Logging (Immutable append-only ledger in jarvis_system.audit_logs)      |
+------------------------------------+----------------------------------------------+
                                     |
                +--------------------+--------------------+
                |                                         |
                v                                         v
+-------------------------------+       +-------------------------------------------+
|  FLASK BACKEND (Port 5000)    |       |   SUPABASE POSTGRESQL 17.11 (Port 6543)   |
|  - Deterministic SQL Metrics  |       |   - analytics (Star Schema)               |
|  - Entity Crosswalk Engine    |       |   - alerts (Alert deduplication)          |
|  - 15-min ETL Watermarks      |       |   - actions (Restricted business actions) |
|  - Rule Monitors (ACH, Credit)|       |   - knowledge (pgvector v0.8.2)           |
|  - Statistical Anomaly Engine |       |   - jarvis_system (Platform governance)   |
|  - RAG Context & Citations    |       +-------------------------------------------+
|  - 3-Tier Memory Governance   |
+-------------------------------+
```

---

## 2. Service Inventory & Runtime Dependencies

| Service | Technology | Runtime Port | Primary Dependencies | Status |
|---|---|---|---|---|
| **React Client** | React 18, Vite 5 | `3001` | Gateway API (`:4000`), Flask (`:5000`) | Operational |
| **Fastify Gateway** | Node.js 22, TypeScript 5.7 | `4000` | PostgreSQL 17.11, Flask (`:5000`), Redis | Operational |
| **Flask Backend** | Python 3.11, Flask 3.0 | `5000` | PostgreSQL 17.11 (`psycopg2`), pgvector | Operational |
| **Database** | Supabase PostgreSQL 17.11 | `6543` (Pooler) | `aws-0-ap-south-1.pooler.supabase.com` | Operational |
| **In-Memory Cache**| Node memory Map + Redis client | Local / 6379 | In-memory fallback active on Windows host | Operational |

---

## 3. Discovered API Route Registrations

### 3.1. Fastify Gateway Routes (`gateway/src/server.ts` & `admin_routes.ts`)
- `GET /api/health` — Public Gateway health & database probe
- `GET /mcp/stream` — MCP Streamable HTTP session handshake
- `POST /mcp/stream` — MCP Streamable HTTP JSON-RPC execution
- `POST /api/query` — Unified conversational intent query
- `GET /api/tools` — Authenticated tool discovery
- `POST /api/tools/:name` — Direct tool invocation
- `GET /api/admin/health` — Multi-service topology health check
- `GET /api/admin/tokens` — List provisioned employee tokens
- `POST /api/admin/tokens` — Provision new employee token
- `POST /api/admin/tokens/:id/revoke` — Revoke MCP token
- `POST /api/admin/tokens/:id/rotate` — Rotate token secret
- `GET /api/admin/models` — Model registry tiers summary
- `GET /api/admin/models/spend` — Spend ledger query
- `GET /api/admin/models/budgets` — Departmental spending caps
- `GET /api/admin/models/usage` — Grouped token usage ledger
- `GET /api/admin/evaluation/summary` — Latest CI evaluation summary
- `GET /api/admin/evaluation/runs` — Historical evaluation runs
- `GET /api/admin/evaluation/scenarios` — Detailed scenario assertion logs
- `GET /api/admin/cache/stats` — Real-time cache hit/miss statistics
- `GET /api/admin/cache/entries` — Active cache entries table
- `POST /api/admin/cache/invalidate` — Scope-based cache invalidation
- `GET /api/admin/dlq` — BullMQ dead jobs overview
- `POST /api/admin/dlq/:jobId/retry` — Idempotent DLQ job replay
- `POST /api/admin/dlq/:jobId/dismiss` — Manual DLQ job dismissal
- `GET /api/admin/security/redteam` — Prompt injection red-team scorecard
- `GET /api/admin/security/events` — Security audit logs (`DENIED`, `CONFIRMATION_REQUIRED`)
- `GET /api/admin/knowledge/candidates` — Tier-2 memory candidate facts
- `POST /api/admin/knowledge/candidates/:id/approve` — Fact promotion to Tier-3
- `POST /api/admin/knowledge/candidates/:id/reject` — Candidate fact rejection

### 3.2. Flask Backend Routes (`server/app.py` & blueprints)
- `GET /api/health/db` — Supabase PostgreSQL pool connectivity
- `GET /api/metrics/list` — List 10 certified deterministic SQL metrics
- `POST /api/metrics/execute` — Execute deterministic analytical metric query
- `GET /api/crosswalk/stats` — Crosswalk mapping counts
- `GET /api/crosswalk/products` — Product entity crosswalk search
- `GET /api/crosswalk/order` — Multi-system canonical order resolution
- `GET /api/sync/status` — 15-minute ETL sync status and watermark
- `GET /api/reconciliation/history` — Nightly reconciliation run logs
- `POST /api/reconciliation/run` — Manual reconciliation execution
- `GET /api/alerts/summary` — Active incident counts by severity
- `GET /api/alerts` — Paginated alerts feed
- `GET /api/alerts/<id>` — Single alert detail view
- `POST /api/alerts/<id>/acknowledge` — Transition alert to ACKNOWLEDGED
- `POST /api/alerts/<id>/resolve` — Transition alert to RESOLVED
- `POST /api/alerts/<id>/snooze` — Snooze alert notifications
- `POST /api/alerts/test` — Synthetic alert emission
- `GET /api/monitoring/status` — Status of background rule monitors
- `POST /api/actions/propose` — Propose restricted operational action
- `GET /api/actions/pending` — List pending actions awaiting confirmation
- `GET /api/actions/<id>` — Action proposal details & confirmation prompt
- `POST /api/actions/<id>/execute` — Execute action with HMAC confirmation token
- `GET /api/actions/history` — Immutable action audit ledger
- `POST /api/knowledge/search` — Hybrid search (dense pgvector + sparse BM25 RRF)
- `POST /api/knowledge/retrieve` — RAG context generator with citations
- `POST /api/knowledge/ingest` — Document ingestion & quarantine pipeline
- `GET /api/knowledge/sources` — List indexed company documents
- `GET /api/knowledge/candidates` — Staged Tier-2 memory facts
- `POST /api/knowledge/candidates/<id>/approve` — Fact promotion
- `POST /api/knowledge/candidates/<id>/reject` — Fact rejection
- `GET /api/knowledge/memory` — Active approved Tier-3 memory
- `GET /api/knowledge/stats` — Ingestion & quarantine statistics

---

## 4. Database Schema Structure (6 Schemas in PostgreSQL 17.11)

1. **`public`**: System extensions (`pgvector` v0.8.2, `uuid-ossp`, `pg_trgm`).
2. **`analytics`**:
   - `dim_products`, `dim_partners`, `dim_dates`, `dim_warehouses`
   - `fact_orders`, `fact_inventory`, `fact_shipments`, `fact_payments`
   - `reconciliation_log`
3. **`alerts`**:
   - `active_alerts`, `alert_history`, `anomaly_log`
4. **`actions`**:
   - `action_audit_ledger`
5. **`knowledge`**:
   - `documents`, `chunks`, `candidate_facts`, `memory_facts`
6. **`jarvis_system`**:
   - `employee_tokens`, `audit_logs`, `token_usage_ledger`
   - `semantic_cache`, `evaluation_runs`, `evaluation_results`
   - `dlq_audit_log`, `department_budgets`

---

## 5. Duplicate Modules & Code Hygiene Findings

1. **Duplicate Directory**: `server/gateway` contains a snapshot of `gateway`. The canonical Gateway source is in `gateway/`. To prevent confusion during builds, changes must always be authored in `gateway/`.
2. **Environment File Distribution**: `.env` was located in `server/.env` and `gateway/.env`, while the root directory lacked `.env`. Root `.env` has now been synchronized.
3. **Redis Dependency Isolation**: The local Windows development environment does not run a native Redis service. The Gateway handles this gracefully by utilizing an in-memory L1 cache Map with full sub-100ms SLA, backed by PostgreSQL L2 persistence.

---

## 6. Testing Strategy & Execution Roadmap

- **Phase 1**: Service Health, Process State & Negative Failure Probing
- **Phase 2**: Comprehensive Automated API Testing (Every single registered endpoint)
- **Phase 3**: Database & Data Integrity Auditing (Schema, Constraints, Precision)
- **Phase 4**: Security, RBAC & Privilege Escalation Auditing
- **Phase 5**: AI & Intelligence Quality Benchmarking (50 Golden Scenarios)
- **Phase 6**: Semantic Cache Invalidation & Isolation Auditing
- **Phase 7**: Background Workers, DLQ & Circuit Breaker Resilience
- **Phase 8**: Frontend Component & React E2E Verification
- **Phase 9**: 8 Critical End-to-End Business Workflows
- **Phase 10**: Load, Concurrency & Latency Stress Testing (1 to 100 users)
- **Phase 11**: Failure Injection & Chaos Recovery Testing
- **Phase 12**: CI/CD Workflows, Linter & Dependency Quality
- **Phase 13**: Bug Categorization, Remediation & Regression Verification
- **Phase 14**: Final Production Readiness Assessment & Decision

