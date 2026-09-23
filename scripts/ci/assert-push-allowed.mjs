#!/usr/bin/env node
/**
 * Reject a direct push to `main`.
 *
 * `main` takes a merged pull request from the current tip of `dev`. GitHub's own branch
 * protection is the right place to enforce that, and
 * `scripts/ci/apply-branch-rules.mjs` configures it — but it needs an admin and, on a private
 * repository, a paid plan. Until that is in place (and afterwards, as a second pair of eyes for
 * anything holding a bypass) this turns a direct push into a red check on the branch.
 *
 * Allowed:
 *   - the merge commit of a pull request whose base is this branch
 *   - a push whose every commit comes from the release automation: semantic-release's
 *     `chore(release):` commits, and `chore: sync …` subjects
 *
 * Everything else is somebody pushing straight at a protected branch.
 *
 * Usage (CI sets the env vars):
 *   BRANCH HEAD_SHA REPO PUSHER COMMITS GITHUB_TOKEN node scripts/ci/assert-push-allowed.mjs
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const AUTOMATION_LOGINS = new Set(['github-actions[bot]', 'github-actions']);
const AUTOMATION_SUBJECTS = [/^chore\(release\):/, /^chore: sync /];

/**
 * @param {{
 *   branch: string,
 *   commits?: Array<{ message?: string, author?: { name?: string, username?: string } }>,
 *   mergedPullRequest?: { number: number, base: string } | null,
 * }} input
 * @returns {{ ok: true, reason: string } | { ok: false, reason: string }}
 */
export function evaluatePush(input) {
  const branch = input.branch?.trim() ?? '';
  const commits = input.commits ?? [];
  const pr = input.mergedPullRequest ?? null;

  if (!branch) {
    return { ok: false, reason: 'Missing BRANCH for the push check.' };
  }

  if (pr && pr.base === branch) {
    return { ok: true, reason: `Merge of #${pr.number} into ${branch}.` };
  }

  if (commits.length > 0 && commits.every(isAutomationCommit)) {
    return { ok: true, reason: `${commits.length} release-automation commit(s).` };
  }

  const subjects = commits
    .map((commit) => (commit.message ?? '').split('\n')[0])
    .filter(Boolean)
    .slice(0, 5);

  return {
    ok: false,
    reason: [
      `Direct push to \`${branch}\`.`,
      '',
      `\`${branch}\` only takes merged pull requests from \`dev\`, plus the release automation's own commits.`,
      subjects.length > 0 ? `\nPushed: ${subjects.map((s) => `\`${s}\``).join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

function isAutomationCommit(commit) {
  const [subject] = (commit.message ?? '').split('\n');
  const author = commit.author ?? {};
  const byBot =
    AUTOMATION_LOGINS.has(author.username ?? '') || AUTOMATION_LOGINS.has(author.name ?? '');
  return byBot || AUTOMATION_SUBJECTS.some((pattern) => pattern.test(subject));
}

/** The pull request this commit closed, when it is a merge commit GitHub knows about. */
async function fetchMergedPullRequest({ repo, sha, token }) {
  const response = await fetch(`https://api.github.com/repos/${repo}/commits/${sha}/pulls`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status} listing pull requests for ${sha.slice(0, 7)}`);
  }
  const body = await response.json();
  const merged = (Array.isArray(body) ? body : []).find((pr) => pr.merge_commit_sha === sha);
  return merged ? { number: merged.number, base: merged.base?.ref ?? '' } : null;
}

function report(result) {
  const target =
    process.env.PUSH_GUARD_FILE ||
    (process.env.RUNNER_TEMP ? join(process.env.RUNNER_TEMP, 'push-guard.txt') : null);
  if (target) {
    writeFileSync(target, `${result.reason}\n`);
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, `### Branch guard\n\n${result.reason}\n`, {
      flag: 'a',
    });
  }
}

async function main() {
  const branch = process.env.BRANCH ?? '';
  const sha = (process.env.HEAD_SHA ?? '').trim();
  const repo = (process.env.REPO ?? '').trim();
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? '';

  let commits = [];
  try {
    commits = JSON.parse(process.env.COMMITS || '[]');
  } catch {
    commits = [];
  }

  let mergedPullRequest = null;
  if (repo && sha) {
    // A lookup failure must not wave a push through: treat it as "not a PR merge" and let the
    // automation check below decide.
    try {
      mergedPullRequest = await fetchMergedPullRequest({ repo, sha, token });
    } catch (error) {
      console.log(`::notice::${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const result = evaluatePush({ branch, commits, mergedPullRequest });
  report(result);

  if (!result.ok) {
    console.error(`::error::${result.reason.split('\n')[0]}`);
    console.error(result.reason);
    process.exit(1);
  }

  console.log(`OK: ${result.reason}`);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((error) => {
    console.error(`::error::${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
