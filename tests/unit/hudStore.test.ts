/**
 * Jarvis's HUD: windows that come forward instead of opening twice, a screen that
 * folds Jarvis's own windows away before it fills, documents that are kept, and what
 * the agent reports as it works landing where the user can see it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { useHudStore } from '@/stores/hud';
import { useVoiceStore } from '@/stores/voice';
import { useHud, REPORT_CHARS } from '@/composables/useHud';
import { useHudAgentTools } from '@/composables/useHudAgentTools';
import { hudEn } from '@/i18n/hud.locale';
import type { BrainStatus } from '@/lib/brain';

const opened = vi.hoisted(() => ({ urls: [] as string[] }));

vi.mock('@/lib/hud/external', () => ({
  openExternal: vi.fn(async (url: string) => {
    opened.urls.push(url);
  }),
}));

vi.mock('@/composables/useAgentActionState', () => ({
  useAgentActionState: () => ({ recordAction: vi.fn() }),
}));

const i18n = () => createI18n({ legacy: false, locale: 'en', messages: { en: hudEn } });

beforeEach(() => {
  localStorage.clear();
  opened.urls = [];
  setActivePinia(createPinia());
});

describe('windows', () => {
  it('brings the same thing forward instead of opening it twice', () => {
    const hud = useHudStore();
    const first = hud.open({ kind: 'web', url: 'https://a.b/', title: 'A' });
    hud.minimize(first.id);
    const again = hud.open({ kind: 'web', url: 'https://a.b/', title: 'A2', start: 3 });
    expect(again.id).toBe(first.id);
    expect(again.minimized).toBe(false);
    expect(again.title).toBe('A2');
    expect(hud.widgets).toHaveLength(1);
    expect(hud.focusedId).toBe(first.id);
  });

  it('keys windows by task, document, address or nothing', () => {
    const hud = useHudStore();
    expect(hud.open({ kind: 'task', taskId: 't1', title: 'T' }).key).toBe('task:t1');
    expect(hud.open({ kind: 'document', docId: 'd1', title: 'D' }).key).toBe('doc:d1');
    const a = hud.open({ kind: 'image', title: 'x' });
    const b = hud.open({ kind: 'image', title: 'y' });
    expect(a.key).not.toBe(b.key);
  });

  it('folds the oldest of Jarvis’s windows away before the screen fills', () => {
    const hud = useHudStore();
    const pinned = hud.open({ kind: 'document', docId: 'p', title: 'pinned' });
    hud.togglePin(pinned.id);
    const mine = hud.open({ kind: 'web', url: 'https://user/', title: 'u', source: 'user' });
    for (let i = 0; i < 6; i++) hud.open({ kind: 'web', url: `https://a${i}/`, title: `${i}` });
    expect(hud.visible.length).toBeLessThanOrEqual(6);
    expect(pinned.minimized).toBe(false);
    expect(mine.minimized).toBe(false);
    expect(hud.docked.length).toBeGreaterThan(0);
  });

  it('opens in the background when asked, without taking the focus', () => {
    const hud = useHudStore();
    const front = hud.open({ kind: 'document', docId: 'a', title: 'a' });
    const back = hud.open({ kind: 'task', taskId: 't', title: 't', background: true });
    expect(hud.focusedId).toBe(front.id);
    expect(back.z).toBeLessThan(front.z);
    hud.open({ kind: 'task', taskId: 't', title: 't', background: true });
    expect(hud.focusedId).toBe(front.id);
  });

  it('moves, resizes, maximises, restores and closes', () => {
    const hud = useHudStore();
    hud.setViewport({ width: 1200, height: 800 });
    hud.setViewport({ width: 0, height: 0 });
    expect(hud.viewport.width).toBe(1200);
    const w = hud.open({ kind: 'video', url: 'https://youtu.be/dQw4w9WgXcQ', title: 'v' });
    hud.setRect(w.id, { x: 5000, y: 5000, w: 400, h: 300 });
    expect(w.rect.x + w.rect.w).toBeLessThanOrEqual(1200);
    hud.toggleMaximize(w.id);
    expect(hud.rectOf(w).w).toBe(1200 - 32);
    hud.setViewport({ width: 1000, height: 700 });
    expect(hud.rectOf(w).w).toBe(1000 - 32);
    hud.minimize(w.id);
    expect(hud.focusedId).toBeNull();
    hud.restore(w.id);
    expect(w.minimized).toBe(false);
    hud.close(w.id);
    expect(hud.widgets).toHaveLength(0);
    // Unknown ids are ignored.
    for (const fn of [hud.focus, hud.minimize, hud.restore, hud.toggleMaximize, hud.togglePin])
      fn('x');
    hud.setRect('x', { x: 0, y: 0, w: 1, h: 1 });
  });

  it('closes everything but what the user pinned', () => {
    const hud = useHudStore();
    const keep = hud.open({ kind: 'document', docId: 'a', title: 'a' });
    hud.togglePin(keep.id);
    hud.open({ kind: 'document', docId: 'b', title: 'b' });
    hud.closeAll();
    expect(hud.widgets.map((w) => w.id)).toEqual([keep.id]);
  });

  it('knows when a window lies on top of another', () => {
    const hud = useHudStore();
    hud.setViewport({ width: 1600, height: 900 });
    const below = hud.open({ kind: 'web', url: 'https://a/', title: 'a' });
    const above = hud.open({ kind: 'web', url: 'https://b/', title: 'b' });
    hud.setRect(below.id, { x: 100, y: 100, w: 400, h: 300 });
    hud.setRect(above.id, { x: 200, y: 150, w: 400, h: 300 });
    expect(hud.covered(below)).toBe(true);
    expect(hud.covered(above)).toBe(false);
    hud.setRect(above.id, { x: 900, y: 150, w: 400, h: 300 });
    expect(hud.covered(below)).toBe(false);
  });

  it('knows when the sidebar panel lies over a window', () => {
    const hud = useHudStore();
    hud.setViewport({ width: 1600, height: 900 });
    const w = hud.open({ kind: 'web', url: 'https://a/', title: 'a' });
    hud.setRect(w.id, { x: 100, y: 100, w: 400, h: 300 });
    expect(hud.underCover(w)).toBe(false);
    hud.setCover({ x: 20, y: 20, w: 524, h: 800 });
    const first = hud.cover;
    hud.setCover({ x: 20, y: 20, w: 524, h: 800 });
    expect(hud.cover).toBe(first);
    expect(hud.underCover(w)).toBe(true);
    hud.setRect(w.id, { x: 700, y: 100, w: 400, h: 300 });
    expect(hud.underCover(w)).toBe(false);
    hud.setCover(null);
    expect(hud.cover).toBeNull();
  });

  it('counts menus that hide the native web views, never below zero', () => {
    const hud = useHudStore();
    hud.hideNative(true);
    hud.hideNative(true);
    hud.hideNative(false);
    expect(hud.nativeHidden).toBe(1);
    hud.hideNative(false);
    hud.hideNative(false);
    expect(hud.nativeHidden).toBe(0);
  });
});

describe('documents', () => {
  it('keeps documents across reloads, and one per task', () => {
    const hud = useHudStore();
    const doc = hud.createDocument('Informe', '# x', { taskId: 't1' });
    const again = hud.createDocument('', '# y', { taskId: 't1' });
    expect(again.id).toBe(doc.id);
    expect(again.markdown).toBe('# y');
    expect(again.title).toBe('Informe');
    const w = hud.openDocument(doc);
    hud.updateDocument(doc.id, { title: 'Nuevo', markdown: 'z' });
    expect(w.title).toBe('Nuevo');
    hud.updateDocument('missing', { title: 'x' });

    setActivePinia(createPinia());
    const reloaded = useHudStore();
    expect(reloaded.documents[0]).toMatchObject({ title: 'Nuevo', markdown: 'z' });
    expect(reloaded.documentById(undefined)).toBeUndefined();
    reloaded.deleteDocument(doc.id);
    expect(reloaded.documents).toHaveLength(0);
  });

  it('survives storage that is full or broken', () => {
    localStorage.setItem('kwami-hud-documents', '{not json');
    const hud = useHudStore();
    expect(hud.documents).toEqual([]);
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    hud.createDocument('a', 'b');
    hud.setPref('tethers', false);
    expect(hud.prefs.tethers).toBe(false);
    spy.mockRestore();
  });
});

describe('the action log', () => {
  it('follows a call from start to end', () => {
    const hud = useHudStore();
    hud.actionStarted('c1', 'navigate_to', 'https://a.b');
    hud.actionUpdated('c1', 'Abriendo');
    expect(hud.runningActions).toHaveLength(1);
    hud.actionEnded('c1', 'done');
    expect(hud.actions[0]).toMatchObject({ phase: 'done', update: 'Abriendo' });
    hud.actionStarted('c2', 'web_search', 'x');
    hud.actionEnded('c2', 'error');
    hud.actionStarted('c3', 'web_search', 'x');
    hud.actionEnded('c3', 'cancelled');
    expect(hud.actions.map((a) => a.phase)).toEqual(['cancelled', 'error', 'done']);
    hud.actionUpdated('nope', 'x');
    hud.actionEnded('nope', 'done');
    hud.clearActions();
    expect(hud.actions).toEqual([]);
  });
});

// -- what the agent reports -------------------------------------------------------------

function mountHud() {
  const Host = defineComponent({
    setup() {
      useHud();
      return () => h('div');
    },
  });
  return mount(Host, { global: { plugins: [i18n()] }, attachTo: document.body });
}

function emit(detail: Record<string, unknown>) {
  window.dispatchEvent(new CustomEvent('kwami:agent_message', { detail }));
}

function status(tasks: Partial<BrainStatus['tasks'][number]>[]): BrainStatus {
  return {
    enabled: true,
    providers: {},
    voiceProviders: {},
    voiceKeys: {},
    tavily: false,
    usableModels: [],
    spend: { month: '', usd: 0, budgetUsd: 0, byModel: {} },
    tasks: tasks as BrainStatus['tasks'],
    receivedAt: Date.now(),
  };
}

const now = new Date().toISOString();

describe('what Jarvis does, on screen', () => {
  it('opens a window for a task it starts, not for one restored from before', async () => {
    const voice = useVoiceStore();
    voice.brainStatus = status([{ id: 'old', title: 'Old', status: 'running', startedAt: now }]);
    const wrapper = mountHud();
    const hud = useHudStore();
    expect(hud.widgets).toHaveLength(0);

    voice.brainStatus = status([
      { id: 'old', title: 'Old', status: 'running', startedAt: now },
      { id: 'new', title: 'Investigar', status: 'running', startedAt: now },
      { id: 'stale', title: 'Stale', status: 'running', startedAt: '2020-01-01T00:00:00Z' },
    ]);
    await nextTick();
    expect(hud.widgets.map((w) => w.key)).toEqual([`task:new@${now}`]);

    voice.brainStatus = status([
      { id: 'new', title: 'Investigar el oro', status: 'running', startedAt: now },
    ]);
    await nextTick();
    expect(hud.widgets[0].title).toBe('Investigar el oro');
    wrapper.unmount();
  });

  it('tells apart two tasks of different calls that share an id', async () => {
    const voice = useVoiceStore();
    const wrapper = mountHud();
    const hud = useHudStore();
    const before = new Date(Date.now() - 60000).toISOString();
    voice.brainStatus = status([
      { id: 't1', title: 'Antes', status: 'running', startedAt: before },
    ]);
    await nextTick();
    emit({
      type: 'brain_result',
      id: 't1',
      startedAt: before,
      title: 'Antes',
      result: 'a'.repeat(REPORT_CHARS),
    });
    voice.brainStatus = status([{ id: 't1', title: 'Ahora', status: 'running', startedAt: now }]);
    await nextTick();
    const tasks = hud.widgets.filter((w) => w.kind === 'task');
    expect(tasks.map((w) => w.title)).toEqual(['Antes', 'Ahora']);
    expect(tasks[1].minimized).toBe(false);
    emit({
      type: 'brain_result',
      id: 't1',
      startedAt: now,
      title: 'Ahora',
      result: 'b'.repeat(REPORT_CHARS),
    });
    expect(hud.documents.map((d) => d.title)).toEqual(['Ahora', 'Antes']);
    wrapper.unmount();
  });

  it('opens a long report as a document and folds its task away', async () => {
    const wrapper = mountHud();
    const hud = useHudStore();
    const task = hud.open({ kind: 'task', taskId: 't1', title: 'T' });
    emit({
      type: 'brain_result',
      id: 't1',
      title: 'Informe',
      result: 'x'.repeat(REPORT_CHARS),
      sources: ['https://a.b', 3],
    });
    const doc = hud.documents[0];
    expect(doc.title).toBe('Informe');
    expect(doc.markdown).toContain('- https://a.b');
    expect(hud.byKey(`doc:${doc.id}`)).toBeTruthy();
    expect(task.minimized).toBe(true);
    expect(hud.taskResults.t1.result).toHaveLength(REPORT_CHARS);

    emit({ type: 'brain_result', id: 't2', result: 'corto' });
    expect(hud.documents).toHaveLength(1);
    expect(hud.taskResults.t2.result).toBe('corto');
    emit({ type: 'brain_result', id: '', result: 'x' });
    emit({ type: 'other' });
    wrapper.unmount();
  });

  it('logs each tool call as it starts, reports and ends', () => {
    const wrapper = mountHud();
    const hud = useHudStore();
    emit({ type: 'agent_action', id: 'c1', name: 'web_search', phase: 'start', detail: 'oro' });
    emit({ type: 'agent_action', id: 'c1', phase: 'update', detail: 'leyendo' });
    emit({ type: 'agent_action', id: 'c1', phase: 'end', status: 'done' });
    emit({ type: 'agent_action', phase: 'start' });
    expect(hud.actions).toHaveLength(1);
    expect(hud.actions[0]).toMatchObject({ name: 'web_search', phase: 'done', update: 'leyendo' });
    wrapper.unmount();
  });

  it('mirrors Jarvis’s browser and follows a clean-window sign-in', () => {
    vi.useFakeTimers();
    const wrapper = mountHud();
    const hud = useHudStore();
    const browser = (detail: Record<string, unknown>) =>
      window.dispatchEvent(new CustomEvent('kwami:browser_session', { detail }));
    browser({ action: 'open', url: 'https://github.com' });
    expect(hud.byKey('browser')).toBeTruthy();
    browser({ action: 'sign_in', url: 'https://github.com/login' });
    expect(hud.browserSignIn).toEqual({ state: 'open', url: 'https://github.com/login' });
    browser({ action: 'sign_in_done' });
    expect(hud.browserSignIn.state).toBe('done');
    browser({ action: 'sign_in_done' });
    vi.advanceTimersByTime(13000);
    expect(hud.browserSignIn.state).toBe('idle');
    hud.setBrowserSignIn('done');
    browser({ action: 'open' });
    expect(hud.browserSignIn.state).toBe('idle');
    browser({ action: 'close' });
    wrapper.unmount();
    vi.useRealTimers();
  });

  it('opens links on screen, and Ctrl-click outside', () => {
    const wrapper = mountHud();
    const hud = useHudStore();
    const link = (
      href: string,
      extra: Partial<MouseEventInit> = {},
      attrs: Record<string, string> = {},
    ) => {
      const a = document.createElement('a');
      a.href = href;
      a.textContent = 'Un vídeo';
      for (const [k, v] of Object.entries(attrs)) a.setAttribute(k, v);
      document.body.appendChild(a);
      a.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...extra }),
      );
      a.remove();
    };
    link('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(hud.widgets[0]).toMatchObject({ kind: 'video', title: 'Un vídeo' });
    link('https://a.b/foto.png');
    expect(hud.widgets[1].kind).toBe('image');
    link('https://a.b/page', { ctrlKey: true });
    link('https://accounts.google.com/o/oauth2/auth');
    expect(opened.urls).toEqual(['https://a.b/page', 'https://accounts.google.com/o/oauth2/auth']);
    link('https://a.b/file.zip', {}, { download: '' });
    link(`${window.location.origin}/inside`);
    link('https://a.b/x', { button: 1 });
    expect(hud.widgets).toHaveLength(2);

    hud.setPref('links', false);
    link('https://a.b/page2');
    expect(hud.widgets).toHaveLength(2);
    wrapper.unmount();
  });

  it('opens nothing by itself when the HUD is off', async () => {
    const wrapper = mountHud();
    const hud = useHudStore();
    hud.setPref('enabled', false);
    window.dispatchEvent(new CustomEvent('kwami:browser_session', { detail: { action: 'open' } }));
    emit({ type: 'brain_result', id: 't', result: 'x'.repeat(REPORT_CHARS) });
    useVoiceStore().brainStatus = status([
      { id: 'n', title: 'N', status: 'running', startedAt: now },
    ]);
    await nextTick();
    expect(hud.widgets).toHaveLength(0);
    wrapper.unmount();
  });
});

describe('show_on_screen', () => {
  type Handler = (args: Record<string, unknown>) => Promise<Record<string, unknown>>;

  function tool(): Handler {
    let handler: Handler | undefined;
    const Host = defineComponent({
      setup() {
        useHudAgentTools().registerHudTools({
          registerTool: (def: { name: string; description: string; handler: Handler }) => {
            expect(def.name).toBe('show_on_screen');
            expect(def.description).not.toContain('hud.');
            handler = def.handler;
          },
        } as never);
        return () => h('div');
      },
    });
    mount(Host, { global: { plugins: [i18n()] } });
    return handler!;
  }

  it('shows a report, a video, a page and a picture', async () => {
    const show = tool();
    const hud = useHudStore();
    const doc = await show({ kind: 'document', content: '# Resumen\n\nTexto' });
    expect(doc).toMatchObject({ success: true, kind: 'document' });
    expect(hud.documents[0].title).toBe('Resumen');
    expect(
      await show({ kind: 'video', url: 'https://youtu.be/dQw4w9WgXcQ', start: 30 }),
    ).toMatchObject({ kind: 'video' });
    expect(hud.widgets.find((w) => w.kind === 'video')?.start).toBe(30);
    expect(await show({ url: 'https://a.b/page', title: 'Página' })).toMatchObject({ kind: 'web' });
    expect(await show({ kind: 'image', url: 'https://a.b/x' })).toMatchObject({ kind: 'image' });
  });

  it('says what is missing rather than opening nothing', async () => {
    const show = tool();
    expect(await show({ kind: 'document', content: ' ' })).toMatchObject({ success: false });
    expect(await show({ kind: 'web', url: 'javascript:alert(1)' })).toMatchObject({
      success: false,
    });
    expect(await show({ kind: 'web' })).toMatchObject({ success: false });
  });

  it('lists, closes one and closes all', async () => {
    const show = tool();
    const hud = useHudStore();
    const { id } = await show({ url: 'https://a.b' });
    await show({ url: 'https://c.d' });
    const listed = await show({ action: 'list' });
    expect(listed.windows).toHaveLength(2);
    expect(await show({ action: 'close', id })).toMatchObject({ success: true });
    expect(await show({ action: 'close', id: 'nope' })).toMatchObject({ success: false });
    await show({ action: 'close_all' });
    expect(hud.widgets).toHaveLength(0);
  });

  it('respects the HUD being switched off', async () => {
    const show = tool();
    useHudStore().setPref('enabled', false);
    expect(await show({ url: 'https://a.b' })).toMatchObject({ success: false });
  });
});
