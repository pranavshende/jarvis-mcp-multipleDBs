# Jarvis Gateway Setup & Configuration Guide

## 1. Prerequisites
- Node.js v20+ (Verified on Node.js v24.11.1)
- npm 10+ (Verified on npm 11.7.0)
- Python Flask backend active on `http://127.0.0.1:5000`
- Supabase PostgreSQL 17.11 instance with `jarvis_system` schema applied

---

## 2. Environment Variables

Create or update `.env` in the project root:

```env
# Gateway Server
GATEWAY_PORT=4000
GATEWAY_HOST=0.0.0.0
NODE_ENV=development

# Downstream Flask Backend (Phases 1-3)
FLASK_BACKEND_URL=http://127.0.0.1:5000

# Supabase PostgreSQL Database (Direct connection for pool)
DIRECT_URL=postgresql://postgres.xxx:password@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
DATABASE_URL=postgresql://postgres.xxx:password@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true

# AI Model Provider (Google Gemini API)
GEMINI_API_KEY=your_gemini_api_key_here

# Slack Integration (Socket Mode)
SLACK_APP_TOKEN=xapp-1-...
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
```

---

## 3. Installation & Build

```bash
cd gateway
npm install
npm run build
```

---

## 4. Running the Gateway

### Development Mode (with hot-reload):
```bash
npm run dev
```

### Production Daemon:
```bash
node dist/server.js
```

---

## 5. Health Verification

```bash
curl http://127.0.0.1:4000/api/health
```

Expected Response:
```json
{
  "status": "HEALTHY",
  "service": "jarvis-gateway",
  "version": "1.0.0",
  "database": "HEALTHY",
  "timestamp": "2026-11-06T12:00:00.000Z"
}
```
