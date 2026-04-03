#!/usr/bin/env bash
set -euo pipefail

OLLAMA_BIND_HOST="${OLLAMA_BIND_HOST:-127.0.0.1:11434}"
OLLAMA_API_URL="${OLLAMA_API_URL:-http://127.0.0.1:11434}"
TARGET_MODEL="${OLLAMA_MODEL:-rawmind-v3}"
MODELFILE_PATH="${MODELFILE_PATH:-/app/docker/Modelfile}"
PORT="${PORT:-3000}"
NODE_ENV="${NODE_ENV:-production}"
OLLAMA_LOG_PATH="${OLLAMA_LOG_PATH:-/tmp/rawmind-ollama.log}"
NGROK_LOG_PATH="${NGROK_LOG_PATH:-/tmp/rawmind-ngrok.log}"
MODEL_CREATE_LOG_PATH="${MODEL_CREATE_LOG_PATH:-/tmp/rawmind-model-create.log}"

print_line() {
  printf '%s\n' "$1"
}

fatal() {
  print_line "❌ $1"
  exit 1
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
      fatal "Ollama failed to start."
    fi
    sleep 1
  done
}

wait_for_backend() {
  local attempts=0
  until curl -fsS "http://127.0.0.1:${PORT}/ready" >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [[ "${attempts}" -ge 60 ]]; then
      fatal "Backend failed to become ready."
    fi
    sleep 1
  done
}

model_exists() {
  OLLAMA_HOST="${OLLAMA_BIND_HOST}" ollama show "${TARGET_MODEL}" >/dev/null 2>&1
}

start_ngrok() {
  ngrok http "${PORT}" --authtoken="${NGROK_AUTHTOKEN}" --log=stdout >"${NGROK_LOG_PATH}" 2>&1 &
  ngrok_pid=$!

  local attempts=0
  local public_url=''
  until [[ -n "${public_url}" ]]; do
    attempts=$((attempts + 1))
    if [[ "${attempts}" -ge 30 ]]; then
      return
    fi

    if ! kill -0 "${ngrok_pid}" >/dev/null 2>&1; then
      return
    fi

    public_url="$(
      curl -fsS http://127.0.0.1:4040/api/tunnels 2>/dev/null | node -e "const fs = require('fs'); try { const data = JSON.parse(fs.readFileSync(0, 'utf8')); const tunnels = data.tunnels || []; const chosen = tunnels.find((entry) => (entry.public_url || '').startsWith('https://')) || tunnels[0]; if (chosen?.public_url) process.stdout.write(chosen.public_url); } catch (error) {}"
    )"

    if [[ -z "${public_url}" ]]; then
      sleep 1
    fi
  done

  print_line "🌍 Public URL: ${public_url}"
}

trap cleanup EXIT INT TERM

print_line "🚀 Starting RawMind..."
OLLAMA_HOST="${OLLAMA_BIND_HOST}" ollama serve >"${OLLAMA_LOG_PATH}" 2>&1 &
ollama_pid=$!

wait_for_ollama

if model_exists; then
  print_line "🧠 Model ready: ${TARGET_MODEL}"
else
  print_line "⚙️ Creating model: ${TARGET_MODEL}"
  if ! OLLAMA_HOST="${OLLAMA_BIND_HOST}" ollama create "${TARGET_MODEL}" -f "${MODELFILE_PATH}" >"${MODEL_CREATE_LOG_PATH}" 2>&1; then
    fatal "Failed to create model: ${TARGET_MODEL}"
  fi
  print_line "✅ Model created"
fi

env \
  PORT="${PORT}" \
  NODE_ENV="${NODE_ENV}" \
  OLLAMA_HOST="${OLLAMA_API_URL}" \
  OLLAMA_MODEL="${TARGET_MODEL}" \
  RAWMIND_QUIET_STARTUP=1 \
  node /app/node-backend/src/index.js &
backend_pid=$!

wait_for_backend
print_line "🚀 Backend running at http://localhost:${PORT}"

if [[ -n "${NGROK_AUTHTOKEN:-}" ]]; then
  start_ngrok
fi

wait -n "${ollama_pid}" "${backend_pid}" || fatal "A required service stopped unexpectedly."
