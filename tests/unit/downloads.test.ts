import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';

const { invoke, listen, success, error, info, warning } = vi.hoisted(() => ({
  invoke: vi.fn(),
  listen: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}));
vi.mock('@tauri-apps/api/core', () => ({ invoke }));
vi.mock('@tauri-apps/api/event', () => ({ listen }));
vi.mock('vue-toastification', () => ({ useToast: () => ({ success, error, info, warning }) }));
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, values?: Record<string, string>) => `${key} ${JSON.stringify(values ?? {})}`,
  }),
}));

import {
  DOWNLOAD_EVENT,
  jarvisDownload,
  onSavedDownload,
  revealDownload,
  savedDownload,
} from '../../src/lib/downloads';
import { useDownloadNotices } from '../../src/composables/useDownloadNotices';

const VIDEO = 'C:/Users/u/Videos/KWAMI/a.webm';
const JARVIS_PDF = 'C:/Users/u/Documents/Jarvis/descargas/f.pdf';

function enterTauri() {
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
});

describe('what a download says', () => {
  it('reads where the desktop app saved a file', () => {
    expect(
      savedDownload({
        name: 'a.webm',
        path: VIDEO,
        folder: 'C:/Users/u/Videos/KWAMI',
        success: true,
      }),
    ).toEqual({ name: 'a.webm', path: VIDEO, folder: 'C:/Users/u/Videos/KWAMI', success: true });
    expect(savedDownload({ path: 'C:\\K\\b.png' })).toEqual({
      name: 'b.png',
      path: 'C:\\K\\b.png',
      folder: '',
      success: false,
    });
    expect(savedDownload({ path: '' })).toBeNull();
    expect(savedDownload(null)).toBeNull();
    expect(savedDownload('a')).toBeNull();
  });

  it('reads what Jarvis downloaded, and nothing else', () => {
    expect(
      jarvisDownload({
        type: 'browser_download',
        state: 'completed',
        name: 'f.pdf',
        path: JARVIS_PDF,
        size: 3,
      }),
    ).toEqual({
      type: 'browser_download',
      state: 'completed',
      name: 'f.pdf',
      path: JARVIS_PDF,
      size: 3,
    });
    expect(jarvisDownload({ type: 'browser_download', name: 'b.zip' })).toEqual({
      type: 'browser_download',
      state: '',
      name: 'b.zip',
      path: '',
      size: undefined,
    });
    expect(jarvisDownload({ type: 'brain_status', name: 'x' })).toBeNull();
    expect(jarvisDownload({ type: 'browser_download', name: '' })).toBeNull();
    expect(jarvisDownload(undefined)).toBeNull();
  });
});

describe('the way to the folder', () => {
  it('exists only in the desktop app', async () => {
    expect(await revealDownload(VIDEO)).toBe(false);
    enterTauri();
    expect(await revealDownload('')).toBe(false);
    invoke.mockResolvedValueOnce(undefined);
    expect(await revealDownload(VIDEO)).toBe(true);
    expect(invoke).toHaveBeenCalledWith('reveal_download', { path: VIDEO });
    invoke.mockRejectedValueOnce(new Error('not a file the app downloaded'));
    expect(await revealDownload('C:/Windows/win.ini')).toBe(false);
  });

  it('hears the desktop app finish each download', async () => {
    const stop = await onSavedDownload(() => {});
    stop();
    expect(listen).not.toHaveBeenCalled();

    enterTauri();
    const unlisten = vi.fn();
    listen.mockResolvedValueOnce(unlisten);
    const heard: unknown[] = [];
    expect(await onSavedDownload((d) => heard.push(d))).toBe(unlisten);
    const [event, handler] = listen.mock.calls[0]!;
    expect(event).toBe(DOWNLOAD_EVENT);
    handler({ payload: { path: VIDEO, success: true } });
    handler({ payload: {} });
    expect(heard).toHaveLength(1);
  });
});

describe('useDownloadNotices', () => {
  const Host = defineComponent({
    setup() {
      return { notices: useDownloadNotices() };
    },
    render: () => h('div'),
  });

  function jarvis(detail: Record<string, unknown>) {
    window.dispatchEvent(new CustomEvent('kwami:agent_message', { detail }));
  }

  it('says where each download went, and in the app a click opens its folder', async () => {
    enterTauri();
    const unlisten = vi.fn();
    listen.mockResolvedValueOnce(unlisten);
    invoke.mockResolvedValue(undefined);
    const wrapper = mount(Host);
    await vi.waitFor(() => expect(listen).toHaveBeenCalled());
    const handler = listen.mock.calls[0]![1];

    handler({
      payload: { name: 'a.webm', path: VIDEO, folder: 'C:/Users/u/Videos/KWAMI', success: true },
    });
    expect(success.mock.calls[0]![0]).toContain('hud.downloads.savedOpen');
    success.mock.calls[0]![1].onClick();
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledWith('reveal_download', { path: VIDEO }));

    handler({ payload: { name: 'b.zip', path: 'C:/D/b.zip', success: false } });
    expect(error.mock.calls[0]![0]).toContain('hud.downloads.failed');

    jarvis({ type: 'browser_download', state: 'completed', name: 'f.pdf', path: JARVIS_PDF });
    expect(info.mock.calls[0]![0]).toContain('hud.downloads.jarvisOpen');
    expect(info.mock.calls[0]![1]).toHaveProperty('onClick');
    jarvis({ type: 'browser_download', state: 'canceled', name: 'g.pdf', path: '' });
    expect(warning.mock.calls[0]![0]).toContain('hud.downloads.jarvisFailed');
    jarvis({ type: 'brain_status' });
    expect(info).toHaveBeenCalledTimes(1);

    wrapper.unmount();
    expect(unlisten).toHaveBeenCalled();
    jarvis({ type: 'browser_download', state: 'completed', name: 'h.pdf', path: '' });
    expect(info).toHaveBeenCalledTimes(1);
  });

  it('in a browser says only where Jarvis put a file, with nothing to click', () => {
    const wrapper = mount(Host);
    jarvis({ type: 'browser_download', state: 'completed', name: 'f.pdf', path: JARVIS_PDF });
    expect(info.mock.calls[0]![0]).toContain('hud.downloads.jarvis ');
    expect(info.mock.calls[0]![1]).toEqual({});
    wrapper.vm.notices.onSaved({ name: 'x', path: '', folder: 'F', success: true });
    expect(success.mock.calls[0]![0]).toContain('hud.downloads.saved ');
    expect(success.mock.calls[0]![1]).toEqual({});
    wrapper.unmount();
  });

  it('stops listening even when unmounted before Tauri answers', async () => {
    enterTauri();
    const unlisten = vi.fn();
    let answer: (stop: () => void) => void = () => {};
    listen.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
    const wrapper = mount(Host);
    wrapper.unmount();
    await vi.waitFor(() => expect(listen).toHaveBeenCalled());
    answer(unlisten);
    await vi.waitFor(() => expect(unlisten).toHaveBeenCalled());
  });
});
