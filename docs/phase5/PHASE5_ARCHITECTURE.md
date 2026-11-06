# Jarvis v1 Phase 5 — System Architecture & Topology

## 1. Executive Summary

Phase 5 introduces five production-grade enterprise optimization, evaluation, and reliability capabilities to the Jarvis v1 Meridian Supply Chain (MSC) intelligence platform:

1. **50-Scenario Certified Golden Question Dataset & Continuous Evaluation Framework** (`eval/golden_dataset.json`, `eval/ci_runner.ts`).
2. **Authorization-Aware Composite Semantic Cache** (`services/cache/composite_cache.ts`, `gateway/src/cache/composite_cache.ts`) with sub-100ms latency SLA, cross-role isolation, and ETL watermark invalidation.
3. **BullMQ Dead-Letter Queues & Automated Failure Recovery** (`services/workers/dlq_handler.ts`, `gateway/src/workers/dlq_handler.ts`) featuring 3 exponential backoff retries, circuit breaker patterns, and idempotent replay/dismiss APIs.
4. **Dynamic AI Model Routing & Departmental Spend Budgets** (`gateway/src/orchestrator/model_router.ts`, `gateway/src/config/models_registry.yaml`) separating workloads into Fast Tier vs. Deep Reasoning Tier with hard monthly spending limits.
5. **Prompt Injection Red-Teaming & Security Guardrails** (`security/redteam/run_redteam.ts`, `gateway/src/security/prompt_guard.ts`) defending 15 attack vectors with 100.0% defense rate.

---

## 2. End-to-End System Topology

```
+-----------------------------------------------------------------------------------+
|                            MERIDIAN CLIENT SURFACES                               |
|   +--------------------------+  +--------------------------+  +-----------------+ |
|   |  Claude Desktop / Cursor |  |   Slack Socket App       |  |  React Web App  | |
|   |  (MCP stdio transport)   |  |   (WebSocket transport)  |  |  (REST/Vite UI) | |
|   +------------+-------------+  +------------+-------------+  +--------+--------+ |
+----------------|-----------------------------|-------------------------|----------+
                 |                             |                         |
                 v                             v                         v
+-----------------------------------------------------------------------------------+
|                     FASTIFY GATEWAY CONTROL PLANE (Port 4000)                    |
|                                                                                   |
|  [Security Guard]  -> PromptGuard (15-vector regex + Base64 auto-inspection)       |
|  [Identity Auth]   -> Bearer Token -> UserContext (role, scopes, dept, email)     |
|                                                                                   |
|  [Composite Cache] -> SHA-256(Query|Params|Role|Scopes|Watermark)                 |
|                       ├─ HIT  (0.07ms) -> Return cached payload                   |
|                       └─ MISS -> Forward to Intent Router                         |
|                                                                                   |
|  [Intent Router]   -> Evaluates intent:                                           |
|                       ├─ Metric Intent    -> Deterministic RPC Tool               |
|                       ├─ Knowledge Intent -> Chunk Retrieval + Vector Search      |
|                       └─ Synthesis Intent -> Dual Retrieval                       |
|                                                                                   |
|  [Model Router]    -> Dynamic Tier Allocation & Budget Verification               |
|                       ├─ Fast Tier (Gemini 2.5 Flash / GPT-4o-mini)               |
|                       ├─ Deep Tier (Gemini 2.5 Pro / GPT-4o)                      |
|                       └─ Ledger -> jarvis_system.token_usage_ledger               |
|                                                                                   |
|  [DLQ Handler]     -> BullMQ Alert/ETL Queues, Retries & Circuit Breaker          |
+------------------------------------+----------------------------------------------+
                                     |
                +--------------------+--------------------+
                |                                         |
                v                                         v
+-------------------------------+       +-------------------------------------------+
|  FLASK BACKEND (Port 5000)    |       |   SUPABASE POSTGRESQL 17.11               |
|  - Star Schema RPCs           |       |   - jarvis_system.semantic_cache          |
|  - RAG Retrieval & Citations  |       |   - jarvis_system.evaluation_runs         |
|  - Crosswalk & Fact Engine    |       |   - jarvis_system.evaluation_results      |
|  - Memory Governance          |       |   - jarvis_system.department_budgets      |
+-------------------------------+       |   - jarvis_system.dlq_audit_log           |
                                        |   - pgvector v0.8.2 Vector Store          |
                                        +-------------------------------------------+
```

---

## 3. Data & Execution Flow

### 3.1. User Query Flow
1. **Ingestion**: Request enters via Fastify Gateway (`/api/query`, `/mcp/stream`, or stdio).
2. **Security Scrubbing**: `PromptGuard.inspect(query)` scans against 15 adversarial regex patterns and decodes Base64 payloads.
3. **Authentication**: `TokenService.authenticate(token)` verifies bearer secret against `jarvis_system.employee_tokens`, populating `req.userContext`.
4. **Cache Lookup**: `CompositeCache.get(query, params, userContext)` hashes the context with current ETL watermark:
   - If hit: validates role & scopes match, returns immediately in < 1ms.
5. **Intent Routing**:
   - `execute_metric`: Calls Flask Backend (`http://127.0.0.1:5000/api/metrics/execute`).
   - `search_knowledge`: Calls Flask Backend (`http://127.0.0.1:5000/api/knowledge/retrieve`).
   - `dual_synthesis`: Calls both and synthesizes response with model.
6. **Model Routing & Budget Check**: `ModelRouter.selectModel(taskType, department)` checks `jarvis_system.department_budgets`. If monthly dollar cap is exceeded, non-critical calls are blocked (operational/security alerts always bypass locks).
7. **Cache Insertion**: Successful responses are written to L1 memory/Redis and L2 PostgreSQL `jarvis_system.semantic_cache`.

---

## 4. Key Architectural Guarantees

| Capability | Guarantee | Verification Test |
|---|---|---|
| **Deterministic Metrics** | LLMs never generate financial or inventory numbers; numbers strictly originate from Star Schema SQL. | `test_metrics.py`, Module A Scenarios |
| **Cross-Role Cache Isolation** | A Sales user can never retrieve cached responses containing Warehouse or AR financial metrics. | `test_composite_cache.ts` Test 5 & 6 |
| **ETL Watermark Synchronization** | When 15-minute ETL completes, old financial cache keys are invalid. | `test_composite_cache.ts` Test 3 |
| **DLQ Exponential Backoff** | Jobs retry at 10s, 30s, and 90s before dead-letter transfer. | `test_dlq_handler.ts` Test 1 & 2 |
| **Budget Fail-Safe** | Critical security/operational alerts bypass departmental budget locks. | `test_model_router_and_budgets.ts` Test 6 |
| **Prompt Injection Immunity** | System prompts, delimiters, and payroll data cannot be extracted via adversarial instructions. | `run_redteam.ts` (15/15 Defended) |

