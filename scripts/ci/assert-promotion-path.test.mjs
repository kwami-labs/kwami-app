import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { evaluatePromotion } from './assert-promotion-path.mjs';

const REPO = 'polsnx/aurea.gg';
const FORK = 'evil/fork';
const DEV_TIP = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const STG_TIP = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

describe('evaluatePromotion', () => {
  it('allows feature → dev including forks', () => {
    assert.deepEqual(
      evaluatePromotion({
        base: 'dev',
        head: 'feature/x',
        headSha: 'cccc',
        headRepo: FORK,
        baseRepo: REPO,
      }),
      { ok: true },
    );
  });

  it('rejects main → dev back-merge PRs', () => {
    const result = evaluatePromotion({
      base: 'dev',
      head: 'main',
      headSha: DEV_TIP,
      headRepo: REPO,
      baseRepo: REPO,
    });
    assert.equal(result.ok, false);
    assert.match(result.reason, /back-merges/i);
  });

  it('rejects stg → dev back-merge PRs', () => {
    const result = evaluatePromotion({
      base: 'dev',
      head: 'stg',
      headSha: STG_TIP,
      headRepo: REPO,
      baseRepo: REPO,
    });
    assert.equal(result.ok, false);
    assert.match(result.reason, /back-merges/i);
  });

  it('allows same-repo tip of dev → stg', () => {
    assert.deepEqual(
      evaluatePromotion({
        base: 'stg',
        head: 'dev',
        headSha: DEV_TIP,
        headRepo: REPO,
        baseRepo: REPO,
      }),
      { ok: true },
    );
  });

  it('allows feature → stg', () => {
    assert.deepEqual(
      evaluatePromotion({
        base: 'stg',
        head: 'feature/x',
        headSha: DEV_TIP,
        headRepo: REPO,
        baseRepo: REPO,
      }),
      { ok: true },
    );
  });

  it('allows fork → stg', () => {
    assert.deepEqual(
      evaluatePromotion({
        base: 'stg',
        head: 'dev',
        headSha: DEV_TIP,
        headRepo: FORK,
        baseRepo: REPO,
      }),
      { ok: true },
    );
  });

  it('rejects main → stg back-merge PRs', () => {
    const result = evaluatePromotion({
      base: 'stg',
      head: 'main',
      headSha: STG_TIP,
      headRepo: REPO,
      baseRepo: REPO,
    });
    assert.equal(result.ok, false);
    assert.match(result.reason, /back-merges/i);
  });

  it('allows same-repo tip of stg → main', () => {
    assert.deepEqual(
      evaluatePromotion({
        base: 'main',
        head: 'stg',
        headSha: STG_TIP,
        headRepo: REPO,
        baseRepo: REPO,
        tipSha: STG_TIP,
      }),
      { ok: true },
    );
  });

  it('rejects fork → main', () => {
    const result = evaluatePromotion({
      base: 'main',
      head: 'stg',
      headSha: STG_TIP,
      headRepo: FORK,
      baseRepo: REPO,
      tipSha: STG_TIP,
    });
    assert.equal(result.ok, false);
    assert.match(result.reason, /fork/i);
  });

  it('rejects wrong head into main', () => {
    const result = evaluatePromotion({
      base: 'main',
      head: 'dev',
      headSha: DEV_TIP,
      headRepo: REPO,
      baseRepo: REPO,
      tipSha: DEV_TIP,
    });
    assert.equal(result.ok, false);
    assert.match(result.reason, /must come from stg/i);
  });

  it('does not let [skip-ci] open a main → stg back-merge PR', () => {
    const result = evaluatePromotion({
      base: 'stg',
      head: 'main',
      headSha: STG_TIP,
      headRepo: REPO,
      baseRepo: REPO,
      title: '[skip-ci] reverse',
    });
    assert.equal(result.ok, false);
    assert.match(result.reason, /back-merges/i);
  });

  it('rejects unexpected base', () => {
    const result = evaluatePromotion({
      base: 'prod',
      head: 'main',
      headSha: STG_TIP,
      headRepo: REPO,
      baseRepo: REPO,
    });
    assert.equal(result.ok, false);
    assert.match(result.reason, /Unexpected base/i);
  });
});
