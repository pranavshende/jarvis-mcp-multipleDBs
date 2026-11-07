#!/usr/bin/env bash
set -e

echo "=================================================="
echo "🚀 Starting Jarvis v1 Enterprise Backend on Render"
echo "=================================================="

# 1. Determine Public Web Port for Fastify Gateway
# Render injects $PORT for external internet traffic (defaults to 10000 on Render)
PUBLIC_PORT="${PORT:-10000}"
export PORT="${PUBLIC_PORT}"
export GATEWAY_PORT="${PUBLIC_PORT}"
export GATEWAY_HOST="0.0.0.0"

# 2. Assign dedicated internal loopback port for Flask (must never collide with Gateway $PORT)
if [ "${PUBLIC_PORT}" = "5050" ]; then
  INTERNAL_FLASK_PORT=5055
else
  INTERNAL_FLASK_PORT=5050
fi

export FLASK_PORT="${INTERNAL_FLASK_PORT}"
export FLASK_BACKEND_URL="http://127.0.0.1:${INTERNAL_FLASK_PORT}"
export HOST="127.0.0.1"

echo "📊 Starting Python Flask Analytics & RAG Engine on internal port ${FLASK_PORT}..."
python app.py &
FLASK_PID=$!

# Graceful termination handler
cleanup() {
  echo "🛑 Terminating services..."
  kill -TERM "$FLASK_PID" 2>/dev/null || true
  exit 0
}
trap cleanup SIGTERM SIGINT

# Wait for Flask engine to report healthy
echo "⏳ Waiting for Flask engine to initialize..."
for i in $(seq 1 30); do
  if curl -s "http://127.0.0.1:${FLASK_PORT}/api/health/db" > /dev/null 2>&1 || curl -s "http://127.0.0.1:${FLASK_PORT}/" > /dev/null 2>&1; then
    echo "✅ Flask engine is online and healthy on internal port ${FLASK_PORT}!"
    break
  fi
  sleep 1
done

echo "🌐 Starting Jarvis Fastify Gateway on public port ${PORT}..."
cd gateway

if [ -f "dist/server.js" ]; then
  exec node dist/server.js
else
  exec npm start
fi
