## Summary

<!-- Why this change exists. Not a file list. -->

## Type

- [ ] `feat`
- [ ] `fix`
- [ ] `docs`
- [ ] `refactor` / `perf` / `test` / `chore` / `ci`

## Test plan

- [ ] `bun run typecheck && bun run lint:check && bun run format:check && bun run test:unit`
- [ ] UI: which panels, signed-in / signed-out, empty / error states
- [ ] Changelog updated if this is user-visible ([CHANGELOG.md](../CHANGELOG.md))

## Checklist

- [ ] No new `fetch()` wrapper around the Kwami API
- [ ] No secrets or `VITE_` provider keys
- [ ] Routes documented in [docs/reference/api.md](../docs/reference/api.md) if the contract changed
