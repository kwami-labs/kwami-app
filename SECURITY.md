# Security policy

## Supported versions

| Version | Supported |
| --- | --- |
| `main` | Yes |
| Published tags | Best effort until a newer tag exists |

This client is tightly coupled to the Kwami API. Security fixes land on `main` first.

## What this app is allowed to hold

The browser bundle only contains `VITE_*` values. Those are **public**:

- API origin
- LiveKit WebSocket URL and token endpoint URL
- Supabase URL and publishable (anon) key

The following must **never** appear in this repository, in `VITE_*`, or in client code:

- OpenAI / Deepgram / ElevenLabs / other provider API keys
- Zep API keys
- Stripe secret keys
- LiveKit API keys or API secrets
- Supabase `service_role` keys
- Any user's access token in logs, issues, or fixtures

Memory and billing always go through the backend. Threat model and review list: [docs/security.md](docs/security.md). HTTP contract: [Backend integration](docs/architecture/backend-integration.md).

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security reports.

Email **security@kwami.io** with:

- A description of the issue and impact
- Steps to reproduce, or a proof of concept
- Affected commit / tag if known
- Whether you are available for follow-up

You should receive an acknowledgement within **72 hours**. We will keep you informed of the fix timeline and credit you if you want.

## Scope hints

Higher-severity areas in this client:

- OAuth popup `postMessage` origin checks (`auth` store)
- Token cache and 401 replay in `apiClient`
- XSS via agent tool arguments or search-result HTML
- Iframe `BrowserPanel` / extension message handling
- Accidental logging of Bearer tokens or transcripts

Out of scope for this repo (report to the API / infra owners): Zep tenancy, credit debit logic, LiveKit room ACLs, Supabase RLS.
