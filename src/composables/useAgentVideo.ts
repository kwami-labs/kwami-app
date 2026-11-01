import { ref, watch } from 'vue';
import { useKwami } from '@/composables/useKwami';

/**
 * The camera and a shared screen, published to the agent's room.
 *
 * The Models panel has long offered "Realtime multimodal: audio + video", but
 * nothing ever published video, and the agent did not read it either. The
 * agent now takes video input (2026-10-20) and passes it to a realtime model
 * that can see -- Gemini Live, OpenAI Realtime; a standard pipeline ignores
 * it. This is the app half: two toggles on the room's local participant.
 *
 * The SDK keeps its LiveKit room private, so it is reached through the
 * pipeline at runtime and typed by the little this needs.
 */
interface VideoParticipant {
  setCameraEnabled(enabled: boolean): Promise<unknown>;
  setScreenShareEnabled(enabled: boolean): Promise<unknown>;
  isCameraEnabled?: boolean;
  isScreenShareEnabled?: boolean;
}

export function useAgentVideo() {
  const { kwami, isConnected } = useKwami();
  const camera = ref(false);
  const screen = ref(false);
  const busy = ref(false);
  const error = ref('');

  const canShareScreen =
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getDisplayMedia === 'function';

  function participant(): VideoParticipant | null {
    const pipeline = kwami.value?.agent.getPipeline() as {
      room?: { localParticipant?: VideoParticipant } | null;
    } | null;
    const local = pipeline?.room?.localParticipant;
    return local && typeof local.setCameraEnabled === 'function' ? local : null;
  }

  async function toggle(kind: 'camera' | 'screen') {
    const local = participant();
    if (!local || busy.value) return;
    const state = kind === 'camera' ? camera : screen;
    busy.value = true;
    error.value = '';
    try {
      const next = !state.value;
      if (kind === 'camera') await local.setCameraEnabled(next);
      else await local.setScreenShareEnabled(next);
      state.value = next;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      busy.value = false;
    }
  }

  /** Stop both, e.g. when the engine in use can no longer see. */
  async function stopAll() {
    if (camera.value) await toggle('camera');
    if (screen.value) await toggle('screen');
  }

  // A dropped connection takes the tracks with it.
  watch(isConnected, (connected) => {
    if (!connected) {
      camera.value = false;
      screen.value = false;
    }
  });

  return {
    camera,
    screen,
    busy,
    error,
    canShareScreen,
    toggleCamera: () => toggle('camera'),
    toggleScreen: () => toggle('screen'),
    stopAll,
  };
}
