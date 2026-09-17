# 0003. Per-companion memory and apps

- Status: Accepted
- Date: 2026-03-10

## Context

Users keep multiple named companions. Mixing transcripts, phone numbers, or inboxes across them is a product and privacy failure.

## Decision

Identity for agent + Zep is:

```
memoryUserId = kwami_{supabaseUserId}_{workspaceId}
```

Contacts, email, calendar, wallet, and communications channels are keyed by the active workspace id. Switching companions:

1. Writes the current draft onto the previous row (local only)
2. Applies the next row's config snapshot
3. Aborts in-flight guarded API requests so pages cannot append to the wrong graph

Deleting a companion also best-effort `DELETE /memory/{memoryUserId}`.

## Consequences

The backend must treat `memoryUserId` as the tenant key and authorize it against the JWT + `user_kwamis`. The client must never reuse a single Zep user for an account. Request guards are mandatory on paged stores.
