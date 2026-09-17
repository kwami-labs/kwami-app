# 0004. Lazy panels and a window event bus

- Status: Accepted
- Date: 2026-09-16

## Context

Settings and apps panels (Memory, Scene, Theme, Wallet, …) are large. Putting them in the entry chunk blew Workbox's precache budget and slowed first paint. Vue Router is unused: the canvas is the only route.

## Decision

- `App.vue` loads panels with `defineAsyncComponent`
- Cross-cutting signals use `window` `CustomEvent`s named `kwami:*` ([Events](../reference/events.md))
- Pinia holds durable state; events wake mounted listeners and the shell (`App.vue`, transcription, credits refresh)

There is no Vue Router and no extra event-bus package.

## Consequences

A panel can stay unmounted while the agent still receives config (`syncAllConfigToBackend` on connect). New features that need a sleeping panel to react must either persist in a store or dispatch a documented `kwami:*` event. Undocumented `window` events are a review reject.
