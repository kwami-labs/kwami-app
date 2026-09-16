# FAQ

Short answers. Longer ones live in the guides and concepts.

## What is this repository?

The **Vue client** (web, PWA, optional Tauri). It renders the 3D companion and talks to the Kwami API, LiveKit, and Supabase. It does not run the LLM, STT, TTS, or Zep.

## Why is there no Vue Router?

The canvas is the only page. Settings and apps are sidebar panels. See [Frontend architecture](architecture/frontend.md) and [ADR 0004](adr/0004-lazy-panels-and-window-events.md).

## Can I point the app at OpenAI / Deepgram directly?

No. Provider keys must not appear in `VITE_*`. Configure models on the API; the client only selects catalogue ids. [ADR 0002](adr/0002-no-secrets-in-the-client.md).

## The avatar renders but Connect fails

You need a reachable `VITE_API_URL` (`POST /token`) and `VITE_LIVEKIT_URL`. A `402` is out of energy, not a bad WebSocket URL. [Troubleshooting](guides/troubleshooting.md).

## Why does each companion have its own memory?

`memoryUserId` is `kwami_{userId}_{workspaceId}`. Two companions must not share a Zep user. [Workspaces](concepts/workspaces.md).

## Where do companion configs live?

Drafts in Pinia + `localStorage`. Named companions and their saved snapshots in Supabase `user_kwamis`. Persist is a user action (Save). [Data flow](architecture/data-flow.md).

## How do I add a settings panel?

Register the id in [`src/constants/panels.ts`](../src/constants/panels.ts), lazy-import it in `App.vue`, add an icon and i18n strings. [Development](guides/development.md).

## bun or pnpm?

**bun**. CI installs with `bun install --frozen-lockfile`. There is no `pnpm-lock.yaml`.

## English only?

`en` and `es`. Detection: `localStorage` → browser language → `en`, then `user_app_settings` after sign-in. [i18n](guides/i18n.md).

## Is the desktop app required?

No. Tauri is optional. The same Vite app runs in the browser. [Desktop](guides/desktop.md).

## How do I report a vulnerability?

Email **security@kwami.io**. Do not open a public issue. [SECURITY.md](../SECURITY.md).
