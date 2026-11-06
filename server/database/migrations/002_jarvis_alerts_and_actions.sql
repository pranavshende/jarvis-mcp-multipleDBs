-- ============================================================================
-- JARVIS V1 — PHASE 2 MIGRATION: ALERT ENGINE & RESTRICTED ACTION AUDIT
-- Schemas: jarvis_alerts, jarvis_system
-- Target: Supabase Cloud Managed PostgreSQL 17.11
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS jarvis_alerts;
CREATE SCHEMA IF NOT EXISTS jarvis_system;

-- 1. alert_definitions
CREATE TABLE IF NOT EXISTS jarvis_alerts.alert_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    rule_configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
    schedule VARCHAR(64) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    severity VARCHAR(16) NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'HIGH', 'CRITICAL')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. alert_history (Persistent alerts with deterministic fingerprint deduplication)
CREATE TABLE IF NOT EXISTS jarvis_alerts.alert_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fingerprint VARCHAR(128) UNIQUE NOT NULL,
    alert_type VARCHAR(64) NOT NULL REFERENCES jarvis_alerts.alert_definitions(alert_type),
    severity VARCHAR(16) NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'HIGH', 'CRITICAL')),
    title VARCHAR(255) NOT NULL,
    summary TEXT NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(128) NOT NULL,
    action_payload JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'SNOOZED')),
    occurrence_count INTEGER NOT NULL DEFAULT 1,
    first_detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_history_type_status ON jarvis_alerts.alert_history(alert_type, status);
CREATE INDEX IF NOT EXISTS idx_alert_history_severity ON jarvis_alerts.alert_history(severity);
CREATE INDEX IF NOT EXISTS idx_alert_history_entity ON jarvis_alerts.alert_history(entity_type, entity_id);

-- 3. alert_feedback
CREATE TABLE IF NOT EXISTS jarvis_alerts.alert_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID NOT NULL REFERENCES jarvis_alerts.alert_history(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL,
    feedback_type VARCHAR(32) NOT NULL CHECK (feedback_type IN ('ACKNOWLEDGE', 'RESOLVE', 'FALSE_POSITIVE', 'NOTE')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_feedback_alert ON jarvis_alerts.alert_feedback(alert_id);

-- 4. alert_snoozes
CREATE TABLE IF NOT EXISTS jarvis_alerts.alert_snoozes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID NOT NULL REFERENCES jarvis_alerts.alert_history(id) ON DELETE CASCADE,
    snoozed_by VARCHAR(64) NOT NULL,
    snoozed_until TIMESTAMPTZ NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_snoozes_alert ON jarvis_alerts.alert_snoozes(alert_id);

-- 5. action_audit_ledger (Immutable, append-only operational audit log)
CREATE TABLE IF NOT EXISTS jarvis_system.action_audit_ledger (
    action_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type VARCHAR(64) NOT NULL,
    requested_by VARCHAR(64) NOT NULL,
    confirmed_by VARCHAR(64) NOT NULL,
    idempotency_key VARCHAR(128) UNIQUE NOT NULL,
    status VARCHAR(32) NOT NULL CHECK (status IN ('PENDING', 'CONFIRMED', 'EXECUTED', 'FAILED', 'CANCELED')),
    target_system VARCHAR(64) NOT NULL,
    target_entity_id VARCHAR(128) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    response JSONB DEFAULT '{}'::jsonb,
    error_details TEXT,
    executed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_action_ledger_idemp ON jarvis_system.action_audit_ledger(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_action_ledger_type ON jarvis_system.action_audit_ledger(action_type);
CREATE INDEX IF NOT EXISTS idx_action_ledger_target ON jarvis_system.action_audit_ledger(target_system, target_entity_id);

-- Seed initial alert definitions
INSERT INTO jarvis_alerts.alert_definitions (alert_type, name, description, rule_configuration, schedule, severity)
VALUES
    ('ACH_PAYOUT_FAILURE', 'ACH Member Payout Failure Monitor', 'Detects failed ACH batches and member payouts on hold > 24 hours', '{"threshold_hours": 24, "status": "failed"}'::jsonb, '*/15 * * * *', 'CRITICAL'),
    ('PARTNER_CREDIT_BREACH', 'Partner Credit Limit Breach Monitor', 'Detects B2B partners exceeding 100% credit utilization or critical overdue balances', '{"utilization_threshold_pct": 100.0}'::jsonb, '0 * * * *', 'HIGH'),
    ('INVENTORY_PRICE_INVERSION', 'Inventory Price Inversion Monitor', 'Detects catalog lines where fair market price falls below remaining FIFO lot cost', '{"margin_inversion_pct": 0.0}'::jsonb, '0 0 * * *', 'WARNING'),
    ('INSPECTION_FAILURE_ANOMALY', 'Inspection Failure Statistical Anomaly', 'Rolling 14-day Z-score anomaly detector for warehouse receiving failure rates', '{"z_score_warning": 2.0, "z_score_critical": 3.0}'::jsonb, '0 1 * * *', 'WARNING'),
    ('DOCK_SCAN_VOLUME_ANOMALY', 'Daily Dock Scan Volume Statistical Anomaly', 'Rolling 14-day Z-score anomaly detector for inbound package scanning volumes', '{"z_score_warning": 2.0, "z_score_critical": 3.0}'::jsonb, '0 1 * * *', 'WARNING')
ON CONFLICT (alert_type) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description, rule_configuration = EXCLUDED.rule_configuration, severity = EXCLUDED.severity, updated_at = NOW();
