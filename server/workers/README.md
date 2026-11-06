# Jarvis Distributed Background Workers (BullMQ + Redis 7)

This directory provides the distributed job scheduler and worker service for Jarvis v1 Phase 2.

## Architecture

- **Scheduler (`scheduler.ts`)**: Registers repeatable BullMQ jobs on Redis 7 matching enterprise cron schedules:
  - ACH Member Payout Failure Monitor: `*/15 * * * *`
  - Partner Credit Breach Monitor: `0 * * * *`
  - Inventory Price Inversion Monitor: `0 0 * * *`
  - Statistical Anomaly Detector: `0 1 * * *`
- **Worker (`worker.ts`)**: Consumes jobs with concurrency 5, exponential backoff retries, and failure event handlers.
- **In-Process Fallback**: When Redis is not available or disconnected, the Flask backend's `JobRunner` automatically activates a resilient multi-threaded timer loop so operational rules continue executing without downtime.

## Setup & Running

```bash
cd services/workers
npm install
npm run build
npm run start:scheduler
npm run start:worker
```
