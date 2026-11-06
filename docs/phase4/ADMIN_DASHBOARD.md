# Jarvis v1 — Admin Control Plane & Dashboard

The Jarvis Admin Dashboard is an enterprise web application extension integrated directly into the existing React 18 + Vite frontend on port 3001 (`client/src/components/AdminDashboard.jsx`), backed by the Fastify Gateway on port 4000.

---

## 1. Dashboard Subsystems

### A. Executive Overview
- Displays high-level KPIs: Active MCP tokens, 30-day AI dollar spend, total tokens processed, pending memory candidates, and end-to-end service health.
- Includes the **Interactive Gateway Intent Console**, allowing administrators to test live conversational queries across Metric, Knowledge, and Dual-Synthesis routes.

### B. User & Token Management
- **Token Provisioning:** Provision new Bearer tokens (`msc_mcp_<user>_<secret>`) for employees with role assignment (`ROLE_EMPLOYEE`, `ROLE_WAREHOUSE`, `ROLE_SALES`, `ROLE_FINANCE`, `ROLE_ADMIN`, `ROLE_FOUNDER`) and department tagging.
- **One-Time Secret Display:** Newly created raw bearer tokens are shown strictly once upon creation.
- **Token Rotation:** Generates an immediate replacement secret and revokes the predecessor.
- **Token Revocation:** Immediately revokes access, terminating any active MCP sessions.

### C. AI Spend & Cost Ledger
- Displays per-employee and per-model consumption summaries over configurable time horizons (default 30 days).
- Lists configured tiers and pricing from `models_registry.yaml`.

### D. Memory Approval Queue
- Full UI integration with the Phase 3 three-tier knowledge promotion engine.
- Domain Leads can inspect candidate operational facts, view originating users, check contradiction status, and trigger approval or rejection with audit comments.

### E. Alert Center & Action Ledger
- Real-time visibility into Phase 2 active anomaly alerts and the immutable restricted action ledger in `app.restricted_action_ledger`.

### F. System Health & Adapters
- Real-time connection status monitoring for Fastify Gateway, Flask Backend, Supabase PostgreSQL, Redis/BullMQ, and Slack Socket Mode.
