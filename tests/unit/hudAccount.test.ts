/**
 * The HUD follows the user: what they leave on one device (screens, windows,
 * documents, settings) is what they find on the next, and a device never used does
 * not wipe out, in the account, what another one has.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, nextTick, reactive } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { isBlankHudState, useHudStore, type HudAccountState } from '@/stores/hud';

const db = vi.hoisted(() => ({
  ui: null as Record<string, unknown> | null,
  saves: [] as Record<string, unknown>[],
}));

vi.mock('@/lib/userAppSettings', () => ({
  loadUserLocaleFromDb: vi.fn(async () => {}),
  loadUserUiFromDb: vi.fn(async () => db.ui),
  saveUserUiToDb: vi.fn(async (_userId: string, ui: Record<string, unknown>) => {
    db.saves.push(ui);
  }),
}));

const auth = vi.hoisted(() => ({
  state: null as { isAuthenticated: boolean; userId: string | null } | null,
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => auth.state,
}));

const { useUiLayoutSync } = await import('@/composables/useUiLayoutSync');

function mountSync() {
  return mount(
    defineComponent({
      setup() {
        useUiLayoutSync();
        return () => null;
      },
    }),
  );
}

async function settle() {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
    await nextTick();
  }
}

/** A HUD with one named screen and a document open on it, as another device left it. */
function otherDevice(): HudAccountState {
  setActivePinia(createPinia());
  localStorage.clear();
  const hud = useHudStore();
  hud.setViewport({ width: 1600, height: 900 });
  const screen = hud.addScreen('Research');
  const doc = hud.createDocument('Notes', '# Kept');
  hud.openDocument(doc);
  hud.setPref('glass', 0.6);
  expect(hud.activeScreen).toBe(screen?.id);
  const state = hud.accountState();
  localStorage.clear();
  setActivePinia(createPinia());
  return state;
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  db.ui = null;
  db.saves = [];
  auth.state = reactive({ isAuthenticated: true, userId: 'user-1' });
  setActivePinia(createPinia());
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the HUD in the account', () => {
  it('keeps what is worth keeping, and nothing of a call in progress', () => {
    const hud = useHudStore();
    hud.setViewport({ width: 1600, height: 900 });
    hud.open({ kind: 'web', url: 'https://a.b/', title: 'A' });
    hud.open({ kind: 'browser', title: 'Browser' });
    const state = hud.accountState();
    expect(state.windows.map((w) => w.kind)).toEqual(['web']);
    expect(isBlankHudState(state)).toBe(false);
  });

  it('calls a HUD nobody touched blank', () => {
    const hud = useHudStore();
    expect(isBlankHudState(hud.accountState())).toBe(true);
  });

  it('takes another device HUD over this one, keeping the windows of a call', () => {
    const state = otherDevice();
    const hud = useHudStore();
    hud.setViewport({ width: 1000, height: 700 });
    hud.open({ kind: 'browser', title: 'Browser' });
    hud.open({ kind: 'web', url: 'https://only.here/', title: 'Here' });

    expect(hud.adoptAccountState(state)).toBe(true);

    expect(hud.screens.map((s) => s.name)).toEqual(['', 'Research']);
    expect(hud.activeScreen).toBe(state.active);
    expect(hud.documents.map((d) => d.title)).toEqual(['Notes']);
    expect(hud.widgets.map((w) => w.kind).sort()).toEqual(['browser', 'document']);
    expect(hud.prefs.glass).toBe(0.6);
    // Fitted to this, smaller, screen.
    for (const w of hud.widgets) expect(w.rect.x + w.rect.w).toBeLessThanOrEqual(1000);
    // And kept on this device too.
    expect(localStorage.getItem('kwami-hud-documents')).toContain('# Kept');
  });

  it('drops what is malformed rather than trusting it', () => {
    const hud = useHudStore();
    expect(hud.adoptAccountState('nope')).toBe(false);
    expect(
      hud.adoptAccountState({
        screens: [{ id: 7 }],
        windows: [{ id: 'x', key: 'k', kind: 'task', screen: 'main', rect: { x: 0 } }],
        documents: [{ id: 'd' }],
        prefs: { glass: 'solid', tasks: false },
        learned: { video: { x: 'a' } },
      }),
    ).toBe(true);
    expect(hud.screens.map((s) => s.id)).toEqual(['main']);
    expect(hud.widgets).toHaveLength(0);
    expect(hud.documents).toHaveLength(0);
    expect(hud.prefs.glass).toBe(0.82);
    expect(hud.prefs.tasks).toBe(false);
    expect(hud.learned).toEqual({});
  });
});

describe('signing in', () => {
  it('finds the HUD as it was left on another device', async () => {
    const state = otherDevice();
    db.ui = { hud: state };
    mountSync();
    await settle();
    const hud = useHudStore();
    expect(hud.documents.map((d) => d.title)).toEqual(['Notes']);
    expect(hud.screens).toHaveLength(2);
  });

  it('does not wipe this device out with an account HUD nobody touched', async () => {
    const hud = useHudStore();
    hud.createDocument('Mine', 'text');
    db.ui = {
      hud: {
        v: 1,
        screens: [],
        active: 'main',
        windows: [],
        documents: [],
        prefs: {},
        learned: {},
      },
    };
    mountSync();
    await settle();
    expect(hud.documents.map((d) => d.title)).toEqual(['Mine']);
    // And this device's becomes the account's, straight away.
    expect(db.saves).toHaveLength(1);
    expect((db.saves[0].hud as HudAccountState).documents[0].title).toBe('Mine');
  });

  it('writes nothing for a device never used, signing in to an empty account', async () => {
    mountSync();
    await settle();
    vi.advanceTimersByTime(2000);
    expect(db.saves).toHaveLength(0);
  });

  it('saves a change once it settles, with the panel layout beside it', async () => {
    db.ui = {};
    mountSync();
    await settle();
    const hud = useHudStore();
    hud.addScreen('Work');
    hud.renameScreen(hud.activeScreen, 'Work 2');
    await nextTick();
    expect(db.saves).toHaveLength(0);
    vi.advanceTimersByTime(1000);
    expect(db.saves).toHaveLength(1);
    const saved = db.saves[0];
    expect((saved.hud as HudAccountState).screens.map((s) => s.name)).toContain('Work 2');
    expect(saved).toHaveProperty('panelWidth');
  });

  it('saves nothing before the account has been read', async () => {
    db.ui = {};
    auth.state = reactive({ isAuthenticated: false, userId: null });
    mountSync();
    await settle();
    useHudStore().addScreen('Early');
    vi.advanceTimersByTime(2000);
    expect(db.saves).toHaveLength(0);
  });
});
