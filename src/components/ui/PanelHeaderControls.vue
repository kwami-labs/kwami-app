<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useUIStore } from '@/stores/ui';
import { useThemeStore } from '@/stores/theme';

withDefaults(
  defineProps<{
    showSizeButtons?: boolean;
    showCloseButton?: boolean;
    showDivider?: boolean;
  }>(),
  {
    showSizeButtons: true,
    showCloseButton: true,
    showDivider: false,
  },
);

const uiStore = useUIStore();
const themeStore = useThemeStore();
const { t } = useI18n();

type PanelRatio = 0.25 | 0.5 | 1;

interface SizeButtonConfig {
  id: string;
  ratio: PanelRatio;
  label: string;
  icon: string;
}

const baseSizeButtons = computed<SizeButtonConfig[]>(() => [
  { id: 'small', ratio: 0.25, label: t('ui.resizePanel25'), icon: 'ph:arrows-in-simple-duotone' },
  { id: 'medium', ratio: 0.5, label: t('ui.resizePanel50'), icon: 'ph:arrows-horizontal-duotone' },
  { id: 'large', ratio: 1, label: t('ui.resizePanel100'), icon: 'ph:arrows-out-simple-duotone' },
]);

const isRightSidebar = computed(() => themeStore.sidebarPosition === 'right');

const orderedSizeButtons = computed(() =>
  isRightSidebar.value ? [...baseSizeButtons.value].reverse() : baseSizeButtons.value,
);

const currentRatio = computed(() => {
  if (uiStore.maxAllowedWidth <= 0) return 0;
  return uiStore.panelWidth / uiStore.maxAllowedWidth;
});

function isActiveRatio(ratio: PanelRatio) {
  return Math.abs(currentRatio.value - ratio) < 0.08;
}

function applyPanelRatio(ratio: PanelRatio) {
  const targetWidth = Math.round(uiStore.maxAllowedWidth * ratio);
  uiStore.setPanelWidth(targetWidth);
}

/**
 * One button that steps small → medium → large → small, standing in for the
 * three below when the panel is narrow (see the container query in the styles):
 * at 320px a header with a badge, the close button and three size buttons was
 * wider than the panel and cut its last button off.
 */
const nextSizeButton = computed(() => {
  const order = baseSizeButtons.value;
  const current = order.findIndex((b) => isActiveRatio(b.ratio));
  return order[(current + 1) % order.length]!;
});

function closePanel() {
  if (uiStore.isPanelOpen) {
    uiStore.togglePanel();
  }
}
</script>

<template>
  <div class="panel-header-controls">
    <div
      v-if="showDivider && !isRightSidebar"
      class="header-controls-divider"
      aria-hidden="true"
    ></div>

    <div v-if="showCloseButton && !isRightSidebar" class="header-control-group close-group">
      <button class="close-btn" :title="t('ui.closePanel')" @click="closePanel">
        <iconify-icon icon="ph:x"></iconify-icon>
      </button>
    </div>

    <div v-if="showSizeButtons" class="header-control-group">
      <button
        v-for="button in orderedSizeButtons"
        :key="button.id"
        class="size-btn"
        :class="{ active: isActiveRatio(button.ratio) }"
        :title="button.label"
        @click="applyPanelRatio(button.ratio)"
      >
        <iconify-icon :icon="button.icon"></iconify-icon>
      </button>
      <button
        class="size-btn size-cycle-btn"
        :title="nextSizeButton.label"
        :aria-label="nextSizeButton.label"
        @click="applyPanelRatio(nextSizeButton.ratio)"
      >
        <iconify-icon :icon="nextSizeButton.icon"></iconify-icon>
      </button>
    </div>

    <div v-if="showCloseButton && isRightSidebar" class="header-control-group close-group">
      <button class="close-btn" :title="t('ui.closePanel')" @click="closePanel">
        <iconify-icon icon="ph:x"></iconify-icon>
      </button>
    </div>

    <div
      v-if="showDivider && isRightSidebar"
      class="header-controls-divider"
      aria-hidden="true"
    ></div>
  </div>
</template>

<style scoped>
.panel-header-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-control-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.close-group {
  margin-right: 2px;
}

.size-btn,
.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: var(--surface-1);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
}

.size-btn:hover,
.close-btn:hover {
  background: var(--surface-2);
  color: var(--text-primary);
}

.size-btn.active {
  background: var(--accent-glow);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.size-btn iconify-icon {
  font-size: 14px;
}

.close-btn iconify-icon {
  font-size: 15px;
}

/* SidebarContent makes the panel a `panel` size container. */
.size-cycle-btn {
  display: none;
}

@container panel (max-width: 380px) {
  .size-btn:not(.size-cycle-btn) {
    display: none;
  }

  .size-cycle-btn {
    display: flex;
  }
}

.header-controls-divider {
  width: 1px;
  height: 18px;
  margin: 0 2px;
  background: var(--glass-border);
}
</style>
