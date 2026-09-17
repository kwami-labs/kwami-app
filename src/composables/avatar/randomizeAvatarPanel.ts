import { useAvatarStore } from '@/stores/avatar';
import { useBlobXyzStore } from '@/stores/avatar.blob-xyz';
import { useBlackHoleStore } from '@/stores/avatar.black-hole';
import { useParticlesFaceStore } from '@/stores/avatar.particles-face';
import { useEyeIrisStore } from '@/stores/avatar.eye-iris';

export interface RandomizeAvatarPanelDeps {
  applyBlob: () => void;
  applyBlackHole: () => void;
  applyParticles: () => void;
  applyEyeIris: () => void;
}

/**
 * Randomizes all avatar panel parameters for the active renderer, applies to Kwami, and persists.
 */
export function randomizeAvatarPanel(deps: RandomizeAvatarPanelDeps): void {
  const avatarStore = useAvatarStore();
  const blobStore = useBlobXyzStore();
  const blackHoleStore = useBlackHoleStore();
  const particlesFaceStore = useParticlesFaceStore();
  const eyeIrisStore = useEyeIrisStore();

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
    default:
      break;
  }

  avatarStore.saveSettings();
}
