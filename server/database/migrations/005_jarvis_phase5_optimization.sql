-- ============================================================================
-- JARVIS V1 — PHASE 5 MIGRATION: CACHE, EVALUATION, DLQ & BUDGET OPTIMIZATION
-- Schema: jarvis_system
-- Target: Supabase Cloud Managed PostgreSQL
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS jarvis_system;

-- 1. semantic_cache: Authorization-Aware Fast Retrieval Store
CREATE TABLE IF NOT EXISTS jarvis_system.semantic_cache (
    cache_key VARCHAR(64) PRIMARY KEY, -- SHA-256 hex digest
    query_text TEXT NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('FINANCIAL_METRIC', 'KNOWLEDGE_SOP', 'USER_SPECIFIC')),
    response_payload JSONB NOT NULL,
    role_scope VARCHAR(50) NOT NULL,
    allowed_scopes TEXT[] NOT NULL,
    user_id VARCHAR(100),              -- NULL for shared responses; set for user-private
    etl_watermark TIMESTAMPTZ,         -- Watermark at the time of caching
    hit_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_semantic_cache_role ON jarvis_system.semantic_cache(role_scope);
CREATE INDEX IF NOT EXISTS idx_semantic_cache_expiry ON jarvis_system.semantic_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_semantic_cache_category ON jarvis_system.semantic_cache(category);
CREATE INDEX IF NOT EXISTS idx_semantic_cache_watermark ON jarvis_system.semantic_cache(etl_watermark);

-- 2. evaluation_runs: Continuous CI Evaluation Run History
CREATE TABLE IF NOT EXISTS jarvis_system.evaluation_runs (
    run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    total_scenarios INTEGER NOT NULL,
    passed_scenarios INTEGER NOT NULL,
    failed_scenarios INTEGER NOT NULL,
    pass_rate_pct NUMERIC(5, 2) NOT NULL,
    category_scores JSONB NOT NULL,
    metrics JSONB NOT NULL,            -- Precision@1, Precision@5, MRR, Latency, Cost
    status VARCHAR(20) NOT NULL DEFAULT 'RUNNING' CHECK (status IN ('RUNNING', 'PASSED', 'FAILED')),
    trigger_type VARCHAR(50) NOT NULL DEFAULT 'MANUAL' CHECK (trigger_type IN ('CI', 'MANUAL', 'SCHEDULED', 'RELEASE_GATE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eval_runs_status ON jarvis_system.evaluation_runs(status);
CREATE INDEX IF NOT EXISTS idx_eval_runs_created ON jarvis_system.evaluation_runs(created_at DESC);

-- 3. evaluation_results: Individual Scenario Evaluation Execution Details
CREATE TABLE IF NOT EXISTS jarvis_system.evaluation_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES jarvis_system.evaluation_runs(run_id) ON DELETE CASCADE,
    scenario_id VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL,
    status VARCHAR(10) NOT NULL CHECK (status IN ('PASS', 'FAIL')),
    latency_ms NUMERIC(10, 2) NOT NULL DEFAULT 0.0,
    tokens_used INTEGER NOT NULL DEFAULT 0,
    model_used VARCHAR(100),
    intent_detected VARCHAR(100),
    assertions_passed JSONB NOT NULL DEFAULT '{}',
    failure_reason TEXT,
    response_preview TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eval_results_run ON jarvis_system.evaluation_results(run_id, status);
CREATE INDEX IF NOT EXISTS idx_eval_results_scenario ON jarvis_system.evaluation_results(scenario_id);

-- 4. dlq_audit_log: BullMQ Dead-Letter Queue & Incident Recovery Audit
CREATE TABLE IF NOT EXISTS jarvis_system.dlq_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id VARCHAR(100) NOT NULL,
    queue_name VARCHAR(100) NOT NULL,
    job_type VARCHAR(100) NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 3,
    failure_reason TEXT NOT NULL,
    error_stack TEXT,
    correlation_id VARCHAR(100),
    recovery_status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (recovery_status IN ('PENDING', 'RETRIED', 'DISMISSED')),
    resolved_by VARCHAR(100),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dlq_audit_status ON jarvis_system.dlq_audit_log(recovery_status);
CREATE INDEX IF NOT EXISTS idx_dlq_audit_queue ON jarvis_system.dlq_audit_log(queue_name);

-- 5. department_budgets: Departmental Token and Dollar Spend Limits
ALTER TABLE jarvis_system.token_usage_ledger ADD COLUMN IF NOT EXISTS department VARCHAR(100) DEFAULT 'OPERATIONS';
ALTER TABLE jarvis_system.token_usage_ledger ADD COLUMN IF NOT EXISTS from_cache BOOLEAN DEFAULT FALSE;
ALTER TABLE jarvis_system.token_usage_ledger ADD COLUMN IF NOT EXISTS routing_reason VARCHAR(100) DEFAULT 'DIRECT';
ALTER TABLE jarvis_system.token_usage_ledger ADD COLUMN IF NOT EXISTS total_tokens INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS jarvis_system.department_budgets (
    department VARCHAR(100) PRIMARY KEY,
    monthly_token_budget BIGINT NOT NULL DEFAULT 5000000,
    monthly_spend_limit_usd NUMERIC(10, 2) NOT NULL DEFAULT 50.00,
    current_token_spend BIGINT NOT NULL DEFAULT 0,
    current_usd_spend NUMERIC(10, 4) NOT NULL DEFAULT 0.0000,
    warning_threshold_pct INTEGER NOT NULL DEFAULT 80,
    is_exhausted BOOLEAN NOT NULL DEFAULT FALSE,
    last_reset_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial department budgets
INSERT INTO jarvis_system.department_budgets 
(department, monthly_token_budget, monthly_spend_limit_usd, current_token_spend, current_usd_spend)
VALUES 
('OPERATIONS', 10000000, 100.00, 142050, 0.2841),
('FINANCE', 15000000, 150.00, 485120, 0.9702),
('SALES', 8000000, 80.00, 94300, 0.1886),
('EXECUTIVE', 20000000, 200.00, 210450, 0.4209)
ON CONFLICT (department) DO UPDATE SET 
    monthly_token_budget = EXCLUDED.monthly_token_budget,
    monthly_spend_limit_usd = EXCLUDED.monthly_spend_limit_usd;
