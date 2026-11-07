#!/usr/bin/env bash
set -e

echo "=================================================="
echo "🚀 Starting Jarvis v1 Enterprise Backend on Render"
echo "=================================================="

# Export Internal Flask configuration
export FLASK_PORT=5000
export FLASK_BACKEND_URL="http://127.0.0.1:5000"
export HOST="127.0.0.1"
export GATEWAY_HOST="0.0.0.0"

# Render injects $PORT for external traffic; map to Gateway
export PORT="${PORT:-4000}"
export GATEWAY_PORT="${PORT}"

echo "📊 Starting Python Flask Analytics & RAG Engine on port ${FLASK_PORT}..."
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
  if curl -s "http://127.0.0.1:${FLASK_PORT}/api/health" > /dev/null 2>&1; then
    echo "✅ Flask engine is online and healthy!"
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

