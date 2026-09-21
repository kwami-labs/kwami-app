<!-- Security issues: do not use this template. Report privately — see SECURITY.md. -->

## What

<!-- What changes, and why. Link the issue if there is one: Closes #123 -->

## How

<!-- The approach, and anything a reviewer would otherwise have to reverse-engineer from the diff. -->

## Testing

<!-- Which lane covers this, and what it asserts. -->

- [ ] `bun run typecheck && bun run lint:check && bun run format:check && bun run test:unit`
- [ ] Unit coverage for the new behaviour
- [ ] E2E updated if this changes a user-visible flow
- [ ] UI: which panels, signed-in / signed-out, empty / error states

## Notes

<!--
Anything the reviewer should know. Delete the section if there is nothing.
-->

---

<!-- The PR title must be a Conventional Commit — it becomes the squash commit on main.
     e.g. feat(auth): follow the pointer during wallet approval -->
