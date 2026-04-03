#!/usr/bin/env bash
set -euo pipefail

OLLAMA_BIND_HOST="${OLLAMA_BIND_HOST:-127.0.0.1:11434}"
OLLAMA_API_URL="${OLLAMA_API_URL:-http://127.0.0.1:11434}"
TARGET_MODEL="${OLLAMA_MODEL:-rawmind-v3}"
MODELFILE_PATH="${MODELFILE_PATH:-/app/docker/Modelfile}"
PORT="${PORT:-3000}"
NODE_ENV="${NODE_ENV:-production}"

log() {
  printf '[startup] %s\n' "$1"
}

cleanup() {
  for pid in "${ngrok_pid:-}" "${backend_pid:-}" "${ollama_pid:-}"; do
    if [[ -n "${pid}" ]]; then
      kill "${pid}" >/dev/null 2>&1 || true
    fi
  done

  for pid in "${ngrok_pid:-}" "${backend_pid:-}" "${ollama_pid:-}"; do
    if [[ -n "${pid}" ]]; then
      wait "${pid}" >/dev/null 2>&1 || true
    fi
  done
}

wait_for_ollama() {
  local attempts=0
  until OLLAMA_HOST="${OLLAMA_BIND_HOST}" ollama list >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [[ "${attempts}" -ge 60 ]]; then
      log "Ollama did not become ready in time."
      exit 1
    fi
    sleep 1
  done
}

wait_for_backend() {
  local attempts=0
  until curl -fsS "http://127.0.0.1:${PORT}/ready" >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [[ "${attempts}" -ge 60 ]]; then
      log "Backend did not become ready in time."
      exit 1
    fi
    sleep 1
  done
}

model_exists() {
  OLLAMA_HOST="${OLLAMA_BIND_HOST}" ollama show "${TARGET_MODEL}" >/dev/null 2>&1
}

start_ngrok() {
  ngrok http "${PORT}" --authtoken="${NGROK_AUTHTOKEN}" --log=stdout >/tmp/ngrok.log 2>&1 &
  ngrok_pid=$!

  local attempts=0
  local public_url=''
  until [[ -n "${public_url}" ]]; do
    attempts=$((attempts + 1))
    if [[ "${attempts}" -ge 30 ]]; then
      log "ngrok started but the public URL could not be determined."
      return
    fi

    if ! kill -0 "${ngrok_pid}" >/dev/null 2>&1; then
      log "ngrok exited before publishing a tunnel."
      cat /tmp/ngrok.log || true
      return
    fi

    public_url="$(
      curl -fsS http://127.0.0.1:4040/api/tunnels 2>/dev/null | node -e "const fs = require('fs'); try { const data = JSON.parse(fs.readFileSync(0, 'utf8')); const tunnels = data.tunnels || []; const chosen = tunnels.find((entry) => (entry.public_url || '').startsWith('https://')) || tunnels[0]; if (chosen?.public_url) process.stdout.write(chosen.public_url); } catch (error) {}"
    )"

    if [[ -z "${public_url}" ]]; then
      sleep 1
    fi
  done

  printf 'PUBLIC_BACKEND_URL=%s\n' "${public_url}"
}

trap cleanup EXIT INT TERM

log "Starting Ollama..."
OLLAMA_HOST="${OLLAMA_BIND_HOST}" ollama serve &
ollama_pid=$!

wait_for_ollama

if model_exists; then
  log "Verified model ${TARGET_MODEL}."
else
  log "Model ${TARGET_MODEL} missing. Rebuilding from ${MODELFILE_PATH}..."
  OLLAMA_HOST="${OLLAMA_BIND_HOST}" ollama create "${TARGET_MODEL}" -f "${MODELFILE_PATH}"
fi

log "Starting backend..."
env \
  PORT="${PORT}" \
  NODE_ENV="${NODE_ENV}" \
  OLLAMA_HOST="${OLLAMA_API_URL}" \
  OLLAMA_MODEL="${TARGET_MODEL}" \
  node /app/node-backend/src/index.js &
backend_pid=$!

wait_for_backend
printf 'LOCAL_BACKEND_URL=http://localhost:%s\n' "${PORT}"

if [[ -n "${NGROK_AUTHTOKEN:-}" ]]; then
  start_ngrok
fi

wait -n "${ollama_pid}" "${backend_pid}"
