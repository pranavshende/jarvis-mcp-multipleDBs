# Jarvis v1 — Decoupled Notification Adapters

## 1. Overview

Notification delivery is completely decoupled from detection logic via abstract adapter contracts (`server/services/alerts/adapters/`). 

All adapters accept a standardized `NotificationEvent` payload:
```json
{
  "id": "uuid",
  "fingerprint": "hex32",
  "alertType": "ACH_PAYOUT_FAILURE",
  "severity": "CRITICAL",
  "title": "Alert Title",
  "summary": "Detailed context...",
  "entity_type": "PAYOUT_BATCH",
  "entity_id": "BATCH_20261012",
  "action_payload": {},
  "metadata": {},
  "source": "RULES_ENGINE",
  "status": "NEW",
  "detectedAt": "ISO8601"
}
```

---

## 2. Supported Adapters

### 2.1 Slack Adapter (`SlackNotificationAdapter`)
- **Block Kit Formatter**: Generates interactive cards with severity color banners, summary blocks, and inline interactive action buttons (`Acknowledge`, `Resolve`, `Snooze 4h`).
- **HMAC-SHA256 Signature Security**:
  - Validates `X-Slack-Signature` using `X-Slack-Request-Timestamp`.
  - Rejects replay attacks older than 5 minutes.
  - Formula: `v0 = hmac_sha256(SLACK_SIGNING_SECRET, "v0:" + timestamp + ":" + body)`
- **Delivery Modes**: Live Webhook POST (when `SLACK_WEBHOOK_URL` configured) or structured staging mock logger.

### 2.2 Admin Dashboard Adapter (`AdminDashboardAdapter`)
- Feeds the in-memory and database event bus consumed by the React 18 frontend Alert Center (`/api/alerts`).

### 2.3 Email Adapter (`EmailNotificationAdapter`)
- Provider-independent interface (SendGrid, SES, SMTP) for high-severity alerts (`CRITICAL`, `HIGH`).
- Formats structured HTML emergency briefings with escalation contact chains.
