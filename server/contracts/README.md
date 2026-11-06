# Jarvis v1 System Contracts & API Specifications
**Document Version:** 1.0.0-PROD  
**Specification Standard:** JSON Schema Draft-07, MCP Specification (2025/2026 Revision)  
**Target Transports:** Local `stdio` (Claude Desktop), Streamable HTTP (Cursor, Claude Code), Slack Socket Mode

---

## 1. Overview & Core Contract Principles

The contracts in this directory govern communication across the Jarvis v1 intelligence layer:
1. **Strong Typing & Zero Dynamic SQL:** Analytical questions are dispatched exclusively through the `execute_metric` tool, backed by registered, parameterized SQL templates. The LLM is strictly prohibited from executing arbitrary SQL.
2. **Mandatory Identity Propagation:** Every tool call payload must supply a validated `caller_context` containing the user's Employee ID, role, facility scope, and client transport.
3. **Dual-Sign Restricted Actions:** Mutating operations cannot be directly triggered by any LLM tool call. The `request_action_execution` tool generates an idempotent, cryptographically signed `DraftActionIntent` that requires human verification.

---

## 2. Directory Manifest

- `tools.schema.json`: Formal JSON Schema Draft-07 specification defining all MCP tools exposed by the Jarvis Gateway (`execute_metric`, `search_company_knowledge`, `get_active_alerts`, `request_action_execution`).
- `canonical_crosswalk.sql`: Production DDL for `analytics.dim_product_crosswalk`, indexes, triggers, and quarantine queues in Supabase PostgreSQL.

---

## 3. Tool Usage & Runtime Enforcement

### 3.1 Transport Mapping
- **Local Stdio (`mcp-server-stdio`):** Packaged for local execution inside Claude Desktop, authenticated via local environment configuration.
- **Streamable HTTP (`/mcp/v1`):** Hosted MCP endpoint supporting SSE streaming with chunked JSON-RPC 2.0 payloads for remote development tools (Cursor, Claude Code).
- **Slack Socket Mode (`slack-adapter`):** Translates Slack slash commands, mentions, and message actions into MCP tool requests.

### 3.2 Error Handling & Contract Violations
If a tool invocation violates role authorization, parameters, or schema:
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32001,
    "message": "AUTHORIZATION_DENIED",
    "data": {
      "metric_id": "NET_PROFIT_GAAP",
      "required_clearance": ["ROLE_FOUNDER", "ROLE_FINANCE"],
      "caller_role": "ROLE_CONTRACTOR"
    }
  },
  "id": "call_12345"
}
```
