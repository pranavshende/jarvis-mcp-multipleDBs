# Jarvis v1 — Phase 2 Security Review & Threat Model

## 1. Threat Modeling & Safeguards

| Threat Vector | Potential Vulnerability | Implemented Phase 2 Safeguard |
|---|---|---|
| **Autonomous LLM Mutation** | Prompt injection inducing unauthorized credit holds or supplier payments. | **Zero Autonomous Execution**: LLMs have no direct write credentials. Every state change requires explicit role-authenticated human confirmation. |
| **Privilege Escalation** | Low-privilege staff attempting to approve credit holds or override balances. | **Server-Side Role Guard**: Hardcoded server validation enforcing `user_role IN ('ROLE_FOUNDER', 'ROLE_SALES')`. |
| **Replay Attacks** | Capturing and resending confirmation requests or Slack interaction payloads. | **Idempotency Keys**: Unique database constraint on `idempotency_key` rejects duplicate submissions. Slack HMAC includes a strict 5-minute expiry check. |
| **Notification Flooding** | Repeated monitor ticks generating duplicate alerts for ongoing incidents. | **Deterministic Fingerprinting**: `sha256(alert_type:entity_type:entity_id:incident_ref)` guarantees single active alert record. |
| **Audit Ledger Tampering** | Malicious deletion or modification of historic action records. | **Append-Only Ledger**: Database table `jarvis_system.action_audit_ledger` has no UPDATE or DELETE triggers or application routes. |

---

## 2. Cryptographic Controls

- **Slack Signature Verification**: `HMAC-SHA256` matching Slack's v0 protocol using secret stored in environment variables (`SLACK_SIGNING_SECRET`).
- **Database Connection Security**: Enforced TLS over Supavisor connection pooler ports 5432 and 6543.
- **Idempotency Fingerprints**: Client and server-generated UUIDv4 keys prefixed with `idemp_`.
