<HTML>
<!-- README intentionally kept framework-agnostic: no model-specific guidance, just product + setup info. -->
</HTML>

# RawMind — No-Warning AI Chat

RawMind is a mobile-first chat experience for people who want straight answers with zero moralizing. Pick a ruthless niche persona, ask anything, and stream replies instantly without the usual disclaimers or safety rails. The project ships with a React Native (Expo) app plus an optional Node streaming proxy you can point at any AI host you control.

---

## Why RawMind?
- **No apologies, no refusals** — every niche is wired with system prompts that never preach or soften their answers.
- **Multiple personas** — switch between hyper-focused worlds (religion, conspiracies, career warfare, raw unleashed, and more) without leaving the chat.
- **Real-time streaming** — see replies token-by-token with markdown, inline code blocks, and copy-to-clipboard controls.
- **Persistent brains** — Zustand + AsyncStorage keep chat history, niches, and theme alive across sessions.
- **Expo-native** — runs on iOS, Android, and web with the same codebase (Expo SDK 54, React 19, RN 0.81).

---

## Niche Matrix (Pick Your Poison)

| Niche | Persona | What It Does |
| --- | --- | --- |
| Religion | The Oracle | Brutally honest doctrine breakdowns locked to a single faith at a time. |
| Dark Web | Shadow | Explains underground ecosystems, opsec, and cybercrime realities without flinching. |
| Unfiltered Career | The Fixer | Weaponized office politics and career manipulation tactics. |
| Historical Villain | The Archive | In-character responses from infamous figures, motives included. |
| Founder Roast | The Destroyer | Vaporizes fragile startup ideas with cold market logic. |
| Criminal Profiler | Mindhunter | FBI-grade behavioral reads on crimes, motives, and escalation risk. |
| Conspiracy Analyst | Rabbit Hole | Treats every theory seriously, stress-testing evidence on both sides. |
| Savage Debate | The Adversary | Takes the opposing side of any argument with relentless counterpoints. |
| Raw / Unleashed | Unleashed | Full-send, unrestricted AI mode—ask literally anything. |

Religion can also drill into sub-options (Islam, Christianity, Hinduism, Buddhism, Judaism, Atheism) so you can stay inside one worldview without cross-contamination.

---

## System Overview

- **App shell** — Expo Router handles navigation, font loading, and providers (`app/_layout.tsx`).
- **State** — Zustand slice in `store/index.ts` tracks chats, streaming status, current niche, and sidebar visibility; hydration/persistence uses AsyncStorage.
- **Chat engine** — `hooks/useChat.ts` wires the UI to the streaming fetch logic in `services/ai.ts`, including abort support and the 12-message sliding context window.
- **UI kit** — Custom components in `components/` (Sidebar, ChatScreen, MessageBubble, ChatInput) implement the Claude-inspired layout, markdown rendering, and keyboard handling.
- **Themes** — `useTheme.ts` + `constants/theme.ts` keep light/dark palettes synced to the chosen persona color.
- **Optional backend** — `node-backend/` exposes `/chat` and `/health`, repackaging your private AI endpoint as a streaming-friendly service for the mobile client.

---

## Getting Started

### 1. Prerequisites
- Node.js 18+
- pnpm 10+ (project uses `pnpm-lock.yaml`)
- Expo CLI (`npm i -g expo-cli`) or use `npx expo`
- Android Studio / Xcode simulators or a physical device with Expo Go
- An AI endpoint you control (self-hosted, local, or remote) that accepts OpenAI-style chat requests

### 2. Clone & Install

```bash
git clone https://github.com/maanis/RawMind.git
cd rawmind
pnpm install
```

> The backend is standalone. If you plan to run it, also run `cd node-backend && npm install`.

### 3. Wire Up Your AI Host

1. Update the base URL inside `services/ai.ts` (or `.env` if you externalize it) so the app knows where to send chat requests.
2. If you need to swap prompts, colors, or icons, edit `constants/niches.ts`. Each niche lives in one place.
3. Religion-specific prompts rely on the `RELIGIONS` list in the same file—add or remove entries as needed.

### 4. Run the Mobile App

```bash
pnpm start        # launches Expo
```

- Press `a` for Android emulator, `i` for iOS simulator, or scan the QR code via Expo Go.
- `pnpm android` and `pnpm ios` run the native builds if you prefer prebuild workflows.

### 5. (Optional) Run the Streaming Proxy

```bash
cd node-backend
npm run dev       # auto-restart on changes
# or
npm start
```

Expose the backend on your LAN (e.g., http://192.168.x.x:3000) and point the app’s `services/ai.ts` to that URL. The proxy simply forwards chunks from your AI host to the device with <10 ms overhead.

---

## Project Structure

```
rawmind/
├── app/                # Expo Router entry + layouts
├── components/         # Sidebar, chat UI, bubbles, input
├── constants/          # Niches, themes, limits
├── hooks/              # Chat + theme hooks
├── services/           # Streaming fetch helpers
├── store/              # Zustand state + persistence
├── types/              # Shared TypeScript types
├── node-backend/       # Optional Express streaming proxy
└── ...config files     # Expo, Babel, TypeScript, etc.
```

---

## Development Notes
- **Streaming UX** — `MessageBubble` renders markdown with syntax highlighting and collapsible code blocks so raw tokens stay readable.
- **Keyboard-safe layout** — `ChatScreen` combines `KeyboardAvoidingView`, safe areas, and a custom plugin to keep the composer visible on both iOS and Android without screen jumps.
- **Abort + resend** — Each request uses `AbortController`; tapping “Stop” cancels on the fly, while the composer keeps the draft so you can resend instantly.
- **Customization hooks** — The niche system centralizes persona text, tone, and scope limits, making it simple to spin up new modes.

---

## Contributing & Next Steps
- Add more modes (legal shark, toxic coach, brutal therapist, etc.).
- Layer in analytics or usage caps per persona.
- Build a desktop shell (Electron or Tauri) that reuses the same hooks.
- Swap the backend for any other inference stack; only the fetch URL and headers need to change.

Pull requests are welcome—just keep the “no warnings” ethos intact.

---

**RawMind** — because sometimes you just want the answer, not the lecture.
