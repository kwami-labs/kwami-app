<script setup lang="ts">
import { watch, ref, nextTick, computed } from 'vue';
import { useUIStore } from '@/stores/ui';
import { panelIcon, panelIcons } from '@/constants/panel-icons';
import { usePanelShortcuts } from '@/composables/usePanelShortcuts';
import SidebarKwamiSection from '@/components/sidebar/SidebarKwamiSection.vue';
import { useI18n } from 'vue-i18n';
import { useWorkspaceStore } from '@/stores/workspace';
import {
  appsPanelOrder,
  SETTINGS_AGENT_PANELS,
  SETTINGS_INFO_PANELS,
  SETTINGS_VISUAL_PANELS,
} from '@/constants/panels';
import { useCommunicationsStore } from '@/stores/communications';
import { fetchKwamiCommunications } from '@/composables/useCommunicationsApi';

const uiStore = useUIStore();
const workspaceStore = useWorkspaceStore();
const communicationsStore = useCommunicationsStore();
const { handlePanelClick } = usePanelShortcuts();
const { t } = useI18n();

const displayMode = ref(uiStore.sidebarMode);
const navVisible = ref(true);

const columnRef = ref<HTMLElement | null>(null);
const headerRef = ref<HTMLElement | null>(null);

const COLLAPSE_MS = 300;
const EXPAND_MS = 340;

// Stored so the enter phase can restore to the exact compact height
let pinnedCompactHeight = 0;

function rAF() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

// Phase 1 — LEAVE: shrink column height to just the header section
watch(
  () => uiStore.isNavAnimating,
  (animating) => {
    if (!animating) return;
    const col = columnRef.value;
    const header = headerRef.value;
    if (!col || !header) { navVisible.value = false; return; }

    const fullHeight = col.scrollHeight;
    pinnedCompactHeight = header.offsetHeight;

    col.style.overflow = 'hidden';
    col.style.transition = 'none';
    col.style.height = `${fullHeight}px`;

    void col.offsetHeight; // force reflow

    col.style.transition = `height ${COLLAPSE_MS}ms ease-in`;
    col.style.height = `${pinnedCompactHeight}px`;
    navVisible.value = false;
  },
);

// Phase 2 — ENTER: swap content, measure reliably, then expand
watch(
  () => uiStore.sidebarMode,
  async (newMode) => {
    const col = columnRef.value;
    displayMode.value = newMode;
    navVisible.value = true;

    if (!col) return;

    // Wait for Vue to mount new content, then one rAF for browser layout
    await nextTick();
    await rAF();

    // Temporarily release height to auto so scrollHeight reflects true size,
    // then snap back to compactHeight without a transition before animating.
    col.style.transition = 'none';
    col.style.height = 'auto';
    const newFullHeight = col.scrollHeight;
    col.style.height = `${pinnedCompactHeight}px`;

    void col.offsetHeight; // force reflow so the snap registers

    col.style.transition = `height ${EXPAND_MS}ms ease-out`;
    col.style.height = `${newFullHeight}px`;

    setTimeout(() => {
      col.style.height = 'auto';
      col.style.overflow = '';
      col.style.transition = '';
    }, EXPAND_MS + 20);
  },
);

function panelTitle(panel: string): string {
  return t(`sidebar.panels.${panel}`);
}

async function refreshPhoneActivationStatus() {
  const kwamiId = workspaceStore.activeWorkspaceId;
  if (!kwamiId) return;
  try {
    const data = await fetchKwamiCommunications(kwamiId);
    communicationsStore.setKwamiPhoneActivated(
      kwamiId,
      data.channels.some((channel) => channel.kind === 'voice_phone'),
    );
  } catch {
    communicationsStore.setKwamiPhoneActivated(kwamiId, false);
  }
}

// Shared with usePanelShortcuts so the keyboard and the sidebar can never
// disagree about which panels exist or which are gated.
const appPanels = computed(() =>
  appsPanelOrder(communicationsStore.isKwamiPhoneActivated(workspaceStore.activeWorkspaceId)),
);

watch(
  () => workspaceStore.activeWorkspaceId,
  () => {
    void refreshPhoneActivationStatus();
  },
  { immediate: true },
);
</script>

<template>
  <div class="switcher-column" ref="columnRef">

    <!-- Always-visible header: KwamiSelector + divider -->
    <div class="header-section" ref="headerRef">
      <SidebarKwamiSection />
      <div class="nav-divider"></div>
    </div>

    <!-- Nav groups: swapped on mode change -->
    <div v-if="navVisible" class="nav-groups" :key="displayMode">

      <!-- SETTINGS MODE -->
      <template v-if="displayMode === 'settings'">
        <div class="nav-group">
          <span class="switcher-label">{{ t('sidebar.visual') }}</span>
          <button
            v-for="p in SETTINGS_VISUAL_PANELS"
            :key="p"
            class="nav-btn"
            :class="{ active: uiStore.activePanel === p && uiStore.isPanelOpen }"
            @click="handlePanelClick(p)"
            :title="panelTitle(p)"
          >
            <iconify-icon :icon="panelIcon(p)"></iconify-icon>
          </button>
        </div>

        <div class="nav-divider"></div>

        <div class="nav-group">
          <span class="switcher-label">{{ t('sidebar.agent') }}</span>
          <button
            v-for="p in SETTINGS_AGENT_PANELS"
            :key="p"
            class="nav-btn"
            :class="{ active: uiStore.activePanel === p && uiStore.isPanelOpen }"
            @click="handlePanelClick(p)"
            :title="panelTitle(p)"
          >
            <iconify-icon :icon="panelIcon(p)"></iconify-icon>
          </button>
        </div>

        <div class="nav-divider"></div>

        <div class="nav-group">
          <span class="switcher-label">{{ t('sidebar.info') }}</span>
          <button
            v-for="p in SETTINGS_INFO_PANELS"
            :key="p"
            class="nav-btn"
            :class="{ active: uiStore.activePanel === p && uiStore.isPanelOpen }"
            @click="handlePanelClick(p)"
            :title="panelTitle(p)"
          >
            <iconify-icon :icon="panelIcon(p)"></iconify-icon>
          </button>
        </div>

        <div class="nav-spacer"></div>

        <button
          class="nav-btn energy-btn"
          :class="{ active: uiStore.activePanel === 'credits' && uiStore.isPanelOpen }"
          @click="handlePanelClick('credits')"
          :title="t('sidebar.energy')"
        >
          <iconify-icon :icon="panelIcons.credits"></iconify-icon>
        </button>

        <button
          class="nav-btn account-btn"
          :class="{ active: uiStore.activePanel === 'account' && uiStore.isPanelOpen }"
          @click="handlePanelClick('account')"
          :title="t('sidebar.account')"
        >
          <iconify-icon icon="ph:user-duotone"></iconify-icon>
        </button>
      </template>

      <!-- APPS MODE -->
      <template v-else>
        <div class="nav-group">
          <span class="switcher-label">{{ t('sidebar.apps') }}</span>
          <button
            v-for="p in appPanels"
            :key="p"
            class="nav-btn"
            :class="{ active: uiStore.activePanel === p && uiStore.isPanelOpen }"
            @click="handlePanelClick(p)"
            :title="panelTitle(p)"
          >
            <iconify-icon :icon="panelIcon(p)"></iconify-icon>
          </button>
        </div>
      </template>

    </div>
  </div>
</template>

<style scoped>
.switcher-column {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  box-shadow: var(--glass-shadow);
  pointer-events: auto;
  z-index: 102;
  /* height is animated via JS; default is auto */
}

.header-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}

.nav-groups {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.nav-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.nav-divider {
  height: 1px;
  margin: 4px 0;
  background: var(--glass-border);
  flex-shrink: 0;
}

.nav-spacer {
  flex: 1;
  min-height: 8px;
}

.nav-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-1);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
  font-size: 20px;
  flex-shrink: 0;
}

.nav-btn:hover {
  background: var(--surface-2);
  color: var(--text-primary);
  transform: scale(1.08);
}

.nav-btn.active {
  background: var(--accent-glow);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
  box-shadow: 0 0 20px var(--accent-glow), 0 0 0 1px rgba(0, 217, 255, 0.2) inset;
}

.switcher-label {
  font-size: 8px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--text-muted);
  text-align: center;
  padding: 0 4px;
}
</style>
