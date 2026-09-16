# Architecture Decision Records

Short, dated records of decisions that are expensive to reverse. New ADRs are Markdown files in this folder, numbered `NNNN-kebab-title.md`.

| ID | Title | Status |
| --- | --- | --- |
| [0001](0001-single-http-client.md) | One shared HTTP client | Accepted |
| [0002](0002-no-secrets-in-the-client.md) | No provider or Zep secrets in the bundle | Accepted |
| [0003](0003-per-kwami-isolation.md) | Per-companion memory and apps | Accepted |
| [0004](0004-lazy-panels-and-window-events.md) | Lazy panels + `window` event bus | Accepted |
| [0005](0005-token-minting-via-api-client.md) | Mint LiveKit tokens through `apiClient` | Accepted |

## Template

```md
# NNNN. Title

- Status: Proposed | Accepted | Superseded by NNNN
- Date: YYYY-MM-DD

## Context

What forces us to choose.

## Decision

What we will do.

## Consequences

What becomes easier, harder, or forbidden.
```
