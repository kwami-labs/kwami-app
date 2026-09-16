# Getting started

Run a local Kwami App against a backend API, LiveKit, and Supabase.

## Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | 22 | See [`.nvmrc`](../../.nvmrc) |
| [bun](https://bun.sh) | 1.2.21+ | Package manager and script runner (CI uses 1.2.21) |
| Kwami API | running | Token issuer, catalogues, memory, credits |
| LiveKit | Cloud or self-hosted | Real-time voice |
| Supabase project | Auth + tables | Providers listed in `VITE_AUTH_PROVIDERS`, `user_kwamis`, `user_app_settings` |

Optional: [Rust](https://www.rust-lang.org/tools/install) 1.77.2+ and the Tauri prerequisites if you want the desktop shell.

## Install

```bash
git clone git@github.com:kwami-labs/kwami-app.git
cd kwami-app
bun install
cp .env.sample .env
```

Edit `.env`. Minimum viable set:

```bash
VITE_API_URL=http://localhost:8080
VITE_LIVEKIT_URL=wss://your-project.livekit.cloud
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
# VITE_AUTH_PROVIDERS=google
```

Full variable list: [Environment](environment.md).

## Run

```bash
bun run dev
```

The Vite server listens on [http://localhost:5173](http://localhost:5173) (`strictPort: true`). Open it, sign in with a provider listed in `VITE_AUTH_PROVIDERS` (default Google), and a default companion is created if the account has none.

You cannot have a useful voice session without a reachable API (`POST /token`) and LiveKit URL. The 3D avatar still renders without them.

## Local Kwami SDK

This app depends on the published `kwami` package (`^2.1.1`). To develop against a sibling checkout:

```bash
cd ../kwami
bun link
cd ../kwami-app
bun link kwami
```

Restart `bun run dev` after linking.

## Next

- [Development](development.md) — scripts and workflow
- [Architecture overview](../architecture/overview.md)
- [Testing](testing.md)
