# Components

Vue SFCs under [`src/components/`](../../src/components/). There is no router; `App.vue` composes these.

## Shell

| Component | Role |
| --- | --- |
| `auth/AuthGuard.vue` | Welcome rings, session restore, `AuthPage` vs app slot |
| `auth/AuthPage.vue` | Sign-in surface |
| `auth/GoogleButton.vue` | Google OAuth |
| `auth/WelcomeBlob.vue` | Decorative blob on auth |
| `welcome/WelcomeRings.vue` | Animated wordmark / rings |
| `sidebar/TheSidebar.vue` | Chrome around the active panel |
| `sidebar/SidebarNavigation.vue` | Mode-aware nav buttons + kwami section |
| `sidebar/SidebarContent.vue` | Panel slot |
| `sidebar/SidebarModeSwitch.vue` | Settings / apps toggle |
| `sidebar/KwamiSelector.vue` | Companion switcher |
| `sidebar/NewKwamiModal.vue` / `EditKwamiModal.vue` / `DeleteKwamiConfirm.vue` | CRUD |
| `controls/ControlBar.vue` | Connect, listen, record |
| `controls/RecordControl.vue` / `RecordingRegionPicker.vue` | Recording |
| `energy/EnergyBadge.vue` | Credit chip |
| `search/SearchOrbitCards.vue` | Web-search results around the avatar |
| `panels/BrowserPanel.vue` | Split-view live browser iframe |

## Settings panels

Lazy-loaded in `App.vue`. See [Panels](panels.md).

```
components/panels/settings/
  avatar/          AvatarPanel + renderer settings
  audio/           Microphone, visualizer, black-hole audio
  scene/           Background, effects
  voice/           Voice picker
  enhancements/    VAD, barge-in, AEC
  transcription/   History (id: history)
  communications/  Number inventory
  soul/            Personality
  memory/          Graph
  tools/           MCP / tools
  info/            Runtime info
  metrics/         Session metrics
  account/         User + locale
  theme/           Theme studio
  models/          LLM / STT / TTS / realtime catalogues
  energy/          Credits
```

## Apps panels

```
components/panels/apps/
  contacts/
  email/           Inbox, compose, thread, activation
  wallet/
  calendar/
  phone/
  whatsapp/
  sms/
```

## Memory visualization

```
components/memory/
  MemoryGraph.vue
  MemoryGraph2D.vue
  MemoryGraph3D.vue
  MemoryGraphHeader.vue
  MemoryGraphLegend.vue
  MemoryNodeDetails.vue
```

## UI primitives

`BaseButton`, `BaseInput`, `BaseSelect`, `BaseSlider`, `BaseToggle`, `BaseTagInput`, `BaseTooltip`, `ConfirmDialog`, `PanelHeaderControls`, `PanelSection`, `RangeBar`, `STTModelCard`, `TTSModelCard`.

Icons: Iconify (`panelIcons` in [`src/constants/panel-icons.ts`](../../src/constants/panel-icons.ts)).
