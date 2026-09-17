# Contributing

Thanks for helping improve Kwami App. This document is the process; [Development](development.md) is the day-to-day toolchain.

## Before you start

1. Read the [Code of Conduct](../../CODE_OF_CONDUCT.md)
2. Open an issue for large changes so scope is agreed ([templates](../../.github/ISSUE_TEMPLATE/))
3. Fork (or branch from `main` if you have write access)

## Workflow

```bash
git checkout -b feat/short-description
bun install
bun run typecheck
bun run lint:check
bun run format:check
bun run test:unit
```

Keep PRs focused. A refactor that also “fixes a typo in 40 files” is two PRs.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(optional-scope): <imperative summary>

optional body
```

Allowed types include `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `perf`, `style`, `build`.

Breaking changes: `feat(api)!: …` or a `BREAKING CHANGE:` footer.

Do not add `Co-authored-by` for bots or AI assistants.

## Pull requests

- Rebase or merge `main` before asking for review
- CI on [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) must be green
- Describe **why**, not a file list
- Include a test plan for UI changes (which panels, signed-in / signed-out, empty states)
- Do not commit `.env`, credentials, or generated `dist/`

## Changelog

User-visible work (features, fixes, security) gets a bullet under `[Unreleased]` in [CHANGELOG.md](../../CHANGELOG.md). Follow [Keep a Changelog](https://keepachangelog.com/). Release process: [Releasing](releasing.md).

## What we will not merge

- New `fetch()` wrappers around the Kwami API (use `apiClient`)
- Zep or provider secrets in `VITE_*`
- Coverage threshold decreases
- Drive-by reformatting of unrelated files
- Undocumented `kwami:*` window events or a second event bus
