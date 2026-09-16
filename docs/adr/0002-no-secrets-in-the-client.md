# 0002. No provider or Zep secrets in the client

- Status: Accepted
- Date: 2026-09-16

## Context

Vite inlines every `VITE_*` variable into the JavaScript bundle. An earlier experiment passed Zep credentials into the SDK's in-browser `Memory` class. That class is a stub (`addMessage` no-ops, `search` returns `[]`), so the keys could not work **and** they shipped to every user.

## Decision

- The frontend `KwamiConfig` has **no `memory` block**
- Recall and graph mutations use `/memory/*` on the API
- Provider keys (OpenAI, Deepgram, ElevenLabs, Stripe, LiveKit API secret, Zep) stay on the server
- `.env.sample` only lists public origins and the Supabase publishable key

## Consequences

Voice, memory, and billing cannot be demoed against raw third-party APIs from this repo. That is intentional. A PR that adds `VITE_ZEP_*` or `VITE_OPENAI_*` is a security bug, not a feature. See [Security](../security.md).
