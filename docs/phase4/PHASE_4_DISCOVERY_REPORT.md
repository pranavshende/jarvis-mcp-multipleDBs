# Jarvis v1 — Phase 4 Discovery Report: Central Gateway, MCP Protocol, Model Registry & Admin Dashboard

**Project:** Meridian Supply Chain (MSC) Enterprise Intelligence Platform  
**Target Release:** `v0.4.0-phase4-gateway`  
**Author:** Principal AI Systems Architect, Security Engineer, and Backend Systems Engineer  
**Date:** November 6, 2026  
**Status:** Approved Discovery Report  

---

## 1. Executive Summary

Phase 4 of Jarvis v1 transitions Meridian Supply Chain's enterprise intelligence layer from a direct REST-queried architecture into a centralized, authenticated **Jarvis Gateway and Orchestration Hub**.

The existing implementation across Phases 1, 2, and 3 is verified, functional, and fully operating:
- **Phase 1 (Data Foundation):** 15 certified deterministic SQL metrics, analytical star schema (`analytics`), crosswalk matching, and 15-minute synchronization running against Supabase Cloud PostgreSQL 17.11.
- **Phase 2 (Deterministic Intelligence):** Anomaly alert engine, notification adapters, Restricted Action Service with explicit human confirmation phrase requirements, idempotency protection, and immutable audit logging in `app.restricted_action_ledger`.
- **Phase 3 (Shared Memory & RAG):** `jarvis_memory` schema with 110 indexed sources, 746 chunks, HNSW + GIN single-CTE hybrid search (< 1 ms server-side execution), deterministic heuristic reranking, exact source citations, and three-tier memory governance (3x corroboration & contradiction detection).

Phase 4 introduces a dedicated **Node.js + TypeScript Fastify Gateway** operating on port 4000. This service acts as an Orchestrator and Security Boundary, eliminating anonymous access by binding every request to an authenticated corporate identity, supporting official MCP (`stdio` and `Streamable HTTP`), Slack Socket Mode, a dynamic Model Registry, and a unified React Admin Dashboard.

---

## 2. Inventory of Existing Subsystems & Reusability Audit

### 2.1 Services to Reuse Directly (Zero Business Logic Duplication)
| Existing Service | Location | Consumed Interface | Non-Duplication Mandate |
|---|---|---|---|
| **Deterministic Metrics Engine** | `server/services/metrics_engine.py` | `POST /api/metrics/execute`, `GET /api/metrics/list` | The gateway **never** generates synthetic SQL. It calls `metrics_engine.execute_metric` exclusively. |
| **Crosswalk Engine** | `server/services/crosswalk_service.py` | `GET /api/crosswalk/products`, `GET /api/crosswalk/order` | Resolves canonical identities across Seller, WMS, and Portal without recreating lookups. |
| **Restricted Action Service** | `server/services/action_service.py` | `POST /api/actions/propose`, `POST /api/actions/<id>/confirm` | The LLM may only *propose* actions. Human confirmation token matching and idempotency remain strictly inside this service. |
| **Alert Monitoring Engine** | `server/services/monitoring/` | `GET /api/alerts`, `POST /api/alerts/<id>/snooze` | Active anomalies and alerts are fetched directly; no secondary alert state is maintained in the gateway. |
| **Hybrid Vector Store** | `server/services/rag/vector_store.py` | `POST /api/knowledge/retrieve`, `POST /api/knowledge/search` | Reuses single-CTE HNSW+GIN search and deterministic heuristic reranker with certified citations. |
| **Knowledge Promoter (Governance)** | `server/services/rag/knowledge_promoter.py` | `GET /api/knowledge/candidates`, `POST /api/knowledge/candidates/<id>/approve` | Reuses 3-tier staging, contradiction checks, and Domain Lead approval logic. |

### 2.2 APIs the Gateway Must Consume from the Flask Backend (`http://127.0.0.1:5000`)
- `GET /api/health`, `GET /api/health/db`
- `GET /api/metrics/list`
- `POST /api/metrics/execute`
- `GET /api/sync/status`
- `GET /api/crosswalk/products`, `GET /api/crosswalk/order`
- `GET /api/alerts`, `GET /api/alerts/summary`, `POST /api/alerts/<id>/snooze`
- `POST /api/actions/propose`, `GET /api/actions/pending`, `POST /api/actions/<id>/confirm`, `GET /api/actions/history`
- `POST /api/knowledge/retrieve`, `POST /api/knowledge/search`, `GET /api/knowledge/sources`
- `GET /api/knowledge/candidates`, `POST /api/knowledge/candidates/<id>/approve`, `POST /api/knowledge/candidates/<id>/reject`, `GET /api/knowledge/memory`

---

## 3. What Needs to Be Created in Phase 4

### 3.1 Central Fastify Gateway (`gateway/`)
1. **Application Bootstrap (`gateway/src/server.ts`):** Fastify server configured on port 4000 with CORS, JSON body parser, structured logging, request IDs, and graceful shutdown.
2. **Security & Identity Pipeline (`gateway/src/auth/` & `gateway/src/security/`):**
   - Cryptographic Bearer token validator (`token_service.ts`): SHA-256 hashed token lookup in `jarvis_system.api_tokens`.
   - Identity Resolver (`identity_resolver.ts`): Resolves token to `{ userId, email, role, department, allowedScopes, tokenId }`.
   - RBAC & Tool Allowlist (`rbac.ts`, `tool_allowlist.ts`): Server-side role-to-tool permission enforcement.
   - Prompt Injection Delimiter Scanner (`prompt_guard.ts`): Scans untrusted prompts for system boundary exploits (`---BEGIN SYSTEM---`, etc.).
3. **MCP Server Transports (`gateway/src/mcp/`):**
   - `@modelcontextprotocol/sdk` integration.
   - `streamable_http.ts`: Modern Streamable HTTP transport at `/mcp/stream` with keepalive pings and session resumption.
   - `stdio_server.ts`: Local stdio transport for Claude Desktop / Cursor.
   - `tool_registry.ts`: Declarative schemas for `execute_metric`, `query_company_knowledge`, `stage_knowledge_candidate`, `propose_business_action`, and `confirm_business_action`.
4. **Intent Router (`gateway/src/orchestrator/intent_router.ts`):**
   - Path A: Business Metric Route
   - Path B: Document Knowledge Route
   - Path C: Dual Synthesis Route
5. **Configurable Model Registry (`gateway/src/config/models_registry.yaml` & `model_router.ts`):**
   - Fast tier and Deep tier definitions.
   - Decoupled pricing per million tokens, fallback chains, and context window limits.
6. **Slack App (`gateway/src/integrations/slack_client.ts`):**
   - `@slack/bolt` in Socket Mode (no inbound open firewall ports required).
   - Slack user ID to corporate email verification via Slack Web API.
7. **Audit & Spend Tracking (`gateway/src/audit/`):**
   - Asynchronous logging of every request to `jarvis_system.audit_logs`.
   - Per-user token consumption and dollar estimate logging in `jarvis_system.token_usage_ledger`.
8. **Admin REST API (`gateway/src/admin/`):**
   - `/api/admin/users`, `/api/admin/tokens`, `/api/admin/tokens/revoke`, `/api/admin/tokens/rotate`.
   - `/api/admin/models/spend`, `/api/admin/models/usage`.
   - `/api/admin/health`, `/api/admin/jobs`.

### 3.2 Database Schema Extensions (`jarvis_system`)
Extend the existing Supabase `jarvis_system` schema with:
- `jarvis_system.api_tokens` (hashed bearer tokens, scopes, expiration, status)
- `jarvis_system.audit_logs` (request metadata, tool, user email, latency, status)
- `jarvis_system.token_usage_ledger` (input/output tokens, estimated cost by model & user)
- `jarvis_system.user_preferences` (preferred tiers, client configurations)

### 3.3 React Admin Dashboard Extension (`client/src/components/AdminDashboard.jsx`)
Integrated into the existing React 18 + Vite frontend under an "Admin & MCP Gateway" navigation tab:
- Executive Overview (tokens, spend, active users, alerts)
- User & Token Management (provision token once, view hashes, revoke, rotate)
- AI Model Spend & Cost Ledger
- Memory Approval Queue (invoking Phase 3 backend)
- Alert History & Dead-Letter Jobs (invoking Phase 2 backend)
- System Health & Sync Status

---

## 4. Authentication, Authorization & Security Gaps Identified

1. **Anonymous Shared Access Risk:** Prior to Phase 4, developer/API calls directly hit Flask without granular per-employee token identity. Phase 4 resolves this by mandating that **every** inbound request resolves to an authenticated corporate employee record.
2. **Token Security:** Plaintext tokens must never be persisted. Only SHA-256 hashes are stored. Plaintext tokens (`msc_mcp_<user>_<secret>`) are shown strictly once upon creation.
3. **Target Authentication Latency:** Token forgery checks must reject forged or revoked tokens within 20 ms.
4. **LLM Execution Restriction:** The LLM must possess zero write credentials and zero direct database execution rights. All mutations pass through Phase 2 human-confirmation workflows.

---

## 5. Deployment & Runtime Dependencies

- **Node.js Environment:** Node.js v24.11.1 and npm 11.7.0 verified available.
- **Node Packages:** `fastify`, `@fastify/cors`, `@fastify/sensible`, `@modelcontextprotocol/sdk`, `@slack/bolt`, `zod`, `pg`, `dotenv`, `yaml`, `typescript`, `tsx`.
- **Database:** Supabase Cloud PostgreSQL 17.11 with Supavisor direct port 5432 and pooler port 6543.
- **Backend Service:** Python Flask backend active on `http://127.0.0.1:5000`.
- **Frontend Client:** React 18 + Vite active on `http://localhost:3001`.
- **Gateway Service:** Fastify running on `http://127.0.0.1:4000`.

---

## 6. Risk Analysis & Breaking Change Prevention

| Risk | Severity | Mitigation Strategy |
|---|---|---|
| Gateway failure interrupting Flask APIs | High | Flask backend remains autonomous on port 5000. Existing endpoints are untouched. |
| Streamable HTTP connection drops | Medium | Keepalive pings every 15s; session resumption tokens supported. |
| Hardcoded model pricing drifting | Low | Dynamic `models_registry.yaml` decouples code from external LLM pricing shifts. |
| Slack identity spoofing | Critical | Never trust user-supplied email strings. Resolve user identity exclusively via Slack API `users.info` email verification. |
| Direct database write attempts | Critical | Zero LLM database write roles. All mutations dispatched to Phase 2 Restricted Action Service. |

---

## 7. Approval & Implementation Readiness

- **Status:** **DISCOVERY COMPLETE — READY FOR IMPLEMENTATION**
- **Proceeding to:** Stage 1 (Database Migration & Model Registry) and Stage 2 (Fastify Gateway Setup).
