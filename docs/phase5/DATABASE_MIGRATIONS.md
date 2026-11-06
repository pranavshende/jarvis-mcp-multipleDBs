# Jarvis v1 Phase 5 — Database Migrations

## 1. Migration File: `005_jarvis_phase5_optimization.sql`

The Phase 5 database migration extends the `jarvis_system` schema in Supabase PostgreSQL 17.11 to support the semantic cache, continuous evaluation, DLQ auditing, and departmental token budgets.

File location: [`server/database/migrations/005_jarvis_phase5_optimization.sql`](file:///d:/eigi.ai/server/database/migrations/005_jarvis_phase5_optimization.sql).

---

## 2. Table Specifications

### 2.1. `jarvis_system.semantic_cache`
Stores L2 persistent entries for the Authorization-Aware Composite Semantic Cache.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `cache_key` | `VARCHAR(64)` | `PRIMARY KEY` | SHA-256 hash of (query, params, role, scopes, watermark) |
| `query_text` | `TEXT` | `NOT NULL` | Original normalized user query string |
| `sanitized_parameters` | `JSONB` | `DEFAULT '{}'::jsonb` | Parameter values sanitized for caching |
| `category` | `VARCHAR(32)` | `NOT NULL` | `FINANCIAL`, `KNOWLEDGE`, `SYNTHESIS` |
| `role_scope` | `VARCHAR(64)` | `NOT NULL` | Required role scope (e.g. `ROLE_FINANCE`) |
| `allowed_scopes` | `TEXT[]` | `DEFAULT '{}'` | Array of allowed OAuth/MCP scopes |
| `user_id` | `VARCHAR(64)` | `NULL` | Isolated user ID (for user-specific caches) |
| `response_payload` | `JSONB` | `NOT NULL` | Full cached response object |
| `etl_watermark` | `TIMESTAMPTZ` | `NOT NULL` | ETL watermark timestamp when cached |
| `hit_count` | `INTEGER` | `DEFAULT 0` | Total cache hits |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Record creation timestamp |
| `expires_at` | `TIMESTAMPTZ` | `NOT NULL` | TTL expiration timestamp |

**Indexes**:
- `idx_semantic_cache_expires` on `(expires_at)`
- `idx_semantic_cache_category` on `(category)`
- `idx_semantic_cache_role` on `(role_scope)`

---

### 2.2. `jarvis_system.evaluation_runs`
Records high-level metadata for automated evaluation executions (Module B).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `run_id` | `VARCHAR(64)` | `PRIMARY KEY` | Unique evaluation run identifier |
| `trigger_type` | `VARCHAR(32)` | `NOT NULL` | `CI_BENCHMARK`, `MANUAL`, `SCHEDULED` |
| `started_at` | `TIMESTAMPTZ` | `NOT NULL` | Run start timestamp |
| `completed_at` | `TIMESTAMPTZ` | `NULL` | Run completion timestamp |
| `total_scenarios` | `INTEGER` | `NOT NULL` | Total scenarios evaluated (e.g. 50) |
| `passed_scenarios` | `INTEGER` | `DEFAULT 0` | Scenarios passing all assertions |
| `failed_scenarios` | `INTEGER` | `DEFAULT 0` | Scenarios failing one or more assertions |
| `pass_rate_pct` | `NUMERIC(5,2)` | `DEFAULT 0.00` | Percentage pass rate (e.g. 96.00) |
| `category_scores` | `JSONB` | `DEFAULT '{}'::jsonb` | Breakdown by category |
| `metrics` | `JSONB` | `DEFAULT '{}'::jsonb` | Latency, tokens, cost metrics |
| `status` | `VARCHAR(32)` | `DEFAULT 'RUNNING'` | `RUNNING`, `COMPLETED`, `FAILED` |

---

### 2.3. `jarvis_system.evaluation_results`
Stores per-scenario results and assertion audits.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Result ID |
| `run_id` | `VARCHAR(64)` | `REFERENCES evaluation_runs(run_id)` | Foreign key to run |
| `scenario_id` | `VARCHAR(32)` | `NOT NULL` | e.g. `QM-01`, `PS-05`, `SA-02` |
| `category` | `VARCHAR(32)` | `NOT NULL` | Category name |
| `status` | `VARCHAR(16)` | `NOT NULL` | `PASSED` or `FAILED` |
| `latency_ms` | `NUMERIC(10,2)` | `NULL` | End-to-end latency in milliseconds |
| `tokens_used` | `INTEGER` | `DEFAULT 0` | Token consumption |
| `model_used` | `VARCHAR(64)` | `NULL` | Model allocated by router |
| `intent_detected` | `VARCHAR(64)` | `NULL` | Detected intent |
| `assertions_passed` | `INTEGER` | `DEFAULT 0` | Count of passed assertions |
| `failure_reason` | `TEXT` | `NULL` | Error details if failed |
| `response_preview` | `TEXT` | `NULL` | Response preview for auditing |

---

### 2.4. `jarvis_system.dlq_audit_log`
Tracks administrative operations on dead-letter queue jobs.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Audit ID |
| `job_id` | `VARCHAR(128)` | `NOT NULL` | BullMQ dead job identifier |
| `queue_name` | `VARCHAR(64)` | `NOT NULL` | `bullmq:dlq:alerts` or `bullmq:dlq:etl` |
| `action` | `VARCHAR(32)` | `NOT NULL` | `REPLAY`, `DISMISS`, `AUTO_RETRY` |
| `performed_by` | `VARCHAR(128)` | `NOT NULL` | User or automated worker identity |
| `reason` | `TEXT` | `NULL` | Administrative reason |
| `outcome` | `VARCHAR(32)` | `NOT NULL` | `SUCCESS` or `FAILED` |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Operation timestamp |

---

### 2.5. `jarvis_system.department_budgets`
Enforces hard monthly token and financial limits.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `department` | `VARCHAR(64)` | `PRIMARY KEY` | `OPERATIONS`, `FINANCE`, `SALES`, `EXECUTIVE` |
| `token_limit_monthly` | `BIGINT` | `NOT NULL` | Monthly token allocation |
| `cost_limit_usd` | `NUMERIC(10,2)` | `NOT NULL` | Monthly dollar limit |
| `current_spent_usd` | `NUMERIC(10,4)` | `DEFAULT 0.0000` | Real-time spend for active month |
| `status` | `VARCHAR(32)` | `DEFAULT 'ACTIVE'` | `ACTIVE`, `WARNING`, `LOCKED` |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Last update timestamp |

**Seed Data**:
- `OPERATIONS`: 50M tokens / $250.00 limit
- `FINANCE`: 30M tokens / $150.00 limit
- `SALES`: 40M tokens / $200.00 limit
- `EXECUTIVE`: 20M tokens / $100.00 limit

---

## 3. Verification & Deployment Record

The schema was successfully deployed to Supabase PostgreSQL:
- Executed via: `server/scripts/deploy_phase5_schema.py`
- Connection: Supabase Pooler (`aws-0-ap-south-1.pooler.supabase.com`)
- Result: All tables, foreign keys, and indexes created with `exit_code=0`.

