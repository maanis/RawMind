# ⚡ RawMind

A local-first AI system powered by:

* 🧠 **Ollama (custom model: `rawmind-v3`)**
* 🚀 **Node.js streaming backend (SSE)**
* 📱 **React Native (Expo) mobile app**

Packaged into a **single Docker image** for zero-setup usage.

---

# 🚀 Quick Start (Recommended)

Run everything with one command:

```bash
cp .env.example .env
docker compose up --build
```

---

## ✅ What happens automatically

When you run the container:

* 🧠 Ollama starts internally

* ⚙️ Model `rawmind-v3` is already available (prebuilt)

* 🚀 Backend starts on:

  ```txt
  http://localhost:3000
  ```

* 🌍 If `NGROK_AUTHTOKEN` is set:

  * ngrok starts automatically
  * Public URL is generated and printed

---

## 🖥️ Expected Logs

```txt
🚀 Starting RawMind...
🧠 Model ready: rawmind-v3
🚀 Backend running at http://localhost:3000
🌍 Public URL: https://xxxxx.ngrok-free.app
```

---

# 🔐 Environment Configuration

Create a `.env` file:

```bash
PORT=3000
NGROK_AUTHTOKEN=
BRAVE_API_KEY=
```

---

## 🌍 Ngrok (Optional)

If you want remote access:

```bash
NGROK_AUTHTOKEN=your_token_here
```

Then restart:

```bash
docker compose up
```

👉 You’ll get a public backend URL automatically.

---

# 📱 Mobile App Integration

By default, the app connects to:

```txt
http://localhost:3000
```

---

## 🔄 Switching Backend (Inside App)

You can change backend from the sidebar:

* ✅ **Localhost** → same device
* 🌐 **LAN IP** → another machine on same network
* 🌍 **Ngrok URL** → remote access

Example:

```txt
http://192.168.1.10:3000
https://abc123.ngrok-free.app
```

---

## 💾 Persistence

* Selected backend URL is saved using AsyncStorage
* Remains until manually changed

---

# ⚙️ Runtime Flow (Inside Docker)

When container starts:

1. Ollama launches (silent mode)
2. System checks for model `rawmind-v3`
3. If missing → recreates using `docker/Modelfile`
4. Backend starts and waits until `/ready`
5. Local backend URL is printed
6. Ngrok starts automatically (if token exists)
7. Public URL is printed

---

# 🧠 Model Details

* Base model: `dolphin-llama3:8b`
* Custom model: `rawmind-v3`
* Built using:

```txt
docker/Modelfile
```

👉 Model is baked into Docker image (no runtime download required)

---

# ⚠️ Important Notes

* First build is **large (~5–10GB)** due to model inclusion
* Requires:

  * 8GB RAM minimum (recommended)
* CPU works, but GPU improves performance

---

# 🧪 Health Check

Test backend:

```bash
curl http://localhost:3000/health
```

---

# 🧑‍💻 Manual Development (Optional)

Run without Docker:

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

---

# 📦 Project Structure

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

---

# 🎯 Goal

RawMind is designed to be:

* ⚡ Zero setup
* 🧠 Fully local-first
* 🌍 Optional remote access
* 🔥 Clean developer experience

---

# 🚀 Next Steps

* Connect your mobile app via LAN or ngrok
* Share Docker image with your team
* Extend with offline/mobile inference (future)

---
