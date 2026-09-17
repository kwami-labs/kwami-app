<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useUIStore } from '@/stores/ui';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';
import { useThemeStore } from '@/stores/theme';
import { useKwamiConfigSync } from '@/composables/useKwamiConfigSync';
import { useToast } from 'vue-toastification';

const uiStore = useUIStore();
const authStore = useAuthStore();
const workspaceStore = useWorkspaceStore();
const themeStore = useThemeStore();
const { saveCurrentConfig, revertCurrentConfig } = useKwamiConfigSync();
const toast = useToast();
const { t } = useI18n();

const isSettingsMode = computed(() => uiStore.sidebarMode === 'settings');
const isSidebarRight = computed(() => themeStore.sidebarPosition === 'right');

// Never show the chip during a mode-switch animation — the transient state
// produced by collapsing the panel can falsely mark the config as dirty.
const hasUnsavedChanges = computed(
  () => workspaceStore.hasActiveUnsavedConfig && !uiStore.isNavAnimating,
);

const isSavingConfig = ref(false);
const saveActionsOpen = ref(false);

const modeIcon = computed(() =>
  isSettingsMode.value ? 'ph:squares-four-duotone' : 'ph:gear-six-duotone',
);
const modeTitle = computed(() =>
  isSettingsMode.value ? t('sidebarMode.switchToApps') : t('sidebarMode.switchToSettings'),
);
const saveButtonTitle = computed(() =>
  !authStore.userId ? t('controlBar.saveLocally') : t('controlBar.reviewUnsaved'),
);

function toggleMode() {
  uiStore.setSidebarMode(isSettingsMode.value ? 'apps' : 'settings');
}

async function handleSaveConfig() {
  if (isSavingConfig.value) return;
  isSavingConfig.value = true;
  try {
    const saved = await saveCurrentConfig();
    if (saved) {
      saveActionsOpen.value = false;
      toast.success(authStore.userId ? t('controlBar.savedRemote') : t('controlBar.savedLocal'));
    } else {
      toast.error(t('controlBar.saveError'));
    }
  } catch (err) {
    console.error('Failed to save kwami config:', err);
    toast.error(t('controlBar.saveError'));
  } finally {
    isSavingConfig.value = false;
  }
}

function handleUndoConfig() {
  revertCurrentConfig();
  saveActionsOpen.value = false;
  toast.info(t('controlBar.discarded'));
}

function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (saveActionsOpen.value && !target.closest('.mode-switch-container')) {
    saveActionsOpen.value = false;
  }
}

watch(hasUnsavedChanges, (v) => { if (!v) saveActionsOpen.value = false; });
watch(isSettingsMode, (v) => { if (!v) saveActionsOpen.value = false; });

onMounted(() => document.addEventListener('click', handleClickOutside));
onUnmounted(() => document.removeEventListener('click', handleClickOutside));
</script>

<template>
  <!--
    Row layout: [save chip] [mode btn]  when sidebar is left  (anchored bottom-right)
                [mode btn] [save chip]  when sidebar is right (anchored bottom-left)
  -->
  <div class="mode-switch-container" :class="{ 'sidebar-right': isSidebarRight }">

    <!-- Save chip — left side when sidebar is left, right side when sidebar is right -->
    <transition name="save-chip">
      <div
        v-if="isSettingsMode && hasUnsavedChanges"
        class="save-wrap"
      >
        <button
          class="save-btn"
          :class="{ active: saveActionsOpen }"
          :title="saveButtonTitle"
          @click.stop="saveActionsOpen = !saveActionsOpen"
        >
          <iconify-icon icon="ph:floppy-disk-bold"></iconify-icon>
          <span>{{ t('controlBar.unsaved') }}</span>
        </button>

        <transition name="save-actions">
          <div v-if="saveActionsOpen" class="save-actions" :class="{ 'open-left': isSidebarRight }">
            <button
              class="save-action primary"
              :disabled="isSavingConfig"
              @click.stop="handleSaveConfig"
            >
              <iconify-icon
                :icon="isSavingConfig ? 'ph:circle-notch-bold' : 'ph:check-bold'"
                :class="{ spin: isSavingConfig }"
              ></iconify-icon>
              <span>{{ isSavingConfig ? t('controlBar.saving') : t('controlBar.save') }}</span>
            </button>
            <button
              class="save-action secondary"
              :disabled="isSavingConfig"
              @click.stop="handleUndoConfig"
            >
              <iconify-icon icon="ph:arrow-counter-clockwise-bold"></iconify-icon>
              <span>{{ t('controlBar.undo') }}</span>
            </button>
          </div>
        </transition>
      </div>
    </transition>

    <!-- Mode toggle button -->
    <button
      class="mode-btn"
      :class="{ 'apps-mode': !isSettingsMode }"
      :title="modeTitle"
      :disabled="uiStore.isNavAnimating"
      @click.stop="toggleMode"
    >
      <transition name="icon-swap" mode="out-in">
        <iconify-icon :key="modeIcon" :icon="modeIcon"></iconify-icon>
      </transition>
    </button>

  </div>
</template>

<style scoped>
/* ── Container ── */
.mode-switch-container {
  position: absolute;
  bottom: 20px;
  right: 20px;
  z-index: 1001;
  display: flex;
  flex-direction: row;       /* horizontal: chip on the left, btn on the right */
  align-items: center;
  gap: 8px;
  pointer-events: auto;
}

/* When sidebar is on the right, anchor to the left and flip order */
.mode-switch-container.sidebar-right {
  right: auto;
  left: 20px;
  flex-direction: row-reverse; /* btn on the left, chip on the right */
}

/* ── Mode toggle button ── */
.mode-btn {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  box-shadow: var(--glass-shadow);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 20px;
  transition: all var(--duration-fast) var(--ease-out);
}

.mode-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent-primary) 12%, var(--glass-bg));
  border-color: color-mix(in srgb, var(--accent-primary) 24%, var(--glass-border));
  box-shadow: 0 0 14px color-mix(in srgb, var(--accent-primary) 16%, transparent), var(--glass-shadow);
  color: var(--text-primary);
  transform: scale(1.08);
}

.mode-btn:disabled {
  opacity: 0.6;
  cursor: wait;
}

/* ── Save chip ── */
.save-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.save-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  height: 40px;
  border-radius: 999px;
  cursor: pointer;
  background: color-mix(in srgb, var(--accent-primary) 12%, var(--glass-bg));
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  color: var(--text-primary);
  box-shadow: 0 0 18px color-mix(in srgb, var(--accent-primary) 18%, transparent);
  font-family: inherit;
  transition: all var(--duration-fast) var(--ease-out);
  white-space: nowrap;
}

.save-btn:hover,
.save-btn.active {
  border-color: color-mix(in srgb, var(--accent-primary) 28%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-primary) 18%, var(--glass-bg));
}

.save-btn iconify-icon {
  font-size: 16px;
  color: var(--accent-primary);
}

.save-btn span {
  font-size: 12px;
  font-weight: 600;
}

/* ── Save actions popover (opens above the chip) ── */
.save-actions {
  position: absolute;
  bottom: calc(100% + 10px);
  right: 0;                   /* aligns to right edge of chip (default: sidebar left) */
  display: flex;
  gap: 8px;
  padding: 8px;
  border-radius: calc(var(--radius-lg) + 2px);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  box-shadow: var(--glass-shadow);
}

/* When sidebar is on the right, popover aligns to the left edge of chip */
.save-actions.open-left {
  right: auto;
  left: 0;
}

/* ── Save action buttons ── */
.save-action {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
  cursor: pointer;
  font-family: inherit;
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  transition: all var(--duration-fast) var(--ease-out);
  white-space: nowrap;
}

.save-action.primary {
  background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
  border-color: transparent;
  color: white;
}

.save-action.secondary {
  background: var(--surface-2);
  color: var(--text-secondary);
}

.save-action:hover:not(:disabled) {
  transform: translateY(-1px);
}

.save-action.secondary:hover:not(:disabled) {
  background: var(--surface-3);
  color: var(--text-primary);
}

.save-action:disabled {
  opacity: 0.6;
  cursor: wait;
}

/* ── Transitions ── */
.save-chip-enter-active,
.save-chip-leave-active {
  transition: opacity 0.2s ease, transform 0.2s var(--ease-out);
}

.save-chip-enter-from,
.save-chip-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.92);
}

.save-actions-enter-active,
.save-actions-leave-active {
  transition: opacity 0.18s ease, transform 0.18s var(--ease-out);
}

.save-actions-enter-from,
.save-actions-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.98);
}

.icon-swap-enter-active,
.icon-swap-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.icon-swap-enter-from,
.icon-swap-leave-to {
  opacity: 0;
  transform: rotate(45deg) scale(0.7);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
</style>
