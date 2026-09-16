# Data flow

This page walks the four flows that define the product: authentication, companion workspaces, a live voice session, and long-term memory.

## Authentication

```mermaid
sequenceDiagram
  participant User
  participant Guard as AuthGuard
  participant Auth as auth store
  participant SB as Supabase
  participant Parent as Opener window

  User->>Guard: open app
  Guard->>Auth: initAuth()
  Auth->>SB: getSession()
  alt Existing session
    SB-->>Auth: session + user
    Auth-->>Guard: isAuthenticated
  else Google OAuth popup
    User->>SB: sign in (popup)
    SB-->>Guard: tokens in popup
    Guard->>Parent: postMessage supabase-auth-callback
    Parent->>Auth: session
  end
```

- `AuthGuard` shows welcome rings for at least 3.5s while the session restores.
- OAuth can complete in a popup. The popup posts `{ type: 'supabase-auth-callback', session }` to `window.opener` and closes. The parent only accepts messages from the same origin.
- Hash fragments containing `access_token` are stripped with `history.replaceState`.
- Signing out calls `supabase.auth.signOut()` and clears store user/session.

On `isAuthenticated`, `App.vue` starts credits polling and `workspaceStore.loadFromDb(userId)`, and loads locale from `user_app_settings`.

## Workspaces (companions)

A **workspace** is one named Kwami: id, name, colors, and a JSON config snapshot.

```mermaid
flowchart TB
  Auth[Signed-in user] --> Load[loadFromDb]
  Load --> Table[(user_kwamis)]
  Table --> List[workspaces[]]
  List --> Active[activeWorkspaceId]
  Active --> Apply[applyConfig]
  Apply --> Stores[avatar / voice / scene / theme / telephony]
  Stores --> Draft[updateActiveConfigLocal]
  Draft --> Dirty[hasUnsavedConfig]
  Dirty --> Save[saveActiveConfig]
  Save --> Table
```

- Empty accounts get one randomly named companion on first load.
- Switching companions writes the current draft onto the previous row (local only), then applies the next row's snapshot.
- Deleting a companion also best-effort deletes `/memory/kwami_{userId}_{kwamiId}`.

See [Workspaces](../concepts/workspaces.md).

## Voice session

```mermaid
sequenceDiagram
  participant UI as ControlBar
  participant K as useKwami
  participant API as Kwami API
  participant LK as LiveKit
  participant Agent as Voice agent

  UI->>K: connect()
  K->>API: POST /token + Bearer
  alt 402 insufficient credits
    API-->>K: 402
    K-->>UI: kwami:insufficient-credits
  else OK
    API-->>K: LiveKit JWT
    K->>LK: join room
    K->>K: kwami:sessionPrepare
    K->>Agent: connect payload<br/>kwamiId, soul, voice, tools
    K->>Agent: syncConfigToBackend(...)
    Agent-->>K: transcripts / audio
    K-->>UI: kwami:message / kwami:interim
  end
  UI->>K: disconnect()
  K-->>UI: kwami:disconnected
  UI->>UI: refresh credits
```

`memoryUserId` is `kwami_{authUserId}_{activeKwamiId}`. The agent and Zep treat that string as the memory user, so two companions never share a graph.

After the room is up, `syncAllConfigToBackend` pushes soul, VAD/enhancements, LLM params, TTS/realtime voice, STT model, client tool definitions, and memory retrieval settings. Panels do not have to be mounted for the agent to receive them.

See [Voice pipeline](../concepts/voice-pipeline.md).

## Memory graph

```mermaid
flowchart LR
  Agent[LiveKit agent] --> API[POST memory internals]
  API --> Zep[(Zep)]
  Panel[MemoryPanel] --> Store[memory store]
  Store --> API2["GET /memory/{id}/edges|nodes|messages"]
  API2 --> Zep
  Store --> Graph[2D / 3D graph]
```

The panel never talks to Zep. The store pages edges and nodes (100 per request) with `createRequestGuard()` so a mid-load companion switch cannot append the old graph onto the new one.

See [Memory](../concepts/memory.md).

## Credits

Usage is billed on the backend when a voice session ends. The client:

1. Loads `/credits/balance` on sign-in
2. Reloads balance and usage logs on `kwami:disconnected`
3. Surfaces `kwami:insufficient-credits` as a toast if `POST /token` returns 402

See [Credits](../concepts/credits.md).

## Agent → UI actions

`useWorkspaceAgentTools` registers client tools on the Kwami instance (open a panel, change theme, compose email, and so on). The LiveKit agent invokes them over the data channel. Tools are re-synced on every `connect()` because they are registered before the room opens.

See [Tools](../concepts/tools.md).
