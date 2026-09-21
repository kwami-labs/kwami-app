/**
 * The workspace record crate.
 *
 * `MusicPlayer` lives in the audio panel, which `App.vue` mounts behind a
 * `v-if`. When the crate belonged to that component, closing the panel took the
 * controller with it: the track kept playing with nothing to advance it, and
 * reopening the panel showed an empty deck. It is module state now, so these
 * tests hold the two properties anything outside the panel depends on — one
 * shared instance, and a life longer than the panel's.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';
import { mount } from '@vue/test-utils';

function createAudioStub() {
  const element = document.createElement('audio');
  let volume = 1;
  return {
    element,
    getAudioElement: () => element,
    getVolume: () => volume,
    setVolume: vi.fn((next: number) => {
      volume = next;
    }),
    getCurrentTime: () => 0,
    getDuration: () => 0,
    isPlaying: () => false,
    setCurrentTime: vi.fn(),
    loadAudioSource: vi.fn(),
    play: vi.fn(() => {
      element.dispatchEvent(new Event('play'));
      return Promise.resolve();
    }),
    pause: vi.fn(() => {
      element.dispatchEvent(new Event('pause'));
    }),
  };
}

let audio = createAudioStub();
const kwami = ref<unknown>(null);

vi.mock('@/composables/useKwami', () => ({
  useKwami: () => ({ kwami, rendererType: ref('blob-xyz'), isConnected: ref(false) }),
}));

// A fresh module per test: the crate is a module-level singleton on purpose,
// and it would otherwise carry a record over from the test before.
async function loadCrate() {
  return import('@/composables/useSoundtrack');
}

beforeEach(async () => {
  vi.resetModules();
  audio = createAudioStub();
  kwami.value = {
    avatar: { getAudio: () => audio },
    // `MusicPlayer` puts the avatar in its speaking state while music runs.
    getState: () => 'idle',
    setState: vi.fn(),
  };
});

describe('the workspace crate', () => {
  it('hands every caller the same deck', async () => {
    const { useWorkspaceSoundtrack } = await loadCrate();

    const first = useWorkspaceSoundtrack();
    const second = useWorkspaceSoundtrack();

    expect(second.soundtrack).toBe(first.soundtrack);
    expect(second.level).toBe(first.level);
  });

  it('takes a volume change to the audio object with no player mounted', async () => {
    const { useWorkspaceSoundtrack } = await loadCrate();
    const { level } = useWorkspaceSoundtrack();

    level.value = 0.25;
    await nextTick();

    expect(audio.setVolume).toHaveBeenCalledWith(0.25);
  });

  it('keeps the record on when the audio panel closes', async () => {
    const { useWorkspaceSoundtrack } = await loadCrate();
    const MusicPlayer = (await import('@/components/controls/MusicPlayer.vue')).default;
    const { soundtrack } = useWorkspaceSoundtrack();

    const player = mount(MusicPlayer);
    soundtrack.toggle();
    const playing = soundtrack.currentTrack.value;
    expect(playing).not.toBeNull();

    player.unmount();

    // Still on the deck, and still advancing: the crate outlived the panel.
    expect(soundtrack.currentTrack.value).toBe(playing);
    audio.element.dispatchEvent(new Event('ended'));
    expect(soundtrack.currentTrack.value?.id).not.toBe(playing?.id);
  });
});
