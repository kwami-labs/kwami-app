/**
 * The browser panel's layout state.
 *
 * The panel is a window over a live cloud browser, so two failure modes are
 * user-visible and unrecoverable rather than cosmetic:
 *
 * 1. **A floating panel dragged or restored off-screen has no header to grab
 *    and no close button to click.** The only way back is clearing site data.
 *    Every mutation therefore clamps into the viewport.
 * 2. **Layout is a preference, not session state.** Ending a browsing session
 *    must not silently move the panel back to the corner the user dragged it
 *    away from.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import {
  clampRect,
  MIN_PANEL_HEIGHT,
  MIN_PANEL_WIDTH,
  useNavigationStore,
} from '@/stores/navigation';

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, writable: true, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: height, writable: true, configurable: true });
}

beforeEach(() => {
  localStorage.clear();
  setViewport(1280, 800);
  setActivePinia(createPinia());
});

describe('clampRect', () => {
  it('keeps a panel dragged past the right edge fully on screen', () => {
    const rect = clampRect({ x: 5000, y: 20, width: 600, height: 400 });
    expect(rect.x).toBe(1280 - 600);
    expect(rect.y).toBe(20);
  });

  it('keeps a panel dragged past the top-left corner reachable', () => {
    const rect = clampRect({ x: -900, y: -400, width: 600, height: 400 });
    expect(rect.x).toBe(0);
    expect(rect.y).toBe(0);
  });

  it('refuses a panel too small to show its own controls', () => {
    const rect = clampRect({ x: 0, y: 0, width: 10, height: 10 });
    expect(rect.width).toBe(MIN_PANEL_WIDTH);
    expect(rect.height).toBe(MIN_PANEL_HEIGHT);
  });

  it('shrinks a panel larger than the viewport rather than overflowing it', () => {
    setViewport(800, 600);
    const rect = clampRect({ x: 0, y: 0, width: 4000, height: 3000 });
    expect(rect.width).toBe(800);
    expect(rect.height).toBe(600);
  });

  it('never returns a rect that starts off-screen after shrinking', () => {
    setViewport(500, 400);
    const rect = clampRect({ x: 900, y: 900, width: 4000, height: 3000 });
    expect(rect.x).toBe(0);
    expect(rect.y).toBe(0);
  });
});

describe('layout', () => {
  it('starts docked so the split-pane behaviour is unchanged by default', () => {
    const store = useNavigationStore();
    expect(store.layout).toBe('docked');
    expect(store.isDocked).toBe(true);
  });

  it('ignores a layout it does not have', () => {
    const store = useNavigationStore();
    store.setLayout('picture-in-picture' as never);
    expect(store.layout).toBe('docked');
  });

  it('clamps the saved rect on the way into floating', () => {
    const store = useNavigationStore();
    store.floatingRect = { x: 9000, y: 9000, width: 600, height: 400 };
    store.setLayout('floating');
    expect(store.floatingRect.x).toBeLessThanOrEqual(1280 - 600);
    expect(store.floatingRect.y).toBeLessThanOrEqual(800 - 400);
  });

  it('toggles fullscreen back to where it came from', () => {
    const store = useNavigationStore();
    store.setLayout('floating');
    store.toggleFullscreen();
    expect(store.isFullscreen).toBe(true);
    store.toggleFullscreen();
    expect(store.layout).toBe('floating');
  });

  it('centres the panel in the viewport', () => {
    const store = useNavigationStore();
    store.setLayout('floating');
    store.resizeTo(600, 400);
    store.centerPanel();
    expect(store.floatingRect.x).toBe((1280 - 600) / 2);
    expect(store.floatingRect.y).toBe((800 - 400) / 2);
  });
});

describe('viewport changes', () => {
  it('pulls a now-off-screen panel back after the window shrinks', () => {
    const store = useNavigationStore();
    store.setLayout('floating');
    store.setRect({ x: 1000, y: 600, width: 400, height: 300 });

    setViewport(600, 500);
    store.syncToViewport();

    expect(store.floatingRect.x + store.floatingRect.width).toBeLessThanOrEqual(600);
    expect(store.floatingRect.y + store.floatingRect.height).toBeLessThanOrEqual(500);
  });
});

describe('persistence', () => {
  it('remembers the layout across a reload', () => {
    const store = useNavigationStore();
    store.setLayout('floating');
    store.setRect({ x: 40, y: 60, width: 500, height: 400 });

    setActivePinia(createPinia());
    const reloaded = useNavigationStore();

    expect(reloaded.layout).toBe('floating');
    expect(reloaded.floatingRect).toMatchObject({ x: 40, y: 60, width: 500, height: 400 });
  });

  it('falls back to docked when stored state is corrupt', () => {
    localStorage.setItem('kwami-browser-panel-layout', '{not json');
    setActivePinia(createPinia());
    expect(useNavigationStore().layout).toBe('docked');
  });

  it('works when storage throws, as it does in private mode', () => {
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

    const store = useNavigationStore();
    expect(() => store.setLayout('floating')).not.toThrow();
    expect(store.layout).toBe('floating');

    setItem.mockRestore();
  });
});

describe('session lifecycle', () => {
  it('records whether the browser carries the user\'s saved logins', () => {
    const store = useNavigationStore();
    store.updateState({ url: 'https://example.com', vendor: 'browserbase', persistent: false });
    expect(store.vendor).toBe('browserbase');
    expect(store.isPersistent).toBe(false);
  });

  it('keeps the layout when a browsing session ends', () => {
    const store = useNavigationStore();
    store.setLayout('floating');
    store.setRect({ x: 40, y: 60, width: 500, height: 400 });

    store.updateState({ url: 'https://example.com' });
    store.end();

    expect(store.isActive).toBe(false);
    expect(store.currentUrl).toBe('');
    expect(store.layout).toBe('floating');
    expect(store.floatingRect).toMatchObject({ x: 40, y: 60 });
  });

  it('clears the persistence warning when a session ends', () => {
    const store = useNavigationStore();
    store.updateState({ url: 'https://example.com', persistent: false });
    store.end();
    expect(store.isPersistent).toBe(true);
  });
});

/**
 * The agent is told to expand the panel before reading a dense page and put it
 * back afterwards. If "put it back" always meant "dock", every page the agent
 * read would quietly undo a user who had the panel floating — and the panel
 * would creep back to the dock over and over with no one having asked for it.
 *
 * The memory of what to return to therefore lives in the store, shared by the
 * expand button and the agent's tool, because the agent cannot know the value.
 */
describe('the expand/collapse round trip', () => {
  it.each(['docked', 'floating'] as const)(
    'returns a %s panel to exactly where it was',
    (start) => {
      const store = useNavigationStore();
      store.setLayout(start);

      store.expandFullscreen();
      expect(store.layout).toBe('fullscreen');

      store.collapseFullscreen();
      expect(store.layout).toBe(start);
    },
  );

  it('keeps the floating geometry across the round trip', () => {
    const store = useNavigationStore();
    store.setLayout('floating');
    store.setRect({ x: 40, y: 60, width: 500, height: 400 });

    store.expandFullscreen();
    store.collapseFullscreen();

    expect(store.layout).toBe('floating');
    expect(store.floatingRect).toMatchObject({ x: 40, y: 60, width: 500, height: 400 });
  });

  it('survives repeated expand/collapse without drifting toward docked', () => {
    const store = useNavigationStore();
    store.setLayout('floating');

    for (let i = 0; i < 5; i += 1) {
      store.expandFullscreen();
      store.collapseFullscreen();
    }

    expect(store.layout).toBe('floating');
  });

  it('does nothing when asked to collapse a panel that is not fullscreen', () => {
    const store = useNavigationStore();
    store.setLayout('floating');
    store.collapseFullscreen();
    expect(store.layout).toBe('floating');
  });

  it('cannot get stuck returning fullscreen to itself', () => {
    const store = useNavigationStore();
    store.setLayout('fullscreen');
    // Entering fullscreen twice must not record 'fullscreen' as the way back.
    store.expandFullscreen();
    store.collapseFullscreen();
    expect(store.layout).not.toBe('fullscreen');
  });

  it('remembers the return layout across a reload', () => {
    const store = useNavigationStore();
    store.setLayout('floating');
    store.expandFullscreen();

    setActivePinia(createPinia());
    const reloaded = useNavigationStore();
    reloaded.collapseFullscreen();

    expect(reloaded.layout).toBe('floating');
  });
});
