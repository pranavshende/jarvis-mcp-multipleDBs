# Jarvis v1 — Phase 2 REST API Specification

## 1. Alert Management Endpoints

### `GET /api/alerts`
- **Query Parameters**:
  - `status`: Filter by `NEW`, `ACKNOWLEDGED`, `RESOLVED`, `SNOOZED`.
  - `severity`: Filter by `CRITICAL`, `HIGH`, `WARNING`, `INFO`.
  - `limit`: Integer (default: 50).
- **Response**: Array of persisted alert history objects.

### `GET /api/alerts/<alert_id>`
- **Response**: Full alert details including action payload and JSONB metadata.

### `POST /api/alerts/<alert_id>/acknowledge`
- **Body**: `{ "user_id": "EMP-001" }`
- **Response**: `{ "success": true, "result": { "status": "SUCCESS" } }`

### `POST /api/alerts/<alert_id>/resolve`
- **Body**: `{ "user_id": "EMP-001", "notes": "Root cause fixed" }`
- **Response**: `{ "success": true, "result": { "status": "SUCCESS" } }`

### `POST /api/alerts/<alert_id>/snooze`
- **Body**: `{ "user_id": "EMP-001", "duration_minutes": 240, "reason": "Investigating" }`
- **Response**: `{ "success": true, "result": { "snoozed_until": "ISO8601" } }`

### `GET /api/alerts/summary`
- **Response**: Total counts by status and open severity breakdown.

---

## 2. Monitoring & Anomaly Endpoints

### `GET /api/monitoring/status`
- **Response**: Runner execution mode (`REDIS_BULLMQ` vs `IN_PROCESS_FALLBACK`), scheduler thread health, and last execution results for all 4 background jobs.

### `GET /api/monitoring/anomalies`
- **Response**: Rolling 14-day parametric and non-parametric statistical metrics for daily inspection failures and dock scan volumes.

### `POST /api/monitoring/run`
- **Body**: `{ "job": "ach_payout_monitor" | "partner_credit_monitor" | "inventory_inversion_monitor" | "anomaly_detector" }`
- **Response**: Synchronous execution receipt.

---

## 3. Restricted Action Endpoints

### `POST /api/actions/propose`
- **Body**: `{ "action_type": "ACTION_CREDIT_HOLD", "partner_id": 301, "requested_by": "EMP-001" }`
- **Response**: Proposal object containing action ID, 15-minute expiration, and required token `CONFIRM CREDIT HOLD`.

### `GET /api/actions/pending`
- **Response**: List of active unexpired proposals awaiting human confirmation.

### `POST /api/actions/<action_id>/confirm`
- **Body**:
  ```json
  {
    "user_id": "EMP-001",
    "user_role": "ROLE_FOUNDER",
    "confirmation_token": "CONFIRM CREDIT HOLD",
    "idempotency_key": "idemp_custom_uuid"
  }
  ```
- **Response**: Execution receipt and ledger audit record. Returns HTTP 403 if unauthorized role; HTTP 400 if token mismatch.

### `GET /api/actions/history`
- **Response**: Append-only audit records directly from `jarvis_system.action_audit_ledger`.
