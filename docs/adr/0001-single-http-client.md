# 0001. One shared HTTP client

- Status: Accepted
- Date: 2026-09-16

## Context

Stores used to call `fetch` with ad-hoc base URLs, timeouts, and auth headers. Memory derived its host from `VITE_LIVEKIT_TOKEN_ENDPOINT` by stripping `/token`, which often disagreed with `VITE_API_URL`. Companion switches raced: a slow inbox response could overwrite the newly selected kwami.

## Decision

All Kwami API traffic goes through [`src/lib/apiClient.ts`](../../src/lib/apiClient.ts).

- Single base URL (`env.apiUrl`)
- Shared Bearer cache (`getAuthToken`)
- Typed `ApiError` (`402` → insufficient credits)
- `createRequestGuard()` for list/detail loads that must lose the race cleanly
- Catalogues use `catalogResource.ts` (in-flight de-dupe, null on failure)

Stores and `use*Api` composables do not wrap `fetch` for this backend.

## Consequences

Adding a route is one `api.get/post/…` call plus a line in [API reference](../reference/api.md). A second HTTP stack is a review reject. Tauri/WebKitGTK cannot use `AbortSignal.any`; the client composes signals by hand — that workaround lives in one file.
