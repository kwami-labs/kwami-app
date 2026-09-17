import { defineStore, storeToRefs } from 'pinia';
import { ref, computed, watch } from 'vue';
import { useThemeStore } from './theme';

const MIN_PANEL_WIDTH = 280;
const MAX_PANEL_WIDTH = 1800;
// Reserve space for sidebar navigation (62px), gaps (12px), and margins (20px each side)
// Total: 20 + 62 + 12 + 20 = 114px, rounded up to 120px for safety
const VIEWPORT_PADDING = 120;
// Mobile breakpoint - below this width, compact mode is auto-enabled
const MOBILE_BREAKPOINT = 768;

// Size preset types
export type PanelSizePreset = 'small' | 'medium' | 'large';

export interface SizePresetConfig {
  width: number;
  shortcut: string;
}

// Default size preset configurations
const DEFAULT_SIZE_PRESETS: Record<PanelSizePreset, SizePresetConfig> = {
  small: { width: 320, shortcut: 'Alt+1' },
  medium: { width: 680, shortcut: 'Alt+2' },
  large: { width: 1300, shortcut: 'Alt+3' },
};

export type SidebarMode = 'settings' | 'apps';

export const useUIStore = defineStore('ui', () => {
  const activePanel = ref<string>('avatar');
  const isPanelOpen = ref(true);
  const panelWidth = ref(DEFAULT_SIZE_PRESETS.small.width);
  const sidebarMode = ref<SidebarMode>('settings');
  const isNavAnimating = ref(false);
  
  // Size presets configuration
  const sizePresets = ref<Record<PanelSizePreset, SizePresetConfig>>({ ...DEFAULT_SIZE_PRESETS });
  const activeSizePreset = ref<PanelSizePreset>('small');
  const allowCustomResize = ref(true);

  // Track window width for viewport-aware panel sizing
  const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1920);

  // Computed max width that respects both MAX_PANEL_WIDTH and viewport
  const maxAllowedWidth = computed(() => {
    const viewportMax = windowWidth.value - VIEWPORT_PADDING;
    return Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, viewportMax));
  });

  // Mobile viewport detection
  const isMobileViewport = computed(() => windowWidth.value < MOBILE_BREAKPOINT);

  // Effective custom resize permission (disabled when compact mode is active)
  const canCustomResize = computed(() => {
    return allowCustomResize.value && !useThemeStore().compactMode;
  });

  // Clamp panel width to viewport (called on window resize)
  function clampPanelToViewport() {
    if (panelWidth.value > maxAllowedWidth.value) {
      panelWidth.value = maxAllowedWidth.value;
      saveSettings();
    }
  }

  // Track if compact mode was auto-enabled due to mobile viewport
  const autoCompactMode = ref(false);

  // Handle window resize
  function onWindowResize() {
    windowWidth.value = window.innerWidth;
    clampPanelToViewport();
    
    // Auto-enable/disable compact mode based on viewport
    const theme = useThemeStore();
    if (windowWidth.value < MOBILE_BREAKPOINT) {
      // Mobile viewport - auto-enable compact mode
      if (!theme.compactMode) {
        autoCompactMode.value = true;
        theme.setCompactMode(true);
      }
    } else if (autoCompactMode.value) {
      // Desktop viewport and compact mode was auto-enabled - disable it
      autoCompactMode.value = false;
      theme.setCompactMode(false);
    }
  }

  // Setup window resize listener
  let resizeListenerAttached = false;
  function setupResizeListener() {
    if (typeof window !== 'undefined' && !resizeListenerAttached) {
      window.addEventListener('resize', onWindowResize);
      resizeListenerAttached = true;
    }
  }

  function cleanupResizeListener() {
    if (typeof window !== 'undefined' && resizeListenerAttached) {
      window.removeEventListener('resize', onWindowResize);
      resizeListenerAttached = false;
    }
  }

  // Must be >= max(nav clip-path 300ms, panel width 400ms) + buffer
  const ANIMATION_DURATION = 440;

  async function setSidebarMode(mode: SidebarMode) {
    if (mode === sidebarMode.value || isNavAnimating.value) return;
    // Start both leave animations simultaneously:
    // isNavAnimating → nav buttons collapse (clip-path 300ms)
    // isPanelOpen = false → panel column collapses (width 400ms) + close current panel
    isNavAnimating.value = true;
    if (isPanelOpen.value) isPanelOpen.value = false;
    // Wait for the slowest leave (panel width at 400ms) + small buffer
    await new Promise((resolve) => setTimeout(resolve, ANIMATION_DURATION));
    sidebarMode.value = mode;
    localStorage.setItem('kwami-sidebar-mode', mode);
    // Brief pause, then enter animations run
    await new Promise((resolve) => setTimeout(resolve, 50));
    isNavAnimating.value = false;
  }

  // Load settings from localStorage
  function loadSettings() {
    // Load active panel and open state
    const savedPanel = localStorage.getItem('kwami-active-panel');
    if (savedPanel) {
      // Migrate legacy panel id
      if (savedPanel === 'persona') {
        activePanel.value = 'soul';
      } else if (savedPanel === 'transcription') {
        activePanel.value = 'history';
      } else {
        activePanel.value = savedPanel;
      }
    }

    const savedPanelOpen = localStorage.getItem('kwami-panel-open');
    if (savedPanelOpen !== null) {
      isPanelOpen.value = savedPanelOpen === 'true';
    }

    const savedMode = localStorage.getItem('kwami-sidebar-mode');
    if (savedMode === 'settings' || savedMode === 'apps') {
      sidebarMode.value = savedMode;
    }

    // Load panel width
    const savedWidth = localStorage.getItem('kwami-panel-width');
    if (savedWidth) {
      const width = parseInt(savedWidth, 10);
      if (!isNaN(width) && width >= MIN_PANEL_WIDTH && width <= MAX_PANEL_WIDTH) {
        panelWidth.value = width;
      }
    }

    // Load size presets
    const savedPresets = localStorage.getItem('kwami-size-presets');
    if (savedPresets) {
      try {
        const parsed = JSON.parse(savedPresets);
        sizePresets.value = { ...DEFAULT_SIZE_PRESETS, ...parsed };
      } catch {
        // Use defaults if parsing fails
      }
    }

    // Load active preset
    const savedActivePreset = localStorage.getItem('kwami-active-preset');
    if (savedActivePreset && ['small', 'medium', 'large'].includes(savedActivePreset)) {
      activeSizePreset.value = savedActivePreset as PanelSizePreset;
    }

    // Load allow custom resize
    const savedAllowResize = localStorage.getItem('kwami-allow-custom-resize');
    if (savedAllowResize !== null) {
      allowCustomResize.value = savedAllowResize === 'true';
    }
  }

  // Save settings to localStorage
  function saveSettings() {
    localStorage.setItem('kwami-active-panel', activePanel.value);
    localStorage.setItem('kwami-panel-open', String(isPanelOpen.value));
    localStorage.setItem('kwami-panel-width', String(panelWidth.value));
    localStorage.setItem('kwami-size-presets', JSON.stringify(sizePresets.value));
    localStorage.setItem('kwami-active-preset', activeSizePreset.value);
    localStorage.setItem('kwami-allow-custom-resize', String(allowCustomResize.value));
  }

  function togglePanel() {
    isPanelOpen.value = !isPanelOpen.value;
  }

  function setPanel(panel: string) {
    activePanel.value = panel;
    if (!isPanelOpen.value) isPanelOpen.value = true;
  }

  function setPanelWidth(width: number) {
    panelWidth.value = Math.max(MIN_PANEL_WIDTH, Math.min(maxAllowedWidth.value, width));
    saveSettings();
  }

  function resetPanelWidth() {
    const presetWidth = sizePresets.value[activeSizePreset.value].width;
    panelWidth.value = Math.min(presetWidth, maxAllowedWidth.value);
    saveSettings();
  }

  // Set size preset and apply its width
  function setSizePreset(preset: PanelSizePreset) {
    activeSizePreset.value = preset;
    const presetWidth = sizePresets.value[preset].width;
    panelWidth.value = Math.min(presetWidth, maxAllowedWidth.value);
    saveSettings();
  }

  // Update a specific preset's width
  function setPresetWidth(preset: PanelSizePreset, width: number) {
    const clampedWidth = Math.max(MIN_PANEL_WIDTH, Math.min(maxAllowedWidth.value, width));
    sizePresets.value[preset].width = clampedWidth;
    // If this is the active preset, also update the panel width
    if (activeSizePreset.value === preset) {
      panelWidth.value = clampedWidth;
    }
    saveSettings();
  }

  // Update a specific preset's shortcut
  function setPresetShortcut(preset: PanelSizePreset, shortcut: string) {
    sizePresets.value[preset].shortcut = shortcut;
    saveSettings();
  }

  // Toggle allow custom resize (blocked when compact mode is active)
  function setAllowCustomResize(value: boolean) {
    // Prevent enabling custom resize when compact mode is active
    if (value && useThemeStore().compactMode) {
      return;
    }
    allowCustomResize.value = value;
    saveSettings();
  }

  // Get the default width for the current preset
  const defaultPanelWidth = computed(() => sizePresets.value[activeSizePreset.value].width);

  // Load on init and setup resize listener
  loadSettings();
  setupResizeListener();
  // Clamp panel width on initial load in case viewport is smaller than saved width
  clampPanelToViewport();
  
  // Check mobile viewport on initial load and auto-enable compact mode if needed
  if (typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT) {
    const theme = useThemeStore();
    if (!theme.compactMode) {
      autoCompactMode.value = true;
      theme.setCompactMode(true);
    }
  }

  // Auto-save active panel and open state on change
  watch([activePanel, isPanelOpen], () => {
    saveSettings();
  });

  // Watch for compact mode changes and disable allowCustomResize when compact mode is activated
  const { compactMode } = storeToRefs(useThemeStore());
  watch(
    compactMode,
    (isCompact) => {
      if (isCompact) {
        allowCustomResize.value = false;
        saveSettings();
      }
    },
    { immediate: true }
  );

  return {
    activePanel,
    isPanelOpen,
    panelWidth,
    sizePresets,
    activeSizePreset,
    allowCustomResize,
    canCustomResize,
    isMobileViewport,
    defaultPanelWidth,
    maxAllowedWidth,
    sidebarMode,
    isNavAnimating,
    setSidebarMode,
    togglePanel,
    setPanel,
    setPanelWidth,
    resetPanelWidth,
    setSizePreset,
    setPresetWidth,
    setPresetShortcut,
    setAllowCustomResize,
    cleanupResizeListener,
    MIN_PANEL_WIDTH,
    MAX_PANEL_WIDTH,
    MOBILE_BREAKPOINT,
  };
});
