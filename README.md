# RawMind

React Native (Expo) app + Node.js backend + Ollama, now packaged for single-image Docker distribution.

## Docker Quick Start

The default developer path is one container and one command:

```bash
cp .env.example .env
docker compose up --build
```

What this does:

- builds one Docker image containing Ollama, the backend, ngrok, and the baked `rawmind-v3` model
- exposes the backend at `http://localhost:3000`
- starts ngrok automatically only if `NGROK_AUTHTOKEN` is set
- prints `LOCAL_BACKEND_URL=...` and, when enabled, `PUBLIC_BACKEND_URL=...`

Notes:

- the first build is large because the image includes `dolphin-llama3:8b` plus your custom model
- runtime startup should not need to pull or create the model again unless the model store is damaged

## Environment

Use `.env` for optional runtime values:

```bash
PORT=3000
NGROK_AUTHTOKEN=
BRAVE_API_KEY=
```

## Mobile App Backend Switching

The app now defaults to:

```txt
http://localhost:3000
```

You can change the backend from the sidebar:

- leave it on localhost for same-device development
- paste a LAN URL for another machine on your network
- paste the printed ngrok URL when you want remote access

The selected custom URL is persisted in AsyncStorage until you reset it back to localhost.

## Runtime Flow

When the container starts:

1. Ollama starts inside the container.
2. The bootstrap script verifies `rawmind-v3`.
3. If the model is unexpectedly missing, it recreates it from `docker/Modelfile`.
4. The Node backend starts and waits until `/ready` passes.
5. The script prints the local backend URL.
6. If `NGROK_AUTHTOKEN` exists, ngrok starts automatically and prints the public URL.

## Manual Local Development

If you still want to run things outside Docker:

```bash
# Ollama
ollama pull dolphin-llama3:8b
ollama create rawmind-v3 -f docker/Modelfile

# Backend
cd node-backend
pnpm install
pnpm start

# App
cd ..
pnpm exec expo start
```

## Project Structure

```txt
docker/
  Modelfile
  build-model.sh
  entrypoint.sh
node-backend/
  src/
services/
store/
components/
```
