# Kwami App Documentation

This is the documentation for **Kwami App**, the Vue client that hosts 3D AI companions built on the [Kwami](https://github.com/kwami-labs/kwami) runtime.

Start here if you are new:

1. [Getting started](guides/getting-started.md) — install, configure, and run the app
2. [Architecture overview](architecture/overview.md) — how the pieces fit together
3. [Kwami runtime](concepts/kwami-runtime.md) — the SDK the UI drives

## Guides

| Guide | What it covers |
| --- | --- |
| [Getting started](guides/getting-started.md) | Prerequisites, install, first run |
| [Environment](guides/environment.md) | Required and optional environment variables |
| [Development](guides/development.md) | Scripts, local workflow, linking the Kwami SDK |
| [Desktop](guides/desktop.md) | Tauri 2 desktop shell |
| [Testing](guides/testing.md) | Vitest, Playwright, coverage, CI |
| [Internationalization](guides/i18n.md) | `vue-i18n`, locales, persistence |
| [Contributing](guides/contributing.md) | Branching, commits, pull requests |

## Architecture

| Page | What it covers |
| --- | --- |
| [Overview](architecture/overview.md) | System diagram, process model, directory map |
| [Frontend](architecture/frontend.md) | Vue boot, Pinia, panels, layout |
| [Data flow](architecture/data-flow.md) | Auth, workspace, voice, memory, credits |
| [Backend integration](architecture/backend-integration.md) | HTTP client, LiveKit, Supabase |

## Concepts

| Page | What it covers |
| --- | --- |
| [Kwami runtime](concepts/kwami-runtime.md) | Avatar, agent, soul, tools, connect/dispose |
| [Workspaces](concepts/workspaces.md) | Per-companion configs stored in Supabase |
| [Voice pipeline](concepts/voice-pipeline.md) | STT → LLM → TTS vs realtime |
| [Memory](concepts/memory.md) | Per-kwami graph, Zep via the backend |
| [Avatars](concepts/avatars.md) | Renderers, presets, store sync |
| [Soul](concepts/soul.md) | Personality and live agent config |
| [Credits](concepts/credits.md) | Energy balance, packs, usage |
| [Communications](concepts/communications.md) | Phone, WhatsApp, SMS |
| [Tools](concepts/tools.md) | Client tools the LiveKit agent can invoke |

## Reference

| Page | What it covers |
| --- | --- |
| [Stores](reference/stores.md) | Every Pinia store |
| [Composables](reference/composables.md) | Vue composables |
| [Components](reference/components.md) | UI surface map |
| [API](reference/api.md) | Backend HTTP routes the app calls |
| [Events](reference/events.md) | `window` custom events |
| [Keyboard shortcuts](reference/keyboard-shortcuts.md) | Global and panel keys |
| [Environment variables](reference/environment-variables.md) | `VITE_*` contract |
| [Panels](reference/panels.md) | Settings and apps sidebar |

## Related repositories

Kwami App is the **client**. The voice agent, token issuer, memory service, and catalogues live in the backend.

| Project | Role |
| --- | --- |
| [kwami](https://github.com/kwami-labs/kwami) | 3D companion SDK (avatar, LiveKit agent, soul, tools) |
| [kwami-app](https://github.com/kwami-labs/kwami-app) | This repository — Vue web / PWA / Tauri client |
| [kwami-api](https://github.com/kwami-labs/kwami-api) | Backend API (tokens, memory, credits, catalogues) |

If a sibling repo is not public yet, treat the API contract in [reference/api.md](reference/api.md) as the source of truth for this client.
