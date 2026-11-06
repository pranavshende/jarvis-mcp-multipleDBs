# Jarvis v1 — Phase 4 Database Schema (`jarvis_system`)

Deployed to Supabase Cloud PostgreSQL 17.11 via `database/migrations/004_jarvis_system_gateway.sql`.

---

## 1. Schema Tables

### `jarvis_system.api_tokens`
Stores hashed Bearer tokens for MCP clients and internal services.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique token identifier |
| `user_id` | VARCHAR(100) | NOT NULL | Employee identifier (e.g. `EMP-001`) |
| `corporate_email` | VARCHAR(255) | NOT NULL | Verified company email |
| `token_hash` | VARCHAR(64) | NOT NULL, UNIQUE | SHA-256 hex digest of bearer token |
| `token_prefix` | VARCHAR(32) | NOT NULL | Masked prefix (e.g. `msc_mcp_marcus_...`) |
| `token_name` | VARCHAR(100) | NOT NULL | User-friendly token description |
| `role` | VARCHAR(50) | NOT NULL | Approved employee role |
| `department` | VARCHAR(100) | NOT NULL | Operational department |
| `allowed_scopes` | TEXT[] | NOT NULL, DEFAULT '{"read:metrics", "read:knowledge"}' | Fine-grained capability scopes |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Token issuance timestamp |
| `expires_at` | TIMESTAMPTZ | NULLABLE | Optional expiration timestamp |
| `last_used_at` | TIMESTAMPTZ | NULLABLE | Updated on each authenticated request |
| `revoked_at` | TIMESTAMPTZ | NULLABLE | Timestamp of revocation |
| `status` | VARCHAR(20) | NOT NULL, DEFAULT 'ACTIVE' | `ACTIVE`, `REVOKED`, or `EXPIRED` |

---

### `jarvis_system.audit_logs`
Immutable log of every inbound query and tool dispatch.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Audit event identifier |
| `request_id` | VARCHAR(64) | NOT NULL | Correlation request UUID |
| `user_id` | VARCHAR(100) | NOT NULL | Employee ID |
| `corporate_email` | VARCHAR(255) | NOT NULL | Employee email |
| `role` | VARCHAR(50) | NOT NULL | Active role during execution |
| `client_type` | VARCHAR(50) | NOT NULL | `SLACK`, `MCP_STREAM`, `MCP_STDIO`, `ADMIN_UI`, `API` |
| `query_summary` | TEXT | NULLABLE | Sanitized summary of query |
| `tool_name` | VARCHAR(100) | NULLABLE | Dispatched tool |
| `action_type` | VARCHAR(100) | NULLABLE | Business action type |
| `model_provider` | VARCHAR(50) | NULLABLE | Provider (e.g. `google`) |
| `model_name` | VARCHAR(100) | NULLABLE | Model (e.g. `gemini-2.5-flash`) |
| `status` | VARCHAR(50) | NOT NULL | `SUCCESS`, `DENIED`, `ERROR`, `CONFIRMATION_REQUIRED` |
| `latency_ms` | REAL | NOT NULL | Request execution duration |
| `error_message` | TEXT | NULLABLE | Error details if failed |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Event timestamp |

---

### `jarvis_system.token_usage_ledger`
Financial and token consumption tracking by employee and model.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Record ID |
| `request_id` | VARCHAR(64) | NOT NULL | Correlation request UUID |
| `user_id` | VARCHAR(100) | NOT NULL | Employee ID |
| `corporate_email` | VARCHAR(255) | NOT NULL | Corporate email |
| `model_provider` | VARCHAR(50) | NOT NULL | Provider name |
| `model_name` | VARCHAR(100) | NOT NULL | Model identifier |
| `input_tokens` | INTEGER | NOT NULL | Input prompt tokens |
| `output_tokens` | INTEGER | NOT NULL | Generated response tokens |
| `cached_tokens` | INTEGER | NOT NULL | Cached prompt tokens |
| `estimated_input_cost` | NUMERIC(10, 6) | NOT NULL | Input token cost (USD) |
| `estimated_output_cost` | NUMERIC(10, 6) | NOT NULL | Output token cost (USD) |
| `total_estimated_cost` | NUMERIC(10, 6) | NOT NULL | Total cost (USD) |
| `currency` | VARCHAR(10) | NOT NULL, DEFAULT 'USD' | Currency code |
| `request_status` | VARCHAR(50) | NOT NULL, DEFAULT 'SUCCESS' | Status |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record timestamp |

---

### `jarvis_system.user_preferences`
User-level configuration for preferred models and notification preferences.
