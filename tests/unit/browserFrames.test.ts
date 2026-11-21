/**
 * The agent's built-in browser has no live view: the panel shows its screenshots.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, shallowRef, ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import {
  BROWSER_FRAME_TOPIC,
  listenForFrames,
  useBrowserFrames,
} from '@/composables/useBrowserFrames';

const live = vi.hoisted(() => ({ kwami: null as unknown, connected: null as unknown }));

vi.mock('@/composables/useKwami', () => ({
  useKwami: () => ({ kwami: live.kwami, isConnected: live.connected }),
}));
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

describe('useBrowserFrames', () => {
  it('registers on the room the call ends up using, not the one before it', () => {
    const oldRoom = { registerByteStreamHandler: vi.fn() };
    const newRoom = { registerByteStreamHandler: vi.fn() };
    const pipeline = { room: oldRoom as typeof oldRoom | null };
    live.kwami = shallowRef({ agent: { getPipeline: () => pipeline } });
    live.connected = ref(false);
    const scope = effectScope();
    scope.run(() => useBrowserFrames());

    // The session reports itself connected while the SDK still holds the old room...
    (live.connected as { value: boolean }).value = true;
    return Promise.resolve().then(() => {
      // ...then makes the new one and says so.
      pipeline.room = newRoom;
      window.dispatchEvent(new CustomEvent('kwami:connected'));
      expect(newRoom.registerByteStreamHandler).toHaveBeenCalledTimes(1);
      window.dispatchEvent(new CustomEvent('kwami:connected'));
      expect(newRoom.registerByteStreamHandler).toHaveBeenCalledTimes(1);

      scope.stop();
      pipeline.room = { registerByteStreamHandler: vi.fn() } as never;
      window.dispatchEvent(new CustomEvent('kwami:connected'));
      expect((pipeline.room as typeof oldRoom).registerByteStreamHandler).not.toHaveBeenCalled();
    });
  });

  it('waits when there is no room at all', () => {
    live.kwami = shallowRef(null);
    live.connected = ref(true);
    const scope = effectScope();
    expect(() => scope.run(() => useBrowserFrames())).not.toThrow();
    scope.stop();
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
