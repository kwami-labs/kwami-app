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
- A soundtrack on the login screen: a play/pause pill over the welcome kwami,
  which moves to the music through the SDK's audio analyser. The same crate is
  playable from Settings -> Audio
- Memory Pinia store talking to `/memory/*` through the shared client
- Single source of truth for panel order (`src/constants/panels.ts`)
- CI workflow: typecheck, lint, format, unit coverage, production build, Playwright
- The live browser panel can be floated, dragged, resized and expanded to
  fullscreen, not only docked as a split pane. Layout persists, is clamped back
  into the viewport on every change (a panel dragged off-screen has no header
  to grab and no close button to click), and is movable and resizable from the
  keyboard. A transparent shield covers the iframe mid-gesture, without which a
  drag dies the moment the cursor crosses into it.
- The panel says when a browsing session is ephemeral, rather than letting the
  user find out by being signed out of everything next time.
- Agent tools for the parts of the UI it could not reach: `set_browser_panel`,
  `list_scene_presets` / `apply_scene_preset` (`set_scene_control` took only raw
  URLs, which the model cannot invent, so every "put a forest behind you" either
  failed or produced a dead link), and `list_kwami_profiles` /
  `switch_kwami_profile`.
- `tests/unit/i18nMessageSyntax.test.ts`: renders every message in both locales.
  vue-i18n compiles lazily and treats `{...}` and `|` as syntax, so a message
  written with JSON or prose punctuation throws only when something displays it.

### Changed

- LiveKit room tokens are minted through `apiClient` (`POST /token`), not a separate `VITE_LIVEKIT_TOKEN_ENDPOINT`
- Catalogues, credits, email, contacts, calendar, wallet, and communications all go through the shared client
- Sidebar nav, digit shortcuts, and agent panel tools derive from the same panel lists

### Fixed

- Wallet panel i18n; treat HTTP 503 as feature-disabled
- Browser panel surfaces iframe load failures instead of spinning forever
- Digit shortcuts follow the visible sidebar order (including phone-gated WhatsApp / SMS)
- Info panel documents the full shortcut sequence
- The theme panel's JSON import placeholder threw
  `Message compilation error` whenever that section rendered: vue-i18n reads a
  bare `{` as a placeholder, and the message was a literal JSON example
- Switching the voice pipeline told the backend nothing. `updateConfig` only
  mutates the local object, so the mode never left the browser and the UI told
  the user to reconnect. It is now sent over the data channel and applied live
- The `eye-iris` renderer was unreachable by voice. The store, its presets and
  `applySnapshot` all supported it; only the agent-facing enum omitted it

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

[Unreleased]: https://github.com/kwami-labs/kwami-app/commits/main
[0.1.0]: https://github.com/kwami-labs/kwami-app
