# RawMind — Uncensored AI Chat

React Native (Expo) + Node.js backend + Ollama (dolphin-llama3:8b-q4_0)

---

## 1. Pull & Setup Ollama Model

```bash
# Pull model (needs ~5GB disk, fits in 6GB VRAM at Q4)
ollama pull dolphin-llama3:8b-q4_0

# Export its Modelfile
ollama show dolphin-llama3:8b-q4_0 --modelfile > Modelfile

# Open Modelfile, replace the SYSTEM line and add PARAMETER lines
# (copy from the Modelfile in this repo root)

# Create the raw version
ollama create dolphin-raw -f Modelfile

# Test it
ollama run dolphin-raw
>>> who are you?
# Should say Dolphin, not OpenAI
```

## 2. Allow LAN Access (Windows)

```powershell
# Set in System Environment Variables permanently:
OLLAMA_HOST = 0.0.0.0

# Then restart Ollama service
```

## 3. Start the Backend

```bash
cd node-backend
npm install
npm start
# Running on http://localhost:3000
```

## 4. Update BACKEND_URL in services/ai.ts

```ts
// Android emulator → host machine
const BACKEND_URL = 'http://10.0.2.2:3000';

// Physical device → your LAN IP
const BACKEND_URL = 'http://192.168.X.X:3000';
```

## 5. Run the App

```bash
pnpm exec expo start
# Press 'a' for Android emulator
```

---

## What Changed in This Version

### 🔒 Strict Niche Isolation
- Every niche has a `lockPrompt()` wrapper that:
  - Locks model identity to the persona
  - Enforces topic scope — refuses off-topic IN CHARACTER
  - Pre-rejects all known jailbreak patterns by name
  - Prevents "briefly helping anyway"
- Switching niches always opens a **new isolated chat** — old chat stays in history untouched

### 🎭 Custom Persona Builder
- Tap "Custom Persona" (🎭) in the mode selector
- Describe your persona in plain language (rough is fine)
- The AI (dolphin-llama3) refines it into a proper system prompt
- Preview and edit the refined prompt before activating
- Chat opens with that exact prompt — fully locked

### 📏 Response Length Intelligence
- Model instructed: short by default, long only when depth is required
- No padding, no filler, no unnecessary paragraphs

### ❓ Follow-up Questions
- After every response, the model appends 2 follow-up questions
- Questions are niche-specific and based on the actual response content
- Formatted with a separator line + "Explore further:" header

### 📂 Niche-Grouped Chat History
- Sidebar now groups past chats by their niche/persona
- Each group shows the persona name in its color
- Makes it easy to return to the right context

### ⚡ Raw Model Parameters
- `temperature: 0.9` — more raw, less filtered output
- `repeat_penalty: 1.1` — suppresses repetitive safety phrasing
- `top_p: 0.92` — broader token sampling
- Baseline system prompt in Modelfile bakes in zero-refusal behavior

---

## Architecture

```
App (React Native Expo)
  └── useChat hook
        └── services/ai.ts  ──→  Node backend (Express)
                                      └── Ollama API (/api/chat)
                                            └── dolphin-llama3:8b-q4_0
```

### Niche Isolation Flow
```
User switches niche
  → nicheId state updates
  → useEffect in ChatScreen detects niche change
  → createChat() called with new nicheId
  → New chat gets its own nicheId + religion + customPrompt stored
  → All messages in that chat use ONLY that chat's system prompt
  → Old chat is preserved in history with its original niche
```

### Custom Persona Flow
```
User opens Custom Persona sheet
  → Types rough description
  → buildCustomPersonaPrompt() sends to backend
  → dolphin-llama3 refines it into a tight system prompt
  → User previews + optionally edits
  → Activates: prompt stored, new chat created
  → lockPrompt() wraps it with jailbreak resistance
```

### Memory / Context
- Sliding window: last 12 messages sent per request
- Each chat maintains its own isolated message history
- AsyncStorage persists all chats across app restarts
