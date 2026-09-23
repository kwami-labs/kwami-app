import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { evaluatePush } from './assert-push-allowed.mjs';

const human = (message) => ({ message, author: { name: 'Alex', username: 'alexcolls' } });
const bot = (message) => ({
  message,
  author: { name: 'github-actions[bot]', username: 'github-actions[bot]' },
});

describe('evaluatePush', () => {
  it('allows the merge commit of a PR into the branch', () => {
    const result = evaluatePush({
      branch: 'main',
      commits: [human('Merge pull request #42 from polsnx/dev')],
      mergedPullRequest: { number: 42, base: 'main' },
    });
    assert.equal(result.ok, true);
    assert.match(result.reason, /#42/);
  });

  it('rejects a direct push to main', () => {
    const result = evaluatePush({
      branch: 'main',
      commits: [human('fix(web): hotfix straight on main')],
      mergedPullRequest: null,
    });
    assert.equal(result.ok, false);
    assert.match(result.reason, /only takes merged pull requests from `dev`/);
    assert.match(result.reason, /hotfix straight on main/);
  });

  it("allows semantic-release's own release commits", () => {
    const result = evaluatePush({
      branch: 'main',
      commits: [bot('chore(release): web-v0.10.0 [skip actions]')],
      mergedPullRequest: null,
    });
    assert.equal(result.ok, true);
  });

  it('allows the post-release back-merge by subject even without a bot author', () => {
    const result = evaluatePush({
      branch: 'main',
      commits: [human('chore: sync dev with main after release [skip actions]')],
      mergedPullRequest: null,
    });
    assert.equal(result.ok, true);
  });

  it('rejects a push that mixes automation with a hand-written commit', () => {
    const result = evaluatePush({
      branch: 'main',
      commits: [
        bot('chore(release): web-v0.10.0 [skip actions]'),
        human('fix: and one more thing'),
      ],
      mergedPullRequest: null,
    });
    assert.equal(result.ok, false);
  });

  it('rejects a merge commit whose PR targeted another branch', () => {
    const result = evaluatePush({
      branch: 'main',
      commits: [human('Merge pull request #7 from polsnx/feature')],
      mergedPullRequest: { number: 7, base: 'dev' },
    });
    assert.equal(result.ok, false);
  });

  it('rejects an empty commit list rather than assuming automation', () => {
    const result = evaluatePush({ branch: 'main', commits: [], mergedPullRequest: null });
    assert.equal(result.ok, false);
  });

  it('fails closed without a branch', () => {
    const result = evaluatePush({ branch: '', commits: [bot('chore(release): x')] });
    assert.equal(result.ok, false);
    assert.match(result.reason, /Missing BRANCH/);
  });
});
