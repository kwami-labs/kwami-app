import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createReloader, installStaleChunkRecovery } from '@/lib/staleVersion';

/**
 * Defends kwami.io on a phone left open across a deploy: the old build's lazy panel
 * chunks no longer exist, every panel but the one already loaded stayed blank, and
 * nothing ever moved the tab onto the new build.
 */
describe('stale version recovery', () => {
  let clock = 1_000_000;
  const now = () => clock;

  beforeEach(() => {
    sessionStorage.clear();
    clock = 1_000_000;
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('reloads straight away when no voice session is live', () => {
    const reload = vi.fn();
    const reloadWhenSafe = createReloader({ isBusy: () => false, reload, now });

    expect(reloadWhenSafe()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('waits for the voice session to end instead of hanging up on it', () => {
    const reload = vi.fn();
    const reloadWhenSafe = createReloader({ isBusy: () => true, reload, now });

    reloadWhenSafe();
    reloadWhenSafe(); // a second failure while waiting must not queue a second reload
    expect(reload).not.toHaveBeenCalled();

    window.dispatchEvent(new CustomEvent('kwami:disconnected'));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not loop when the new build is itself broken', () => {
    const reload = vi.fn();
    const reloadWhenSafe = createReloader({ isBusy: () => false, reload, now });

    reloadWhenSafe();
    // Same session (sessionStorage survives the reload), seconds later: give up.
    clock += 5_000;
    expect(createReloader({ isBusy: () => false, reload, now })()).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);

    // A later deploy, minutes on, is allowed to reload again.
    clock += 60_000;
    expect(createReloader({ isBusy: () => false, reload, now })()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('reloads when Vite reports a chunk that failed to load', () => {
    const reload = vi.fn();
    const uninstall = installStaleChunkRecovery({ isBusy: () => false, reload, now });

    window.dispatchEvent(new Event('vite:preloadError'));
    expect(reload).toHaveBeenCalledTimes(1);

    uninstall();
    clock += 120_000;
    window.dispatchEvent(new Event('vite:preloadError'));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
