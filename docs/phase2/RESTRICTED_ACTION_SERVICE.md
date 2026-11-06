# Jarvis v1 — Restricted Action Service & Human-Gated Execution

## 1. Security Architecture

The Restricted Action Service (`server/services/actions/restricted_action_service.py`) protects Meridian's core operational systems against unauthorized or automated LLM state changes.

### Fundamental Security Invariant
> **LLM agents possess zero direct execution credentials or write authority.**
> Every business state transition must be proposed, reviewed, explicitly confirmed by an authorized human operator with exact token matching, executed idempotently, and permanently recorded in an immutable append-only ledger.

---

## 2. Seven-Step Confirmation Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor Operator as Human Founder / Sales Lead
    participant Web as React Alert Center
    participant RAS as RestrictedActionService
    participant Downstream as MSC Wholesale Portal API
    participant Ledger as jarvis_system.action_audit_ledger

    Operator->>Web: Click "Initiate Credit Hold (Partner 301)"
    Web->>RAS: POST /api/actions/propose { partner_id: 301 }
    RAS-->>Web: Action Proposal Created (TTL 15m, Token: "CONFIRM CREDIT HOLD")
    Web->>Operator: Display Impact Assessment & Token Input Field
    Operator->>Web: Types "CONFIRM CREDIT HOLD" & Clicks Confirm
    Web->>RAS: POST /api/actions/:id/confirm { role: "ROLE_FOUNDER", token: "CONFIRM CREDIT HOLD", idemp_key }
    RAS->>RAS: Verify Role in {ROLE_FOUNDER, ROLE_SALES}
    RAS->>RAS: Verify Exact Token Match
    RAS->>Ledger: Check if idemp_key already executed
    alt Already Executed
        RAS-->>Web: Return ALREADY_EXECUTED (Replay Protection)
    else New Execution
        RAS->>Downstream: PATCH /api/v1/partners/301/credit-hold
        Downstream-->>RAS: 200 OK { current_status: "CREDIT_HOLD" }
        RAS->>Ledger: INSERT INTO action_audit_ledger (Status: EXECUTED)
        RAS-->>Web: 200 OK Execution Receipt with Ledger UUID
    end
```

---

## 3. Verified Target Case: Partner 301 (Northgate Hobby Distributors)

- **Partner ID**: `301`
- **Partner Tier**: `gold`
- **Credit Limit**: **\$250,000.00**
- **Open AR Balance**: **\$284,279.37**
- **Credit Utilization**: **113.71% (CRITICAL BREACH)**
- **Overdue >60 Days**: **\$26,475.94** (across 26 open invoices)
- **Direct Operational Impact**: Freezes wholesale portal ordering and warehouse shipping releases until overdue balance is settled.
- **Idempotency Protection**: `idempotency_key` guarantees duplicate execution attempts return the original transaction receipt without double-dispatching downstream.
