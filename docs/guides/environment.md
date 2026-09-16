# Environment

Copy [`.env.sample`](../../.env.sample) to `.env`. Vite only exposes variables prefixed with `VITE_` to the browser bundle. Treat them as public.

```bash
cp .env.sample .env
```

## Required

| Variable | Example | Used by |
| --- | --- | --- |
| `VITE_API_URL` | `http://localhost:8080` | [`apiClient.ts`](../../src/lib/apiClient.ts) — catalogues, memory, credits, channels, apps |
| `VITE_LIVEKIT_URL` | `wss://xxx.livekit.cloud` | `useKwami` agent config |
| `VITE_LIVEKIT_TOKEN_ENDPOINT` | `http://localhost:8080/token` | Room JWT issuer (must accept the Supabase Bearer) |
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` | Auth + `user_kwamis` / `user_app_settings` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` | Supabase JS client |

`VITE_API_URL` trailing slashes are stripped. If unset, the client falls back to `http://localhost:8080`.

Missing Supabase values log a warning. Sign-in will fail.

## Test mode

Playwright and Vitest do **not** read your personal `.env`.

- Vitest injects values in [`vitest.config.ts`](../../vitest.config.ts)
- Playwright starts Vite with `--mode test`, which loads [`.env.test`](../../.env.test)

That keeps CI and local e2e off real projects.

## Common mistakes

| Symptom | Cause |
| --- | --- |
| Welcome screen never ends | Supabase URL/key wrong; `getSession()` rejects and `loading` used to stick — now it clears with an error |
| Connect fails immediately | `VITE_LIVEKIT_URL` or token endpoint empty / CORS / backend down |
| “Insufficient credits” toast | Token endpoint returned 402 |
| Memory panel empty, other panels work | Backend `/memory/*` down or Zep unconfigured (503). The store now surfaces that as an error, not an empty graph |
| Auth works, companions vanish on refresh | `user_kwamis` RLS or table missing; the store falls back to an in-memory workspace |

## Secrets

Never put provider API keys, Zep keys, or Stripe secrets in this repo’s `.env`. The backend holds those. See [Backend integration](../architecture/backend-integration.md).
