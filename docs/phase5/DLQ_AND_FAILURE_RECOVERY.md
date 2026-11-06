# Jarvis v1 — BullMQ Dead-Letter Queue (DLQ) & Failure Recovery Specification
**Phase 5: Evaluation, Reliability & Optimization**  
**Component Path:** `services/workers/dlq_handler.ts` / `server/gateway/src/workers/dlq_handler.ts`  
**Underlying Architecture:** Redis 7 + BullMQ 5 + Supabase PostgreSQL `jarvis_system.dlq_audit_log`  
**Author:** Principal DevOps & Site Reliability Engineer  
**Date:** 2026-11-06  

---

## 1. Retry Strategy & Backoff Exponential Policy

Jarvis background workers execute critical asynchronous jobs (e.g., automated inventory inversion checks, partner credit monitoring, dock-to-stock intake aggregations, and incremental ETL reconciliations).

When a job experiences an upstream transient failure (e.g. database connection pool saturation, external network blip, lock timeout):
1. **Attempt 1 Failure:** Backoff delay = **10 seconds** (10,000 ms).
2. **Attempt 2 Failure:** Backoff delay = **30 seconds** (30,000 ms).
3. **Attempt 3 Failure:** Backoff delay = **90 seconds** (90,000 ms).
4. **Retry Exhaustion:** Once `attempt_count >= 3`, automatic retries cease immediately to prevent retry storms. The job is transferred to the designated Dead-Letter Queue.

---

## 2. Dead-Letter Queues (DLQ) Structure

Two dedicated BullMQ queues capture dead-lettered tasks:
- **`bullmq:dlq:alerts`**: Monitors deterministic rule execution, statistical anomaly detections, and notification adapter deliveries.
- **`bullmq:dlq:etl`**: Monitors 15-minute Supabase synchronization, star schema updates, and nightly FIFO reconciliations.

Each transferred job preserves:
- `job_id`: Original job identifier.
- `queue_name`: Target DLQ name.
- `job_type`: Job type string (e.g. `partner_credit_monitor`).
- `attempt_count`: Total attempts made (3).
- `failure_reason`: Exact error message.
- `error_stack`: Complete stack trace.
- `correlation_id`: Distributed trace UUID for correlation with Gateway logs.
- `recovery_status`: Set to `PENDING`.

Upon transfer, an automated incident notification is sent to Slack channel `#eng-alerts`.

---

## 3. Circuit Breaker Specification

To protect downstream databases and external APIs from cascade failures, the `CircuitBreaker` pattern is integrated into background dispatching:
- **Trip Threshold:** 5 consecutive failures within a 60-second sliding window.
- **State Transition:** `CLOSED` ➔ `OPEN`.
- **Behavior in `OPEN`:** Inbound heavy ingestion tasks are fast-failed or deferred without hitting upstream databases.
- **Cooldown & Recovery:** After a **30-second cooldown**, the state transitions to `HALF_OPEN`, allowing a single probe request. If successful, it resets to `CLOSED`.

---

## 4. Administrative Failure Recovery & Safety Barriers

Privileged users (`ROLE_ADMIN`, `ROLE_FOUNDER`) can inspect and manage failed jobs via the Admin Dashboard or REST APIs:

1. **Idempotent Manual Retry (`POST /api/admin/dlq/:jobId/retry`)**:
   - Re-enqueues the job into the operational queue with its original idempotency key and correlation ID.
   - Updates `recovery_status = 'RETRIED'` with the resolving user and timestamp.
   - Prevents duplicate replays if the job is already marked as `RETRIED`.
2. **Dismissal with Reason (`POST /api/admin/dlq/:jobId/dismiss`)**:
   - Marks the job as `DISMISSED` with mandatory justification notes.
3. **Non-Negotiable Safety Barrier**:
   - Automatic or one-click DLQ replay of **restricted business actions** (e.g., credit holds, payout cancellations) is strictly prohibited. The system requires initiating a new action proposal with an explicit human confirmation token.
