# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This is the **Kwami App** client (`0.1.0`). There are no published tags yet; entries below describe `main`.

## [Unreleased]

### Added

- Architecture, guides, concepts, and reference under [`docs/`](docs/README.md)
- Security policy, contributor guide, and code of conduct
- Shared HTTP client (`apiClient`) for every Kwami API call
- Environment validation at startup (`src/lib/env.ts`)
- Configurable OAuth and wallet sign-in via `VITE_AUTH_PROVIDERS`
- PWA install icons and an Account-panel download flow
- Particles-face renderer in the Avatar panel
- Memory Pinia store talking to `/memory/*` through the shared client
- Single source of truth for panel order (`src/constants/panels.ts`)
- CI workflow: typecheck, lint, format, unit coverage, production build, Playwright

### Changed

- LiveKit room tokens are minted through `apiClient` (`POST /token`), not a separate `VITE_LIVEKIT_TOKEN_ENDPOINT`
- Catalogues, credits, email, contacts, calendar, wallet, and communications all go through the shared client
- Sidebar nav, digit shortcuts, and agent panel tools derive from the same panel lists

### Fixed

- Wallet panel i18n; treat HTTP 503 as feature-disabled
- Browser panel surfaces iframe load failures instead of spinning forever
- Digit shortcuts follow the visible sidebar order (including phone-gated WhatsApp / SMS)
- Info panel documents the full shortcut sequence

### Security

- Stopped shipping Zep credentials in the client bundle
- Token minting preserves typed `402` so the insufficient-credits toast can fire
- OAuth popup `postMessage` remains same-origin only (see [Security](docs/security.md))

### Removed

- Unused `VITE_LIVEKIT_TOKEN_ENDPOINT` environment variable

## [0.1.0] - 2026-09-16

Initial documented snapshot of the Vue 3 / PWA / optional Tauri client:

- Voice sessions over LiveKit (STT → LLM → TTS or realtime)
- Four Three.js avatar renderers via the `kwami` SDK
- Per-companion workspaces in Supabase (`user_kwamis`)
- Memory graph explorer (Zep behind the API)
- Apps: contacts, email, calendar, phone, WhatsApp, SMS, wallet
- Energy (credits) balance, packs, and usage
- English and Spanish via `vue-i18n`
- Vitest + MSW unit tests and Playwright e2e

[Unreleased]: https://github.com/kwami-labs/kwami-app/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/kwami-labs/kwami-app/releases/tag/v0.1.0
