# Environment variables

Narrative: [Environment guide](../guides/environment.md). Sample file: [`.env.sample`](../../.env.sample).

## Client (`VITE_*`)

| Name | Required | Default | Description |
| --- | --- | --- | --- |
| `VITE_API_URL` | yes | `http://localhost:8080` | Kwami API origin. Trailing slashes stripped |
| `VITE_LIVEKIT_URL` | yes | `''` | LiveKit WebSocket URL |
| `VITE_LIVEKIT_TOKEN_ENDPOINT` | yes | `''` | HTTP endpoint that returns a room JWT |
| `VITE_SUPABASE_URL` | yes | `''` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | yes | `''` | Supabase anon / publishable key |

All five are public (inlined by Vite). Never put provider secrets here.

## Test injection

| Context | How |
| --- | --- |
| Vitest | Hard-coded in `vitest.config.ts` `test.env` |
| Playwright | Vite `--mode test` + `.env.test` |
| CI | Same as above; no repo secrets required for the client job |

## Playwright

| Name | Default | Description |
| --- | --- | --- |
| `PLAYWRIGHT_PORT` | `5173` | Dev-server port for e2e |
| `CI` | unset | Enables retries, single worker, GitHub reporter |

## Tauri

No extra env at runtime. `VITE_*` values are those present when `bun run build` / `tauri build` ran.
