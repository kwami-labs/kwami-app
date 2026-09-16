# Avatars

The companion is a Three.js object rendered by the Kwami SDK onto `#kwami-canvas`. This app owns **parameters and presets**; the SDK owns the shaders and animation loop.

## Renderers

| Id | Store | Sync composable | Look |
| --- | --- | --- | --- |
| `blob-xyz` | `avatar.blob-xyz` | `useBlobXyzSync` | Organic blob, independent X/Y/Z colors and spikes |
| `black-hole` | `avatar.black-hole` | `useBlackHoleSync` | Accretion / event-horizon style |
| `particles-face` | `avatar.particles-face` | `useParticlesFaceSync` | Particle field face |
| `eye-iris` | `avatar.eye-iris` | `useEyeIrisSync` | Iris / pupil |

`useAvatarStore.rendererType` is the persisted choice. Shortcuts: `B` blob, `H` black-hole. `switchRenderer` on the SDK updates the scene and emits `kwami:rendererChanged`.

## Stores

[`src/stores/avatar.ts`](../../src/stores/avatar.ts) is the façade: renderer, camera, interactions, skins, plus `getSnapshot` / `applySnapshot` for workspace config.

Per-renderer stores hold the dense numeric state (colors, spikes, rotation, particles, …). Sync composables push that state onto the live SDK object (`getBlob()`, `getBlackHole()`, …).

Presets live under `src/presets/avatar/`.

## States

`idle` | `listening` | `thinking` | `speaking`

Forced via `kwami.setState` (`L` / `T` / `I`) or driven by the agent `onStateChange` mapping (`initializing` → `listening`).

## Interactions

Configurable in the Avatar panel:

| Gesture | Default |
| --- | --- |
| Click | Pulse |
| Double-click | Toggle listening |
| Right-click | Randomize |
| Double right-click | Switch renderer |
| Drag | Rotate |
| Hover | Pointer cursor |

`randomizeAvatarPanel` applies random presets through the four sync composables and dispatches `kwami:randomized`.

## Scene vs avatar

**Avatar** is the companion mesh. **Scene** is the world behind it (gradient, image, video, HDRI, overlays, star field). Scene settings are a separate store and panel; `useSceneBackground` applies them to the SDK scene after init and on config apply.

Resize: `App.vue` observes the canvas parent and calls `avatar.getScene()?.resize` plus blob `position.refresh()`.
