/**
 * The agent's built-in browser has no live view: the panel shows its screenshots.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { BROWSER_FRAME_TOPIC, listenForFrames } from '@/composables/useBrowserFrames';
import { useNavigationStore } from '@/stores/navigation';

beforeEach(() => {
  setActivePinia(createPinia());
  URL.createObjectURL = vi.fn(() => 'blob:frame');
  URL.revokeObjectURL = vi.fn();
});

describe('listenForFrames', () => {
  it('registers once per room, because a room refuses a second handler', () => {
    const room = { registerByteStreamHandler: vi.fn() };

    listenForFrames(room, vi.fn());
    listenForFrames(room, vi.fn());

    expect(room.registerByteStreamHandler).toHaveBeenCalledTimes(1);
    expect(room.registerByteStreamHandler.mock.calls[0][0]).toBe(BROWSER_FRAME_TOPIC);
  });

  it('turns the bytes it receives into an image the panel can show', async () => {
    const room = { registerByteStreamHandler: vi.fn() };
    const show = vi.fn();

    listenForFrames(room, show);
    room.registerByteStreamHandler.mock.calls[0][1](
      { readAll: async () => [new Uint8Array([1, 2])] },
      {},
    );

    await vi.waitFor(() => expect(show).toHaveBeenCalledWith('blob:frame'));
  });
});

describe('the navigation store', () => {
  it('counts the built-in browser as something to show, before its first frame', () => {
    const store = useNavigationStore();
    expect(store.hasView).toBe(false);

    store.updateState({ url: 'https://example.com', vendor: 'headless', liveUrl: '' });

    expect(store.hasView).toBe(true);
  });

  it('does not show a panel for an active session with nothing to display', () => {
    const store = useNavigationStore();

    store.updateState({ url: 'https://example.com', vendor: 'local', liveUrl: '' });

    expect(store.hasView).toBe(false);
  });

  it('frees each frame once the next arrives, and the last one when browsing ends', () => {
    const store = useNavigationStore();
    store.updateState({ url: 'https://example.com', vendor: 'headless', liveUrl: '' });

    store.showFrame('blob:one');
    store.showFrame('blob:two');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:one');
    expect(store.frameUrl).toBe('blob:two');

    store.end();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:two');
    expect(store.frameUrl).toBe('');
  });

  it('drops a frame that arrives after browsing ended', () => {
    const store = useNavigationStore();

    store.showFrame('blob:late');

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:late');
    expect(store.frameUrl).toBe('');
  });
});
