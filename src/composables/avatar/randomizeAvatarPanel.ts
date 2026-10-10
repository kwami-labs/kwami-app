import { useAvatarStore } from '@/stores/avatar';
import { useBlobXyzStore } from '@/stores/avatar.blob-xyz';
import { useBlackHoleStore } from '@/stores/avatar.black-hole';
import { useParticlesFaceStore } from '@/stores/avatar.particles-face';
import { useEyeIrisStore } from '@/stores/avatar.eye-iris';
import { useJarvisStore } from '@/stores/avatar.jarvis';

export interface RandomizeAvatarPanelDeps {
  applyBlob: () => void;
  applyBlackHole: () => void;
  applyParticles: () => void;
  applyEyeIris: () => void;
  applyJarvis?: () => void;
}

const NO_DEPS: RandomizeAvatarPanelDeps = {
  applyBlob: () => {},
  applyBlackHole: () => {},
  applyParticles: () => {},
  applyEyeIris: () => {},
};

/**
 * Randomizes all avatar panel parameters for the active renderer, applies to Kwami, and persists.
 *
 * `deps` is optional. App.vue registers the always-on store-to-renderer
 * watchers (see `composables/avatar/sync/*`), so a store mutation reaches the
 * renderer whether or not the avatar panel is mounted; the callbacks are an
 * immediate push for the panel, which owns them. Callers outside a component
 * -- the agent's `randomize_appearance` tool -- have no such callbacks to
 * pass and do not need them.
 */
export function randomizeAvatarPanel(deps: RandomizeAvatarPanelDeps = NO_DEPS): void {
  const avatarStore = useAvatarStore();
  const blobStore = useBlobXyzStore();
  const blackHoleStore = useBlackHoleStore();
  const particlesFaceStore = useParticlesFaceStore();
  const eyeIrisStore = useEyeIrisStore();
  const jarvisStore = useJarvisStore();

  switch (avatarStore.rendererType) {
    case 'blob-xyz':
      blobStore.randomizeAll();
      deps.applyBlob();
      break;
    case 'black-hole':
      blackHoleStore.randomizeAll();
      deps.applyBlackHole();
      break;
    case 'particles-face':
      particlesFaceStore.randomizeAll();
      deps.applyParticles();
      break;
    case 'eye-iris':
      eyeIrisStore.randomizeAll();
      deps.applyEyeIris();
      break;
    case 'jarvis':
      jarvisStore.randomizeAll();
      deps.applyJarvis?.();
      break;
    default:
      break;
  }

  avatarStore.saveSettings();
}
