-- ============================================================================
-- JARVIS V1 — PHASE 4 MIGRATION: GATEWAY, MCP PROTOCOL, USAGE LEDGER & AUDIT
-- Schema: jarvis_system
-- Target: Supabase Cloud Managed PostgreSQL 17.11
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS jarvis_system;

-- 1. api_tokens (MCP & Gateway Bearer Tokens)
CREATE TABLE IF NOT EXISTS jarvis_system.api_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(100) NOT NULL,
    corporate_email VARCHAR(255) NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 hex digest
    token_prefix VARCHAR(32) NOT NULL,       -- e.g. "msc_mcp_marcus_..."
    token_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN (
        'ROLE_FOUNDER', 'ROLE_ADMIN', 'ROLE_FINANCE', 'ROLE_SALES',
        'ROLE_WAREHOUSE', 'ROLE_OPERATIONS', 'ROLE_EMPLOYEE', 'ROLE_USER'
    )),
    department VARCHAR(100) NOT NULL DEFAULT 'OPERATIONS',
    allowed_scopes TEXT[] NOT NULL DEFAULT '{"read:metrics", "read:knowledge"}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED', 'EXPIRED'))
);

CREATE INDEX IF NOT EXISTS idx_api_tokens_hash ON jarvis_system.api_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_api_tokens_user ON jarvis_system.api_tokens(user_id, status);
CREATE INDEX IF NOT EXISTS idx_api_tokens_email ON jarvis_system.api_tokens(corporate_email);

-- 2. audit_logs (Immutable Gateway Request & Tool Dispatch Log)
CREATE TABLE IF NOT EXISTS jarvis_system.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(100) NOT NULL,
    corporate_email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    client_type VARCHAR(50) NOT NULL CHECK (client_type IN ('SLACK', 'MCP_STREAM', 'MCP_STDIO', 'ADMIN_UI', 'API')),
    query_summary TEXT,
    tool_name VARCHAR(100),
    action_type VARCHAR(100),
    model_provider VARCHAR(50),
    model_name VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'SUCCESS', -- SUCCESS, DENIED, ERROR, CONFIRMATION_REQUIRED
    latency_ms REAL NOT NULL DEFAULT 0.0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_request_id ON jarvis_system.audit_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_email ON jarvis_system.audit_logs(corporate_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON jarvis_system.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tool ON jarvis_system.audit_logs(tool_name);

-- 3. token_usage_ledger (Per-User / Per-Model AI Spend Tracking)
CREATE TABLE IF NOT EXISTS jarvis_system.token_usage_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(100) NOT NULL,
    corporate_email VARCHAR(255) NOT NULL,
    model_provider VARCHAR(50) NOT NULL,
    model_name VARCHAR(100) NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cached_tokens INTEGER NOT NULL DEFAULT 0,
    estimated_input_cost NUMERIC(10, 6) NOT NULL DEFAULT 0.0,
    estimated_output_cost NUMERIC(10, 6) NOT NULL DEFAULT 0.0,
    total_estimated_cost NUMERIC(10, 6) NOT NULL DEFAULT 0.0,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    request_status VARCHAR(50) NOT NULL DEFAULT 'SUCCESS',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_usage_email ON jarvis_system.token_usage_ledger(corporate_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_usage_model ON jarvis_system.token_usage_ledger(model_name);
CREATE INDEX IF NOT EXISTS idx_token_usage_created_at ON jarvis_system.token_usage_ledger(created_at DESC);

-- 4. user_preferences (Employee Gateway Configuration)
CREATE TABLE IF NOT EXISTS jarvis_system.user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(100) NOT NULL UNIQUE,
    corporate_email VARCHAR(255) NOT NULL UNIQUE,
    preferred_model_tier VARCHAR(50) DEFAULT 'fast_tier',
    preferred_client VARCHAR(50) DEFAULT 'SLACK',
    notification_preferences JSONB DEFAULT '{"slack_dm": true, "email_alerts": false}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_email ON jarvis_system.user_preferences(corporate_email);
