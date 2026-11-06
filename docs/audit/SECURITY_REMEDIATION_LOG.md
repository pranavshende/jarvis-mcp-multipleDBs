# Security Remediation Log & Hardening Plan
**Document ID:** SEC-REM-V1-2026-10-20  
**Target Systems:** `seller_db`, `wms_db`, `portal_db`, Supabase Analytics Cluster (`eu-central-1`)  
**Status:** MANDATORY PRE-REQUISITE FOR PHASE 1  
**Classification:** STRICTLY CONFIDENTIAL — INTERNAL INFRASTRUCTURE ONLY

---

## 1. Executive Summary & Audit Posture

The Phase 0 forensic security audit of Meridian Supply Chain (MSC)'s database ecosystem identified severe credential mismanagement and over-privileged service roles inherited from the abandoned Jarvis v0 experiment:
1. **Unrestricted Superuser Role (`jarvis_svc`):** A shared service account with unrestricted `SUPERUSER` / `ALL PRIVILEGES` across production databases, capable of executing unlogged `DROP`, `ALTER`, and mutating `UPDATE`/`DELETE` queries.
2. **Plaintext Banking and PII Exposure:** Bank routing numbers, checking account numbers, Tax IDs (SSN/EIN), and encrypted payout tokens were accessible to standard query consumers without column-level security or masking.
3. **Monolithic API Keys:** A single master API key was hardcoded in multiple client environments (Slack apps, Claude desktop configuration, local Jupyter notebooks) without transport segmentation or audit logging.
4. **Lack of Network and Session Isolation:** Connections were permitted from arbitrary IP addresses without enforced SSL/TLS ciphers, connection connection pooling, or query runtime timeouts.

This document establishes the immediate, idempotent remediation scripts, SQL commands, and credential rotation procedures required prior to spinning up Phase 1 synchronization workers.

---

## 2. Immediate SQL Remediation Scripts

### 2.1 Complete Deprecation and Revocation of `jarvis_svc`

Execute the following script across all production database clusters (`seller_db`, `wms_db`, `portal_db`):

```sql
-- ============================================================================
-- SCRIPT: revoke_and_isolate_legacy_service_account.sql
-- TARGET: seller_db, wms_db, portal_db
-- PURPOSE: Immediately strip all DDL, write, and administrative grants
-- ============================================================================

BEGIN;

-- 1. Terminate all active sessions established by jarvis_svc
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE usename = 'jarvis_svc'
  AND pid <> pg_backend_pid();

-- 2. Revoke all database-level administrative permissions
REVOKE ALL ON DATABASE seller_db FROM jarvis_svc;
REVOKE ALL ON DATABASE wms_db FROM jarvis_svc;
REVOKE ALL ON DATABASE portal_db FROM jarvis_svc;

-- 3. Revoke all schema usage and table-level privileges in public schemas
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM jarvis_svc;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM jarvis_svc;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM jarvis_svc;

-- 4. Alter default privileges to prevent auto-granting access on future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM jarvis_svc;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM jarvis_svc;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM jarvis_svc;

-- 5. Disable login for the legacy service role
ALTER ROLE jarvis_svc WITH NOLOGIN NOREPLICATION NOSUPERUSER NOCREATEDB NOCREATEROLE;

COMMIT;
```

---

### 2.2 Creation of Isolated Read-Only Analytics Role (`jarvis_analytics_ro`)

A dedicated read-only role is established on the read replica, restricted to non-sensitive tables and bound by strict session-level safeguards:

```sql
-- ============================================================================
-- SCRIPT: provision_read_only_analytics_role.sql
-- TARGET: Read Replicas of seller_db, wms_db, portal_db
-- ============================================================================

BEGIN;

-- 1. Create role with enforced password hashing and strict session limits
CREATE ROLE jarvis_analytics_ro WITH
    LOGIN
    ENCRYPTED PASSWORD '${SECURE_VAULT_GENERATED_SECRET}'
    NOSUPERUSER
    NOCREATEDB
    NOCREATEROLE
    NOINHERIT
    CONNECTION LIMIT 15;

-- 2. Configure aggressive session and resource boundaries
ALTER ROLE jarvis_analytics_ro SET statement_timeout = '8000ms';
ALTER ROLE jarvis_analytics_ro SET idle_in_transaction_session_timeout = '5000ms';
ALTER ROLE jarvis_analytics_ro SET default_transaction_read_only = 'on';
ALTER ROLE jarvis_analytics_ro SET search_path = public, analytics;

-- 3. Grant schema usage only
GRANT USAGE ON SCHEMA public TO jarvis_analytics_ro;

-- 4. Grant SELECT only on explicitly allowed operational tables
-- SELLER_DB:
GRANT SELECT ON TABLE public.submissions TO jarvis_analytics_ro;
GRANT SELECT ON TABLE public.submission_items TO jarvis_analytics_ro;
GRANT SELECT ON TABLE public.buy_list TO jarvis_analytics_ro;
GRANT SELECT ON TABLE public.buy_list_changes TO jarvis_analytics_ro;
GRANT SELECT ON TABLE public.wallet_ledger TO jarvis_analytics_ro;
GRANT SELECT ON TABLE public.support_tickets TO jarvis_analytics_ro;

-- WMS_DB:
GRANT SELECT ON TABLE public.inbound_packages TO jarvis_analytics_ro;
GRANT SELECT ON TABLE public.receiving_items TO jarvis_analytics_ro;
GRANT SELECT ON TABLE public.bins TO jarvis_analytics_ro;
GRANT SELECT ON TABLE public.wms_items TO jarvis_analytics_ro;
GRANT SELECT ON TABLE public.outbound_shipments TO jarvis_analytics_ro;
GRANT SELECT ON TABLE public.outbound_lines TO jarvis_analytics_ro;
GRANT SELECT ON TABLE public.quality_logs TO jarvis_analytics_ro;

-- PORTAL_DB:
GRANT SELECT ON TABLE public.catalog_products TO jarvis_analytics_ro;
GRANT SELECT ON TABLE public.brands TO jarvis_analytics_ro;
GRANT SELECT ON TABLE public.sets TO jarvis_analytics_ro;
GRANT SELECT ON TABLE public.listed_stock TO jarvis_analytics_ro;
GRANT SELECT ON TABLE public.market_prices TO jarvis_analytics_ro;
GRANT SELECT ON TABLE public.price_index TO jarvis_analytics_ro;
GRANT SELECT ON TABLE public.orders TO jarvis_analytics_ro;
GRANT SELECT ON TABLE public.order_items TO jarvis_analytics_ro;
GRANT SELECT ON TABLE public.invoices TO jarvis_analytics_ro;
GRANT SELECT ON TABLE public.quotes TO jarvis_analytics_ro;
GRANT SELECT ON TABLE public.quote_items TO jarvis_analytics_ro;

COMMIT;
```

---

### 2.3 Strict Exclusion of Sensitive PII and Financial Tables

The following tables contain highly sensitive consumer PII, bank account details, and staff credentials. Access is strictly denied to `jarvis_analytics_ro`:

```sql
-- ============================================================================
-- SCRIPT: enforce_pii_and_bank_exclusion.sql
-- ============================================================================

BEGIN;

-- Explicitly revoke access to forbidden tables
REVOKE ALL PRIVILEGES ON TABLE public.members FROM jarvis_analytics_ro;
REVOKE ALL PRIVILEGES ON TABLE public.payouts FROM jarvis_analytics_ro;
REVOKE ALL PRIVILEGES ON TABLE public.payout_methods FROM jarvis_analytics_ro;
REVOKE ALL PRIVILEGES ON TABLE public.staff_users FROM jarvis_analytics_ro;
REVOKE ALL PRIVILEGES ON TABLE public.partners FROM jarvis_analytics_ro;
REVOKE ALL PRIVILEGES ON TABLE public.partner_users FROM jarvis_analytics_ro;
REVOKE ALL PRIVILEGES ON TABLE public.payments FROM jarvis_analytics_ro;

-- Create sanitized views for necessary identity resolution without exposing PII
CREATE OR REPLACE VIEW analytics.v_sanitized_members AS
SELECT 
    id,
    member_code,
    status,
    created_at,
    updated_at,
    -- Deterministic cryptographic pseudonymization
    encode(sha256((email || '${PII_SALT_PEPPER}')::bytea), 'hex') AS email_hash,
    substring(email from '@(.*)$') AS email_domain
FROM public.members;

GRANT SELECT ON analytics.v_sanitized_members TO jarvis_analytics_ro;

CREATE OR REPLACE VIEW analytics.v_sanitized_partners AS
SELECT 
    id,
    partner_code,
    name,
    tier,
    status,
    credit_limit,
    payment_terms,
    assigned_rep_id,
    created_at
    -- Excluding tax_id, bank_routing, bank_account_number, settlement_instructions
FROM public.partners;

GRANT SELECT ON analytics.v_sanitized_partners TO jarvis_analytics_ro;

COMMIT;
```

---

## 3. Supabase RLS and Analytical Multi-Tenancy Architecture

In the unified Supabase PostgreSQL cluster (`eu-central-1`), Row Level Security (RLS) is enabled on all tables across the `analytics` schema to prevent privilege leakage across user roles:

```sql
-- Enable RLS across analytical core entities
ALTER TABLE analytics.dim_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.dim_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.fact_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.fact_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.fact_inventory_valuation ENABLE ROW LEVEL SECURITY;

-- Policy Example: B2B Account Representatives can only view orders for assigned partners
CREATE POLICY rep_assigned_partners_only ON analytics.fact_orders
    FOR SELECT
    TO authenticated
    USING (
        (auth.jwt() ->> 'role' IN ('FOUNDER', 'FINANCE_LEAD', 'OPS_LEAD'))
        OR
        (partner_id IN (
            SELECT id FROM analytics.dim_partners 
            WHERE assigned_rep_id = (auth.jwt() ->> 'employee_id')::uuid
        ))
    );

-- Policy Example: Contractors and Support Staff cannot view unit margins or acquisition costs
CREATE POLICY mask_financial_margins ON analytics.fact_inventory_valuation
    FOR SELECT
    TO authenticated
    USING (
        auth.jwt() ->> 'role' IN ('FOUNDER', 'FINANCE_LEAD', 'OPS_LEAD')
    );
```

---

## 4. API Key & Client Secret Segmentation Plan

| Client Component | Protocol / Transport | Secret Type | Storage Mechanism | Rotation Schedule | Permissions Bound |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Claude Desktop** | Local `stdio` | Ephemeral Session Token | OS Secure Enclave / Keytar | 12 Hours | Per-user RBAC context |
| **Cursor / Claude Code** | Streamable HTTP (`mcp.meridian.internal`) | mTLS + HMAC Bearer Token | Encrypted Developer Keychain | 7 Days | Engineering read-only + Schema metadata |
| **Slack Bot App** | WebSocket (Socket Mode) | App-level Token + Bot User Token | AWS Secrets Manager / Vault | 90 Days | Event dispatch + Interactive dialogs |
| **Admin Web Dashboard** | HTTPS / TLS 1.3 | Supabase Auth JWT (Short-lived) | HTTP-Only Secure SameSite Cookie | 60 Minutes (Access) / 30 Days (Refresh) | Role-based Dashboard UI |
| **Background Sync Workers** | Internal VPC Private Network | IAM Instance Profile / Direct Secret | HashiCorp Vault Injector | 30 Days | Read-only replica ETL ingestion |

---

## 5. Restricted Action Service & Dual-Authorization Protocol

To prevent unauthorized mutations (such as unblocking partner credit lines, triggering bulk payouts, or modifying sell prices):
1. **Zero Direct Mutations:** Jarvis Orchestrator and MCP tools have **NO** direct write credentials to production databases or payment gateways.
2. **Action Intent Tokenization:** When a privileged user requests an operational modification via Slack or MCP, Jarvis generates an immutable `ActionIntent` record with an HMAC-SHA256 signature and a 15-minute expiration.
3. **Dual-Authorization Requirement:** Any action impacting more than **$5,000** or modifying credit status requires two independent authorizations (e.g., Requested by Sales Lead, Approved by Finance Lead).
4. **Idempotency Gate:** All mutations are executed via idempotent HTTP webhooks with unique idempotency keys (`uuidv5`) to prevent replay attacks.
