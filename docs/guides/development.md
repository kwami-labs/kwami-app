# Development

## Scripts

| Command | What it does |
| --- | --- |
| `bun run dev` | Vite dev server on port 5173 |
| `bun run build` | `vue-tsc -b` then production Vite build |
| `bun run preview` | Serve the production build |
| `bun run typecheck` | `vue-tsc --noEmit -p tsconfig.app.json` |
| `bun run lint` | ESLint with `--fix` |
| `bun run lint:check` | ESLint, no writes (CI) |
| `bun run format` | Prettier on `src/` |
| `bun run format:check` | Prettier check (CI) |
| `bun run test` | Vitest watch |
| `bun run test:unit` | Vitest once |
| `bun run test:watch` | Vitest watch |
| `bun run test:e2e` | Playwright Chromium |
| `bun run test:e2e:ui` | Playwright UI mode |
| `bun run tauri` | Tauri CLI passthrough |
| `bun run tauri dev` | Desktop shell + Vite |

CI runs typecheck, lint, format, unit tests with coverage, production build, then e2e. See [Testing](testing.md).

## Tooling

| Tool | Config |
| --- | --- |
| TypeScript 5.9 | `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` |
| Vite 7 | [`vite.config.ts`](../../vite.config.ts) |
| ESLint 9 flat | [`eslint.config.js`](../../eslint.config.js) |
| Prettier | [`.prettierrc`](../../.prettierrc) — 2-space, semicolons, single quotes, width 100 |
| Vue language tools | `.vscode/extensions.json` |

Path alias: `@` → `src/`.

Production builds drop `console` and `debugger` via a Vite plugin that applies only to `build`, so Vitest and `vite dev` keep logs.

## Debug hooks

After init, the singleton is on `window.kwami`.

Useful keys (not while typing in an input):

| Key | Action |
| --- | --- |
| `B` / `H` | Blob / black-hole renderer |
| `R` | Randomize avatar |
| `L` / `T` / `I` | Force listening / thinking / idle |
| `P` | Toggle sidebar panel |
| `1`–`9` | Open panel by index (mode-dependent) |
| `Alt+1/2/3` | Panel width presets |

Full list: [Keyboard shortcuts](../reference/keyboard-shortcuts.md).

## Adding a settings panel

1. Create `src/components/panels/settings/<name>/<Name>Panel.vue`
2. Lazy-import it in `App.vue` and add a `v-if="uiStore.activePanel === '…'"`
3. Add the id to the right group in [`src/constants/panels.ts`](../../src/constants/panels.ts) (sidebar, digit shortcuts, and agent tools all read this)
4. Register the id in [`panel-icons.ts`](../../src/constants/panel-icons.ts)
5. Add i18n strings in `src/i18n/translations/en.ts` and `es.ts`

If the panel is something the voice agent should open, add an alias in `useWorkspaceAgentTools.ts` (`PANEL_ALIASES`). Do not hand-edit shortcut arrays.

## Adding an API resource

1. Call `api.get/post/put/patch/del` from a store or `src/composables/use*Api.ts`
2. Use `createRequestGuard()` if a newer request must cancel an older one
3. Use `createSimpleResource` / `createCatalogResource` for cacheable catalogues
4. Do not introduce a second `fetch` wrapper
5. Document the route in [API reference](../reference/api.md)

## Conventional commits

This repo uses [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(memory): paginate graph edges with a request guard
fix(auth): clear loading when session restore fails
docs: add architecture overview
```

See [Contributing](contributing.md).
