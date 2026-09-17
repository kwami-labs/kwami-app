# Kwami App Documentation

This is the documentation for **Kwami App**, the Vue client that hosts 3D AI companions built on the [Kwami](https://github.com/kwami-labs/kwami) runtime.

Start here if you are new:

1. [Getting started](guides/getting-started.md) — install, configure, and run the app
2. [Architecture overview](architecture/overview.md) — how the pieces fit together
3. [Kwami runtime](concepts/kwami-runtime.md) — the SDK the UI drives
4. [FAQ](faq.md) / [Troubleshooting](guides/troubleshooting.md)

## Guides

| Guide | What it covers |
| --- | --- |
| [Getting started](guides/getting-started.md) | Prerequisites, install, first run |
| [Environment](guides/environment.md) | Required and optional environment variables |
| [Development](guides/development.md) | Scripts, local workflow, linking the Kwami SDK |
| [Desktop](guides/desktop.md) | Tauri 2 desktop shell |
| [Testing](guides/testing.md) | Vitest, Playwright, coverage, CI |
| [Internationalization](guides/i18n.md) | `vue-i18n`, locales, persistence |
| [Troubleshooting](guides/troubleshooting.md) | Boot, auth, voice, memory, PWA |
| [Releasing](guides/releasing.md) | SemVer, changelog, baked `VITE_*` |
| [Contributing](guides/contributing.md) | Branching, commits, pull requests |

## Architecture

| Page | What it covers |
| --- | --- |
| [Overview](architecture/overview.md) | System diagram, process model, directory map |
| [Frontend](architecture/frontend.md) | Vue boot, Pinia, panels, layout |
| [Data flow](architecture/data-flow.md) | Auth, workspace, voice, memory, credits |
| [Backend integration](architecture/backend-integration.md) | HTTP client, LiveKit, Supabase |
| [Deployment](architecture/deployment.md) | CI, Cloudflare Workers, PWA, Tauri |
| [Security](security.md) | Trust boundaries, XSS, tokens |
| [ADRs](adr/README.md) | Accepted architecture decisions |

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

## Project files

| File | Role |
| --- | --- |
| [README.md](../README.md) | Product overview and quick start |
| [CHANGELOG.md](../CHANGELOG.md) | Keep a Changelog |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Pointer into the contributor guide |
| [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) | Contributor Covenant |
| [SECURITY.md](../SECURITY.md) | Vulnerability reporting |
| [SUPPORT.md](../SUPPORT.md) | Where to ask for help |
| [LICENSE](../LICENSE) | Apache-2.0 |

## Related repositories

Kwami App is the **client**. The voice agent, token issuer, memory service, and catalogues live in the backend.

| Project | Role |
| --- | --- |
| [kwami](https://github.com/kwami-labs/kwami) | 3D companion SDK (avatar, LiveKit agent, soul, tools) |
| [kwami-app](https://github.com/kwami-labs/kwami-app) | This repository — Vue web / PWA / Tauri client |
| Kwami API | Backend at `VITE_API_URL` (tokens, memory, credits, catalogues). Client contract: [reference/api.md](reference/api.md) |
