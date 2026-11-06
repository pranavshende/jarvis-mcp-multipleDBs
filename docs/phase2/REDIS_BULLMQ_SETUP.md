# Jarvis v1 — Redis 7 & BullMQ Worker Architecture

## 1. Overview

Phase 2 introduces enterprise background queue scheduling for recurring operational monitoring. The architecture provides a dual-mode execution strategy:

1. **Distributed Mode (Redis 7 + BullMQ TypeScript)**: For multi-instance horizontal scaling, cluster concurrency control, exponential retry backoff, and dead-letter queues.
2. **In-Process Mode (Python Threaded Scheduler Fallback)**: For lightweight local development, single-node deployments, or automatic fallback when Redis connectivity is severed.

---

## 2. Distributed Architecture (BullMQ)

Located under `services/workers/`:
- `scheduler.ts`: Registers repeatable cron schedules into Redis 7.
- `worker.ts`: Listens to `jarvis-operational-queue` with a concurrency limit of 5 and calls the backend runner API.
- `package.json`: Defines TypeScript compilation and runtime targets.

### Configured Schedules

| Job Key | Target Rule | Enterprise Cron | Interval | Priority |
|---|---|---|---|---|
| `ach_payout_monitor` | ACH Payout Failure | `*/15 * * * *` | 15 Minutes | HIGH |
| `partner_credit_monitor` | Partner Credit Breach | `0 * * * *` | 1 Hour | CRITICAL |
| `inventory_inversion_monitor` | Inventory Price Inversion | `0 0 * * *` | 24 Hours | MEDIUM |
| `anomaly_detector` | Statistical Anomaly Engine | `0 1 * * *` | 24 Hours | HIGH |

---

## 3. Resilient In-Process Fallback

When Redis is not reachable, the Flask backend's `JobRunner` (`server/services/queue/job_runner.py`) automatically starts an internal daemon thread (`JarvisJobScheduler`). 
- Polls execution intervals every 5 seconds.
- Dispatches executions on dedicated worker threads.
- Tracks execution timestamps, durations, and outputs in memory and database.
- Exposes runtime health via `GET /api/monitoring/status`.

---

## 4. Operational Commands

### Starting BullMQ Workers (Production Mode)

```bash
cd services/workers
npm install
npm run build
npm run start:scheduler
npm run start:worker
```

### Manual Triggering via REST API

```bash
curl -X POST http://127.0.0.1:5000/api/monitoring/run \
  -H "Content-Type: application/json" \
  -d '{"job": "ach_payout_monitor"}'
```
