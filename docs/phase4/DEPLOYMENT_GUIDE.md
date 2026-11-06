# Jarvis v1 — Phase 4 Production Deployment Guide

This guide details the procedures for deploying the complete Jarvis v1 architecture, including the Fastify Gateway (`gateway/`), Flask Backend (`server/`), React Frontend (`client/`), and Supabase Cloud PostgreSQL database.

---

## 1. System Architecture Overview

```
                      +-----------------------------+
                      |   AI Clients & Endpoints    |
                      | Claude Desktop / Cursor /   |
                      | Slack App / Web Browser UI  |
                      +--------------+--------------+
                                     |
                                     | (Bearer jarvis_tok_... / MCP)
                                     v
                      +-----------------------------+
                      |   Jarvis Fastify Gateway    |
                      |         (Port 4000)         |
                      |  - Employee Identity & Auth |
                      |  - Intent Router (A, B, C)  |
                      |  - Model Registry & Routing |
                      |  - MCP stdio & Streamable   |
                      +--------------+--------------+
                                     |
                +--------------------+--------------------+
                |                                         |
                v                                         v
+-------------------------------+         +-------------------------------+
|    Flask Backend (Port 5000)  |         |     Google Gemini API / LLM   |
|  - Deterministic SQL Metrics  |         |  - gemini-2.5-flash (Fast)    |
|  - Restricted Action Service  |         |  - gemini-2.5-pro (Deep)      |
|  - Hybrid RAG Retrieval       |         +-------------------------------+
|  - Audit Log Ledger           |
+---------------+---------------+
                |
                v
+---------------------------------------------------------------+
|            Supabase Cloud PostgreSQL 17.11 & Redis 7          |
|  - Schemas: analytics, vector, app, staging_*, jarvis_system  |
|  - pgvector HNSW/IVFFlat indexes, Trigram & BM25 TSVECTOR    |
+---------------------------------------------------------------+
```

---

## 2. Environment Variables Specification

Create or configure `.env` in the project root and `gateway/.env`:

```ini
# Supabase Database Configuration
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=ey...
SUPABASE_DB_URL=postgresql://postgres.<project-ref>:<password>@aws-0-us-west-1.pooler.supabase.com:6543/postgres

# Redis & Async Queue (Phase 2)
REDIS_URL=redis://localhost:6379

# Google Gemini API Key
GEMINI_API_KEY=AIzaSy...

# Service Ports
PORT=4000
GATEWAY_PORT=4000
FLASK_PORT=5000
FLASK_BACKEND_URL=http://localhost:5000

# Slack Bot Configuration (Optional for Socket Mode)
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
```

---

## 3. Database Deployment

Apply migration `004_jarvis_system_gateway.sql` to your Supabase PostgreSQL 17.11 instance:

```bash
psql "$SUPABASE_DB_URL" -f database/migrations/004_jarvis_system_gateway.sql
```

This verifies and provisions:
- `jarvis_system.api_tokens` (with SHA-256 hash storage and index on `token_hash`)
- `jarvis_system.audit_logs` (immutable security and execution log)
- `jarvis_system.token_usage_ledger` (AI spend and token tracking)
- `jarvis_system.user_preferences` (client UI and notification configurations)
- Initial seeded enterprise employee accounts (`EMP-001` through `EMP-005`).

---

## 4. Gateway Service Deployment (`gateway/`)

### 4.1 Build
```bash
cd gateway
npm install
npm run build
```
This compiles TypeScript sources into production JavaScript in `gateway/dist/`.

### 4.2 Run in Production
Using PM2 or systemd:
```bash
# Using PM2
pm2 start dist/server.js --name "jarvis-gateway"

# Or using Node directly
node dist/server.js
```
The Gateway binds to `0.0.0.0:4000`.

### 4.3 Running MCP in stdio Mode (Claude Desktop / Cursor)
In Claude Desktop configuration (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "jarvis": {
      "command": "node",
      "args": ["d:/eigi.ai/gateway/dist/server.js", "--stdio"],
      "env": {
        "JARVIS_STDIO_TOKEN": "jarvis_tok_testfounder1234567890abcdef",
        "FLASK_BACKEND_URL": "http://localhost:5000",
        "GEMINI_API_KEY": "AIzaSy..."
      }
    }
  }
}
```

---

## 5. Flask Backend Service Deployment (`server/`)

```bash
cd server
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
python app.py
```
Or with Gunicorn in production:
```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

---

## 6. Frontend Deployment (`client/`)

### 6.1 Development Mode
```bash
cd client
npm install
npm run dev -- --port 3001 --host
```

### 6.2 Production Build
```bash
cd client
npm run build
```
Distribute `client/dist/` via NGINX, Cloudflare Pages, Vercel, or AWS S3/CloudFront.

---

## 7. Health Check & Validation
Verify connectivity:
```bash
curl http://localhost:4000/health
curl http://localhost:5000/health
curl http://localhost:4000/api/admin/overview -H "Authorization: Bearer jarvis_tok_testfounder1234567890abcdef"
```
All checks must return HTTP 200 with status `"HEALTHY"`.
