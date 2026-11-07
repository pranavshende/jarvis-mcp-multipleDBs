# 🚀 Deploying Jarvis Enterprise Backend on Render

This guide outlines how to deploy the **Jarvis Enterprise Intelligence Backend** (`server/`) to [Render](https://render.com) as a single unified service.

---

## 🏛 Architecture Overview

The backend operates as a unified service:
- **Fastify Gateway (TypeScript / Node.js 20)**:
  - Listens on Render's public port (`$PORT`, e.g. `10000`).
  - Handles SSE Streaming (`/api/query/stream`), Gemini NLU Intent Routing (`/api/query`), MCP tools (`/api/tools`), and Admin Management (`/api/admin/*`).
  - Acts as a reverse-proxy for all downstream analytical routes to Python Flask.
- **Python Flask Engine (Python 3.11)**:
  - Runs internally on `127.0.0.1:5000`.
  - Connects to Supabase PostgreSQL (pgvector, 746 knowledge chunks).
  - Handles `/api/metrics`, `/api/crosswalk`, `/api/sync`, `/api/reconciliation`, `/api/alerts`, `/api/actions`, `/api/knowledge`.

---

## 📦 What Is Included in `server/`

```
server/
├── Dockerfile              # Multi-stage production container (Python 3.11 + Node 20)
├── start.sh                # Startup script that launches Flask + Gateway
├── render.yaml             # Render Blueprint specification
├── requirements.txt        # Python dependencies (Flask, psycopg2-binary, etc.)
├── config.py               # Flask configuration (FLASK_PORT=5000)
├── app.py                  # Flask entrypoint
├── gateway/                # Fastify TypeScript Gateway
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── server.ts       # Gateway server + reverse proxy to Flask
│   │   ├── orchestrator/   # Gemini NLU & Intent Router
│   │   ├── mcp/            # MCP tool registry & streamable HTTP
│   │   └── admin/          # Admin control plane & token manager
├── routes/                 # Flask route blueprints (metrics, alerts, actions, etc.)
├── services/               # RAG vector store, embedding service, db pool, etc.)
├── database/               # PostgreSQL / Supabase migrations
├── context-bank/           # Operational SOPs, markdown documents & knowledge source files
├── contracts/              # SQL schemas & tool definitions
└── eval/                   # Golden dataset & CI evaluation runners
```

---

## 🛠 Deployment Options on Render

### Option A: Using Render Blueprints (Recommended - 1 Click)

1. Push your repository to GitHub.
2. In the [Render Dashboard](https://dashboard.render.com), click **New +** → **Blueprint**.
3. Select your repository.
4. Render will automatically detect `render.yaml`.
5. Enter your secret environment variables:
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `GEMINI_API_KEY`
6. Click **Apply**. Render will build the Docker container and deploy the service.

---

### Option B: Manual Web Service Setup

1. In the [Render Dashboard](https://dashboard.render.com), click **New +** → **Web Service**.
2. Connect your GitHub repository.
3. Configure the service settings:
   - **Name**: `jarvis-backend`
   - **Region**: Frankfurt / Singapore / Oregon (select closest to your Supabase region)
   - **Root Directory**: `server`
   - **Runtime**: **Docker**
   - **Plan**: Free or Standard ($7/mo)
4. Add the following **Environment Variables** under the "Environment" tab:
   | Key | Value | Notes |
   |---|---|---|
   | `DATABASE_URL` | `postgresql://...` | Supabase pooler connection string |
   | `DIRECT_URL` | `postgresql://...` | Supabase direct connection string |
   | `GEMINI_API_KEY` | `your_gemini_api_key` | Google Gemini API Key |
   | `JARVIS_BEARER_TOKEN` | `msc_mcp_founder_sec_7a8f9b1c2d3e4f5a6b7c8d9e0f1a2b3c` | Admin bearer token |
   | `FLASK_PORT` | `5000` | Internal Flask port |
   | `FLASK_BACKEND_URL` | `http://127.0.0.1:5000` | Gateway upstream target |
   | `NODE_ENV` | `production` | Production environment flag |
5. Click **Deploy Web Service**.

---

## 🌐 Verifying the Deployment

Once Render displays **"Live"**, your service URL will be something like:
`https://jarvis-backend.onrender.com`

Test the endpoints:
```bash
# 1. Healthcheck
curl https://jarvis-backend.onrender.com/api/health

# 2. Database connectivity
curl https://jarvis-backend.onrender.com/api/health/db

# 3. Dynamic RAG Query
curl -X POST https://jarvis-backend.onrender.com/api/query \
  -H "Authorization: Bearer msc_mcp_founder_sec_7a8f9b1c2d3e4f5a6b7c8d9e0f1a2b3c" \
  -H "Content-Type: application/json" \
  -d '{"query": "Why is Partner 301 on credit hold?"}'
```

---

## 💻 Connecting Your Frontend (`client/`)

Deploy your `client` folder to **Vercel**, **Netlify**, or **Render Static Site**:
1. Add an environment variable to your frontend deployment:
   ```env
   VITE_GATEWAY_URL=https://jarvis-backend.onrender.com
   ```
2. Your frontend will now route all chat queries, SSE live workflow streams, metrics, and alerts to your deployed Render backend!
