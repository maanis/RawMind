FROM node:20-bookworm-slim

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

ARG OLLAMA_VERSION=latest
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
  && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://ollama.com/install.sh | OLLAMA_VERSION="${OLLAMA_VERSION}" sh

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

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=5 \
  CMD curl -fsS http://127.0.0.1:3000/ready || exit 1

ENTRYPOINT ["tini", "--", "/app/docker/entrypoint.sh"]
