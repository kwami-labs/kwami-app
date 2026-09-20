import { defineStore } from 'pinia';
import { ref, reactive, computed } from 'vue';
import {
  avatarPresets,
  getBlobXyzPresets,
  getBlackHolePresets,
  getEyeIrisPresets,
  getPresetById,
  type AvatarPreset,
} from '@/presets/avatar/avatar-presets';
import { useBlobXyzStore } from './avatar.blob-xyz';
import { useBlackHoleStore } from './avatar.black-hole';
import { useParticlesFaceStore } from './avatar.particles-face';
import { useEyeIrisStore } from './avatar.eye-iris';
import type { AvatarRendererType } from 'kwami';

// Re-export AvatarPreset for backwards compatibility
export type { AvatarPreset };

// Types
export type SkinType =
  | 'radial' | 'banded' | 'striped' | 'marble' | 'fresnel' | 'iridescent' | 'spiral' | 'plasma' | 'gradient'
  | 'matte' | 'glossy' | 'metallic' | 'subsurface'
  | 'chrome' | 'clay' | 'jade' | 'toon-matcap' | 'hologram'
  | 'flat' | 'stepped' | 'halftone' | 'outlined';
export type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking';
export type RendererType = AvatarRendererType;

// Interaction Types
export type InteractionAction =
  | 'none'
  | 'toggleListening'
  | 'startListening'
  | 'stopListening'
  | 'randomize'
  | 'switchRenderer'
  | 'cycleState'
  | 'pulse'
  | 'moveToClick';

export interface InteractionConfig {
  click: {
    action: InteractionAction;
    enabled: boolean;
  };
  doubleClick: {
    action: InteractionAction;
    enabled: boolean;
  };
  rightClick: {
    action: InteractionAction;
    enabled: boolean;
  };
  doubleRightClick: {
    action: InteractionAction;
    enabled: boolean;
  };
  drag: {
    enabled: boolean;
    sensitivity: number;
    rotateOnDrag: boolean;
  };
  hover: {
    enabled: boolean;
    highlightOnHover: boolean;
    cursorStyle: string;
  };
}

const defaultInteractionConfig: InteractionConfig = {
  click: { action: 'pulse', enabled: true },
  doubleClick: { action: 'toggleListening', enabled: true },
  rightClick: { action: 'randomize', enabled: true },
  doubleRightClick: { action: 'switchRenderer', enabled: true },
  drag: { enabled: true, sensitivity: 1.0, rotateOnDrag: true },
  hover: { enabled: true, highlightOnHover: false, cursorStyle: 'pointer' },
};

export interface SceneConfig {
  camera: {
    fov: number;
    distance: number;
  };
  lighting: {
    top: number;
    bottom: number;
    ambient: number;
  };
}

const defaultSceneConfig: SceneConfig = {
  camera: { fov: 100, distance: 6 },
  lighting: { top: 0.7, bottom: 0.4, ambient: 1.0 },
};

export interface BlobState {
  colors: { x: string; y: string; z: string };
  spikes: { x: number; y: number; z: number };
  amplitude: { x: number; y: number; z: number };
  time: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  /** Starting rotation position in degrees (0-360) */
  startRotation: { x: number; y: number; z: number };
  scale: number;
  opacity: number;
  shininess: number;
  lightIntensity: number;
  wireframe: boolean;
  /** Enable glass effect (stencil-based transparency) */
  glassMode: boolean;
  skin: SkinType;
  resolution: number;
  touchStrength: number;
  touchDuration: number;
  maxTouchPoints: number;
  transitionSpeed: number;
  thinkingDuration: number;
  interaction: InteractionConfig;
  scene: SceneConfig;
  audioEffects: {
    enabled: boolean;
    reactivity: number;
    sensitivity: number;
    breathing: number;
    responseSpeed: number;
    transientBoost: number;
    bassSpike: number;
    midSpike: number;
    highSpike: number;
    spikeDensity: number;
    rotateWhilePlaying: boolean;
  };
}

export type BlackHoleColorScheme = 'classic' | 'fire' | 'ice' | 'nebula' | 'void';

export interface BlackHoleState {
  colorScheme: BlackHoleColorScheme;
  colors: {
    hot: string;
    mid1: string;
    mid2: string;
    mid3: string;
    outer: string;
  };
  core: {
    radius: number;
    glowIntensity: number;
    pulseSpeed: number;
  };
  disk: {
    innerRadius: number;
    outerRadius: number;
    tiltAngle: number;
    flowSpeed: number;
    noiseScale: number;
    density: number;
  };
  stars: {
    count: number;
    fieldRadius: number;
    twinkleSpeed: number;
  };
  animation: {
    autoRotate: boolean;
    autoRotateSpeed: number;
    diskRotationSpeed: number;
    starsRotationSpeed: number;
  };
  effects: {
    bloomIntensity: number;
    bloomThreshold: number;
    bloomRadius: number;
    lensingStrength: number;
    lensingRadius: number;
    chromaticAberration: number;
  };
  audioEffects: {
    enabled: boolean;
    reactivity: number;
    smoothing: number;
    bassDiskGlow: number;
    midDiskSpeed: number;
    highStarTwinkle: number;
  };
  scale: number;
  interaction: InteractionConfig;
  scene: SceneConfig;
}

// Default states
export function getDefaultBlobState(): BlobState {
  return {
    colors: { x: '#ff0066', y: '#00ff66', z: '#6600ff' },
    spikes: { x: 0.95, y: 0.95, z: 0.95 },
    amplitude: { x: 0.75, y: 0.75, z: 0.75 },
    time: { x: 1, y: 1, z: 1 },
    rotation: { x: 0.002, y: 0.003, z: 0.001 },
    startRotation: { x: 0, y: 0, z: 0 },
    scale: 3.2,
    opacity: 1,
    shininess: 50,
    lightIntensity: 0,
    wireframe: false,
    glassMode: false,
    skin: 'radial',
    resolution: 180,
    touchStrength: 1,
    touchDuration: 1100,
    maxTouchPoints: 5,
    transitionSpeed: 0.05,
    thinkingDuration: 10000,
    interaction: JSON.parse(JSON.stringify(defaultInteractionConfig)),
    scene: JSON.parse(JSON.stringify(defaultSceneConfig)),
    audioEffects: {
      enabled: true,
      reactivity: 1.9,
      sensitivity: 0.075,
      breathing: 0.035,
      responseSpeed: 0.75,
      transientBoost: 0.5,
      bassSpike: 0.55,
      midSpike: 0.65,
      highSpike: 0.35,
      spikeDensity: 1.5,
      rotateWhilePlaying: true,
    }
  };
}

export function getDefaultBlackHoleState(): BlackHoleState {
  return {
    colorScheme: 'classic',
    colors: {
      hot: '#ffffff',
      mid1: '#ff7733',
      mid2: '#ff4477',
      mid3: '#7744ff',
      outer: '#4477ff',
    },
    core: {
      radius: 1.3,
      glowIntensity: 1.0,
      pulseSpeed: 2.5,
    },
    disk: {
      innerRadius: 0.2,
      outerRadius: 8.0,
      tiltAngle: Math.PI / 3.0,
      flowSpeed: 0.22,
      noiseScale: 2.5,
      density: 1.3,
    },
    stars: {
      count: 150000,
      fieldRadius: 2000,
      twinkleSpeed: 2.5,
    },
    animation: {
      autoRotate: false,
      autoRotateSpeed: 0.1,
      diskRotationSpeed: 0.005,
      starsRotationSpeed: 0.003,
    },
    effects: {
      bloomIntensity: 0.8,
      bloomThreshold: 0.8,
      bloomRadius: 0.7,
      lensingStrength: 0.12,
      lensingRadius: 0.3,
      chromaticAberration: 0.005,
    },
    audioEffects: {
      enabled: true,
      reactivity: 1.0,
      smoothing: 0.8,
      bassDiskGlow: 0.5,
      midDiskSpeed: 0.3,
      highStarTwinkle: 0.4,
    },
    scale: 1.0,
    interaction: JSON.parse(JSON.stringify(defaultInteractionConfig)),
    scene: JSON.parse(JSON.stringify(defaultSceneConfig)),
  };
}

// Re-export for backwards compatibility
export const AVATAR_PRESETS = avatarPresets;

const STORAGE_KEY = 'kwami-avatar';

export const useAvatarStore = defineStore('avatar', () => {
  // State
  const blob = reactive<BlobState>(getDefaultBlobState());
  const blackHole = reactive<BlackHoleState>(getDefaultBlackHoleState());
  const activeState = ref<AvatarState>('idle');
  const rendererType = ref<RendererType>('blob-xyz');
  const isInitialized = ref(false);
  const isLoading = ref(false);

  // Computed
  const currentState = computed(() => {
    if (rendererType.value === 'blob-xyz') return blob;
    return blackHole;
  });

  const blobXyzPresets = computed(() => getBlobXyzPresets());
  const blackHolePresets = computed(() => getBlackHolePresets());
  const eyeIrisPresets = computed(() => getEyeIrisPresets());

  // Actions
  function setRendererType(type: RendererType) {
    rendererType.value = type;
  }

  function setActiveState(state: AvatarState) {
    activeState.value = state;
  }

  function updateBlob(updates: Partial<BlobState>) {
    Object.assign(blob, updates);
  }

  function updateBlackHole(updates: Partial<BlackHoleState>) {
    Object.assign(blackHole, updates);
  }

  function resetBlob() {
    Object.assign(blob, getDefaultBlobState());
  }

  function resetBlackHole() {
    Object.assign(blackHole, getDefaultBlackHoleState());
  }

  function resetParticlesFace() {
    const pfStore = useParticlesFaceStore();
    pfStore.resetAll();
  }

  function reset() {
    if (rendererType.value === 'blob-xyz') {
      resetBlob();
    } else if (rendererType.value === 'black-hole') {
      resetBlackHole();
    } else if (rendererType.value === 'particles-face') {
      resetParticlesFace();
    } else if (rendererType.value === 'eye-iris') {
      useEyeIrisStore().resetAll();
    }
  }

  function applyPreset(presetId: string) {
    const preset = getPresetById(presetId);
    if (!preset) return false;

    rendererType.value = preset.renderer;

    if (preset.renderer === 'blob-xyz' && preset.blobXyz) {
      // Use the new blob store for presets
      const blobStore = useBlobXyzStore();
      blobStore.importState(preset.blobXyz as Parameters<typeof blobStore.importState>[0]);
    } else if (preset.renderer === 'black-hole' && preset.blackHole) {
      // Use the new black hole store for presets
      const blackHoleStore = useBlackHoleStore();
      blackHoleStore.importState(preset.blackHole as Parameters<typeof blackHoleStore.importState>[0]);
    } else if (preset.renderer === 'eye-iris' && preset.eyeIris) {
      useEyeIrisStore().importState(preset.eyeIris as Parameters<ReturnType<typeof useEyeIrisStore>['importState']>[0]);
    }

    return true;
  }

  // Sync from external source (kwami instance)
  function syncBlobFromExternal(externalBlob: {
    getColors: () => { x: string; y: string; z: string };
    getSpikes: () => { x: number; y: number; z: number };
    getAmplitude: () => { x: number; y: number; z: number };
    getTime: () => { x: number; y: number; z: number };
    getRotation: () => { x: number; y: number; z: number };
    getScale: () => number;
    getOpacity: () => number;
    getShininess: () => number;
    lightIntensity: number;
    getWireframe: () => boolean;
    getCurrentSkinType: () => string;
    // Copied wholesale via Object.assign, so only their presence matters here.
    audioEffects?: Record<string, unknown>;
    interaction?: Record<string, unknown>;
    scene?: Record<string, unknown>;
  }) {
    const c = externalBlob.getColors();
    blob.colors = { x: c.x, y: c.y, z: c.z };
    blob.spikes = externalBlob.getSpikes();
    blob.amplitude = externalBlob.getAmplitude();
    blob.time = externalBlob.getTime();
    blob.rotation = externalBlob.getRotation();
    blob.scale = externalBlob.getScale();
    blob.opacity = externalBlob.getOpacity();
    blob.shininess = externalBlob.getShininess();
    blob.lightIntensity = externalBlob.lightIntensity;
    blob.wireframe = externalBlob.getWireframe();
    blob.skin = externalBlob.getCurrentSkinType() as SkinType;

    // Sync audio effects if available
    if (externalBlob.audioEffects) {
      Object.assign(blob.audioEffects, externalBlob.audioEffects);
    }
    // Sync scene if available
    if (externalBlob.scene) {
      Object.assign(blob.scene, externalBlob.scene);
    }
  }

  // Sync from external source (kwami instance) - Black Hole
  function syncBlackHoleFromExternal(externalBlackHole: {
    getColorScheme: () => { scheme: string };
    getColors: () => { hot: string; mid1: string; mid2: string; mid3: string; outer: string };
    getScale: () => number;
    audioEffects?: Record<string, unknown>;
  }) {
    try {
      blackHole.colorScheme = externalBlackHole.getColorScheme().scheme as BlackHoleColorScheme;
      const bhColors = externalBlackHole.getColors();
      blackHole.colors.hot = bhColors.hot;
      blackHole.colors.mid1 = bhColors.mid1;
      blackHole.colors.mid2 = bhColors.mid2;
      blackHole.colors.mid3 = bhColors.mid3;
      blackHole.colors.outer = bhColors.outer;
      blackHole.scale = externalBlackHole.getScale();

      if (externalBlackHole.audioEffects) {
        Object.assign(blackHole.audioEffects, externalBlackHole.audioEffects);
      }
    } catch (e) {
      console.warn('Error syncing black hole state:', e);
    }
  }

  // =====================================================
  // PERSISTENCE
  // =====================================================

  function getSnapshot() {
    const blobStore = useBlobXyzStore();
    const blackHoleStore = useBlackHoleStore();
    const pfStore = useParticlesFaceStore();
    const eyeIrisStore = useEyeIrisStore();
    return {
      rendererType: rendererType.value,
      blobXyz: blobStore.exportState(),
      blackHole: blackHoleStore.exportState(),
      particlesFace: pfStore.exportState(),
      eyeIris: eyeIrisStore.exportState(),
    };
  }

  function applySnapshot(settings: {
    rendererType?: RendererType;
    blobXyz?: unknown;
    blackHole?: unknown;
    particlesFace?: unknown;
    eyeIris?: unknown;
  }) {
    if (!settings) return;
    isLoading.value = true;
    try {
      if (settings.rendererType) {
        rendererType.value = settings.rendererType;
      }
      const blobStore = useBlobXyzStore();
      const blackHoleStore = useBlackHoleStore();
      const pfStore = useParticlesFaceStore();
      const eyeIrisStore = useEyeIrisStore();
      if (settings.blobXyz) blobStore.importState(settings.blobXyz as Parameters<typeof blobStore.importState>[0]);
      if (settings.blackHole) blackHoleStore.importState(settings.blackHole as Parameters<typeof blackHoleStore.importState>[0]);
      if (settings.particlesFace) pfStore.importState(settings.particlesFace as Parameters<typeof pfStore.importState>[0]);
      if (settings.eyeIris) eyeIrisStore.importState(settings.eyeIris as Parameters<typeof eyeIrisStore.importState>[0]);
    } catch (e) {
      console.warn('Failed to apply avatar snapshot:', e);
    }
    isInitialized.value = true;
    isLoading.value = false;
  }

  function saveSettings() {
    if (isLoading.value) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(getSnapshot()));
    } catch (e) {
      console.warn('Failed to save avatar settings:', e);
    }
  }

  function loadSettings() {
    isLoading.value = true;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      isInitialized.value = true;
      isLoading.value = false;
      return;
    }
    try {
      applySnapshot(JSON.parse(saved) as Parameters<typeof applySnapshot>[0]);
    } catch (e) {
      console.warn('Failed to load avatar settings:', e);
      isInitialized.value = true;
      isLoading.value = false;
    }
  }

  return {
    // State
    blob,
    blackHole,
    activeState,
    rendererType,
    isInitialized,
    isLoading,
    // Computed
    currentState,
    avatarPresets,
    blobXyzPresets,
    blackHolePresets,
    eyeIrisPresets,
    // Actions
    setRendererType,
    setActiveState,
    updateBlob,
    updateBlackHole,
    resetBlob,
    resetBlackHole,
    resetParticlesFace,
    reset,
    applyPreset,
    syncBlobFromExternal,
    syncBlackHoleFromExternal,
    // Persistence
    loadSettings,
    saveSettings,
    getSnapshot,
    applySnapshot,
  };
});
