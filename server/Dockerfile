# ==============================================================================
# Jarvis v1 — Unified Enterprise Backend Container (Flask + Fastify Gateway)
# Optimized for Render Web Service Deployment
# ==============================================================================

FROM python:3.11-slim

# Install system dependencies, curl (for healthchecks), and Node.js 20
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    ca-certificates \
    gnupg \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1. Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 2. Install Gateway Node dependencies & build TypeScript
COPY gateway/package*.json ./gateway/
RUN cd gateway && npm install

# 3. Copy application codebase
COPY . .

# Build gateway production bundle
RUN cd gateway && npm run build

# Make startup script executable
RUN chmod +x start.sh

# Render dynamically sets $PORT environment variable
ENV PORT=10000
EXPOSE 10000

CMD ["/bin/bash", "start.sh"]

