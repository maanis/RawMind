#!/usr/bin/env bash
set -euo pipefail

OLLAMA_BIND_HOST="${OLLAMA_BIND_HOST:-127.0.0.1:11434}"
BASE_MODEL="${BASE_MODEL:-dolphin-llama3:8b}"
TARGET_MODEL="${OLLAMA_MODEL:-rawmind-v3}"
MODELFILE_PATH="${MODELFILE_PATH:-/app/docker/Modelfile}"

log() {
  printf '[build-model] %s\n' "$1"
}

cleanup() {
  if [[ -n "${ollama_pid:-}" ]]; then
    kill "${ollama_pid}" >/dev/null 2>&1 || true
    wait "${ollama_pid}" >/dev/null 2>&1 || true
  fi
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

model_exists() {
  OLLAMA_HOST="${OLLAMA_BIND_HOST}" ollama show "${TARGET_MODEL}" >/dev/null 2>&1
}

trap cleanup EXIT

log "Starting temporary Ollama daemon for image build..."
OLLAMA_HOST="${OLLAMA_BIND_HOST}" ollama serve >/tmp/ollama-build.log 2>&1 &
ollama_pid=$!

wait_for_ollama

log "Pulling base model ${BASE_MODEL}..."
OLLAMA_HOST="${OLLAMA_BIND_HOST}" ollama pull "${BASE_MODEL}"

if model_exists; then
  log "Model ${TARGET_MODEL} already exists, skipping create."
else
  log "Creating custom model ${TARGET_MODEL} from ${MODELFILE_PATH}..."
  OLLAMA_HOST="${OLLAMA_BIND_HOST}" ollama create "${TARGET_MODEL}" -f "${MODELFILE_PATH}"
fi

OLLAMA_HOST="${OLLAMA_BIND_HOST}" ollama show "${TARGET_MODEL}" >/dev/null
log "Verified custom model ${TARGET_MODEL}."
