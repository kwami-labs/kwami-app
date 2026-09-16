# Kwami App

Web app for building and interacting with **Kwami** 3D AI companions: voice conversations, persistent memory, and customizable avatars and scenes.

## Features

- **Voice pipeline** — Real-time STT, LLM, and TTS (e.g. Deepgram, OpenAI) via LiveKit
- **3D avatars** — Blob and Black Hole renderers
- **Memory** — Long-term context with Zep
- **Tools** — MCP and custom tools
- **Scene & theme** — Backgrounds, HDRI, themes, and effects
- **Auth** — Supabase (Google, email)

## Prerequisites

- **Node.js** 22 (see `.nvmrc`)
- **bun** 1.2+
- **Kwami** — Uses the published package (`kwami@^2.1.1`). To develop against a local
  checkout instead, run `bun link` inside `../kwami` and `bun link kwami` here.

## Setup

```bash
# Install dependencies
bun install

# Configure environment
cp .env.sample .env
# Edit .env with your API keys and endpoints (see below)
```

## Scripts

| Command             | Description                     |
|---------------------|---------------------------------|
| `bun run dev`       | Start dev server (port 5173)    |
| `bun run build`     | Type-check and production build |
| `bun run preview`   | Preview production build        |
| `bun run typecheck` | Type-check only                 |
| `bun run lint`      | Lint and fix                    |
| `bun run lint:check`| Lint without writing            |
| `bun run format`    | Format with Prettier            |
| `bun run tauri dev` | Run the desktop (Tauri) build   |

## Environment variables

Copy `.env.sample` to `.env` and set:

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API base URL |
| `VITE_LIVEKIT_URL` | LiveKit WebSocket URL |
| `VITE_LIVEKIT_TOKEN_ENDPOINT` | Endpoint that issues LiveKit tokens |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/key |

## Tech stack

- **Vue 3** (Composition API, `<script setup>`)
- **TypeScript**
- **Vite 7**
- **Pinia** — state
- **Kwami** — 3D companion runtime (voice, avatar, memory, tools)
- **Three.js** — 3D (peer dependency of Kwami)
- **Supabase** — auth
- **PWA** — vite-plugin-pwa
- **Tauri 2** — optional desktop build (`bun run tauri dev`)

## Project structure

```
src/
├── components/     # UI: panels, sidebar, auth, search, memory
├── composables/    # Kwami sync, voice options, navigation, etc.
├── presets/        # Avatar, scene, theme, agent presets
├── stores/         # Pinia stores (avatar, voice, scene, auth, …)
├── assets/         # Global styles, variables
├── lib/            # Supabase client
├── App.vue
└── main.ts
```

## License

Private. See repository settings.
