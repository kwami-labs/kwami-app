import { defineStore } from 'pinia';
import { reactive } from 'vue';
import { getDefaultJarvisConfig, getJarvisPalette } from 'kwami';
import type { JarvisPalettePreset, JarvisQuality } from 'kwami';
import { randomInRange } from '@/utils/color';

export type { JarvisPalettePreset, JarvisQuality };

export const JARVIS_PALETTES: readonly JarvisPalettePreset[] = [
  'holo-cyan',
  'neon-violet',
  'arc-white',
  'alert-amber',
];

/**
 * The Jarvis renderer is deliberately low-configuration: the HUD layout is
 * procedural inside the SDK, so this store only holds the look (palette) and a
 * handful of behaviour knobs. Defaults come from the SDK so the two never drift.
 */
export interface JarvisState {
  palettePreset: JarvisPalettePreset;
  color: {
    primary: string;
    secondary: string;
    accent: string;
    alert: string;
    background: string;
    backgroundGlow: string;
  };
  intensity: number;
  reactivity: number;
  rotationSpeed: number;
  parallax: number;
  quality: JarvisQuality;
  backdrop: boolean;
  labels: boolean;
  title: string;
  scale: number;
  /** Floating data panels around the reactor. */
  panels: boolean;
  /** Perspective floor under the reactor. */
  grid: boolean;
  /** How far the layers spread through depth: 0 flat, 1 reference, 2 double. */
  depth: number;
}

export function getDefaultJarvisState(): JarvisState {
  const defaults = getDefaultJarvisConfig();
  return {
    palettePreset: defaults.palettePreset,
    color: { ...defaults.color },
    intensity: defaults.intensity,
    reactivity: defaults.reactivity,
    rotationSpeed: defaults.rotationSpeed,
    parallax: defaults.parallax,
    quality: defaults.quality,
    backdrop: defaults.backdrop,
    labels: defaults.labels,
    title: defaults.title,
    scale: defaults.scale,
    panels: defaults.panels,
    grid: defaults.grid,
    depth: defaults.depth,
  };
}

export const useJarvisStore = defineStore('jarvis', () => {
  const state = reactive<JarvisState>(getDefaultJarvisState());

  function resetAll() {
    Object.assign(state, getDefaultJarvisState());
  }

  function exportState(): JarvisState {
    return JSON.parse(JSON.stringify(state)) as JarvisState;
  }

  function importState(next: Partial<JarvisState>) {
    if (!next || typeof next !== 'object') return;
    const { color, ...rest } = next;
    for (const [key, value] of Object.entries(rest)) {
      if (value !== undefined && key in state) {
        (state as unknown as Record<string, unknown>)[key] = value;
      }
    }
    if (color && typeof color === 'object') {
      state.color = { ...state.color, ...color };
    }
  }

  function applyPalettePreset(preset: JarvisPalettePreset) {
    state.palettePreset = preset;
    state.color = getJarvisPalette(preset);
  }

  function randomizeAll() {
    const others = JARVIS_PALETTES.filter((p) => p !== state.palettePreset);
    applyPalettePreset(others[Math.floor(Math.random() * others.length)] ?? 'holo-cyan');
    state.intensity = randomInRange(0.8, 1.35, 0.01);
    state.rotationSpeed = randomInRange(0.6, 1.6, 0.01);
    // Reactivity, parallax, depth, quality, title, scale and what is shown are the user's,
    // not the dice's.
  }

  function syncFromKwami(renderer: { getConfig: () => Partial<JarvisState> }) {
    importState(renderer.getConfig());
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
