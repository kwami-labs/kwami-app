# Environment variables

Narrative: [Environment guide](../guides/environment.md). Sample file: [`.env.sample`](../../.env.sample).

## Client (`VITE_*`)

| Name | Required | Default | Description |
| --- | --- | --- | --- |
| `VITE_API_URL` | no | `http://localhost:8080` | Kwami API origin. Trailing slashes stripped. Includes `POST /token` |
| `VITE_LIVEKIT_URL` | for voice | `''` | LiveKit WebSocket URL |
| `VITE_SUPABASE_URL` | **yes** | `''` | Supabase project URL. Missing → boot error |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | **yes** | `''` | Supabase anon / publishable key. Missing → boot error |
| `VITE_AUTH_PROVIDERS` | no | `google` | Comma-separated: `google`, `apple`, `azure`, `github`, `phantom`, `metamask`. Email + password is always available and is not configured here |
| `VITE_WALLET_CARD_FUNDING` | no | unset | Set `true` to show wallet card-funding UI |

All `VITE_*` values are public (inlined by Vite). Never put provider secrets here. There is **no** `VITE_LIVEKIT_TOKEN_ENDPOINT`; see [ADR 0005](../adr/0005-token-minting-via-api-client.md).

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
