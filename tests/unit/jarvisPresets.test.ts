import { beforeEach, describe, expect, it, vi } from 'vitest';

// tests/setup.ts replaces the whole package with `Kwami`. These presets and defaults are real
// data from the SDK, so keep its exports and stub only the runtime class.
vi.mock('kwami', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const { Kwami } = await import('../mocks/kwami');
  return { ...actual, Kwami };
});
import { createPinia, setActivePinia } from 'pinia';
import { getDefaultJarvisConfig } from 'kwami';
import { getJarvisPresets, JARVIS_INTERFACE } from '@/presets/avatar/avatar-presets';
import { useAvatarStore } from '@/stores/avatar';
import { getDefaultJarvisState, useJarvisStore } from '@/stores/avatar.jarvis';

beforeEach(() => {
  setActivePinia(createPinia());
});

describe('the three-dimensional Jarvis interface is the default', () => {
  it('is what a fresh Jarvis starts with, and matches the SDK', () => {
    const state = getDefaultJarvisState();
    expect({ panels: state.panels, grid: state.grid, depth: state.depth }).toEqual(
      JARVIS_INTERFACE,
    );
    const sdk = getDefaultJarvisConfig();
    expect({ panels: sdk.panels, grid: sdk.grid, depth: sdk.depth }).toEqual(JARVIS_INTERFACE);
  });

  it('is part of every Jarvis preset', () => {
    const presets = getJarvisPresets();
    expect(presets.length).toBeGreaterThan(0);
    for (const preset of presets) {
      expect(preset.jarvis).toMatchObject(JARVIS_INTERFACE);
    }
  });

  it('comes back when a preset is picked after a piece was switched off', () => {
    const jarvis = useJarvisStore();
    jarvis.state.panels = false;
    jarvis.state.grid = false;
    jarvis.state.depth = 0;

    const preset = getJarvisPresets()[0]!;
    expect(useAvatarStore().applyPreset(preset.id)).toBe(true);

    expect(jarvis.state.panels).toBe(true);
    expect(jarvis.state.grid).toBe(true);
    expect(jarvis.state.depth).toBe(1);
  });

  it('survives a saved Jarvis from before the interface existed', () => {
    const jarvis = useJarvisStore();
    // A snapshot saved before panels, grid and depth were settings has none of the three.
    jarvis.importState({ palettePreset: 'neon-violet', intensity: 1.2, labels: true });
    expect(jarvis.state.panels).toBe(true);
    expect(jarvis.state.grid).toBe(true);
    expect(jarvis.state.depth).toBe(1);
  });
});
