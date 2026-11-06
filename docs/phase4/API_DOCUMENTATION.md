# Jarvis v1 — Phase 4 API Documentation

This document describes all interfaces exposed by the Fastify Gateway (`gateway/`), Model Context Protocol (MCP) servers, and administrative endpoints in Jarvis v1 Phase 4.

---

## 1. Authentication & Common Headers

All Gateway endpoints require Bearer token authentication:

```http
Authorization: Bearer jarvis_tok_<hash>
X-Request-ID: <optional-client-trace-id>
```

### Response on Authentication Failure
- **HTTP 401 Unauthorized**: If token is missing, expired, revoked, or invalid.
- **Latency Guarantee**: Negative token lookups are cached with in-memory negative caching, rejecting forged tokens in **< 10 ms** (measured at 2.2 ms, exceeding the 20 ms SLA).

---

## 2. Gateway Core REST APIs

### 2.1 System Health
```http
GET /health
```
**Response (200 OK):**
```json
{
  "status": "HEALTHY",
  "version": "1.0.0",
  "node_version": "v22.x",
  "uptime_seconds": 124.5,
  "registered_mcp_tools": 9,
  "default_model": "gemini-2.5-flash",
  "active_providers": ["gemini"]
}
```

---

### 2.2 Intent Router & Query Orchestration
```http
POST /api/chat
POST /api/orchestrate
Content-Type: application/json
Authorization: Bearer jarvis_tok_...

{
  "query": "What was the revenue and gross margin for Apex in Q3?",
  "stream": false
}
```

**Routing Logic:**
- **Path A (Deterministic Metric)**: Direct analytical SQL metrics from Phase 1 (`get_metric`, `get_ar_aging`, etc.). Zero hallucinations.
- **Path B (Document Retrieval / RAG)**: Hybrid RRF retrieval from Phase 3 knowledge base (`search_knowledge_base`).
- **Path C (Dual Synthesis)**: Combines structured metric execution with document policy context for holistic enterprise analysis.

**Response (200 OK):**
```json
{
  "success": true,
  "intent_path": "PATH_A_BUSINESS_METRIC",
  "model_used": "gemini-2.5-flash",
  "latency_ms": 142.3,
  "token_usage": {
    "prompt_tokens": 120,
    "completion_tokens": 45,
    "total_tokens": 165,
    "estimated_cost_usd": 0.0000225
  },
  "answer": "Apex Q3 revenue was $412,500.00 with a gross margin of 24.2%.",
  "metrics": [
    {
      "metric_id": "REVENUE",
      "value": 412500.00
    }
  ],
  "sources": []
}
```

---

## 3. Model Context Protocol (MCP)

Jarvis implements the official `@modelcontextprotocol/sdk` (v1.0.4) specification across two transports.

### 3.1 Transport Types

1. **Streamable HTTP Transport (`/mcp/stream`)**:
   - URL: `http://localhost:4000/mcp/stream`
   - Method: `POST`
   - Content-Type: `application/json`
   - Authorization: Standard Bearer token or Slack resolution.

2. **stdio Transport**:
   - Invocation: `node dist/server.js --stdio`
   - Environment variables: `JARVIS_STDIO_TOKEN=jarvis_tok_...`
   - For Claude Desktop, Cursor, and local IDE agent plugins.

### 3.2 Supported MCP JSON-RPC Methods

#### `initialize`
Initializes the MCP session and negotiates protocol capabilities.
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {
      "name": "Cursor",
      "version": "0.42.0"
    }
  }
}
```

#### `tools/list`
Lists all available enterprise tools accessible to the caller based on their RBAC role.
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list",
  "params": {}
}
```

**Registered Tools:**
| Tool Name | Allowed Roles | Description |
|---|---|---|
| `get_metric` | ALL | Retrieve deterministic SQL business metric |
| `get_ar_aging` | FOUNDER, ADMIN, FINANCE | Partner Accounts Receivable aging ledger |
| `get_inventory_fifo` | ALL | FIFO batch inventory levels |
| `search_knowledge_base` | ALL | Hybrid vector/BM25 knowledge base search |
| `get_document_by_id` | ALL | Full document fetch with verified citations |
| `list_unresolved_alerts` | ALL | Active Phase 2 deterministic alerts |
| `propose_action` | ALL | Propose restricted business action |
| `confirm_action` | FOUNDER, ADMIN, FINANCE, OPERATIONS | Confirm action with human verification token |
| `execute_intent` | ALL | Natural language orchestrator routing |

#### `tools/call`
Executes an approved tool with RBAC enforcement and parameter schema validation.
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "get_metric",
    "arguments": {
      "metric_id": "REVENUE",
      "parameters": {
        "period": "2026-Q3"
      }
    }
  }
}
```

---

## 4. Admin Dashboard REST APIs

Base Path: `/api/admin` (Protected by `ROLE_ADMIN` and `ROLE_FOUNDER`)

### 4.1 System Overview
```http
GET /api/admin/overview
```
Returns system statistics, active token counts, 30-day AI spend, and MCP health.

### 4.2 Token Management
- `GET /api/admin/tokens`: List all enterprise tokens with metadata (hashed secrets, owner, role, expiration, status).
- `POST /api/admin/tokens`: Provision new token.
  ```json
  {
    "employee_id": "EMP-006",
    "employee_name": "David Kim",
    "employee_email": "david.kim@meridiansupplychain.com",
    "role": "ROLE_OPERATIONS",
    "client_name": "Claude Desktop",
    "expires_days": 90
  }
  ```
- `POST /api/admin/tokens/:id/rotate`: Revoke existing token and generate a fresh replacement token.
- `DELETE /api/admin/tokens/:id`: Immediately revoke a token. Negative lookup cache is updated immediately.

### 4.3 AI Spend & Token Usage
```http
GET /api/admin/usage
```
Returns aggregated token usage grouped by model, employee, and tier, along with dollar cost estimates based on `models_registry.yaml`.
