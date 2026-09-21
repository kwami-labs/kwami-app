#!/usr/bin/env node
/**
 * Branch-promotion gate for `.github/workflows/branch-promotion.yml`.
 *
 * Keeps the promote path one-directional:
 *
 *   feature/* → dev → stg → main
 *
 * `stg` takes pull requests from any branch except `main` (back-merges are pushed
 * by cd.yml). Direct pushes are a different gate
 * (`assert-push-allowed.mjs`).
 *
 * For PRs into `main`, name matching is not enough: the head must be this
 * repository's current tip of `stg`. Forks can share a tip SHA when they are
 * fully synced, so the same-repo check is load-bearing. PRs into `dev` still
 * allow forks; only back-merges from `stg`/`main` via PR are rejected.
 *
 * Usage (CI sets the env vars):
 *   BASE HEAD HEAD_SHA HEAD_REPO BASE_REPO GITHUB_TOKEN \
 *     node scripts/ci/assert-promotion-path.mjs
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const CHANNEL_TARGETS = new Set(['main']);
const REQUIRED_HEAD = { main: 'stg' };

/**
 * @param {{
 *   base: string,
 *   head: string,
 *   headSha: string,
 *   headRepo: string,
 *   baseRepo: string,
 *   tipSha?: string | null,
 * }} input
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function evaluatePromotion(input) {
  const base = input.base?.trim() ?? '';
  const head = input.head?.trim() ?? '';
  const headSha = input.headSha?.trim() ?? '';
  const headRepo = input.headRepo?.trim() ?? '';
  const baseRepo = input.baseRepo?.trim() ?? '';
  const tipRaw = input.tipSha?.trim();
  const tipSha = tipRaw ? tipRaw : null;

  if (!(base && head && headSha && headRepo && baseRepo)) {
    return {
      ok: false,
      reason: 'Missing BASE, HEAD, HEAD_SHA, HEAD_REPO, or BASE_REPO for promotion check.',
    };
  }

  if (base === 'dev') {
    if (head === 'stg' || head === 'main') {
      return {
        ok: false,
        reason: `'${head}' is downstream of dev; back-merges are pushed by cd.yml, not merged by PR.`,
      };
    }
    return { ok: true };
  }

  if (base === 'stg') {
    if (head === 'main') {
      return {
        ok: false,
        reason: `'main' is downstream of stg; back-merges are pushed by cd.yml, not merged by PR.`,
      };
    }
    return { ok: true };
  }

  if (!CHANNEL_TARGETS.has(base)) {
    return { ok: false, reason: `Unexpected base branch '${base}'.` };
  }

  if (headRepo !== baseRepo) {
    return {
      ok: false,
      reason: `PRs into ${base} must come from ${baseRepo} (got fork '${headRepo}'). Promote from this repository's channels, not a fork.`,
    };
  }

  const required = REQUIRED_HEAD[base];
  if (head !== required) {
    return {
      ok: false,
      reason: `PRs into main must come from stg (got '${head}' → main). Promote through stg first.`,
    };
  }

  if (!tipSha) {
    return {
      ok: false,
      reason: `Could not resolve the tip of '${head}' on ${baseRepo}.`,
    };
  }

  if (headSha !== tipSha) {
    return {
      ok: false,
      reason: `PRs into ${base} must promote the current tip of '${head}' on ${baseRepo} (PR head ${headSha.slice(0, 7)} ≠ tip ${tipSha.slice(0, 7)}).`,
    };
  }

  return { ok: true };
}

async function fetchTipSha({ baseRepo, head, token }) {
  const url = `https://api.github.com/repos/${baseRepo}/git/ref/heads/${encodeURIComponent(head)}`;
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status} for ${url}`);
  }
  const body = await response.json();
  const sha = body?.object?.sha;
  if (typeof sha !== 'string' || !sha) {
    throw new Error(`GitHub API response missing object.sha for heads/${head}`);
  }
  return sha;
}

function writeReason(reason) {
  const target =
    process.env.PROMOTION_ERROR_FILE ||
    (process.env.RUNNER_TEMP ? join(process.env.RUNNER_TEMP, 'promotion-error.txt') : null);
  if (!target) {
    return;
  }
  writeFileSync(target, `${reason}\n`);
}

async function main() {
  const base = process.env.BASE ?? '';
  const head = process.env.HEAD ?? '';
  const headSha = process.env.HEAD_SHA ?? '';
  const headRepo = process.env.HEAD_REPO ?? '';
  const baseRepo = process.env.BASE_REPO ?? '';
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? '';

  let tipSha = null;
  if (CHANNEL_TARGETS.has(base.trim())) {
    try {
      tipSha = await fetchTipSha({ baseRepo: baseRepo.trim(), head: head.trim(), token });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.error(`::error::${reason}`);
      writeReason(reason);
      process.exit(1);
    }
  }

  const result = evaluatePromotion({
    base,
    head,
    headSha,
    headRepo,
    baseRepo,
    tipSha,
  });

  if (!result.ok) {
    console.error(`::error::${result.reason}`);
    writeReason(result.reason);
    process.exit(1);
  }

  console.log(`OK: ${headRepo}@${headSha} (${head}) → ${base}`);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((error) => {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`::error::${reason}`);
    writeReason(reason);
    process.exit(1);
  });
}
