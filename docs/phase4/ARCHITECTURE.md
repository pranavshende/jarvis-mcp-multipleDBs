# Jarvis v1 — Phase 4 Gateway & MCP Architecture

**Target Release:** `v0.4.0-phase4-gateway`  
**Author:** Principal AI Systems Architect  
**Status:** Approved Architecture  

---

## 1. System Topology Overview

Phase 4 implements the centralized **Jarvis Gateway and Orchestrator** in Node.js/TypeScript using Fastify. It connects multiple enterprise AI client interfaces (Claude Desktop, Cursor, Slack, and Web Browsers) to existing Meridian Supply Chain intelligence capabilities while enforcing authentication, employee identity propagation, RBAC, model routing, and immutable audit tracking.

```mermaid
flowchart TD
    subgraph Clients["User Interaction Tier"]
        C_Slack["Slack App (Socket Mode)"]
        C_Local["Local Claude Desktop / Cursor (stdio)"]
        C_Remote["Remote MCP Clients (Streamable HTTP)"]
        C_AdminUI["React 18 Admin Dashboard (Port 3001)"]
    end

    subgraph Gateway["Jarvis Gateway & Orchestrator (Port 4000)"]
        Auth["Identity & Token Resolver"]
        RBAC["RBAC & Tool Allowlist"]
        Guard["Prompt Injection Guard"]
        Router["Intent Router (Tool Dispatcher)"]
        ModelRouter["Configurable Model Router (models_registry.yaml)"]
        Audit["Audit Logger & Spend Ledger"]
    end

    subgraph ExistingServices["Existing Verified Subsystems (DO NOT REBUILD)"]
        P1["Phase 1: Metrics Engine & Analytics APIs\n(15 Deterministic SQL Metrics)"]
        P2["Phase 2: Restricted Action Service & Alert Engine\n(Human Confirmation Phrase & Audit Ledger)"]
        P3["Phase 3: Hybrid Vector Store & Governance Engine\n(HNSW+GIN Single-CTE Search & Citations)"]
    end

    subgraph Storage["Supabase Cloud PostgreSQL 17.11"]
        DB_Analytics["analytics schema"]
        DB_App["app.restricted_action_ledger"]
        DB_Memory["jarvis_memory schema"]
        DB_System["jarvis_system schema (New in Phase 4)"]
    end

    C_Slack --> Auth
    C_Local --> Auth
    C_Remote --> Auth
    C_AdminUI --> Auth

    Auth --> RBAC --> Guard --> Router
    Router <--> ModelRouter

    Router -- "get_business_metric" --> P1 --> DB_Analytics
    Router -- "propose/confirm_action" --> P2 --> DB_App
    Router -- "search_company_knowledge" --> P3 --> DB_Memory
    Auth -- "validate_token" --> DB_System
    Router --> Audit --> DB_System
```

---

## 2. Key Architecture Pillars

### 2.1 Non-Duplication Mandate
The gateway is an **Orchestrator, Security Boundary, and Protocol Adapter**. It never duplicates or computes business metrics, action executions, or vector searches independently. All business operations are dispatched to existing verified services via authenticated service-to-service calls.

### 2.2 Strict Identity Binding
Every request across all transports must resolve to an authenticated corporate employee record:
```typescript
interface UserContext {
  userId: string;
  email: string;
  role: UserRole;
  department: string;
  allowedScopes: string[];
  tokenId: string;
  requestId: string;
  clientType: 'SLACK' | 'MCP_STREAM' | 'MCP_STDIO' | 'ADMIN_UI' | 'API';
}
```

### 2.3 Universal Security Pipeline
$$\text{Request} \longrightarrow \text{Token Auth} \longrightarrow \text{Identity Resolver} \longrightarrow \text{RBAC Validator} \longrightarrow \text{Prompt Guard} \longrightarrow \text{Service Dispatch} \longrightarrow \text{Audit Logger}$$

---

## 3. Communication Protocols
- **Internal Service-to-Service:** Fastify Gateway communicates with Flask Backend (`http://127.0.0.1:5000`) over HTTP with internal security header `X-Jarvis-Internal-Gateway: true`.
- **External Local MCP:** Official `@modelcontextprotocol/sdk` StdioServerTransport.
- **External Remote MCP:** Official Streamable HTTP transport at `/mcp/stream` with 15-second keepalive pings.
- **Slack Client:** `@slack/bolt` in Socket Mode via secure outbound WebSocket connection.
