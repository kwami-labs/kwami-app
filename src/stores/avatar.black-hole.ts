/**
 * Black Hole Avatar Store
 * 
 * Dedicated store for black hole renderer state with organized sections:
 * - COLOR SCHEME: Visual preset schemes (classic, fire, ice, nebula, void)
 * - CORE: Event horizon radius, glow, pulse
 * - DISK: Accretion disk configuration
 * - COLORS: Disk gradient colors
 * - STARS: Background star field
 * - ANIMATION: Rotation speeds
 * - EFFECTS: Bloom and gravitational lensing
 * - CLICK EVENTS: Click interactions
 * - CURSOR & TOUCH: Hover, drag behavior
 * - AUDIO: Audio reactivity settings
 */

import { defineStore } from 'pinia';
import { reactive } from 'vue';
import { randomHex, randomInRange } from '@/utils/color';

// =====================================================
// TYPES
// =====================================================

export type BlackHoleColorScheme = 'classic' | 'fire' | 'ice' | 'nebula' | 'void';

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

// =====================================================
// SECTION INTERFACES
// =====================================================

/** COLOR SCHEME: Visual preset */
export interface BlackHoleColorSchemeSection {
  preset: BlackHoleColorScheme;
}

/** CORE: Event horizon configuration */
export interface BlackHoleCore {
  radius: number;              // Combined radius (convenience)
  blackHoleRadius: number;     // Dark center sphere radius
  eventHorizonRadius: number;  // Glowing event horizon shell radius
  glowIntensity: number;
  pulseSpeed: number;
}

/** DISK: Accretion disk configuration */
export interface BlackHoleDisk {
  innerRadius: number;
  outerRadius: number;
  tiltAngle: number;
  flowSpeed: number;
  noiseScale: number;
  density: number;
}

/** COLORS: Disk gradient colors */
export interface BlackHoleColors {
  hot: string;
  mid1: string;
  mid2: string;
  mid3: string;
  outer: string;
}

/** STARS: Background star field */
export interface BlackHoleStars {
  count: number;
  fieldRadius: number;
  twinkleSpeed: number;
}

/** ANIMATION: Motion configuration */
export interface BlackHoleAnimation {
  autoRotate: boolean;
  autoRotateSpeed: number;
  diskRotationSpeed: number;
  starsRotationSpeed: number;
}

/** EFFECTS: Post-processing effects */
export interface BlackHoleEffects {
  bloomIntensity: number;
  bloomThreshold: number;
  bloomRadius: number;
  lensingStrength: number;
  lensingRadius: number;
  chromaticAberration: number;
}

/** CLICK EVENTS: Click interaction callbacks */
export interface BlackHoleClickEvents {
  click: {
    enabled: boolean;
    action: InteractionAction;
  };
  doubleClick: {
    enabled: boolean;
    action: InteractionAction;
  };
  rightClick: {
    enabled: boolean;
    action: InteractionAction;
  };
  doubleRightClick: {
    enabled: boolean;
    action: InteractionAction;
  };
}

/** CURSOR & TOUCH: Input behavior */
export interface BlackHoleCursorTouch {
  hover: {
    enabled: boolean;
    highlightOnHover: boolean;
    cursorStyle: CursorStyle;
  };
  drag: {
    enabled: boolean;
    sensitivity: number;
  };
}

/** AUDIO: Audio reactivity settings */
export interface BlackHoleAudio {
  enabled: boolean;
  reactivity: number;
  smoothing: number;
  frequencyEffects: {
    bassDiskGlow: number;
    midDiskSpeed: number;
    highStarTwinkle: number;
  };
}

/** ORIENTATION: Mesh position/rotation in 3D space */
export interface BlackHoleOrientation {
  x: number;
  y: number;
  z: number;
}

/** Complete black hole state */
export interface BlackHoleState {
  colorScheme: BlackHoleColorSchemeSection;
  core: BlackHoleCore;
  disk: BlackHoleDisk;
  colors: BlackHoleColors;
  stars: BlackHoleStars;
  animation: BlackHoleAnimation;
  orientation: BlackHoleOrientation;
  effects: BlackHoleEffects;
  clickEvents: BlackHoleClickEvents;
  cursorTouch: BlackHoleCursorTouch;
  audio: BlackHoleAudio;
  scale: number;
  cameraZoom: number;
}

// =====================================================
// DEFAULT VALUES
// =====================================================

export function getDefaultColorScheme(): BlackHoleColorSchemeSection {
  return {
    preset: 'classic',
  };
}

export function getDefaultCore(): BlackHoleCore {
  return {
    radius: 1.3,
    blackHoleRadius: 1.3,            // Dark center sphere
    eventHorizonRadius: 1.3 * 1.05,  // Glowing shell (slightly larger)
    glowIntensity: 1.0,
    pulseSpeed: 2.5,
  };
}

export function getDefaultDisk(): BlackHoleDisk {
  return {
    innerRadius: 0.2,
    outerRadius: 8.0,
    tiltAngle: Math.PI / 3.0,
    flowSpeed: 0.22,
    noiseScale: 2.5,
    density: 1.3,
  };
}

export function getDefaultColors(): BlackHoleColors {
  return {
    hot: '#ffffff',
    mid1: '#ff7733',
    mid2: '#ff4477',
    mid3: '#7744ff',
    outer: '#4477ff',
  };
}

export function getDefaultStars(): BlackHoleStars {
  return {
    count: 150000,
    fieldRadius: 2000,
    twinkleSpeed: 2.5,
  };
}

export function getDefaultAnimation(): BlackHoleAnimation {
  return {
    autoRotate: false,
    autoRotateSpeed: 0.1,
    diskRotationSpeed: 0.005,
    starsRotationSpeed: 0.003,
  };
}

export function getDefaultEffects(): BlackHoleEffects {
  return {
    bloomIntensity: 0.8,
    bloomThreshold: 0.8,
    bloomRadius: 0.7,
    lensingStrength: 0.12,
    lensingRadius: 0.3,
    chromaticAberration: 0.005,
  };
}

export function getDefaultClickEvents(): BlackHoleClickEvents {
  return {
    click: {
      enabled: true,
      action: 'pulse',
    },
    doubleClick: {
      enabled: true,
      action: 'toggleListening',
    },
    rightClick: {
      enabled: true,
      action: 'randomize',
    },
    doubleRightClick: {
      enabled: true,
      action: 'switchRenderer',
    },
  };
}

export function getDefaultCursorTouch(): BlackHoleCursorTouch {
  return {
    hover: {
      enabled: true,
      highlightOnHover: false,
      cursorStyle: 'pointer',
    },
    drag: {
      enabled: true,
      sensitivity: 1.0,
    },
  };
}

export function getDefaultAudio(): BlackHoleAudio {
  return {
    enabled: true,
    reactivity: 1.0,
    smoothing: 0.8,
    frequencyEffects: {
      bassDiskGlow: 0.5,
      midDiskSpeed: 0.3,
      highStarTwinkle: 0.4,
    },
  };
}

export function getDefaultOrientation(): BlackHoleOrientation {
  return {
    x: 0,
    y: 0,
    z: 0,
  };
}

export function getDefaultBlackHoleState(): BlackHoleState {
  return {
    colorScheme: getDefaultColorScheme(),
    core: getDefaultCore(),
    disk: getDefaultDisk(),
    colors: getDefaultColors(),
    stars: getDefaultStars(),
    animation: getDefaultAnimation(),
    orientation: getDefaultOrientation(),
    effects: getDefaultEffects(),
    clickEvents: getDefaultClickEvents(),
    cursorTouch: getDefaultCursorTouch(),
    audio: getDefaultAudio(),
    scale: 1.0,
    cameraZoom: 1.0,
  };
}

// =====================================================
// STORE
// =====================================================

export const useBlackHoleStore = defineStore('blackHole', () => {
  // State organized by sections
  const colorScheme = reactive<BlackHoleColorSchemeSection>(getDefaultColorScheme());
  const core = reactive<BlackHoleCore>(getDefaultCore());
  const disk = reactive<BlackHoleDisk>(getDefaultDisk());
  const colors = reactive<BlackHoleColors>(getDefaultColors());
  const stars = reactive<BlackHoleStars>(getDefaultStars());
  const animation = reactive<BlackHoleAnimation>(getDefaultAnimation());
  const orientation = reactive<BlackHoleOrientation>(getDefaultOrientation());
  const effects = reactive<BlackHoleEffects>(getDefaultEffects());
  const clickEvents = reactive<BlackHoleClickEvents>(getDefaultClickEvents());
  const cursorTouch = reactive<BlackHoleCursorTouch>(getDefaultCursorTouch());
  const audio = reactive<BlackHoleAudio>(getDefaultAudio());
  const scale = reactive({ value: 1.0 });
  const cameraZoom = reactive({ value: 1.0 });

  // =====================================================
  // SECTION RESET ACTIONS
  // =====================================================

  function resetColorScheme() {
    Object.assign(colorScheme, getDefaultColorScheme());
  }

  function resetCore() {
    Object.assign(core, getDefaultCore());
  }

  function resetDisk() {
    Object.assign(disk, getDefaultDisk());
  }

  function resetColors() {
    Object.assign(colors, getDefaultColors());
  }

  function resetStars() {
    Object.assign(stars, getDefaultStars());
  }

  function resetAnimation() {
    Object.assign(animation, getDefaultAnimation());
  }

  function resetOrientation() {
    Object.assign(orientation, getDefaultOrientation());
  }

  function resetEffects() {
    Object.assign(effects, getDefaultEffects());
  }

  function resetClickEvents() {
    Object.assign(clickEvents, getDefaultClickEvents());
  }

  function resetCursorTouch() {
    Object.assign(cursorTouch, getDefaultCursorTouch());
  }

  function resetAudio() {
    Object.assign(audio, getDefaultAudio());
  }

  function resetAll() {
    resetColorScheme();
    resetCore();
    resetDisk();
    resetColors();
    resetStars();
    resetAnimation();
    resetOrientation();
    resetEffects();
    resetClickEvents();
    resetCursorTouch();
    resetAudio();
    scale.value = 1.0;
  }

  // =====================================================
  // SECTION UPDATE ACTIONS
  // =====================================================

  function updateColorScheme(updates: Partial<BlackHoleColorSchemeSection>) {
    Object.assign(colorScheme, updates);
  }

  function updateCore(updates: Partial<BlackHoleCore>) {
    Object.assign(core, updates);
  }

  function updateDisk(updates: Partial<BlackHoleDisk>) {
    Object.assign(disk, updates);
  }

  function updateColors(updates: Partial<BlackHoleColors>) {
    Object.assign(colors, updates);
  }

  function updateStars(updates: Partial<BlackHoleStars>) {
    Object.assign(stars, updates);
  }

  function updateAnimation(updates: Partial<BlackHoleAnimation>) {
    Object.assign(animation, updates);
  }

  function updateEffects(updates: Partial<BlackHoleEffects>) {
    Object.assign(effects, updates);
  }

  function updateClickEvents(updates: Partial<BlackHoleClickEvents>) {
    Object.assign(clickEvents, updates);
  }

  function updateCursorTouch(updates: Partial<BlackHoleCursorTouch>) {
    Object.assign(cursorTouch, updates);
  }

  function updateAudio(updates: Partial<BlackHoleAudio>) {
    Object.assign(audio, updates);
  }

  // =====================================================
  // CONVENIENCE SETTERS
  // =====================================================

  function setColorSchemePreset(preset: BlackHoleColorScheme) {
    colorScheme.preset = preset;
    // Apply color scheme colors
    const colorPresets: Record<BlackHoleColorScheme, BlackHoleColors> = {
      classic: {
        hot: '#ffffff',
        mid1: '#ff7733',
        mid2: '#ff4477',
        mid3: '#7744ff',
        outer: '#4477ff',
      },
      fire: {
        hot: '#ffffff',
        mid1: '#ffcc00',
        mid2: '#ff6600',
        mid3: '#ff3300',
        outer: '#990000',
      },
      ice: {
        hot: '#ffffff',
        mid1: '#aaffff',
        mid2: '#66ccff',
        mid3: '#3399ff',
        outer: '#0066cc',
      },
      nebula: {
        hot: '#ffccff',
        mid1: '#ff66ff',
        mid2: '#cc33ff',
        mid3: '#6633cc',
        outer: '#330066',
      },
      void: {
        hot: '#666666',
        mid1: '#444444',
        mid2: '#333333',
        mid3: '#222222',
        outer: '#111111',
      },
    };
    Object.assign(colors, colorPresets[preset]);
  }

  function setScale(value: number) {
    scale.value = value;
  }

  function setFrequencyEffects(bass: number, mid: number, high: number) {
    audio.frequencyEffects.bassDiskGlow = bass;
    audio.frequencyEffects.midDiskSpeed = mid;
    audio.frequencyEffects.highStarTwinkle = high;
  }

  function setOrientation(x: number, y: number, z: number) {
    orientation.x = x;
    orientation.y = y;
    orientation.z = z;
  }

  // =====================================================
  // SYNC FROM EXTERNAL (Kwami instance)
  // =====================================================

  function syncFromKwami(blackHole: {
    getColorScheme: () => { scheme: string };
    getColors: () => { hot: string; mid1: string; mid2: string; mid3: string; outer: string };
    getScale: () => number;
    audioEffects?: {
      enabled?: boolean;
      reactivity?: number;
      smoothing?: number;
      bassDiskGlow?: number;
      midDiskSpeed?: number;
      highStarTwinkle?: number;
    };
  }) {
    // Sync color scheme
    const schemeData = blackHole.getColorScheme();
    colorScheme.preset = schemeData.scheme as BlackHoleColorScheme;
    
    // Sync colors
    const bhColors = blackHole.getColors();
    colors.hot = bhColors.hot;
    colors.mid1 = bhColors.mid1;
    colors.mid2 = bhColors.mid2;
    colors.mid3 = bhColors.mid3;
    colors.outer = bhColors.outer;
    
    // Sync scale
    scale.value = blackHole.getScale();

    // Sync audio
    if (blackHole.audioEffects) {
      audio.enabled = blackHole.audioEffects.enabled ?? audio.enabled;
      audio.reactivity = blackHole.audioEffects.reactivity ?? audio.reactivity;
      audio.smoothing = blackHole.audioEffects.smoothing ?? audio.smoothing;
      audio.frequencyEffects.bassDiskGlow = blackHole.audioEffects.bassDiskGlow ?? audio.frequencyEffects.bassDiskGlow;
      audio.frequencyEffects.midDiskSpeed = blackHole.audioEffects.midDiskSpeed ?? audio.frequencyEffects.midDiskSpeed;
      audio.frequencyEffects.highStarTwinkle = blackHole.audioEffects.highStarTwinkle ?? audio.frequencyEffects.highStarTwinkle;
    }
  }

  // =====================================================
  // EXPORT STATE (for presets)
  // =====================================================

  function exportState(): BlackHoleState {
    return {
      colorScheme: { ...colorScheme },
      core: { ...core },
      disk: { ...disk },
      colors: { ...colors },
      stars: { ...stars },
      animation: { ...animation },
      orientation: { ...orientation },
      effects: { ...effects },
      clickEvents: { ...clickEvents },
      cursorTouch: { ...cursorTouch },
      audio: { ...audio, frequencyEffects: { ...audio.frequencyEffects } },
      scale: scale.value,
      cameraZoom: cameraZoom.value,
    };
  }

  /**
   * Deep merge helper that preserves reactive references
   */
  function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): void {
    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
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
          // Recursively merge nested objects
          deepMerge(targetValue as Record<string, unknown>, sourceValue as Record<string, unknown>);
        } else if (sourceValue !== undefined) {
          // Assign primitive values or replace arrays
          (target as Record<string, unknown>)[key] = sourceValue;
        }
      }
    }
  }

  function importState(state: Partial<BlackHoleState>) {
    if (state.colorScheme) deepMerge(colorScheme, state.colorScheme);
    if (state.core) deepMerge(core, state.core);
    if (state.disk) deepMerge(disk, state.disk);
    if (state.colors) deepMerge(colors, state.colors);
    if (state.stars) deepMerge(stars, state.stars);
    if (state.animation) deepMerge(animation, state.animation);
    if (state.orientation) deepMerge(orientation, state.orientation);
    if (state.effects) deepMerge(effects, state.effects);
    if (state.clickEvents) deepMerge(clickEvents, state.clickEvents);
    if (state.cursorTouch) deepMerge(cursorTouch, state.cursorTouch);
    if (state.audio) deepMerge(audio, state.audio);
    if (state.scale !== undefined) scale.value = state.scale;
    if (state.cameraZoom !== undefined) cameraZoom.value = state.cameraZoom;
  }

  const INTERACTION_ACTIONS: InteractionAction[] = [
    'none',
    'toggleListening',
    'startListening',
    'stopListening',
    'randomize',
    'switchRenderer',
    'cycleState',
    'pulse',
    'moveToClick',
  ];

  const CURSOR_STYLES: CursorStyle[] = ['pointer', 'grab', 'crosshair', 'default'];

  function pickAction(): InteractionAction {
    return INTERACTION_ACTIONS[Math.floor(Math.random() * INTERACTION_ACTIONS.length)]!;
  }

  function pickCursor(): CursorStyle {
    return CURSOR_STYLES[Math.floor(Math.random() * CURSOR_STYLES.length)]!;
  }

  function randomizeAll() {
    const schemes: BlackHoleColorScheme[] = ['classic', 'fire', 'ice', 'nebula', 'void'];
    setColorSchemePreset(schemes[Math.floor(Math.random() * schemes.length)]!);

    colors.hot = randomHex();
    colors.mid1 = randomHex();
    colors.mid2 = randomHex();
    colors.mid3 = randomHex();
    colors.outer = randomHex();

    const bhRadius = randomInRange(0.5, 3, 0.1);
    core.blackHoleRadius = bhRadius;
    core.eventHorizonRadius = bhRadius * randomInRange(1.02, 1.15, 0.01);
    core.radius = bhRadius;
    core.glowIntensity = randomInRange(0.2, 2, 0.1);
    core.pulseSpeed = randomInRange(0.5, 5, 0.5);

    disk.innerRadius = randomInRange(0, 1, 0.05);
    disk.outerRadius = randomInRange(4, 15, 0.5);
    disk.flowSpeed = randomInRange(0.05, 0.5, 0.01);
    disk.noiseScale = randomInRange(1, 5, 0.5);
    disk.density = randomInRange(0.5, 2, 0.1);
    disk.tiltAngle = randomInRange(0.5, 1.57, 0.1);

    stars.count = Math.floor(randomInRange(10000, 200000, 1000));
    stars.fieldRadius = randomInRange(500, 3000, 50);
    stars.twinkleSpeed = randomInRange(0.5, 5, 0.1);

    effects.bloomIntensity = randomInRange(0, 2, 0.1);
    effects.bloomThreshold = randomInRange(0.5, 1, 0.05);
    effects.bloomRadius = randomInRange(0, 1.5, 0.1);
    effects.lensingStrength = randomInRange(0, 0.3, 0.01);
    effects.lensingRadius = randomInRange(0.1, 0.5, 0.02);
    effects.chromaticAberration = randomInRange(0, 0.02, 0.001);

    animation.autoRotate = Math.random() > 0.5;
    animation.autoRotateSpeed = randomInRange(0.01, 0.3, 0.01);
    animation.diskRotationSpeed = randomInRange(0, 0.02, 0.001);
    animation.starsRotationSpeed = randomInRange(0, 0.01, 0.0005);

    orientation.x = randomInRange(0, 360, 1);
    orientation.y = randomInRange(0, 360, 1);
    orientation.z = randomInRange(0, 360, 1);

    scale.value = randomInRange(0.5, 2, 0.1);
    cameraZoom.value = randomInRange(0.5, 3, 0.1);

    clickEvents.click = { enabled: Math.random() > 0.2, action: pickAction() };
    clickEvents.doubleClick = { enabled: Math.random() > 0.2, action: pickAction() };
    clickEvents.rightClick = { enabled: Math.random() > 0.2, action: pickAction() };
    clickEvents.doubleRightClick = { enabled: Math.random() > 0.2, action: pickAction() };

    cursorTouch.hover = {
      enabled: Math.random() > 0.15,
      highlightOnHover: Math.random() > 0.5,
      cursorStyle: pickCursor(),
    };
    cursorTouch.drag = {
      enabled: Math.random() > 0.15,
      sensitivity: randomInRange(0.1, 3, 0.1),
    };

    audio.enabled = Math.random() > 0.1;
    audio.reactivity = randomInRange(0, 2, 0.1);
    audio.smoothing = randomInRange(0.5, 0.99, 0.01);
    audio.frequencyEffects.bassDiskGlow = randomInRange(0, 1, 0.05);
    audio.frequencyEffects.midDiskSpeed = randomInRange(0, 1, 0.05);
    audio.frequencyEffects.highStarTwinkle = randomInRange(0, 1, 0.05);
  }

  return {
    // State sections
    colorScheme,
    core,
    disk,
    colors,
    stars,
    animation,
    orientation,
    effects,
    clickEvents,
    cursorTouch,
    audio,
    scale,
    cameraZoom,

    // Reset actions
    resetColorScheme,
    resetCore,
    resetDisk,
    resetColors,
    resetStars,
    resetAnimation,
    resetOrientation,
    resetEffects,
    resetClickEvents,
    resetCursorTouch,
    resetAudio,
    resetAll,

    // Update actions
    updateColorScheme,
    updateCore,
    updateDisk,
    updateColors,
    updateStars,
    updateAnimation,
    updateEffects,
    updateClickEvents,
    updateCursorTouch,
    updateAudio,

    // Convenience setters
    setColorSchemePreset,
    setScale,
    setOrientation,
    setFrequencyEffects,

    // Sync
    syncFromKwami,

    // Import/Export
    exportState,
    importState,

    randomizeAll,
  };
});
