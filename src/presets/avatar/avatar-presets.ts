/**
 * Avatar Templates for the Kwami App
 *
 * Central export for all avatar renderer presets (blob, black-hole).
 */

import { shallowRef, type ShallowRef } from 'vue';
import type { RendererType } from '../../stores/avatar';
import type { BlobXyzState } from '../../stores/avatar.blob-xyz';
import type { BlackHoleState } from '../../stores/avatar.black-hole';
import type { EyeIrisState } from '../../stores/avatar.eye-iris';
import type { JarvisState } from '../../stores/avatar.jarvis';
import { getJarvisPalette, type JarvisPalettePreset } from 'kwami';
import { blobPresetsData, type BlobXyzPreset } from './blob-xyz-presets';
import { blackHolePresetsData, type BlackHolePreset } from './black-hole-presets';
import { eyeIrisPresetsData, type EyeIrisPreset } from './eye-iris-presets';

// Re-export preset types
export type { BlobXyzPreset } from './blob-xyz-presets';
export type { BlackHolePreset } from './black-hole-presets';
export type { EyeIrisPreset } from './eye-iris-presets';

// Direct access to typed preset data
export { blobPresetsData } from './blob-xyz-presets';
export { blackHolePresetsData } from './black-hole-presets';
export { eyeIrisPresetsData } from './eye-iris-presets';

// Unified preset interface for backwards compatibility
export interface AvatarPreset {
  id: string;
  name: string;
  icon: string;
  renderer: RendererType;
  blobXyz?: Partial<BlobXyzState>;
  blackHole?: Partial<BlackHoleState>;
  eyeIris?: Partial<EyeIrisState>;
  jarvis?: Partial<JarvisState>;
}

// Convert specific presets to unified format
function toBlobAvatarPreset(preset: BlobXyzPreset): AvatarPreset {
  return {
    id: preset.id,
    name: preset.name,
    icon: preset.icon,
    renderer: 'blob-xyz',
    blobXyz: preset.blob as unknown as Partial<BlobXyzState>,
  };
}

function toBlackHoleAvatarPreset(preset: BlackHolePreset): AvatarPreset {
  return {
    id: preset.id,
    name: preset.name,
    icon: preset.icon,
    renderer: 'black-hole',
    blackHole: preset.blackHole,
  };
}

function toEyeIrisAvatarPreset(preset: EyeIrisPreset): AvatarPreset {
  return {
    id: preset.id,
    name: preset.name,
    icon: preset.icon,
    renderer: 'eye-iris',
    eyeIris: preset.eyeIris,
  };
}

/** Jarvis presets are its palettes, each with a behaviour that suits it. */
const JARVIS_PRESETS: Array<{
  id: JarvisPalettePreset;
  name: string;
  icon: string;
  extra: Partial<JarvisState>;
}> = [
  {
    id: 'holo-cyan',
    name: 'Holo Cyan',
    icon: 'ph:crosshair-duotone',
    extra: { intensity: 1, rotationSpeed: 1 },
  },
  {
    id: 'neon-violet',
    name: 'Neon Violet',
    icon: 'ph:aperture-duotone',
    extra: { intensity: 1.15, rotationSpeed: 1.2 },
  },
  {
    id: 'arc-white',
    name: 'Arc White',
    icon: 'ph:lightning-duotone',
    extra: { intensity: 0.9, rotationSpeed: 0.8 },
  },
  {
    id: 'alert-amber',
    name: 'Alert Amber',
    icon: 'ph:warning-diamond-duotone',
    extra: { intensity: 1.05, rotationSpeed: 1.4 },
  },
];

function toJarvisAvatarPreset(preset: (typeof JARVIS_PRESETS)[number]): AvatarPreset {
  return {
    id: `jarvis-${preset.id}`,
    name: preset.name,
    icon: preset.icon,
    renderer: 'jarvis',
    jarvis: { palettePreset: preset.id, color: getJarvisPalette(preset.id), ...preset.extra },
  };
}

// Combine all presets into a unified array
const _avatarPresetsData: AvatarPreset[] = [
  ...blobPresetsData.map(toBlobAvatarPreset),
  ...blackHolePresetsData.map(toBlackHoleAvatarPreset),
  ...eyeIrisPresetsData.map(toEyeIrisAvatarPreset),
  ...JARVIS_PRESETS.map(toJarvisAvatarPreset),
];

// Persist reactive ref across HMR updates using import.meta.hot.data
function getOrCreatePresetsRef(): ShallowRef<AvatarPreset[]> {
  // `import.meta.hot` exists under Vitest too, but without the `data` bag the
  // dev server provides -- so the unguarded `hot.data.avatarPresetsRef` threw
  // at import time, and any test that touched the avatar store failed before
  // it ran a line of its own.
  const hotData = import.meta.hot?.data;
  if (hotData) {
    // Reuse existing ref from previous HMR update, or create new one
    if (!hotData.avatarPresetsRef) {
      hotData.avatarPresetsRef = shallowRef<AvatarPreset[]>(_avatarPresetsData);
    }
    return hotData.avatarPresetsRef;
  }
  // Production (and tests): just create the ref
  return shallowRef<AvatarPreset[]>(_avatarPresetsData);
}

// Reactive ref for HMR support (persisted across HMR updates)
export const avatarPresetsRef = getOrCreatePresetsRef();

// Update the ref with new data on HMR
if (import.meta.hot) {
  // Update the persisted ref with the new data from this module
  avatarPresetsRef.value = _avatarPresetsData;
}

// Static export for backwards compatibility
export const avatarPresets = _avatarPresetsData;

// Helper functions (use ref for reactivity)
export function getPresetById(id: string): AvatarPreset | undefined {
  return avatarPresetsRef.value.find((p) => p.id === id);
}

export function getBlobXyzPresets(): AvatarPreset[] {
  return avatarPresetsRef.value.filter((p) => p.renderer === 'blob-xyz');
}

export function getBlackHolePresets(): AvatarPreset[] {
  return avatarPresetsRef.value.filter((p) => p.renderer === 'black-hole');
}

export function getEyeIrisPresets(): AvatarPreset[] {
  return avatarPresetsRef.value.filter((p) => p.renderer === 'eye-iris');
}

export function getJarvisPresets(): AvatarPreset[] {
  return avatarPresetsRef.value.filter((p) => p.renderer === 'jarvis');
}
