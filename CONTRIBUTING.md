# Contributing

Report security issues privately — [SECURITY.md](./SECURITY.md). Do not open a public issue or pull request for a vulnerability.

Also read the [Code of Conduct](CODE_OF_CONDUCT.md) and [Development](docs/guides/development.md).

## The rules, in one paragraph

`main` is protected: you cannot push to it. Every change arrives as a pull request from a branch, the pull request title is a Conventional Commit, all CI checks pass, and it lands as a single squashed commit. History on `main` is linear and never force-pushed.

## Branches

Changes promote in one direction:

```
feature/* → dev → stg → main
```

`stg` takes a pull request from any branch except `main`. `main` takes a pull request from `stg`, and it must be `stg`'s current tip on this repository — not a fork, and not a namesake branch. Back-merges into lower channels are pushed by `cd.yml`, never merged by pull request.

Three things enforce that, in increasing order of authority:

| | What it does | Bypass |
|---|---|---|
| `.husky/pre-push` | Refuses the push before it leaves your machine | `--no-verify` |
| `branch-guard.yml` / `branch-promotion.yml` | Turns the branch or the PR red | none, but it cannot *prevent* a push |
| GitHub branch protection | GitHub refuses the push outright | repository admin |

Branch off `dev`, named `<type>/<short-description>`:

```
feat/welcome-beat-clock
fix/wallet-siws-handoff
chore/bump-vitest
```

The type prefix matches the Conventional Commit types below. Branches are deleted on merge.

### `dev` and `stg`

**All three channels deploy.** `dev` ships to Worker `kwami-app-dev`, `stg` to `kwami-app-stg`, and `main` to `kwami-app`. `stg` is also a prerelease channel (`vX.Y.Z-stg.N`) so it cannot collide with a stable tag on `main`.

A push to `dev` runs the **fast lane** — `lint` and `unit` — and skips `e2e`, `vuln` and `build`. `dev` is the branch you push to repeatedly, and those three cost minutes each. The full suite still runs on every pull request, so nothing reaches `main` without it. The fast lane is a shorter feedback loop, not a lower bar.

| | `lint` `unit` | `e2e` `vuln` `build` | `cd` |
|---|---|---|---|
| pull request | yes | yes | no |
| push `dev` | yes | **no** | deploy `kwami-app-dev` |
| push `stg` | yes | yes | release (prerelease), deploy `kwami-app-stg` |
| push `main` | yes | yes | **release**, deploy `kwami-app` |

`cd.yml` is called by `ci.yml` once every gate on that commit has gone green. Create GitHub Environments `production`, `stg` and `dev` with their own `CLOUDFLARE_*` and `VITE_*` values.

## Commits and pull request titles

[Conventional Commits](https://www.conventionalcommits.org/), enforced in three places:

- `.husky/commit-msg` runs commitlint as you commit, so a malformed message never gets written.
- The `commits` job in `ci.yml` lints every commit the branch adds.
- The `pr-title` job lints the pull request title, because a squash merge is what lands on `main` — the title becomes the commit message.

This is not a style preference. `.releaserc.json` derives the version, the tag, the CHANGELOG entry and the GitHub Release from these subjects. A commit that does not parse is silently unreleasable work.

```
<type>(<optional scope>): <description>

feat(auth): follow the pointer during wallet approval
fix(avatar): hero-fit only blob and iris on workspace resize
test(e2e): map digit shortcuts to SETTINGS_PANEL_ORDER
```

Types: `feat` `fix` `docs` `style` `refactor` `perf` `test` `build` `ci` `chore` `revert`.
A `!` after the type or scope, or a `BREAKING CHANGE:` footer, marks a breaking change.

Do not add `Co-authored-by` for bots or AI assistants.

## Before you open a pull request

```bash
bun run typecheck && bun run lint:check && bun run format:check && bun run test:unit
```

That is the whole local gate. CI runs the same targets, plus Playwright, `bun audit`, and a production build.

## CI

Every job in [`ci.yml`](.github/workflows/ci.yml) is a status check:

| Check | What fails it |
|---|---|
| `pr-title` | The PR title is not a Conventional Commit |
| `commits` | A first-parent commit on the branch is not a Conventional Commit |
| `lint` | `vue-tsc`, ESLint, Prettier, or a CI script test |
| `unit` | Vitest, or a coverage floor in `vitest.config.ts` |
| `e2e` | Playwright |
| `vuln` | `bun audit --prod` |
| `build` | `bun run build` |

[`cd.yml`](.github/workflows/cd.yml) is called by `ci.yml` from the commit that just passed, on `main`, `stg` or `dev`: `main` and `stg` cut the release; all three deploy their Cloudflare Worker. It can also be run by hand from the Actions tab to retry a delivery without re-running the whole suite.

## Releases

Versions, tags, the GitHub Release and [`CHANGELOG.md`](CHANGELOG.md) are generated from the commit history by [semantic-release](https://semantic-release.gitbook.io). Nothing is hand-maintained, nothing needs a version bump in a pull request, and no tag is ever pushed by hand.

```text
merge a PR into main or stg
        │
        ▼
      ci.yml ── red ──▶ nothing
        │ green
        ▼
      cd.yml
        ├─ release   semantic-release → CHANGELOG.md + tag + GitHub Release
        └─ deploy    wrangler → channel Worker

push to dev
        │
        ▼
      ci.yml (fast lane) ── red ──▶ nothing
        │ green
        ▼
      cd.yml
        └─ deploy    wrangler --env dev → kwami-app-dev
```

The client is pre-1.0, so [`.releaserc.json`](.releaserc.json) maps **breaking → minor** and everything else → patch: a `feat!:` bumps `0.3.x → 0.4.0`, not `1.0.0`. Every conventional type is releasable — a `test:` or `refactor:` still ships a patch — but only `feat`, `fix`, `perf` and `revert` get a heading in the changelog (the `angular` preset).

`v0.1.0` is a baseline tag at the commit that introduced this automation. Without it semantic-release would treat the repository as a fresh 1.0.0 and pull the entire pre-automation history into the first changelog; the first `cd` run creates it if it is missing.

## What we will not merge

- New `fetch()` wrappers around the Kwami API (use `apiClient`)
- Zep or provider secrets in `VITE_*`
- Coverage threshold decreases
- Drive-by reformatting of unrelated files
- A PR into `main` that is not the current tip of `stg`
