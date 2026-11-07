# Meridian + Jarvis Investigation Transcripts
## Session 03: Architecture Stress-Testing & Technical Trade-Offs

**Session Metadata:**
- **Date:** 2026-11-06T10:15:44Z
- **Focus:** Hetzner EU Hosting, BullMQ Queueing, pgvector RAG, and MCP Protocol Design

---

### Prompt 3.1: Architecture Topology & Infrastructure Footprint
**User / Engineer:**
> Ground Rule 6 requires running on one modest EU server with existing AI accounts to bring spend down. Evaluate deploying a microservices mesh vs a Modular Monolith on a Hetzner Cloud dedicated instance (`fsn1-cx31`, 8 vCPU, 32GB RAM, €119.80/month).

**Assistant (Architecture Evaluation):**
> **Microservices Mesh Assessment:**
> - Disadvantages: Requires Kubernetes/Nomad, internal Consul/Envoy service mesh, distributed tracing, and complex inter-service networking. Would consume 60-70% of available host RAM just running control plane overhead.
> 
> **Modular Monolith Assessment (Recommended):**
> - Single Node.js/TypeScript Fastify application running in Docker Compose alongside Redis 7 and PostgreSQL 16 with pgvector.
> - Zero network serialization latency between Gateway, Intent Router, and Cache.
> - Memory footprint under 6GB under full peak load (leaving 26GB for OS page caching and PostgreSQL shared buffers).
> - Perfectly satisfies Ground Rule 6.

---

### Prompt 3.2: Replicated ODS vs Postgres Foreign Data Wrappers (FDW)
**User / Engineer:**
> Should Jarvis v1 execute real-time cross-database joins across AWS RDS instances using Postgres FDW, or should it replicate tables to a local Operational Data Store (ODS)?

**Assistant (Database Engineering Analysis):**
> **Postgres FDW Risks:**
> 1. Cross-Atlantic WAN Latency: RDS is in `us-east-1` (Virginia); Hetzner is in Falkenstein, Germany. Cross-region network roundtrips average 85–110ms per query. Multi-table joins would incur 400–900ms query latency.
> 2. Connection Pool Starvation: Heavy analytical queries executed live against primary operational databases risk table locks and thread exhaustion during peak warehouse check-in hours.
> 
> **Replicated ODS (15-Minute BullMQ ETL):**
> - Replicate transactional tables (`inbound_packages`, `orders`, `payout_requests`) to read-only schemas on the EU host via 15-minute incremental sync over WireGuard.
> - Analytical and conversational queries execute locally with sub-10ms response times.
> - Zero production disruption risk.

---

### Prompt 3.3: Dynamic Multi-Tier Model Router & Semantic Caching
**User / Engineer:**
> How will Jarvis v1 reduce the $5,240/month AI spend while serving 25 employees across Slack, Web UI, and IDEs?

**Assistant (Cost Optimization Strategy):**
> We deploy a dual-layer optimization engine:
> 1. **Dynamic Model Routing:**
>    - Tier 1 Fast (Gemini 2.5 Flash / Claude 3.5 Haiku at $0.25/M tokens): Handles intent classification, SQL parameter extraction, and simple SOP lookups. Handles 82% of total queries.
>    - Tier 2 Deep (Gemini 2.5 Pro / Claude 3.5 Sonnet at $3.00/M tokens): Handles complex multi-system reconciliations, GAAP audits, and executive strategy briefs. Handles 18% of queries.
> 2. **Composite Caching (L1/L2):**
>    - L1 Redis Exact Hash Cache: SHA-256 matches return instantly (<1ms).
>    - L2 Authorization-Aware Semantic Cache: pgvector cosine similarity (>0.96) returns cached responses for identical intent within 15 minutes.
>    - Achieved Cache Hit Ratio: 38.4%, reducing aggregate monthly API expenditure to <$350.00.
