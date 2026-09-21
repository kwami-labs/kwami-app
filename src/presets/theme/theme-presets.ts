import type { AccentColor, ThemePreset } from '@/stores/theme';

// ============================================================================
// Accent Color Presets
// ============================================================================

export const accentPresets: AccentColor[] = [
  // Cool tones
  { name: 'Cyan', primary: '#00d9ff', secondary: '#a855f7' },
  { name: 'Azure', primary: '#0ea5e9', secondary: '#06b6d4' },
  { name: 'Blue', primary: '#3b82f6', secondary: '#8b5cf6' },
  { name: 'Indigo', primary: '#6366f1', secondary: '#a855f7' },
  // Warm tones
  { name: 'Purple', primary: '#a855f7', secondary: '#ec4899' },
  { name: 'Violet', primary: '#8b5cf6', secondary: '#d946ef' },
  { name: 'Fuchsia', primary: '#d946ef', secondary: '#f43f5e' },
  { name: 'Pink', primary: '#ec4899', secondary: '#f43f5e' },
  { name: 'Rose', primary: '#f43f5e', secondary: '#fb7185' },
  // Earth tones
  { name: 'Red', primary: '#ef4444', secondary: '#f97316' },
  { name: 'Orange', primary: '#f97316', secondary: '#eab308' },
  { name: 'Amber', primary: '#f59e0b', secondary: '#fbbf24' },
  { name: 'Yellow', primary: '#eab308', secondary: '#84cc16' },
  // Nature tones
  { name: 'Lime', primary: '#84cc16', secondary: '#22c55e' },
  { name: 'Green', primary: '#22c55e', secondary: '#14b8a6' },
  { name: 'Teal', primary: '#14b8a6', secondary: '#06b6d4' },
  // Neutrals
  { name: 'Slate', primary: '#64748b', secondary: '#94a3b8' },
  { name: 'Zinc', primary: '#71717a', secondary: '#a1a1aa' },
];

// ============================================================================
// Theme Presets
// ============================================================================

export const themePresets: ThemePreset[] = [
  // Original presets
  {
    name: 'Minimal',
    icon: 'ph:minus-circle-duotone',
    description: 'Clean and subtle',
    settings: {
      accentPrimary: '#64748b',
      accentSecondary: '#94a3b8',
      glass: { blur: 16, opacity: 95, tint: 0, noise: 0, shadow: 20 },
      ui: {
        borderRadius: 6,
        animationSpeed: 1.2,
        surfaceContrast: 30,
        saturation: 80,
        gradientDirection: 135,
      },
      effects: { panelBorder: false, glowEffects: false, compactMode: false },
    },
  },
  {
    name: 'Vibrant',
    icon: 'ph:rainbow-duotone',
    description: 'Bold and colorful',
    settings: {
      accentPrimary: '#d946ef',
      accentSecondary: '#f43f5e',
      glass: { blur: 24, opacity: 85, tint: 30, noise: 15, shadow: 70 },
      ui: {
        borderRadius: 14,
        animationSpeed: 0.8,
        surfaceContrast: 60,
        saturation: 140,
        gradientDirection: 135,
      },
      effects: { panelBorder: true, glowEffects: true, compactMode: false },
    },
  },
  {
    name: 'Professional',
    icon: 'ph:briefcase-duotone',
    description: 'Focused and efficient',
    settings: {
      accentPrimary: '#3b82f6',
      accentSecondary: '#06b6d4',
      glass: { blur: 20, opacity: 92, tint: 5, noise: 0, shadow: 40 },
      ui: {
        borderRadius: 8,
        animationSpeed: 1,
        surfaceContrast: 45,
        saturation: 100,
        gradientDirection: 180,
      },
      effects: { panelBorder: true, glowEffects: false, compactMode: true },
    },
  },
  {
    name: 'Neon',
    icon: 'ph:lightning-duotone',
    description: 'Electric and dynamic',
    settings: {
      accentPrimary: '#00d9ff',
      accentSecondary: '#a855f7',
      glass: { blur: 32, opacity: 80, tint: 40, noise: 25, shadow: 80 },
      ui: {
        borderRadius: 16,
        animationSpeed: 0.7,
        surfaceContrast: 70,
        saturation: 160,
        gradientDirection: 45,
      },
      effects: { panelBorder: true, glowEffects: true, compactMode: false },
    },
  },
  // New presets
  {
    name: 'Midnight',
    icon: 'ph:moon-stars-duotone',
    description: 'Deep and mysterious',
    settings: {
      mode: 'dark',
      accentPrimary: '#6366f1',
      accentSecondary: '#312e81',
      glass: { blur: 28, opacity: 92, tint: 20, noise: 10, shadow: 60 },
      ui: {
        borderRadius: 12,
        animationSpeed: 1.1,
        surfaceContrast: 40,
        saturation: 90,
        gradientDirection: 225,
      },
      effects: { panelBorder: true, glowEffects: true, compactMode: false },
    },
  },
  {
    name: 'Aurora',
    icon: 'ph:sparkle-duotone',
    description: 'Northern lights magic',
    settings: {
      accentPrimary: '#22c55e',
      accentSecondary: '#06b6d4',
      glass: { blur: 30, opacity: 82, tint: 35, noise: 20, shadow: 65 },
      ui: {
        borderRadius: 14,
        animationSpeed: 0.9,
        surfaceContrast: 55,
        saturation: 130,
        gradientDirection: 120,
      },
      effects: { panelBorder: true, glowEffects: true, compactMode: false },
    },
  },
  {
    name: 'Sunset',
    icon: 'ph:sun-horizon-duotone',
    description: 'Warm golden hour',
    settings: {
      accentPrimary: '#f97316',
      accentSecondary: '#ec4899',
      glass: { blur: 22, opacity: 88, tint: 25, noise: 5, shadow: 55 },
      ui: {
        borderRadius: 10,
        animationSpeed: 1,
        surfaceContrast: 50,
        saturation: 120,
        gradientDirection: 315,
      },
      effects: { panelBorder: true, glowEffects: true, compactMode: false },
    },
  },
  {
    name: 'Ocean',
    icon: 'ph:waves-duotone',
    description: 'Deep sea tranquility',
    settings: {
      accentPrimary: '#0ea5e9',
      accentSecondary: '#14b8a6',
      glass: { blur: 26, opacity: 90, tint: 15, noise: 8, shadow: 50 },
      ui: {
        borderRadius: 12,
        animationSpeed: 1.1,
        surfaceContrast: 45,
        saturation: 110,
        gradientDirection: 180,
      },
      effects: { panelBorder: true, glowEffects: true, compactMode: false },
    },
  },
  {
    name: 'Forest',
    icon: 'ph:tree-duotone',
    description: 'Natural and earthy',
    settings: {
      accentPrimary: '#22c55e',
      accentSecondary: '#84cc16',
      glass: { blur: 20, opacity: 92, tint: 10, noise: 12, shadow: 45 },
      ui: {
        borderRadius: 8,
        animationSpeed: 1.2,
        surfaceContrast: 40,
        saturation: 95,
        gradientDirection: 90,
      },
      effects: { panelBorder: true, glowEffects: false, compactMode: false },
    },
  },
  {
    name: 'Cherry',
    icon: 'ph:flower-lotus-duotone',
    description: 'Soft and elegant',
    settings: {
      accentPrimary: '#ec4899',
      accentSecondary: '#f472b6',
      glass: { blur: 24, opacity: 88, tint: 20, noise: 5, shadow: 50 },
      ui: {
        borderRadius: 14,
        animationSpeed: 1,
        surfaceContrast: 50,
        saturation: 115,
        gradientDirection: 135,
      },
      effects: { panelBorder: true, glowEffects: true, compactMode: false },
    },
  },
  {
    name: 'Hacker',
    icon: 'ph:terminal-duotone',
    description: 'Matrix-inspired',
    settings: {
      mode: 'dark',
      accentPrimary: '#22c55e',
      accentSecondary: '#4ade80',
      glass: { blur: 12, opacity: 95, tint: 15, noise: 30, shadow: 30 },
      ui: {
        borderRadius: 4,
        animationSpeed: 0.8,
        surfaceContrast: 70,
        saturation: 100,
        gradientDirection: 180,
      },
      effects: { panelBorder: true, glowEffects: true, compactMode: true },
    },
  },
  {
    name: 'Retro',
    icon: 'ph:game-controller-duotone',
    description: 'Nostalgic vibes',
    settings: {
      accentPrimary: '#f59e0b',
      accentSecondary: '#ef4444',
      glass: { blur: 18, opacity: 90, tint: 15, noise: 20, shadow: 55 },
      ui: {
        borderRadius: 6,
        animationSpeed: 0.9,
        surfaceContrast: 60,
        saturation: 130,
        gradientDirection: 45,
      },
      effects: { panelBorder: true, glowEffects: true, compactMode: false },
    },
  },
  {
    name: 'Frost',
    icon: 'ph:snowflake-duotone',
    description: 'Cool and crisp',
    settings: {
      mode: 'light',
      accentPrimary: '#0ea5e9',
      accentSecondary: '#38bdf8',
      glass: { blur: 32, opacity: 85, tint: 10, noise: 5, shadow: 35 },
      ui: {
        borderRadius: 12,
        animationSpeed: 1.1,
        surfaceContrast: 35,
        saturation: 90,
        gradientDirection: 180,
      },
      effects: { panelBorder: false, glowEffects: true, compactMode: false },
    },
  },
  {
    name: 'Lava',
    icon: 'ph:fire-duotone',
    description: 'Hot and intense',
    settings: {
      mode: 'dark',
      accentPrimary: '#ef4444',
      accentSecondary: '#f97316',
      glass: { blur: 28, opacity: 85, tint: 40, noise: 15, shadow: 75 },
      ui: {
        borderRadius: 10,
        animationSpeed: 0.7,
        surfaceContrast: 65,
        saturation: 150,
        gradientDirection: 0,
      },
      effects: { panelBorder: true, glowEffects: true, compactMode: false },
    },
  },
  {
    name: 'Lavender',
    icon: 'ph:flower-tulip-duotone',
    description: 'Soft and calming',
    settings: {
      accentPrimary: '#a855f7',
      accentSecondary: '#c084fc',
      glass: { blur: 26, opacity: 90, tint: 15, noise: 0, shadow: 40 },
      ui: {
        borderRadius: 16,
        animationSpeed: 1.2,
        surfaceContrast: 40,
        saturation: 100,
        gradientDirection: 135,
      },
      effects: { panelBorder: true, glowEffects: true, compactMode: false },
    },
  },
  {
    name: 'Stealth',
    icon: 'ph:mask-happy-duotone',
    description: 'Dark and discrete',
    settings: {
      mode: 'dark',
      accentPrimary: '#475569',
      accentSecondary: '#64748b',
      glass: { blur: 20, opacity: 96, tint: 0, noise: 5, shadow: 25 },
      ui: {
        borderRadius: 6,
        animationSpeed: 1,
        surfaceContrast: 25,
        saturation: 70,
        gradientDirection: 180,
      },
      effects: { panelBorder: false, glowEffects: false, compactMode: true },
    },
  },
];
