# Jarvis v1 — Phase 2 System Architecture

## 1. Executive Summary

Phase 2 elevates Jarvis from a passive analytical observation layer into an active, proactive enterprise intelligence and restricted operational execution platform. 

The core architecture is anchored by three architectural principles:
1. **Deterministic Rule Evaluation**: All alerts and operational warnings are derived from rigorous SQL calculations and statistical baselines rather than ungrounded LLM inference.
2. **Deterministic Deduplication**: Every alert event is fingerprinted via `sha256(alert_type + entity_type + entity_id + incident_ref)` to eliminate notification fatigue.
3. **Zero Autonomous LLM Mutation Authority**: LLMs never possess direct database write credentials or autonomous API dispatch authority. Every operational action requires explicit role-authorized human confirmation, token matching, and append-only audit ledger recording.

---

## 2. Component Topology

```mermaid
flowchart TD
    subgraph Data Sources & Ingestion
        DB[(Supabase Managed PostgreSQL 17.11)]
        S_SELLER[staging_seller]
        S_WMS[staging_wms]
        S_PORTAL[staging_portal]
        ANALYTICS[analytics star schema]
    end

    subgraph Distributed Queue & Schedulers
        REDIS[(Redis 7 / BullMQ)]
        FALLBACK[In-Process Threaded Scheduler]
        RUNNER[JobRunner Service]
    end

    subgraph Deterministic Rules & Anomaly Engines
        ACH[ACH Payout Monitor\n(Every 15m)]
        CREDIT[Partner Credit Monitor\n(Hourly)]
        INVENTORY[Inventory Inversion Monitor\n(Daily)]
        ANOMALY[Statistical Anomaly Detector\n(Rolling 14-day Z-Score & IQR)]
    end

    subgraph Central Alert Management System
        AM[AlertManager Engine]
        DEDUP[Fingerprint Deduplication\nSHA256 Registry]
        ALERTS_DB[(jarvis_alerts.alert_history\njarvis_alerts.alert_definitions\njarvis_alerts.alert_feedback)]
    end

    subgraph Decoupled Notification Adapters
        SLACK[Slack Adapter\nBlock Kit + HMAC-SHA256]
        ADMIN[Admin Dashboard Adapter\nEvent Bus]
        EMAIL[Email Adapter\nProvider Independent]
    end

    subgraph Restricted Action Service
        RAS[RestrictedActionService]
        AUTH[Server-Side Role Guard\nROLE_FOUNDER / ROLE_SALES]
        TOKEN[Explicit Token Match\nCONFIRM CREDIT HOLD]
        IDEMP[Idempotency Guard\nEnforces Single Execution]
        LEDGER[(jarvis_system.action_audit_ledger)]
        PORTAL_CLIENT[MSC Portal API Client\nPATCH /credit-hold]
    end

    DB --> S_SELLER & S_WMS & S_PORTAL & ANALYTICS
    REDIS & FALLBACK --> RUNNER
    RUNNER --> ACH & CREDIT & INVENTORY & ANOMALY
    ACH & CREDIT & INVENTORY & ANOMALY --> DB
    ACH & CREDIT & INVENTORY & ANOMALY --> AM
    AM --> DEDUP --> ALERTS_DB
    AM --> SLACK & ADMIN & EMAIL
    ADMIN --> RAS
    RAS --> AUTH --> TOKEN --> IDEMP --> LEDGER
    IDEMP --> PORTAL_CLIENT
```

---

## 3. Database Schemas

### `jarvis_alerts`
- `alert_definitions`: Master registry of alert types, human names, cron schedules, JSONB rule configuration, and severity.
- `alert_history`: Persistent record of all alerts. Enforces deterministic fingerprint uniqueness (`fingerprint VARCHAR(128) UNIQUE`).
- `alert_feedback`: Tracks operator actions (`ACKNOWLEDGE`, `RESOLVE`, `FALSE_POSITIVE`, `NOTE`).
- `alert_snoozes`: Tracks active snoozes with operator ID and `snoozed_until` timestamp.

### `jarvis_system`
- `action_audit_ledger`: Append-only immutable record of all restricted actions. Enforces uniqueness on `idempotency_key VARCHAR(128) UNIQUE`.
