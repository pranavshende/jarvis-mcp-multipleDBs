# Jarvis v1 Phase 5 — API Documentation

This document describes all REST and Gateway endpoints introduced in Phase 5, including request payloads, response schemas, and authentication requirements.

All admin endpoints require an active Founder/Executive MCP Bearer token in the `Authorization: Bearer <token>` header.

---

## 1. Evaluation Center APIs

### 1.1. Get Latest Evaluation Run Summary
- **Endpoint**: `GET /api/admin/evaluation/summary`
- **Description**: Returns overall pass rates, category scores, latency, and token totals from the latest CI evaluation benchmark.
- **Response**:
```json
{
  "summary": {
    "runId": "eval-run-1762438345123",
    "startedAt": "2026-11-06T14:12:25.123Z",
    "completedAt": "2026-11-06T14:13:35.819Z",
    "totalScenarios": 50,
    "passedScenarios": 48,
    "failedScenarios": 2,
    "passRatePct": 96.0,
    "status": "COMPLETED",
    "triggerType": "CI_BENCHMARK",
    "categoryScores": {
      "QUANTITATIVE_METRICS": { "total": 15, "passed": 15, "pct": 100.0 },
      "POLICY_AND_SOP": { "total": 15, "passed": 13, "pct": 86.7 },
      "SECURITY_AND_ADVERSARIAL": { "total": 10, "passed": 10, "pct": 100.0 },
      "STRATEGIC_SYNTHESIS": { "total": 10, "passed": 10, "pct": 100.0 }
    },
    "metrics": {
      "avgLatencyMs": 1413.89,
      "totalTokens": 22500,
      "totalEstimatedCostUsd": 0.02851
    }
  }
}
```

### 1.2. Get Historical Runs
- **Endpoint**: `GET /api/admin/evaluation/runs`
- **Description**: Returns up to the last 20 evaluation runs.

### 1.3. Get Scenarios in Latest Run
- **Endpoint**: `GET /api/admin/evaluation/scenarios`
- **Description**: Returns all 50 scenarios from the latest run with assertion statuses, latencies, and models used.

---

## 2. Composite Semantic Cache APIs

### 2.1. Get Cache Statistics
- **Endpoint**: `GET /api/admin/cache/stats`
- **Description**: Returns real-time metrics including hits, misses, hit ratio %, and active ETL watermark.
- **Response**:
```json
{
  "stats": {
    "totalRequests": 128,
    "hits": 112,
    "misses": 16,
    "hitRatioPct": 87.5,
    "storedKeys": 42,
    "etlWatermark": "2026-11-06T14:00:00.000Z"
  }
}
```

### 2.2. List Cached Entries
- **Endpoint**: `GET /api/admin/cache/entries`
- **Description**: Returns up to 50 active cache records stored in `jarvis_system.semantic_cache`.

### 2.3. Invalidate Cache
- **Endpoint**: `POST /api/admin/cache/invalidate`
- **Request Body**:
```json
{
  "scope": "ALL" | "FINANCIAL" | "KNOWLEDGE" | "ROLE" | "USER" | "WATERMARK",
  "targetValue": "optional role, user_id, or watermark"
}
```
- **Response**:
```json
{
  "invalidatedCount": 18,
  "message": "Invalidated 18 cache entries for scope: FINANCIAL"
}
```

---

## 3. Dynamic Model Routing & Budget APIs

### 3.1. Get Model Registry Tiers
- **Endpoint**: `GET /api/admin/models`
- **Description**: Returns tier allocations (Fast Tier vs. Deep Reasoning Tier) and costs per million tokens.

### 3.2. Get Departmental Budgets
- **Endpoint**: `GET /api/admin/models/budgets`
- **Description**: Returns monthly token and dollar caps per department, along with current utilization.
- **Response**:
```json
{
  "budgets": [
    {
      "department": "OPERATIONS",
      "tokenLimitMonthly": 50000000,
      "costLimitUsd": 250.00,
      "currentSpentUsd": 18.42,
      "status": "ACTIVE"
    },
    {
      "department": "FINANCE",
      "tokenLimitMonthly": 30000000,
      "costLimitUsd": 150.00,
      "currentSpentUsd": 12.10,
      "status": "ACTIVE"
    }
  ]
}
```

### 3.3. Get Model Usage Breakdown
- **Endpoint**: `GET /api/admin/models/usage`
- **Description**: Returns token consumption, request counts, and dollar spend grouped by department and model name.

---

## 4. BullMQ Dead-Letter Queue (DLQ) APIs

### 4.1. Get DLQ Overview
- **Endpoint**: `GET /api/admin/dlq`
- **Description**: Returns counts of dead jobs in `bullmq:dlq:alerts` and `bullmq:dlq:etl`, plus circuit breaker states.
- **Response**:
```json
{
  "alertsDlqCount": 0,
  "etlDlqCount": 0,
  "circuitBreakers": {
    "alerts": "CLOSED",
    "etl": "CLOSED"
  },
  "deadJobs": []
}
```

### 4.2. Retry DLQ Job (Idempotent)
- **Endpoint**: `POST /api/admin/dlq/:jobId/retry`
- **Request Body**:
```json
{
  "reason": "Admin Control Plane manual retry"
}
```
- **Response**:
```json
{
  "success": true,
  "jobId": "job-alert-401",
  "message": "Job re-enqueued for processing",
  "status": "RE_ENQUEUED"
}
```

### 4.3. Dismiss DLQ Job
- **Endpoint**: `POST /api/admin/dlq/:jobId/dismiss`
- **Request Body**:
```json
{
  "reason": "Permanent operational dismissal"
}
```
- **Response**:
```json
{
  "success": true,
  "jobId": "job-alert-401",
  "message": "Job permanently dismissed and archived",
  "status": "DISMISSED"
}
```

---

## 5. Security & Red-Team APIs

### 5.1. Get Red-Team Benchmark Results
- **Endpoint**: `GET /api/admin/security/redteam`
- **Description**: Returns results for all 15 certified red-team attack vectors.
- **Response**:
```json
{
  "passedCount": 15,
  "totalAttacks": 15,
  "defenseRatePct": 100.0,
  "results": [
    {
      "id": "RT-01",
      "name": "Direct System Prompt Override",
      "severity": "CRITICAL",
      "guardrail": "Regex DANGEROUS_PATTERNS",
      "defended": true
    }
  ]
}
```

### 5.2. Get Security Event Logs
- **Endpoint**: `GET /api/admin/security/events`
- **Description**: Returns security audit records (`DENIED`, `CONFIRMATION_REQUIRED`, `ERROR`) from `jarvis_system.audit_logs`.
