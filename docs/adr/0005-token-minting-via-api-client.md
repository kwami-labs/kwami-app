# 0005. Mint LiveKit tokens through apiClient

- Status: Accepted
- Date: 2026-09-16

## Context

The Kwami SDK can `fetch` a token from `tokenEndpoint`. Its error path is `Failed to fetch token: ${response.statusText}`. For HTTP/2, `statusText` is empty; for `402` it is `"Payment Required"`. The app's insufficient-credits toast never matched, and the request had no timeout.

A dedicated `VITE_LIVEKIT_TOKEN_ENDPOINT` also drifted from `VITE_API_URL`.

## Decision

- `useKwami.connect()` calls `api.post('/token', …)` (`retry: false`, 20s timeout)
- Room name is omitted so the server generates an unguessable name
- `kwamiId` is sent only when the workspace id is a persisted Supabase row
- `VITE_LIVEKIT_TOKEN_ENDPOINT` is removed; `VITE_LIVEKIT_URL` remains (WebSocket)

`402` arrives as `ApiError` and becomes `kwami:insufficient-credits`.

## Consequences

The API must expose `POST /token` on the same origin as the rest of the client contract. The SDK is still responsible for joining the room with the returned JWT. Tests stub `/token` in MSW / Playwright, not a second host.
