/**
 * Color Palette System Composable
 *
 * Provides various color palette generators for avatar customization.
 * Each palette generates harmonious color combinations based on color theory.
 */

import { hslToHex, randomHex } from '@/utils/color';

// =====================================================
// TYPES
// =====================================================

export type PaletteType =
  | 'complementary'
  | 'analogous'
  | 'triadic'
  | 'split'
  | 'monochrome'
  | 'warm'
  | 'cool'
  | 'pastel'
  | 'vibrant'
  | 'sunset'
  | 'ocean'
  | 'forest';

export interface Palette {
  label: string;
  icon: string;
  generate: () => [string, string, string];
}

// =====================================================
// PALETTE DEFINITIONS
// =====================================================

const palettes: Record<PaletteType, Palette> = {
  complementary: {
    label: 'Complementary',
    icon: 'ph:circle-half-duotone',
    generate: () => {
      const h = Math.random() * 360;
      const s = 60 + Math.random() * 30;
      const l = 45 + Math.random() * 20;
      return [hslToHex(h, s, l), hslToHex(h + 180, s, l), hslToHex(h + 180, s * 0.7, l + 15)];
    },
  },
  analogous: {
    label: 'Analogous',
    icon: 'ph:gradient-duotone',
    generate: () => {
      const h = Math.random() * 360;
      const s = 55 + Math.random() * 35;
      const l = 45 + Math.random() * 20;
      return [hslToHex(h, s, l), hslToHex(h + 30, s, l + 5), hslToHex(h - 30, s, l - 5)];
    },
  },
  triadic: {
    label: 'Triadic',
    icon: 'ph:triangle-duotone',
    generate: () => {
      const h = Math.random() * 360;
      const s = 60 + Math.random() * 30;
      const l = 50 + Math.random() * 15;
      return [hslToHex(h, s, l), hslToHex(h + 120, s, l), hslToHex(h + 240, s, l)];
    },
  },
  split: {
    label: 'Split',
    icon: 'ph:arrows-split-duotone',
    generate: () => {
      const h = Math.random() * 360;
      const s = 60 + Math.random() * 30;
      const l = 50 + Math.random() * 15;
      return [hslToHex(h, s, l), hslToHex(h + 150, s, l), hslToHex(h + 210, s, l)];
    },
  },
  monochrome: {
    label: 'Mono',
    icon: 'ph:circle-duotone',
    generate: () => {
      const h = Math.random() * 360;
      const s = 50 + Math.random() * 40;
      return [
        hslToHex(h, s, 30 + Math.random() * 15),
        hslToHex(h, s * 0.8, 50 + Math.random() * 10),
        hslToHex(h, s * 0.6, 70 + Math.random() * 10),
      ];
    },
  },
  warm: {
    label: 'Warm',
    icon: 'ph:sun-duotone',
    generate: () => {
      const h = Math.random() * 60;
      const s = 65 + Math.random() * 30;
      const l = 50 + Math.random() * 15;
      return [
        hslToHex(h, s, l),
        hslToHex(h + 20 + Math.random() * 20, s, l + 5),
        hslToHex(h - 10 + Math.random() * 10, s * 0.9, l - 5),
      ];
    },
  },
  cool: {
    label: 'Cool',
    icon: 'ph:snowflake-duotone',
    generate: () => {
      const h = 180 + Math.random() * 80;
      const s = 55 + Math.random() * 35;
      const l = 45 + Math.random() * 20;
      return [
        hslToHex(h, s, l),
        hslToHex(h + 25 + Math.random() * 20, s, l + 5),
        hslToHex(h - 20 + Math.random() * 15, s * 0.85, l - 5),
      ];
    },
  },
  pastel: {
    label: 'Pastel',
    icon: 'ph:flower-duotone',
    generate: () => {
      const h1 = Math.random() * 360;
      const h2 = (h1 + 60 + Math.random() * 60) % 360;
      const h3 = (h2 + 60 + Math.random() * 60) % 360;
      return [
        hslToHex(h1, 40 + Math.random() * 20, 80 + Math.random() * 10),
        hslToHex(h2, 35 + Math.random() * 25, 78 + Math.random() * 12),
        hslToHex(h3, 38 + Math.random() * 22, 82 + Math.random() * 8),
      ];
    },
  },
  vibrant: {
    label: 'Vibrant',
    icon: 'ph:lightning-duotone',
    generate: () => {
      const h1 = Math.random() * 360;
      const h2 = (h1 + 90 + Math.random() * 60) % 360;
      const h3 = (h2 + 90 + Math.random() * 60) % 360;
      return [
        hslToHex(h1, 85 + Math.random() * 15, 50 + Math.random() * 10),
        hslToHex(h2, 80 + Math.random() * 20, 52 + Math.random() * 10),
        hslToHex(h3, 82 + Math.random() * 18, 48 + Math.random() * 12),
      ];
    },
  },
  sunset: {
    label: 'Sunset',
    icon: 'ph:sun-horizon-duotone',
    generate: () => [
      hslToHex(15 + Math.random() * 20, 80 + Math.random() * 20, 55 + Math.random() * 15),
      hslToHex(330 + Math.random() * 30, 70 + Math.random() * 25, 60 + Math.random() * 15),
      hslToHex(270 + Math.random() * 40, 50 + Math.random() * 30, 45 + Math.random() * 20),
    ],
  },
  ocean: {
    label: 'Ocean',
    icon: 'ph:waves-duotone',
    generate: () => [
      hslToHex(200 + Math.random() * 20, 70 + Math.random() * 25, 45 + Math.random() * 15),
      hslToHex(175 + Math.random() * 25, 60 + Math.random() * 30, 50 + Math.random() * 15),
      hslToHex(210 + Math.random() * 30, 55 + Math.random() * 35, 55 + Math.random() * 20),
    ],
  },
  forest: {
    label: 'Forest',
    icon: 'ph:tree-duotone',
    generate: () => [
      hslToHex(90 + Math.random() * 40, 40 + Math.random() * 35, 35 + Math.random() * 20),
      hslToHex(30 + Math.random() * 20, 35 + Math.random() * 30, 30 + Math.random() * 20),
      hslToHex(70 + Math.random() * 50, 45 + Math.random() * 30, 45 + Math.random() * 20),
    ],
  },
};

// =====================================================
// COMPOSABLE
// =====================================================

export interface UseColorPalettesOptions {
  onApply?: (colors: { x: string; y: string; z: string }) => void;
}

export function useColorPalettes(options: UseColorPalettesOptions = {}) {
  /**
   * Get all available palette types
   */
  function getPaletteTypes(): PaletteType[] {
    return Object.keys(palettes) as PaletteType[];
  }

  /**
   * Get all palettes with their metadata
   */
  function getPalettes(): Record<PaletteType, Palette> {
    return palettes;
  }

  /**
   * Generate colors for a specific palette type
   */
  function generatePalette(type: PaletteType): [string, string, string] {
    return palettes[type].generate();
  }

  /**
   * Apply a palette and optionally trigger callback
   */
  function applyPalette(type: PaletteType): { x: string; y: string; z: string } {
    const [x, y, z] = palettes[type].generate();
    const colors = { x, y, z };

    if (options.onApply) {
      options.onApply(colors);
    }

    return colors;
  }

  /**
   * Randomize with completely random colors
   */
  function randomizeColors(): { x: string; y: string; z: string } {
    const colors = {
      x: randomHex(),
      y: randomHex(),
      z: randomHex(),
    };

    if (options.onApply) {
      options.onApply(colors);
    }

    return colors;
  }

  return {
    palettes,
    getPaletteTypes,
    getPalettes,
    generatePalette,
    applyPalette,
    randomizeColors,
  };
}
