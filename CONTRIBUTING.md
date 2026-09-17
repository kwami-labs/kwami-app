# Contributing to Kwami App

Thanks for taking the time to contribute.

The full contributor guide — workflow, Conventional Commits, and what we will not merge — lives in the docs:

**[docs/guides/contributing.md](docs/guides/contributing.md)**

Also read:

- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Development](docs/guides/development.md)
- [Testing](docs/guides/testing.md)
- [Security](SECURITY.md)
- [Changelog](CHANGELOG.md) — user-visible changes go under `[Unreleased]`

## Fast path

```bash
bun install
bun run typecheck
bun run lint:check
bun run format:check
bun run test:unit
```

Open a focused PR against `main`. CI must stay green.
