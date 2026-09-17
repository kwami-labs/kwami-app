# Panels

The sidebar shows **one** panel at a time (`uiStore.activePanel`). Panels are async components in `App.vue`.

## Settings (`sidebarMode === 'settings'`)

Order comes from [`src/constants/panels.ts`](../../src/constants/panels.ts) (visual → agent → info → pinned). Digit shortcuts follow this list.

| Id | Component | Purpose |
| --- | --- | --- |
| `avatar` | `AvatarPanel` | Renderer, skins, interactions, presets |
| `audio` | `AudioPanel` | Mic, meters, renderer-specific audio |
| `scene` | `ScenePanel` | Background, HDRI, overlays, effects |
| `theme` | `ThemePanel` | Mode, accent, glass, accessibility |
| `models` | `ModelsPanel` | LLM / STT / TTS / realtime catalogues |
| `voice` | `VoicePanel` | TTS / realtime voice catalogue |
| `soul` | `SoulPanel` | Personality and templates |
| `memory` | `MemoryPanel` | Graph, facts, communities, duplicates |
| `enhancements` | `EnhancementsPanel` | VAD, turn detection, AEC, interruptions |
| `communications` | settings `PhonePanel` | Number inventory (not the Phone **app**) |
| `tools` | `ToolsPanel` | MCP / custom tools |
| `metrics` | `MetricsPanel` | Live session metrics |
| `info` | `InfoPanel` | Connection and runtime status |
| `credits` | `EnergyPanel` | Balance, packs, usage (pinned) |
| `account` | `AccountPanel` | User, locale, PWA install, sign-out (pinned) |

## Apps (`sidebarMode === 'apps'`)

`whatsapp` and `sms` appear only after a phone number is provisioned (`appsPanelOrder(phoneActivated)`).

| Id | Component | Purpose |
| --- | --- | --- |
| `contacts` | `ContactsPanel` | Per-kwami address book |
| `email` | `EmailPanel` | Activate inbox, threads, compose |
| `phone` | apps `PhonePanel` | Outbound PSTN |
| `whatsapp` | `WhatsappPanel` | WhatsApp messages (phone-gated) |
| `sms` | `SmsPanel` | SMS (phone-gated) |
| `history` | `TranscriptionPanel` | Transcripts (legacy id `transcription`) |
| `wallet` | `WalletPanel` | Custody wallet + fund |
| `calendar` | `CalendarPanel` | Events |

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
