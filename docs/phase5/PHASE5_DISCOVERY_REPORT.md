# Jarvis v1 — Phase 5 Discovery & Architectural Baseline Report
**Evaluation, Reliability, Dead-Letter Queues & Optimization**  
**Author:** Principal AI Engineer, Backend Architect & Security Specialist  
**Target Infrastructure:** Hetzner Linux Host + Supabase PostgreSQL 16 (EU Central) + Redis 7  
**Date:** 2026-11-06  
**Status:** Certified Discovery & Baseline Architecture

---

## 1. Executive Summary

Phase 5 transitions Jarvis v1 from a functional multi-tier platform (Phases 0–4) into a hardened, continuously evaluated, highly reliable, and cost-optimized enterprise intelligence layer.

Prior to development, a comprehensive audit of the active codebase across `server/`, `server/gateway/`, `client/`, and `docs/` was executed. The system currently possesses:
1. **Phase 1**: Analytical star schema in Supabase (`analytics`), deterministic metric SQL calculations (e.g., Package Counts, Gross Margin, Overdue AR, Credit Utilization), and nightly/incremental reconciliation engines.
2. **Phase 2**: Deterministic alert rules engine, Z-score/IQR anomaly detectors, decoupled notification adapters, and an idempotent Restricted Action Service with human cryptographic approval tokens.
3. **Phase 3**: Company memory chunker, automated PII/secrets sanitizer, pgvector hybrid search (dense embeddings + BM25 keyword matching), and three-tier knowledge promotion governance.
4. **Phase 4**: Central Fastify TypeScript Gateway on port 4000, official `@modelcontextprotocol/sdk` (stdio + streamable HTTP), sub-2.5ms token forgery rejection, 9 registered enterprise tools, 3-path intent classifier, spend ledger tracking, and React Admin Dashboard.

Phase 5 implements the 5 missing critical enterprise resilience pillars:
- **50-Scenario Golden Evaluation Dataset & CI Runner (`eval/golden_dataset.json`, `eval/ci_runner.ts`)**
- **Authorization-Aware Composite Semantic Cache (`services/cache/composite_cache.ts`)**
- **BullMQ Dead-Letter Queues & Failure Recovery (`services/workers/dlq_handler.ts`)**
- **Dynamic Model Routing Tiers & Departmental Budgets (`model_router.ts`, `models_registry.yaml`)**
- **Layered Prompt Injection & Adversarial Red-Teaming Suite (`security/redteam/`)**

---

## 2. Existing Modules & Reuse Inventory

| Module Path | Primary Responsibility | Reusable Phase 5 Foundation |
|---|---|---|
| `server/services/metrics_engine.py` | 13 deterministic financial & operational SQL metrics | Ground truth evaluation assertions for all Quantitative Scenarios (15). |
| `server/services/rag/` | Chunker, embedding service, sanitizer, vector store | Retrieval target for Policy/SOP Scenarios (15) & indirect injection red-teaming. |
| `server/services/rules/` & `actions/` | Alert monitors & human-confirmed Restricted Actions | Action verification, DLQ alert retries, and non-bypassable action boundaries. |
| `server/gateway/src/server.ts` | Fastify Gateway entrypoint on Port 4000 | Host for Cache middleware, intent interception, and Admin API endpoints. |
| `server/gateway/src/orchestrator/intent_router.ts` | Path A (SQL), Path B (RAG), Path C (Dual Synthesis) | Routing target evaluated by CI runner; cache integration point. |
| `server/gateway/src/orchestrator/model_router.ts` | Tier-based model execution & spend ledger | Expansion point for Fast vs. Deep tiers, fallback logic, and budget gates. |
| `server/gateway/src/config/models_registry.yaml` | Model definitions, routing rules, pricing | Master configuration for provider tiers, fallback priorities, and token costs. |
| `server/gateway/src/security/prompt_guard.ts` | Token forgery rejection & prompt injection checks | Primary defense layer tested and hardened by the red-team suite. |
| `server/workers/` | Redis 7 & BullMQ job processor | Foundation for retry policies, dead-letter queues (`bullmq:dlq:*`), and DLQ handler. |
| `client/src/components/AdminDashboard.jsx` | React 18 Admin Control Plane | Extensible UI for Evaluation Center, Cache Analytics, Spend, DLQ, and Security. |

---

## 3. Missing Capabilities in Existing Codebase

1. **Golden Evaluation Dataset**:
   - `eval/baseline_eval.json` only contains 10 basic questions.
   - Missing: A complete, certified 50-scenario dataset covering Quantitative (15), Policy/SOP (15), Security/Adversarial (10), and Strategic Synthesis (10).
2. **Evaluation CI Runner**:
   - Missing an automated TypeScript runner (`eval/ci_runner.ts`) capable of evaluating accuracy, precision, citations, authorization refusal, latency, and token consumption with structured JSON reports.
3. **Semantic Cache**:
   - Missing Redis/PostgreSQL composite cache keyed by query hash, sanitized parameters, user role, allowed scopes, and ETL watermark.
   - Missing dual-tier invalidation (TTL + ETL watermark triggers).
4. **BullMQ Dead-Letter Queues (DLQ)**:
   - Current worker lacks 3-attempt exponential backoff (10s, 30s, 90s), dead-letter queues (`bullmq:dlq:alerts`, `bullmq:dlq:etl`), circuit breaker, and idempotent replay APIs.
5. **Dynamic Routing & Departmental Budgets**:
   - Model router lacks explicit Fast Tier vs. Deep Reasoning Tier dynamic routing, multi-provider fallback (Gemini -> Anthropic/OpenAI), and departmental budget limits in `jarvis_system`.
6. **Prompt Injection Red-Teaming Suite**:
   - Missing automated adversarial test harness with 15 attack vectors (direct injection, indirect document injection, delimiter evasion, payroll exfiltration, token theft).

---

## 4. Architectural Risks & Mitigation Strategy

| Risk | Cause | Mitigation Strategy |
|---|---|---|
| **Cross-Role Cache Leakage** | Caching financial metrics or private facts without scope boundaries | Composite cache key incorporates `userSecurityContext.role`, `userSecurityContext.allowedScopes.sort().join(",")`, and user ID for private scopes. Cache hit still verifies caller authorization. |
| **Stale Financial Numbers** | Re-serving cached metrics after nightly or 15m ETL synchronization | Financial cache keys incorporate the current ETL watermark timestamp (`analytics.reconciliation_log` latest sync). Invalidation hook purges or invalidates on sync. Max TTL 15 min. |
| **DLQ Duplicate Action Execution** | Auto-retrying non-idempotent business actions | DLQ recovery requires manual admin intervention via human confirmation token; action service enforces idempotency key constraints. |
| **Silent Model Downgrade** | Fallback to cheaper model losing reasoning capability | Router verifies fallback model capabilities before dispatching; logs structured warning; rejects fallback if security constraints require specific tier. |
| **Indirect Document Injection** | Retrieved RAG chunks containing malicious instructions (e.g. "Ignore previous instructions") | Treat all retrieved chunks as untrusted data (`<untrusted_document>` delimiters); validate tool schemas server-side; Prompt Guard scans retrieved context. |

---

## 5. Baseline Test & Benchmark Results

Before modifications, existing test suites were executed:
- **Phase 1 Unit & Integrity Tests**: 100% PASS (13/13 metrics, timezone verifications).
- **Phase 2 Alert & Action Tests**: 100% PASS (anomaly detectors, human confirmation tokens).
- **Phase 3 Sanitizer & Security Tests**: 100% PASS (100/100 sensitive redaction cases verified; zero leaks).
- **Phase 3 RAG Retrieval Benchmark**: Precision@5 = 94.4%, Mean Reciprocal Rank = 0.806 across 18 operational queries.
- **Phase 4 MCP Stdio Server**: 100% PASS (9 registered tools verified over official MCP transport).

---

## 6. Implementation Phasing Plan

1. **Module A — Golden Question Dataset (`eval/golden_dataset.json`)**: 50 scenarios with deterministic ground truth and refusal assertions.
2. **Module B — CI Evaluation Runner (`eval/ci_runner.ts` / runner script)**: Automated scoring harness and GitHub Actions workflow.
3. **Module C — Authorization-Aware Composite Cache (`services/cache/composite_cache.ts`)**: Redis + PG schema `jarvis_system.semantic_cache`.
4. **Module D — BullMQ DLQ & Recovery Handler (`services/workers/dlq_handler.ts`)**: 3-step exponential backoff, DLQ queues, circuit breaker, and admin APIs.
5. **Module E — Dynamic Model Router & Budgets (`gateway/src/orchestrator/model_router.ts`)**: Fast vs. Deep reasoning tiers, fallback, and departmental spend limits.
6. **Module F — Prompt Injection Red-Teaming (`security/redteam/`)**: 15 attack vectors and security audit report.
7. **Admin Dashboard Extension (`client/src/components/AdminDashboard.jsx`)**: 5 new control views + REST APIs in `admin_routes.ts`.
8. **Database Migration (`005_jarvis_phase5_optimization.sql`)**: Deploy semantic cache, evaluation runs, DLQ audit, and budgets.
9. **Full Verification & Certification**: Regression pass across Phases 1–5 and final delivery report.
