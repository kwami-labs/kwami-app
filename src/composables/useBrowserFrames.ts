import { onScopeDispose, watch } from 'vue';
import { useKwami } from '@/composables/useKwami';
import { useNavigationStore } from '@/stores/navigation';

/**
 * Screenshots from the agent's built-in browser, which has no live view to embed.
 *
 * The agent falls back to a Chromium of its own when no browser vendor can provide
 * one, and sends a JPEG each time the page changes. The SDK keeps its LiveKit room
 * private, so it is reached through the pipeline at runtime and typed by the little
 * this needs (same as `useAgentVideo`).
 */
export const BROWSER_FRAME_TOPIC = 'browser_frame';

interface FrameReader {
  readAll(): Promise<Uint8Array[]>;
}

interface FrameRoom {
  registerByteStreamHandler(
    topic: string,
    handler: (reader: FrameReader, participant: unknown) => void,
  ): void;
}

/** A room refuses a second handler on the same topic, and reconnecting keeps the room. */
const handled = new WeakSet<FrameRoom>();

export function listenForFrames(room: FrameRoom, show: (url: string) => void) {
  if (handled.has(room)) return;
  handled.add(room);
  room.registerByteStreamHandler(BROWSER_FRAME_TOPIC, (reader) => {
    reader
      .readAll()
      .then((chunks) =>
        show(URL.createObjectURL(new Blob(chunks as BlobPart[], { type: 'image/jpeg' }))),
      )
      .catch((e) => console.warn('[Kwami] Lost a browser frame', e));
  });
}

export function useBrowserFrames() {
  const { kwami, isConnected } = useKwami();
  const store = useNavigationStore();

  function attach() {
    const pipeline = kwami.value?.agent.getPipeline() as { room?: FrameRoom | null } | null;
    if (pipeline?.room?.registerByteStreamHandler) {
      listenForFrames(pipeline.room, store.showFrame);
    }
  }

  // `isConnected` turns true as soon as the session starts initialising, before the
  // SDK has made the call's new room, so on its own it registered on the last call's
  // room and no frame ever showed (seen 2026-11-16). `kwami:connected` comes once
  // the room is the one in use; the WeakSet keeps either from registering twice.
  watch(isConnected, (connected) => connected && attach(), { immediate: true });
  window.addEventListener('kwami:connected', attach);
  onScopeDispose(() => window.removeEventListener('kwami:connected', attach));
}
