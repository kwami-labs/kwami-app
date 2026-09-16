# Panels

The sidebar shows **one** panel at a time (`uiStore.activePanel`). Panels are async components in `App.vue`.

## Settings (`sidebarMode === 'settings'`)

| Id | Component | Purpose |
| --- | --- | --- |
| `avatar` | `AvatarPanel` | Renderer, skins, interactions, presets |
| `audio` | `AudioPanel` | Mic, meters, renderer-specific audio |
| `scene` | `ScenePanel` | Background, HDRI, overlays, effects |
| `voice` | `VoicePanel` | TTS / realtime voice catalogue |
| `enhancements` | `EnhancementsPanel` | VAD, turn detection, AEC, interruptions |
| `soul` | `SoulPanel` | Personality and templates |
| `memory` | `MemoryPanel` | Graph, facts, communities, duplicates |
| `tools` | `ToolsPanel` | MCP / custom tools |
| `info` | `InfoPanel` | Connection and runtime status |
| `metrics` | `MetricsPanel` | Live session metrics |
| `account` | `AccountPanel` | User, locale, sign-out |
| `theme` | `ThemePanel` | Mode, accent, glass, accessibility |
| `models` | `ModelsPanel` | LLM / STT / TTS / realtime catalogues |
| `credits` | `EnergyPanel` | Balance, packs, usage |
| `communications` | settings `PhonePanel` | Number inventory (not the Phone **app**) |
| `history` | `TranscriptionPanel` | Transcripts (legacy id `transcription`) |

## Apps (`sidebarMode === 'apps'`)

| Id | Component | Purpose |
| --- | --- | --- |
| `contacts` | `ContactsPanel` | Per-kwami address book |
| `email` | `EmailPanel` | Activate inbox, threads, compose |
| `wallet` | `WalletPanel` | Custody wallet + fund |
| `calendar` | `CalendarPanel` | Events |
| `phone` | apps `PhonePanel` | Outbound PSTN |
| `whatsapp` | `WhatsappPanel` | WhatsApp messages |
| `sms` | `SmsPanel` | SMS |

## Agent aliases

`useWorkspaceAgentTools` maps spoken names onto panel ids, for example:

| Alias | Opens |
| --- | --- |
| `energy` | `credits` |
| `inbox` / `mail` | `email` |
| `chat` / `transcript` | `history` |
| `persona` (legacy storage) | `soul` |
| `calls` / `messages` | `communications` |

Full map: `PANEL_ALIASES` in [`useWorkspaceAgentTools.ts`](../../src/composables/useWorkspaceAgentTools.ts).

## Adding a panel

See [Development → Adding a settings panel](../guides/development.md#adding-a-settings-panel).
