# Composables

Vue composables under [`src/composables/`](../../src/composables/).

## Runtime

| Composable | Role |
| --- | --- |
| `useKwami` | Singleton `Kwami` instance: init, connect, disconnect, dispose, renderer |
| `useKwamiConfigSync` | Build / apply / save / revert workspace snapshots |
| `useKwamiConfigWatchers` | Draft watcher + apply-on-switch (mounted from `App.vue`) |
| `useKwamiActions` | Create / rename / delete companions + memory purge |
| `useWorkspaceAgentTools` | Register client tools the LiveKit agent can call |
| `useSceneBackground` | Push scene store onto the SDK scene |
| `useAvatarInteractions` | Click / drag / hover → SDK + events |

## Avatar sync

| Composable | Renderer |
| --- | --- |
| `useBlobXyzSync` | `blob-xyz` |
| `useBlackHoleSync` | `black-hole` |
| `useParticlesFaceSync` | `particles-face` |
| `useEyeIrisSync` | `eye-iris` |
| `randomizeAvatarPanel` | All four |

Each exposes `applyToKwami` used on init, config apply, and randomize.

## HTTP / catalogues

| Composable | Backend |
| --- | --- |
| `useModelsApi` | `/models/{llm,stt,tts,realtime}` + plugins + capabilities |
| `useVoicesApi` | `/voices/tts`, `/voices/realtime` |
| `useLanguagesApi` | `/languages`, `/languages/{stt,tts,realtime}` |
| `useCreditsApi` | `/credits/*` |
| `useCommunicationsApi` | `/channels/*` |

Catalog helpers: [`src/lib/catalogResource.ts`](../../src/lib/catalogResource.ts).

## UI / session chrome

| Composable | Role |
| --- | --- |
| `useNavigation` | Listen for `kwami:browser_session` / extension nav |
| `useSearchResults` | Orbit cards from `kwami:search_results` |
| `usePanelShortcuts` | Digit keys + `P` |
| `useTranscriptionState` | History panel lines, session keys |
| `useAgentActionState` | In-progress tool / search status |
| `useMetricsState` | Live metrics while connected |
| `useRecording` | Session recording + region picker |
| `useCommunicationsPanel` | Shared phone/WhatsApp/SMS panel logic |
| `useVoiceOptions` | Voice dropdown helpers |
| `useWelcomeAnimation` | Auth welcome rings |
| `useKwamiGradient` | Canvas-adjacent gradient |
| `useColorPalettes` | Harmonized color sets for scene/avatar |

## Shared libraries (not composables, often imported with them)

| Module | Role |
| --- | --- |
| `src/lib/apiClient.ts` | `api`, `ApiError`, `getAuthToken`, `createRequestGuard` |
| `src/lib/supabase.ts` | Supabase JS client |
| `src/lib/userAppSettings.ts` | Locale load/save |
| `src/lib/catalogResource.ts` | Cached catalogue GETs |
