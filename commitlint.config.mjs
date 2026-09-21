/**
 * Enforces Conventional Commits on the commit message via the husky `commit-msg`
 * hook and the `commits` job in ci.yml.
 *
 * This is not a style preference. `.releaserc.json` derives the version, the
 * tag, the CHANGELOG entry and the GitHub Release from this history, so a
 * commit that does not parse is silently unreleasable work.
 */
export default {
  extends: ['@commitlint/config-conventional'],
};
