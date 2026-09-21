<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import { useUIStore } from '@/stores/ui';
import { useThemeStore } from '@/stores/theme';

const uiStore = useUIStore();
const themeStore = useThemeStore();

// Resize state
const isResizing = ref(false);
const startX = ref(0);
const startWidth = ref(0);

// Computed to check if resizing is allowed (uses canCustomResize which respects compact mode)
const canResize = computed(() => uiStore.canCustomResize);

// Computed to check if sidebar is on the right
const isRightSidebar = computed(() => themeStore.sidebarPosition === 'right');

// Dynamic panel width style with viewport constraint
const panelStyle = computed(() => {
  if (!uiStore.isPanelOpen) {
    return {
      width: '0px',
      minWidth: '0px',
      maxWidth: '0px',
      flexBasis: '0px',
      padding: '0',
      boxShadow: 'none',
      borderWidth: '0',
      opacity: '0',
    };
  }

  if (themeStore.compactMode) {
    return {}; // Let CSS handle compact mode width
  }

  return {
    width: `${uiStore.panelWidth}px`,
    minWidth: `${uiStore.panelWidth}px`,
    flexBasis: `${uiStore.panelWidth}px`,
    maxWidth: `calc(100vw - 120px)`, // CSS fallback: sidebar nav (62px) + gaps (12px) + margins (40px) + buffer
  };
});

// Start resize
function startResize(e: MouseEvent) {
  if (!canResize.value) return;

  isResizing.value = true;
  startX.value = e.clientX;
  startWidth.value = uiStore.panelWidth;

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', stopResize);
  document.body.style.cursor = 'ew-resize';
  document.body.style.userSelect = 'none';
}

// Handle resize
function onMouseMove(e: MouseEvent) {
  if (!isResizing.value) return;

  // Check sidebar position for correct resize direction
  const isRight = themeStore.sidebarPosition === 'right';
  const delta = isRight ? startX.value - e.clientX : e.clientX - startX.value;
  const newWidth = startWidth.value + delta;
  uiStore.setPanelWidth(newWidth);
}

// Stop resize
function stopResize() {
  isResizing.value = false;
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', stopResize);
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
}

// Double-click to reset width
function resetWidth() {
  if (!canResize.value) return;
  uiStore.resetPanelWidth();
}

// Cleanup on unmount
onUnmounted(() => {
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', stopResize);
});
</script>

<template>
  <div class="panel-column glass-panel" :style="panelStyle">
    <div class="panel-content-wrapper">
      <slot></slot>
    </div>

    <!-- Noise texture overlay -->
    <div class="noise-overlay"></div>

    <!-- Resize handle -->
    <div
      v-if="canResize && uiStore.isPanelOpen"
      class="resize-handle"
      :class="{ resizing: isResizing, 'handle-left': isRightSidebar }"
      @mousedown.prevent="startResize"
      @dblclick="resetWidth"
    >
      <div class="resize-indicator"></div>
    </div>
  </div>
</template>

<style scoped>
.panel-column {
  width: 320px;
  max-height: 100%;
  transition:
    width var(--duration-slow) var(--ease-out),
    min-width var(--duration-slow) var(--ease-out),
    max-width var(--duration-slow) var(--ease-out),
    flex-basis var(--duration-slow) var(--ease-out),
    padding var(--duration-slow) var(--ease-out),
    box-shadow var(--duration-slow) var(--ease-out),
    border-width calc(var(--duration-slow) * 0.25) var(--ease-out),
    opacity calc(var(--duration-slow) * 2) var(--ease-out);
  position: relative;
}

/* Disable width transition while resizing */
.panel-column:has(.resize-handle.resizing) {
  transition: none;
}

.glass-panel {
  height: 100%;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  box-shadow: var(--glass-shadow);
  overflow: hidden;
  position: relative;
  pointer-events: auto;
}

/* Subtle gradient overlay for depth */
.glass-panel::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 120px;
  background: linear-gradient(180deg, rgba(0, 217, 255, 0.02) 0%, transparent 100%);
  pointer-events: none;
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
}

/* Noise texture overlay */
.noise-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  opacity: var(--noise-opacity, 0);
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  background-repeat: repeat;
  mix-blend-mode: overlay;
  border-radius: var(--radius-xl);
}

.panel-content-wrapper {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Resize handle */
.resize-handle {
  position: absolute;
  top: 0;
  right: -4px;
  width: 8px;
  height: 100%;
  cursor: ew-resize;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Right sidebar - handle on left */
.resize-handle.handle-left {
  right: auto;
  left: -4px;
}

.resize-handle:hover .resize-indicator,
.resize-handle.resizing .resize-indicator {
  opacity: 1;
  background: var(--accent-primary);
  box-shadow: 0 0 8px var(--accent-primary);
}

.resize-indicator {
  width: 3px;
  height: 40px;
  background: var(--text-muted);
  border-radius: 2px;
  opacity: 0;
  transition:
    opacity 0.2s ease,
    background 0.2s ease;
}

.resize-handle:hover .resize-indicator {
  opacity: 0.6;
}

.resize-handle.resizing .resize-indicator {
  opacity: 1;
}

/* Focus indicators styles */
:global(body.focus-visible) .glass-panel:focus-within {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}

/* High contrast mode adjustments */
:global(body.high-contrast) .glass-panel {
  border-width: 2px;
}
</style>
