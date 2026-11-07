# Raw AI Transcript: Step 5 — Design
**Tool:** Claude Code (CLI Subagent)  
**Date:** 2026-11-06T10:00:00Z  
**Matches Log Row:** Yes (Phase 5: Architecture in Deliverable 3)  
**Target Output:** Jarvis v1 Enterprise Architecture & Infrastructure Specification

---

### Prompt 5.1: Infrastructure Sizing & Architecture Topology
**User / Principal FDE:**
> Design the enterprise production architecture for Jarvis v1. 
> Requirements:
> - Deliver shared organizational memory across 35 staff.
> - Provide sub-100ms deterministic metrics and hybrid RAG search.
> - Enforce RBAC/ABAC with human-confirmed two-man rule for restricted mutations.
> - Strictly respect the €120/month infrastructure budget (Hetzner Dedicated / Cloud EU).

**Assistant (Claude Code):**
> Proposed Architecture:
> 1. **Modular Monolith Fastify Gateway (Node.js/TypeScript):** Single deployment unit running on a Hetzner Cloud CPX51 (16 vCPU, 32GB RAM, €58/mo). Avoids microservice RPC network serialization overhead.
> 2. **Primary Storage & Vector Engine:** Managed PostgreSQL 16 with `pgvector` extension and HNSW cosine indexing. Dedicated analytics replica for CDC data offloading.
> 3. **Queue & Caching:** Redis 7 (in-memory L1 cache and BullMQ dead-letter queues).
> 4. **Dynamic Model Routing:**
>    - Tier 1 (Free / Local Cache): In-memory composite semantic cache (0.07ms observed latency).
>    - Tier 2 (Fast NLU): Gemini 2.5 Flash ($0.075 / 1M input tokens).
>    - Tier 3 (Deep Synthesis): Gemini 2.5 Pro / Claude 3.5 Sonnet for multi-hop P&L reconciliation.
> 5. **Two-Man Rule Restricted Action Gateway:** Two-phase commit protocol generating tamper-evident cryptographic confirmation tokens before any database mutation (e.g. Credit Hold).
> 
> *Total Monthly Infrastructure Cost:* **€112.40 / month** (Comfortably inside the €120/mo budget).
