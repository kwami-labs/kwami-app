import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { hexToRgb, adjustBrightness, debounce } from '@/utils/color';

// ============================================================================
// Types & Interfaces
// ============================================================================

export type ThemeMode = 'dark' | 'light' | 'system' | 'auto';
export type SidebarPosition = 'left' | 'right';

export interface AccentColor {
  name: string;
  primary: string;
  secondary: string;
}

export interface GlassSettings {
  blur: number;
  opacity: number;
  tint: number;
  noise: number;
  shadow: number;
}

export interface UISettings {
  borderRadius: number;
  animationSpeed: number;
  surfaceContrast: number;
  saturation: number;
  gradientDirection: number;
}

export interface AccessibilitySettings {
  highContrast: boolean;
  focusIndicators: boolean;
}

export interface FlashlightSettings {
  enabled: boolean;
  size: number;
  intensity: number;
  color: string;
}

export interface EffectSettings {
  panelBorder: boolean;
  glowEffects: boolean;
  compactMode: boolean;
}

export interface ThemeSettings {
  mode: ThemeMode;
  autoStartTime: string;
  autoEndTime: string;
  accentPrimary: string;
  accentSecondary: string;
  sidebarPosition: SidebarPosition;
  glass: GlassSettings;
  ui: UISettings;
  accessibility: AccessibilitySettings;
  flashlight: FlashlightSettings;
  effects: EffectSettings;
}

export interface ThemePreset {
  name: string;
  icon: string;
  description: string;
  settings: Partial<ThemeSettings>;
}

// Re-export presets from dedicated file
export { accentPresets, themePresets } from '@/presets/theme/theme-presets';

// ============================================================================
// Default Values
// ============================================================================

const defaultSettings: ThemeSettings = {
  mode: 'dark',
  autoStartTime: '06:00',
  autoEndTime: '18:00',
  accentPrimary: '#00d9ff',
  accentSecondary: '#a855f7',
  sidebarPosition: 'left',
  glass: { blur: 24, opacity: 88, tint: 0, noise: 0, shadow: 50 },
  ui: { borderRadius: 10, animationSpeed: 1, surfaceContrast: 50, saturation: 100, gradientDirection: 135 },
  accessibility: { highContrast: false, focusIndicators: true },
  flashlight: { enabled: false, size: 200, intensity: 30, color: '#ffffff' },
  effects: { panelBorder: true, glowEffects: true, compactMode: false },
};

// ============================================================================
// Store
// ============================================================================

const MAX_HISTORY = 50;

export const useThemeStore = defineStore('theme', () => {
  // State - Grouped settings
  const mode = ref<ThemeMode>(defaultSettings.mode);
  const autoStartTime = ref(defaultSettings.autoStartTime);
  const autoEndTime = ref(defaultSettings.autoEndTime);
  const accentPrimary = ref(defaultSettings.accentPrimary);
  const accentSecondary = ref(defaultSettings.accentSecondary);
  const sidebarPosition = ref<SidebarPosition>(defaultSettings.sidebarPosition);

  // Glass settings
  const glassBlur = ref(defaultSettings.glass.blur);
  const glassOpacity = ref(defaultSettings.glass.opacity);
  const glassTint = ref(defaultSettings.glass.tint);
  const noiseTexture = ref(defaultSettings.glass.noise);
  const shadowIntensity = ref(defaultSettings.glass.shadow);

  // UI settings
  const borderRadius = ref(defaultSettings.ui.borderRadius);
  const animationSpeed = ref(defaultSettings.ui.animationSpeed);
  const surfaceContrast = ref(defaultSettings.ui.surfaceContrast);
  const saturation = ref(defaultSettings.ui.saturation);
  const gradientDirection = ref(defaultSettings.ui.gradientDirection);

  // Effect settings
  const panelBorder = ref(defaultSettings.effects.panelBorder);
  const glowEffects = ref(defaultSettings.effects.glowEffects);
  const compactMode = ref(defaultSettings.effects.compactMode);

  // Accessibility
  const highContrast = ref(defaultSettings.accessibility.highContrast);
  const focusIndicators = ref(defaultSettings.accessibility.focusIndicators);

  // Flashlight
  const cursorFlashlight = ref(defaultSettings.flashlight.enabled);
  const flashlightSize = ref(defaultSettings.flashlight.size);
  const flashlightIntensity = ref(defaultSettings.flashlight.intensity);
  const flashlightColor = ref(defaultSettings.flashlight.color);

  // Undo/Redo history
  const history = ref<ThemeSettings[]>([]);
  const historyIndex = ref(-1);
  const isUndoRedoAction = ref(false);

  // Computed
  const canUndo = computed(() => historyIndex.value > 0);
  const canRedo = computed(() => historyIndex.value < history.value.length - 1);

  // ============================================================================
  // Snapshot & History
  // ============================================================================

  function getCurrentSnapshot(): ThemeSettings {
    return {
      mode: mode.value,
      autoStartTime: autoStartTime.value,
      autoEndTime: autoEndTime.value,
      accentPrimary: accentPrimary.value,
      accentSecondary: accentSecondary.value,
      sidebarPosition: sidebarPosition.value,
      glass: {
        blur: glassBlur.value,
        opacity: glassOpacity.value,
        tint: glassTint.value,
        noise: noiseTexture.value,
        shadow: shadowIntensity.value,
      },
      ui: {
        borderRadius: borderRadius.value,
        animationSpeed: animationSpeed.value,
        surfaceContrast: surfaceContrast.value,
        saturation: saturation.value,
        gradientDirection: gradientDirection.value,
      },
      accessibility: {
        highContrast: highContrast.value,
        focusIndicators: focusIndicators.value,
      },
      flashlight: {
        enabled: cursorFlashlight.value,
        size: flashlightSize.value,
        intensity: flashlightIntensity.value,
        color: flashlightColor.value,
      },
      effects: {
        panelBorder: panelBorder.value,
        glowEffects: glowEffects.value,
        compactMode: compactMode.value,
      },
    };
  }

  function applySnapshot(snapshot: Partial<ThemeSettings>) {
    if (snapshot.mode != null) mode.value = snapshot.mode;
    if (snapshot.autoStartTime != null) autoStartTime.value = snapshot.autoStartTime;
    if (snapshot.autoEndTime != null) autoEndTime.value = snapshot.autoEndTime;
    if (snapshot.accentPrimary != null) accentPrimary.value = snapshot.accentPrimary;
    if (snapshot.accentSecondary != null) accentSecondary.value = snapshot.accentSecondary;
    if (snapshot.sidebarPosition != null) sidebarPosition.value = snapshot.sidebarPosition;

    if (snapshot.glass) {
      if (snapshot.glass.blur != null) glassBlur.value = snapshot.glass.blur;
      if (snapshot.glass.opacity != null) glassOpacity.value = snapshot.glass.opacity;
      if (snapshot.glass.tint != null) glassTint.value = snapshot.glass.tint;
      if (snapshot.glass.noise != null) noiseTexture.value = snapshot.glass.noise;
      if (snapshot.glass.shadow != null) shadowIntensity.value = snapshot.glass.shadow;
    }

    if (snapshot.ui) {
      if (snapshot.ui.borderRadius != null) borderRadius.value = snapshot.ui.borderRadius;
      if (snapshot.ui.animationSpeed != null) animationSpeed.value = snapshot.ui.animationSpeed;
      if (snapshot.ui.surfaceContrast != null) surfaceContrast.value = snapshot.ui.surfaceContrast;
      if (snapshot.ui.saturation != null) saturation.value = snapshot.ui.saturation;
      if (snapshot.ui.gradientDirection != null) gradientDirection.value = snapshot.ui.gradientDirection;
    }

    if (snapshot.effects) {
      if (snapshot.effects.panelBorder != null) panelBorder.value = snapshot.effects.panelBorder;
      if (snapshot.effects.glowEffects != null) glowEffects.value = snapshot.effects.glowEffects;
      if (snapshot.effects.compactMode != null) compactMode.value = snapshot.effects.compactMode;
    }

    if (snapshot.accessibility) {
      if (snapshot.accessibility.highContrast != null) highContrast.value = snapshot.accessibility.highContrast;
      if (snapshot.accessibility.focusIndicators != null) focusIndicators.value = snapshot.accessibility.focusIndicators;
    }

    if (snapshot.flashlight) {
      if (snapshot.flashlight.enabled != null) cursorFlashlight.value = snapshot.flashlight.enabled;
      if (snapshot.flashlight.size != null) flashlightSize.value = snapshot.flashlight.size;
      if (snapshot.flashlight.intensity != null) flashlightIntensity.value = snapshot.flashlight.intensity;
      if (snapshot.flashlight.color != null) flashlightColor.value = snapshot.flashlight.color;
    }
  }

  function pushToHistory() {
    if (isUndoRedoAction.value) return;

    // Trim future history if we're not at the end
    if (historyIndex.value < history.value.length - 1) {
      history.value = history.value.slice(0, historyIndex.value + 1);
    }

    // Add current state
    history.value.push(getCurrentSnapshot());

    // Limit history size
    if (history.value.length > MAX_HISTORY) {
      history.value.shift();
    }

    historyIndex.value = history.value.length - 1;
  }

  // Debounced version for slider updates
  const pushToHistoryDebounced = debounce(pushToHistory, 500);

  function undo() {
    if (!canUndo.value) return;
    isUndoRedoAction.value = true;
    historyIndex.value--;
    applySnapshot(history.value[historyIndex.value]!);
    applyTheme();
    isUndoRedoAction.value = false;
  }

  function redo() {
    if (!canRedo.value) return;
    isUndoRedoAction.value = true;
    historyIndex.value++;
    applySnapshot(history.value[historyIndex.value]!);
    applyTheme();
    isUndoRedoAction.value = false;
  }

  // ============================================================================
  // Export / Import
  // ============================================================================

  function exportTheme(): string {
    return JSON.stringify(getCurrentSnapshot(), null, 2);
  }

  function importTheme(json: string): boolean {
    try {
      const parsed = JSON.parse(json) as ThemeSettings;
      // Validate required fields
      if (!parsed.mode || !parsed.glass || !parsed.ui) {
        console.warn('Invalid theme format');
        return false;
      }
      pushToHistory();
      applySnapshot(parsed);
      applyTheme();
      setupFlashlight();
      return true;
    } catch (e) {
      console.error('Failed to import theme:', e);
      return false;
    }
  }

  // ============================================================================
  // Load / Save
  // ============================================================================

  function loadSettings() {
    const saved = localStorage.getItem('kwami-theme');
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        // Legacy flat format
        mode.value = settings.mode || 'dark';
        autoStartTime.value = settings.autoStartTime || '06:00';
        autoEndTime.value = settings.autoEndTime || '18:00';
        accentPrimary.value = settings.accentPrimary || '#00d9ff';
        accentSecondary.value = settings.accentSecondary || '#a855f7';
        sidebarPosition.value = settings.sidebarPosition || 'left';

        // Support both old flat and new grouped format
        glassBlur.value = settings.glass?.blur ?? settings.glassBlur ?? 24;
        glassOpacity.value = settings.glass?.opacity ?? settings.glassOpacity ?? 88;
        glassTint.value = settings.glass?.tint ?? settings.glassTint ?? 0;
        noiseTexture.value = settings.glass?.noise ?? settings.noiseTexture ?? 0;
        shadowIntensity.value = settings.glass?.shadow ?? settings.shadowIntensity ?? 50;

        borderRadius.value = settings.ui?.borderRadius ?? settings.borderRadius ?? 10;
        animationSpeed.value = settings.ui?.animationSpeed ?? settings.animationSpeed ?? 1;
        surfaceContrast.value = settings.ui?.surfaceContrast ?? settings.surfaceContrast ?? 50;
        saturation.value = settings.ui?.saturation ?? settings.saturation ?? 100;
        gradientDirection.value = settings.ui?.gradientDirection ?? settings.gradientDirection ?? 135;

        panelBorder.value = settings.effects?.panelBorder ?? settings.panelBorder ?? true;
        glowEffects.value = settings.effects?.glowEffects ?? settings.glowEffects ?? true;
        compactMode.value = settings.effects?.compactMode ?? settings.compactMode ?? false;

        highContrast.value = settings.accessibility?.highContrast ?? settings.highContrast ?? false;
        focusIndicators.value = settings.accessibility?.focusIndicators ?? settings.focusIndicators ?? true;

        cursorFlashlight.value = settings.flashlight?.enabled ?? settings.cursorFlashlight ?? false;
        flashlightSize.value = settings.flashlight?.size ?? settings.flashlightSize ?? 200;
        flashlightIntensity.value = settings.flashlight?.intensity ?? settings.flashlightIntensity ?? 30;
        flashlightColor.value = settings.flashlight?.color ?? settings.flashlightColor ?? '#ffffff';
      } catch (e) {
        console.warn('Failed to load theme settings:', e);
      }
    }
    applyTheme();
    setupFlashlight();

    // Initialize history with current state
    history.value = [getCurrentSnapshot()];
    historyIndex.value = 0;
  }

  function saveSettings() {
    localStorage.setItem('kwami-theme', JSON.stringify(getCurrentSnapshot()));
  }

  // ============================================================================
  // Apply Theme to DOM
  // ============================================================================

  function applyTheme() {
    const root = document.documentElement;

    // Apply saturation filter
    root.style.setProperty('--saturation', `${saturation.value}%`);

    // Apply accent colors
    root.style.setProperty('--accent-primary', accentPrimary.value);
    root.style.setProperty('--accent-secondary', accentSecondary.value);
    root.style.setProperty('--accent-glow', glowEffects.value ? `${accentPrimary.value}26` : 'transparent');
    root.style.setProperty('--accent-hover', adjustBrightness(accentPrimary.value, 20));

    // Gradient direction
    root.style.setProperty('--gradient-direction', `${gradientDirection.value}deg`);

    // Apply glass settings
    root.style.setProperty('--glass-blur', `${glassBlur.value}px`);

    // Noise texture
    root.style.setProperty('--noise-opacity', `${noiseTexture.value / 100}`);

    // Shadow intensity
    const shadowBase = shadowIntensity.value / 100;
    root.style.setProperty('--shadow-intensity', `${shadowBase}`);

    // Apply UI settings
    root.style.setProperty('--radius-sm', `${Math.max(2, borderRadius.value - 4)}px`);
    root.style.setProperty('--radius-md', `${borderRadius.value}px`);
    root.style.setProperty('--radius-lg', `${borderRadius.value + 4}px`);
    root.style.setProperty('--radius-xl', `${borderRadius.value + 10}px`);

    root.style.setProperty('--duration-fast', `${0.15 * animationSpeed.value}s`);
    root.style.setProperty('--duration-normal', `${0.25 * animationSpeed.value}s`);
    root.style.setProperty('--duration-slow', `${0.4 * animationSpeed.value}s`);

    root.style.setProperty('--glass-border', panelBorder.value ? 'rgba(255, 255, 255, 0.06)' : 'transparent');

    // Compact mode
    if (compactMode.value) {
      document.body.classList.add('compact-mode');
    } else {
      document.body.classList.remove('compact-mode');
    }

    // High contrast mode
    if (highContrast.value) {
      document.body.classList.add('high-contrast');
    } else {
      document.body.classList.remove('high-contrast');
    }

    // Focus indicators
    if (focusIndicators.value) {
      document.body.classList.add('focus-visible');
    } else {
      document.body.classList.remove('focus-visible');
    }

    // Sidebar position
    if (sidebarPosition.value === 'right') {
      document.body.classList.add('sidebar-right');
    } else {
      document.body.classList.remove('sidebar-right');
    }

    // Surface contrast
    const contrast = surfaceContrast.value / 100;

    // Apply glow effects with shadow intensity
    const shadowMult = shadowIntensity.value / 50;
    if (glowEffects.value) {
      root.style.setProperty('--glass-shadow', `0 ${8 * shadowMult}px ${32 * shadowMult}px rgba(0, 0, 0, ${0.5 * shadowMult}), 0 0 0 1px rgba(255, 255, 255, 0.03) inset`);
    } else {
      root.style.setProperty('--glass-shadow', `0 ${4 * shadowMult}px ${16 * shadowMult}px rgba(0, 0, 0, ${0.3 * shadowMult})`);
    }

    // Apply theme mode
    let effectiveMode = mode.value as string;

    if (mode.value === 'system') {
      effectiveMode = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    } else if (mode.value === 'auto') {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const [startHour = 0, startMinute = 0] = autoStartTime.value.split(':').map(Number);
      const startMinutes = startHour * 60 + startMinute;

      const [endHour = 0, endMinute = 0] = autoEndTime.value.split(':').map(Number);
      const endMinutes = endHour * 60 + endMinute;

      let isLight = false;
      if (endMinutes > startMinutes) {
        isLight = currentMinutes >= startMinutes && currentMinutes < endMinutes;
      } else {
        isLight = currentMinutes >= startMinutes || currentMinutes < endMinutes;
      }

      effectiveMode = isLight ? 'light' : 'dark';
    }

    root.setAttribute('data-theme', effectiveMode);

    // Glass tint calculation
    const tintAmount = glassTint.value / 100;
    const accentRgb = hexToRgb(accentPrimary.value);

    if (effectiveMode === 'light') {
      const baseBg = `rgba(255, 255, 255, ${glassOpacity.value / 100})`;
      const tintedBg = tintAmount > 0 && accentRgb
        ? `rgba(${Math.round(255 * (1 - tintAmount * 0.1) + accentRgb.r * tintAmount * 0.1)}, ${Math.round(255 * (1 - tintAmount * 0.1) + accentRgb.g * tintAmount * 0.1)}, ${Math.round(255 * (1 - tintAmount * 0.1) + accentRgb.b * tintAmount * 0.1)}, ${glassOpacity.value / 100})`
        : baseBg;
      root.style.setProperty('--glass-bg', tintedBg);
      root.style.setProperty('--glass-border', panelBorder.value ? 'rgba(0, 0, 0, 0.08)' : 'transparent');
      root.style.setProperty('--glass-highlight', 'rgba(0, 0, 0, 0.02)');

      // High contrast adjustments
      if (highContrast.value) {
        root.style.setProperty('--text-primary', '#000000');
        root.style.setProperty('--text-secondary', '#1a1a1a');
        root.style.setProperty('--text-muted', '#404040');
      } else {
        root.style.setProperty('--text-primary', '#1a1a2e');
        root.style.setProperty('--text-secondary', '#4a4a6a');
        root.style.setProperty('--text-muted', '#8a8aa0');
      }

      root.style.setProperty('--surface-1', `rgba(0, 0, 0, ${0.03 * contrast * 2})`);
      root.style.setProperty('--surface-2', `rgba(0, 0, 0, ${0.05 * contrast * 2})`);
      root.style.setProperty('--surface-3', `rgba(0, 0, 0, ${0.08 * contrast * 2})`);
      root.style.setProperty('--surface-4', `rgba(0, 0, 0, ${0.12 * contrast * 2})`);

      if (glowEffects.value) {
        root.style.setProperty('--glass-shadow', `0 ${8 * shadowMult}px ${32 * shadowMult}px rgba(0, 0, 0, ${0.1 * shadowMult}), 0 0 0 1px rgba(0, 0, 0, 0.03) inset`);
      } else {
        root.style.setProperty('--glass-shadow', `0 ${4 * shadowMult}px ${16 * shadowMult}px rgba(0, 0, 0, ${0.08 * shadowMult})`);
      }
    } else {
      const baseBg = `rgba(8, 10, 18, ${glassOpacity.value / 100})`;
      const tintedBg = tintAmount > 0 && accentRgb
        ? `rgba(${Math.round(8 * (1 - tintAmount * 0.15) + accentRgb.r * tintAmount * 0.15)}, ${Math.round(10 * (1 - tintAmount * 0.15) + accentRgb.g * tintAmount * 0.15)}, ${Math.round(18 * (1 - tintAmount * 0.15) + accentRgb.b * tintAmount * 0.15)}, ${glassOpacity.value / 100})`
        : baseBg;
      root.style.setProperty('--glass-bg', tintedBg);
      root.style.setProperty('--glass-border', panelBorder.value ? 'rgba(255, 255, 255, 0.06)' : 'transparent');
      root.style.setProperty('--glass-highlight', 'rgba(255, 255, 255, 0.03)');

      // High contrast adjustments
      if (highContrast.value) {
        root.style.setProperty('--text-primary', '#ffffff');
        root.style.setProperty('--text-secondary', '#e0e0e0');
        root.style.setProperty('--text-muted', '#b0b0b0');
      } else {
        root.style.setProperty('--text-primary', '#f4f5f9');
        root.style.setProperty('--text-secondary', '#a0a4b8');
        root.style.setProperty('--text-muted', '#5c6178');
      }

      root.style.setProperty('--surface-1', `rgba(255, 255, 255, ${0.025 * contrast * 2})`);
      root.style.setProperty('--surface-2', `rgba(255, 255, 255, ${0.05 * contrast * 2})`);
      root.style.setProperty('--surface-3', `rgba(255, 255, 255, ${0.08 * contrast * 2})`);
      root.style.setProperty('--surface-4', `rgba(255, 255, 255, ${0.12 * contrast * 2})`);
    }

    // Flashlight settings
    root.style.setProperty('--flashlight-size', `${flashlightSize.value}px`);
    root.style.setProperty('--flashlight-intensity', `${flashlightIntensity.value / 100}`);
    root.style.setProperty('--flashlight-color', flashlightColor.value);

    saveSettings();
  }

  // Debounced version for slider updates
  const applyThemeDebounced = debounce(() => {
    applyTheme();
    pushToHistoryDebounced();
  }, 50);

  // ============================================================================
  // Flashlight
  // ============================================================================

  let flashlightElement: HTMLDivElement | null = null;

  function setupFlashlight() {
    if (typeof window === 'undefined') return;

    // Remove existing flashlight
    if (flashlightElement) {
      flashlightElement.remove();
      flashlightElement = null;
    }

    if (!cursorFlashlight.value) return;

    // Create flashlight element
    flashlightElement = document.createElement('div');
    flashlightElement.id = 'cursor-flashlight';
    flashlightElement.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 9999;
      width: var(--flashlight-size);
      height: var(--flashlight-size);
      border-radius: 50%;
      background: radial-gradient(circle, var(--flashlight-color) 0%, transparent 70%);
      opacity: var(--flashlight-intensity);
      transform: translate(-50%, -50%);
      mix-blend-mode: soft-light;
      transition: opacity 0.15s ease;
    `;
    document.body.appendChild(flashlightElement);

    document.addEventListener('mousemove', updateFlashlightPosition);
    document.addEventListener('mouseleave', hideFlashlight);
    document.addEventListener('mouseenter', showFlashlight);
  }

  function updateFlashlightPosition(e: MouseEvent) {
    if (flashlightElement) {
      flashlightElement.style.left = `${e.clientX}px`;
      flashlightElement.style.top = `${e.clientY}px`;
    }
  }

  function hideFlashlight() {
    if (flashlightElement) {
      flashlightElement.style.opacity = '0';
    }
  }

  function showFlashlight() {
    if (flashlightElement) {
      flashlightElement.style.opacity = `var(--flashlight-intensity)`;
    }
  }

  // ============================================================================
  // Generic Setter
  // ============================================================================

  type SettingKey = 'mode' | 'autoStartTime' | 'autoEndTime' | 'accentPrimary' | 'accentSecondary'
    | 'sidebarPosition' | 'glassBlur' | 'glassOpacity' | 'glassTint' | 'noiseTexture' | 'shadowIntensity'
    | 'borderRadius' | 'animationSpeed' | 'surfaceContrast' | 'saturation' | 'gradientDirection'
    | 'panelBorder' | 'glowEffects' | 'compactMode' | 'highContrast' | 'focusIndicators'
    | 'cursorFlashlight' | 'flashlightSize' | 'flashlightIntensity' | 'flashlightColor';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const settingRefs: Record<SettingKey, { value: any }> = {
    mode, autoStartTime, autoEndTime, accentPrimary, accentSecondary, sidebarPosition,
    glassBlur, glassOpacity, glassTint, noiseTexture, shadowIntensity,
    borderRadius, animationSpeed, surfaceContrast, saturation, gradientDirection,
    panelBorder, glowEffects, compactMode, highContrast, focusIndicators,
    cursorFlashlight, flashlightSize, flashlightIntensity, flashlightColor,
  };

  function setSetting(
    key: SettingKey,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any,
    options: { debounce?: boolean; pushHistory?: boolean } = {}
  ) {
    const { debounce: useDebounce = false, pushHistory = true } = options;
    settingRefs[key].value = value;

    if (useDebounce) {
      applyThemeDebounced();
    } else {
      applyTheme();
      if (pushHistory) pushToHistory();
    }
  }


  // ============================================================================
  // Individual Setters (for backwards compatibility)
  // ============================================================================

  function setMode(newMode: ThemeMode) {
    setSetting('mode', newMode);
  }

  function setAutoStartTime(time: string) {
    setSetting('autoStartTime', time);
  }

  function setAutoEndTime(time: string) {
    setSetting('autoEndTime', time);
  }

  function setAccent(primary: string, secondary: string) {
    accentPrimary.value = primary;
    accentSecondary.value = secondary;
    applyTheme();
    pushToHistory();
  }

  function setAccentPrimary(color: string) {
    setSetting('accentPrimary', color);
  }

  function setAccentSecondary(color: string) {
    setSetting('accentSecondary', color);
  }

  function setAccentPreset(preset: AccentColor) {
    setAccent(preset.primary, preset.secondary);
  }

  function applyPreset(preset: ThemePreset) {
    pushToHistory();
    const s = preset.settings;
    if (s.accentPrimary) accentPrimary.value = s.accentPrimary;
    if (s.accentSecondary) accentSecondary.value = s.accentSecondary;
    if (s.mode) mode.value = s.mode;
    if (s.sidebarPosition) sidebarPosition.value = s.sidebarPosition;

    if (s.glass) {
      glassBlur.value = s.glass.blur;
      glassOpacity.value = s.glass.opacity;
      glassTint.value = s.glass.tint;
      noiseTexture.value = s.glass.noise;
      shadowIntensity.value = s.glass.shadow;
    }

    if (s.ui) {
      borderRadius.value = s.ui.borderRadius;
      animationSpeed.value = s.ui.animationSpeed;
      surfaceContrast.value = s.ui.surfaceContrast;
      saturation.value = s.ui.saturation;
      gradientDirection.value = s.ui.gradientDirection;
    }

    if (s.effects) {
      panelBorder.value = s.effects.panelBorder;
      glowEffects.value = s.effects.glowEffects;
      compactMode.value = s.effects.compactMode;
    }

    if (s.accessibility) {
      highContrast.value = s.accessibility.highContrast;
      focusIndicators.value = s.accessibility.focusIndicators;
    }

    if (s.flashlight) {
      cursorFlashlight.value = s.flashlight.enabled;
      flashlightSize.value = s.flashlight.size;
      flashlightIntensity.value = s.flashlight.intensity;
      flashlightColor.value = s.flashlight.color;
    }

    applyTheme();
    setupFlashlight();
  }

  // Debounced setters for sliders
  function setGlassBlur(value: number) {
    setSetting('glassBlur', value, { debounce: true });
  }

  function setGlassOpacity(value: number) {
    setSetting('glassOpacity', value, { debounce: true });
  }

  function setGlassTint(value: number) {
    setSetting('glassTint', value, { debounce: true });
  }

  function setNoiseTexture(value: number) {
    setSetting('noiseTexture', value, { debounce: true });
  }

  function setShadowIntensity(value: number) {
    setSetting('shadowIntensity', value, { debounce: true });
  }

  function setBorderRadius(value: number) {
    setSetting('borderRadius', value, { debounce: true });
  }

  function setAnimationSpeed(value: number) {
    setSetting('animationSpeed', value, { debounce: true });
  }

  function setSurfaceContrast(value: number) {
    setSetting('surfaceContrast', value, { debounce: true });
  }

  function setSaturation(value: number) {
    setSetting('saturation', value, { debounce: true });
  }

  function setGradientDirection(value: number) {
    setSetting('gradientDirection', value, { debounce: true });
  }

  function setCompactMode(value: boolean) {
    setSetting('compactMode', value);
  }

  function setPanelBorder(value: boolean) {
    setSetting('panelBorder', value);
  }

  function setGlowEffects(value: boolean) {
    setSetting('glowEffects', value);
  }

  function setSidebarPosition(value: SidebarPosition) {
    setSetting('sidebarPosition', value);
  }

  function setHighContrast(value: boolean) {
    setSetting('highContrast', value);
  }

  function setFocusIndicators(value: boolean) {
    setSetting('focusIndicators', value);
  }

  function setCursorFlashlight(value: boolean) {
    setSetting('cursorFlashlight', value);
    setupFlashlight();
  }

  function setFlashlightSize(value: number) {
    setSetting('flashlightSize', value, { debounce: true });
  }

  function setFlashlightIntensity(value: number) {
    setSetting('flashlightIntensity', value, { debounce: true });
  }

  function setFlashlightColor(value: string) {
    setSetting('flashlightColor', value);
  }

  function resetToDefaults() {
    pushToHistory();
    applySnapshot(defaultSettings);
    applyTheme();
    setupFlashlight();
  }

  // ============================================================================
  // System Listeners
  // ============================================================================

  let darkModeQuery: MediaQueryList | null = null;
  let autoModeTimer: ReturnType<typeof setInterval> | null = null;

  function onSystemSchemeChange() {
    if (mode.value === 'system') applyTheme();
  }

  if (typeof window !== 'undefined') {
    darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    darkModeQuery.addEventListener('change', onSystemSchemeChange);

    // Check auto mode every minute
    autoModeTimer = setInterval(() => {
      if (mode.value === 'auto') {
        applyTheme();
      }
    }, 60000);
  }

  /**
   * Release the system listeners. The store is an app-lifetime singleton, so
   * this exists mainly so tests and HMR do not stack a new interval and a new
   * matchMedia listener on every reload.
   */
  function teardownSystemListeners() {
    darkModeQuery?.removeEventListener('change', onSystemSchemeChange);
    darkModeQuery = null;
    if (autoModeTimer !== null) {
      clearInterval(autoModeTimer);
      autoModeTimer = null;
    }
  }

  if (import.meta.hot) {
    import.meta.hot.dispose(teardownSystemListeners);
  }

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // State
    mode,
    autoStartTime,
    autoEndTime,
    accentPrimary,
    accentSecondary,
    glassBlur,
    glassOpacity,
    glassTint,
    noiseTexture,
    borderRadius,
    animationSpeed,
    surfaceContrast,
    panelBorder,
    glowEffects,
    compactMode,
    saturation,
    sidebarPosition,
    gradientDirection,
    shadowIntensity,
    highContrast,
    focusIndicators,
    cursorFlashlight,
    flashlightSize,
    flashlightIntensity,
    flashlightColor,

    // Undo/Redo
    canUndo,
    canRedo,
    undo,
    redo,

    // Export/Import
    exportTheme,
    importTheme,

    // Presets
    applyPreset,

    // Generic setter
    setSetting,

    // Snapshot for per-kwami config
    getSnapshot: getCurrentSnapshot,
    applySnapshot,

    // Actions
    loadSettings,
    setMode,
    setAutoStartTime,
    setAutoEndTime,
    setAccent,
    setAccentPrimary,
    setAccentSecondary,
    setAccentPreset,
    setGlassBlur,
    setGlassOpacity,
    setGlassTint,
    setNoiseTexture,
    setBorderRadius,
    setAnimationSpeed,
    setSurfaceContrast,
    setPanelBorder,
    setGlowEffects,
    setCompactMode,
    setSaturation,
    setSidebarPosition,
    setGradientDirection,
    setShadowIntensity,
    setHighContrast,
    setFocusIndicators,
    setCursorFlashlight,
    setFlashlightSize,
    setFlashlightIntensity,
    setFlashlightColor,
    resetToDefaults,
    teardownSystemListeners,
    applyTheme,
    applyThemeDebounced,
  };
});
