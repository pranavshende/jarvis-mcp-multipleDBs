# Jarvis v1 — Model Context Protocol (MCP) Transports

Phase 4 implements the official `@modelcontextprotocol/sdk` (v1.0.4) supporting both standard local and remote MCP transports.

---

## 1. Local Transport: `stdio`

### Purpose
Enables local developer and analyst tools (Claude Desktop, Cursor IDE) to interact with Jarvis capabilities over local standard input/output.

### Architecture & Security Requirements
- Implemented via `gateway/src/mcp/stdio_server.ts` utilizing `StdioServerTransport`.
- **Zero Stdout Leaks:** All diagnostic and operational logs are written strictly to `stderr`. `stdout` is reserved exclusively for JSON-RPC 2.0 messages.
- **Identity Resolution:** Resolves user context from the `JARVIS_BEARER_TOKEN` environment variable. Defaults to local operator founder permissions.

### Claude Desktop Configuration
Add to `%APPDATA%\Claude\claude_desktop_config.json` (Windows) or `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "jarvis-enterprise": {
      "command": "node",
      "args": ["d:/eigi.ai/gateway/dist/mcp/stdio_server.js"],
      "env": {
        "JARVIS_BEARER_TOKEN": "msc_mcp_founder_sec_7a8f9b1c2d3e4f5a6b7c8d9e0f1a2b3c",
        "FLASK_BACKEND_URL": "http://127.0.0.1:5000",
        "DIRECT_URL": "postgresql://postgres...5432/postgres"
      }
    }
  }
}
```

### Cursor Configuration
Add to `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "jarvis": {
      "command": "node d:/eigi.ai/gateway/dist/mcp/stdio_server.js",
      "env": {
        "JARVIS_BEARER_TOKEN": "msc_mcp_founder_sec_7a8f9b1c2d3e4f5a6b7c8d9e0f1a2b3c"
      }
    }
  }
}
```

---

## 2. Remote Transport: Streamable HTTP

### Purpose
Connects remote web agents, remote Claude Desktop instances, and microservice connectors over HTTP without legacy SSE connection drops.

### Endpoint
`POST http://127.0.0.1:4000/mcp/stream` (and `GET /mcp/stream` for SSE stream initialization).

### Requirements & Handshake
1. **Authentication:** Mandatory `Authorization: Bearer msc_mcp_...` header or `?token=...` query parameter.
2. **Session Resumption:** Server generates a stateful session ID (`mcp-session-id`) returned in response headers.
3. **Keepalive Pings:** Built-in timer pings connections every 15 seconds to prevent proxy/NAT timeouts.
4. **Session Expiry:** Inactive sessions are safely closed and cleared after 30 minutes of inactivity.
5. **Cross-User Protection:** Sessions are strictly bound to the authenticated `userId`. Any request presenting another user's session ID receives `HTTP 403 Forbidden`.
