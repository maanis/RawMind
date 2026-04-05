FROM node:20-bookworm-slim

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

ARG NGROK_DOWNLOAD_URL=https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz

ENV DEBIAN_FRONTEND=noninteractive \
    NODE_ENV=production \
    PORT=3000 \
    OLLAMA_MODEL=rawmind-v3 \
    OLLAMA_MODELS=/root/.ollama/models \
    MODELFILE_PATH=/app/docker/Modelfile

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    procps \
    tar \
    tini \
    zstd \
  && rm -rf /var/lib/apt/lists/* \
  && rm -rf /tmp/* /var/tmp/*

# Install Ollama only if not already present
# Uses conditional check with proper error handling
RUN set -eux; \
    if ! command -v ollama &> /dev/null; then \
      echo "📦 Installing Ollama..."; \
      curl -fsSL https://ollama.com/install.sh | sh || { \
        echo "❌ Ollama installation failed"; \
        exit 1; \
      }; \
      echo "✅ Ollama installed successfully"; \
    else \
      echo "✅ Ollama already installed"; \
    fi

RUN curl -fsSL "${NGROK_DOWNLOAD_URL}" -o /tmp/ngrok.tgz \
  && tar -xzf /tmp/ngrok.tgz -C /tmp \
  && mv /tmp/ngrok /usr/local/bin/ngrok \
  && chmod +x /usr/local/bin/ngrok \
  && rm -f /tmp/ngrok.tgz

COPY node-backend/package.json node-backend/pnpm-lock.yaml /app/node-backend/

RUN corepack enable \
  && cd /app/node-backend \
  && pnpm install --frozen-lockfile --prod

COPY node-backend/src /app/node-backend/src
COPY docker /app/docker

RUN chmod +x /app/docker/build-model.sh /app/docker/entrypoint.sh \
  && /app/docker/build-model.sh

# Expose ports:
# 3000 = Node.js backend
# 11434 = Ollama API (started as background service by entrypoint.sh)
EXPOSE 3000 11434

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=5 \
  CMD curl -fsS http://127.0.0.1:3000/ready || exit 1

# entrypoint.sh orchestrates:
# 1. Start Ollama in background on port 11434
# 2. Wait for Ollama to be ready
# 3. Load/create rawmind-v3 model
# 4. Start Node.js backend on port 3000
# 5. Optionally start ngrok if NGROK_AUTHTOKEN is set
ENTRYPOINT ["tini", "--", "/app/docker/entrypoint.sh"]
