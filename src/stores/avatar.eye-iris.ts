import { defineStore } from 'pinia';
import { reactive } from 'vue';
import { randomHex, randomInRange } from '@/utils/color';

export type EyeIrisPalettePreset = 'light-brown' | 'hazel' | 'blue-grey' | 'green-blue';
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
export type CursorStyle = 'pointer' | 'grab' | 'crosshair' | 'default';

export interface EyeIrisState {
  palettePreset: EyeIrisPalettePreset;
  geometry: {
    irisRadius: number;
    pupilRadius: number;
    limbalRingWidth: number;
  };
  detail: {
    fiberDensity: number;
    fiberSharpness: number;
    radialStreakStrength: number;
    collaretteStrength: number;
    limbalIntensity: number;
    noiseStrength: number;
    cryptStrength: number;
    furrowStrength: number;
    ringContrast: number;
    sectorMix: number;
    pigmentMottleStrength: number;
    spokesStrength: number;
    innerRingStrength: number;
  };
  color: {
    base: string;
    secondary: string;
    accent: string;
    limbal: string;
    collarette: string;
    crypt: string;
    streak: string;
  };
  animation: {
    shimmerSpeed: number;
    shimmerStrength: number;
    patternFlow: number;
    patternRotation: number;
  };
  audio: {
    enabled: boolean;
    reactivity: number;
    pupilResponse: number;
    shimmerResponse: number;
    smoothing: number;
  };
  follow: {
    enabled: boolean;
    sensitivity: number;
    pupilMotion: boolean;
    pupilMotionStrength: number;
  };
  clickEvents: {
    click: { enabled: boolean; action: InteractionAction };
    doubleClick: { enabled: boolean; action: InteractionAction };
    rightClick: { enabled: boolean; action: InteractionAction };
    doubleRightClick: { enabled: boolean; action: InteractionAction };
  };
  cursorTouch: {
    hover: { enabled: boolean; highlightOnHover: boolean; cursorStyle: CursorStyle };
    drag: { enabled: boolean; sensitivity: number };
  };
  scale: number;
}

export function getDefaultEyeIrisState(): EyeIrisState {
  return {
    palettePreset: 'hazel',
    geometry: { irisRadius: 0.94, pupilRadius: 0.22, limbalRingWidth: 0.06 },
    detail: {
      fiberDensity: 168,
      fiberSharpness: 1.0,
      radialStreakStrength: 0.98,
      collaretteStrength: 0.72,
      limbalIntensity: 1.02,
      noiseStrength: 0.28,
      cryptStrength: 0.9,
      furrowStrength: 0.72,
      ringContrast: 0.82,
      sectorMix: 0.56,
      pigmentMottleStrength: 0.95,
      spokesStrength: 0.9,
      innerRingStrength: 0.92,
    },
    color: {
      base: '#6b4b23',
      secondary: '#a37229',
      accent: '#d0a73c',
      limbal: '#2b190a',
      collarette: '#845223',
      crypt: '#1d1208',
      streak: '#d6b45b',
    },
    animation: { shimmerSpeed: 0.16, shimmerStrength: 0.1, patternFlow: 0.24, patternRotation: 0.08 },
    audio: { enabled: true, reactivity: 1.0, pupilResponse: 0.22, shimmerResponse: 0.35, smoothing: 0.82 },
    follow: { enabled: true, sensitivity: 1.0, pupilMotion: true, pupilMotionStrength: 0.12 },
    clickEvents: {
      click: { enabled: true, action: 'pulse' },
      doubleClick: { enabled: true, action: 'toggleListening' },
      rightClick: { enabled: true, action: 'randomize' },
      doubleRightClick: { enabled: true, action: 'switchRenderer' },
    },
    cursorTouch: {
      hover: { enabled: true, highlightOnHover: false, cursorStyle: 'pointer' },
      drag: { enabled: false, sensitivity: 1.0 },
    },
    scale: 5.0,
  };
}

export const useEyeIrisStore = defineStore('eyeIris', () => {
  const state = reactive<EyeIrisState>(getDefaultEyeIrisState());

  function resetAll() {
    Object.assign(state, getDefaultEyeIrisState());
  }

  function exportState(): EyeIrisState {
    return JSON.parse(JSON.stringify(state)) as EyeIrisState;
  }

  function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): void {
    for (const key in source) {
      if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
      const sourceValue = source[key];
      const targetValue = target[key];
      if (
        sourceValue !== null &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue !== null &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        deepMerge(targetValue as Record<string, unknown>, sourceValue as Record<string, unknown>);
      } else if (sourceValue !== undefined) {
        (target as Record<string, unknown>)[key] = sourceValue;
      }
    }
  }

  function importState(next: Partial<EyeIrisState>) {
    deepMerge(state as unknown as Record<string, unknown>, next as Record<string, unknown>);
  }

  function applyPalettePreset(preset: EyeIrisPalettePreset) {
    state.palettePreset = preset;
    if (preset === 'light-brown') {
      state.color = { base: '#8f4b24', secondary: '#b06a34', accent: '#e2a24d', limbal: '#3b1d10', collarette: '#a35a2c', crypt: '#2a160d', streak: '#f0b265' };
    } else if (preset === 'hazel') {
      state.color = { base: '#6b4b23', secondary: '#a37229', accent: '#d0a73c', limbal: '#2b190a', collarette: '#845223', crypt: '#1d1208', streak: '#d6b45b' };
    } else if (preset === 'blue-grey') {
      state.color = { base: '#73879b', secondary: '#9db2c4', accent: '#d6e3ef', limbal: '#2b3540', collarette: '#8398ab', crypt: '#1d2530', streak: '#dce7f0' };
    } else {
      state.color = { base: '#2f8f84', secondary: '#4ac1aa', accent: '#a1e75c', limbal: '#12483e', collarette: '#3ea892', crypt: '#0d3129', streak: '#9fe5b2' };
    }
  }

  function randomizeAll() {
    const presets: EyeIrisPalettePreset[] = ['light-brown', 'hazel', 'blue-grey', 'green-blue'];
    applyPalettePreset(presets[Math.floor(Math.random() * presets.length)] ?? 'hazel');
    state.geometry.irisRadius = randomInRange(0.82, 0.98, 0.01);
    state.geometry.pupilRadius = randomInRange(0.16, 0.36, 0.01);
    state.geometry.limbalRingWidth = randomInRange(0.03, 0.14, 0.01);
    state.detail.fiberDensity = randomInRange(80, 1000, 1);
    state.detail.fiberSharpness = randomInRange(0.2, 1.4, 0.01);
    state.detail.radialStreakStrength = randomInRange(0.2, 1.1, 0.01);
    state.detail.collaretteStrength = randomInRange(0.1, 1.0, 0.01);
    state.detail.limbalIntensity = randomInRange(0.2, 1.2, 0.01);
    state.detail.noiseStrength = randomInRange(0.1, 2.6, 0.01);
    state.detail.cryptStrength = randomInRange(0.1, 1.3, 0.01);
    state.detail.furrowStrength = randomInRange(0.1, 1.2, 0.01);
    state.detail.ringContrast = randomInRange(0.1, 1.2, 0.01);
    state.detail.sectorMix = randomInRange(0, 1, 0.01);
    state.detail.pigmentMottleStrength = randomInRange(0.1, 1.4, 0.01);
    state.detail.spokesStrength = randomInRange(0.1, 1.4, 0.01);
    state.detail.innerRingStrength = randomInRange(0.1, 1.4, 0.01);
    state.animation.shimmerSpeed = randomInRange(0, 0.8, 0.01);
    state.animation.shimmerStrength = randomInRange(0, 0.6, 0.01);
    state.animation.patternFlow = randomInRange(0, 0.35, 0.01);
    // Rotation only on 1 of 3 randomizes, and always smooth/subtle.
    if (Math.floor(Math.random() * 3) === 0) {
      state.animation.patternRotation = randomInRange(-0.12, 0.12, 0.01);
    } else {
      state.animation.patternRotation = 0;
    }
    state.audio.reactivity = randomInRange(0, 2, 0.05);
    state.audio.pupilResponse = randomInRange(0, 0.5, 0.01);
    state.audio.shimmerResponse = randomInRange(0, 0.7, 0.01);
    state.audio.smoothing = randomInRange(0.6, 0.98, 0.01);
    state.follow.sensitivity = randomInRange(0.4, 1.6, 0.01);
    state.follow.pupilMotion = Math.random() > 0.15;
    state.follow.pupilMotionStrength = randomInRange(0.04, 0.22, 0.01);
    // Keep user scale untouched on randomize.

    if (Math.random() > 0.65) {
      state.color.accent = randomHex();
    }
    if (Math.random() > 0.7) state.color.streak = randomHex();
    if (Math.random() > 0.8) state.color.collarette = randomHex();
  }

  // importState merges a partial, so accept the renderer's config as one:
  // the SDK's EyeIrisConfig is structurally compatible but not identical.
  function syncFromKwami(renderer: {
    getConfig: () => Partial<EyeIrisState>;
    getScale: () => number;
  }) {
    const config = renderer.getConfig();
    importState(config);
    state.scale = renderer.getScale();
  }

  return {
    state,
    resetAll,
    exportState,
    importState,
    applyPalettePreset,
    randomizeAll,
    syncFromKwami,
  };
});
