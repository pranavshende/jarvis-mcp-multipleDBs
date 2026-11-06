# Jarvis v1 Phase 5 — Deployment Guide

## 1. Prerequisites & Environment

Before deploying Jarvis v1 Phase 5, ensure the following dependencies are available:
- **Node.js**: v20+ LTS
- **Python**: v3.11+
- **PostgreSQL**: Supabase PostgreSQL 17.11 with `pgvector` v0.8.2 and `jarvis_system` schema
- **Redis**: v7+ (for BullMQ queues and L1 composite caching)
- **Environment Variables**: Defined in `.env` at root or loaded into container environments.

---

## 2. Environment Variables Specification

Ensure the following variables are configured in `.env`:

```env
# Database Connection (Supabase PostgreSQL 17.11)
DATABASE_URL=postgresql://postgres.xxx:yyy@aws-0-ap-south-1.pooler.supabase.com:6543/postgres

# Fastify Gateway Configuration
GATEWAY_PORT=4000
GATEWAY_HOST=0.0.0.0
NODE_ENV=production

# Flask Backend Configuration
FLASK_PORT=5000
FLASK_HOST=127.0.0.1
FLASK_ENV=production

# Redis Configuration (BullMQ & Composite Semantic Cache)
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=

# AI Provider API Keys
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key

# Security & Master Tokens
MASTER_ADMIN_TOKEN=msc_mcp_founder_sec_7a8f9b1c2d3e4f5a6b7c8d9e0f1a2b3c
JWT_SECRET=super_secret_enterprise_msc_jwt_key
```

---

## 3. Database Migration Deployment

Deploy the Phase 5 schema update to Supabase PostgreSQL:

```bash
# Execute Phase 5 SQL Migration
python server/scripts/deploy_phase5_schema.py
```

This verifies that the following tables exist and are active:
- `jarvis_system.semantic_cache`
- `jarvis_system.evaluation_runs`
- `jarvis_system.evaluation_results`
- `jarvis_system.dlq_audit_log`
- `jarvis_system.department_budgets`

---

## 4. Service Startup Sequence

To ensure healthy inter-service communication, start components in the following sequence:

### Step 1: Start Redis
Ensure the Redis server is running on port 6379 for BullMQ queues and L1 caching.

### Step 2: Start Flask Backend (Port 5000)
```bash
cd server
python app.py
```
Verify health:
```bash
curl http://127.0.0.1:5000/api/health/db
# Expected response: {"status": "HEALTHY", "database": "CONNECTED"}
```

### Step 3: Build & Start Fastify Gateway (Port 4000)
```bash
cd gateway
npm run build
npm start
```
Verify health:
```bash
curl -H "Authorization: Bearer msc_mcp_founder_sec_7a8f9b1c2d3e4f5a6b7c8d9e0f1a2b3c" http://127.0.0.1:4000/api/admin/health
# Expected response: {"gateway": "HEALTHY", "database": "HEALTHY", "flaskBackend": "HEALTHY"}
```

### Step 4: Build & Serve React Admin Dashboard (Port 3001)
```bash
cd client
npm run build
npm run preview -- --port 3001
```

---

## 5. Verification & Health Checks

1. **Run Integration Test Suite**:
   ```bash
   cd gateway
   npx tsx tests/test_composite_cache.ts
   npx tsx tests/test_dlq_handler.ts
   npx tsx tests/test_model_router_and_budgets.ts
   ```

2. **Run Continuous Evaluation CI Benchmark**:
   ```bash
   npx tsx eval/ci_runner.ts
   ```
   Verify `pass_rate_pct >= 90.0%`.

3. **Run Red-Team Guardrails Suite**:
   ```bash
   npx tsx security/redteam/run_redteam.ts
   ```
   Verify 15/15 attack vectors defended.

4. **Verify Admin Dashboard**:
   Open browser at `http://localhost:3001`. Navigate across:
   - Tab 4: Evaluation Center
   - Tab 5: Semantic Cache Analytics
   - Tab 6: BullMQ DLQ & Recovery
   - Tab 7: Security & Red-Team Gate

