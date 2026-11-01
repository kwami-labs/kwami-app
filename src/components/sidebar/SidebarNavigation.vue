<script setup lang="ts">
import { watch, ref, nextTick, computed, onMounted, onUnmounted } from 'vue';
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
    if (!col || !header) {
      navVisible.value = false;
      return;
    }

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

// The phone dock's settings/apps switch. Same action as SidebarModeSwitch.
const modeIcon = computed(() =>
  displayMode.value === 'settings' ? 'ph:squares-four-duotone' : 'ph:gear-six-duotone',
);
const modeTitle = computed(() =>
  displayMode.value === 'settings'
    ? t('sidebarMode.switchToApps')
    : t('sidebarMode.switchToSettings'),
);
const modeLabel = computed(() =>
  displayMode.value === 'settings' ? t('sidebar.apps') : t('sidebar.settings'),
);

function toggleMode() {
  void uiStore.setSidebarMode(uiStore.sidebarMode === 'settings' ? 'apps' : 'settings');
}

/**
 * Bring the active panel's button into view when the nav scrolls: sideways in the
 * phone dock, or down a rail that is taller than a short screen. Sets the
 * scroller's own offset rather than calling scrollIntoView, which would also
 * scroll the fixed, overflow-hidden ancestors.
 */
function revealActiveButton() {
  const scroller = columnRef.value?.querySelector<HTMLElement>('.nav-groups');
  const button = scroller?.querySelector<HTMLElement>('.nav-btn.active');
  if (!scroller || !button) return;
  const s = scroller.getBoundingClientRect();
  const b = button.getBoundingClientRect();
  const pad = 12;
  if (scroller.scrollWidth > scroller.clientWidth) {
    if (b.left < s.left + pad) scroller.scrollLeft -= s.left + pad - b.left;
    else if (b.right > s.right - pad) scroller.scrollLeft += b.right - (s.right - pad);
  }
  if (scroller.scrollHeight > scroller.clientHeight) {
    if (b.top < s.top + pad) scroller.scrollTop -= s.top + pad - b.top;
    else if (b.bottom > s.bottom - pad) scroller.scrollTop += b.bottom - (s.bottom - pad);
  }
}

watch(
  () => [uiStore.activePanel, uiStore.isPanelOpen, displayMode.value] as const,
  async () => {
    await nextTick();
    revealActiveButton();
    updateScrollHints();
  },
);

/**
 * Which ends of the nav still have buttons out of view: down a rail cut short by
 * the screen, or sideways along the phone dock. Drives the fades at those ends.
 */
const groupsRef = ref<HTMLElement | null>(null);
const moreBefore = ref(false);
const moreAfter = ref(false);

function updateScrollHints() {
  const el = groupsRef.value;
  if (!el) return;
  const sideways = el.scrollWidth > el.clientWidth + 1;
  const pos = sideways ? el.scrollLeft : el.scrollTop;
  const max = sideways ? el.scrollWidth - el.clientWidth : el.scrollHeight - el.clientHeight;
  moreBefore.value = max > 1 && pos > 1;
  moreAfter.value = max > 1 && pos < max - 1;
}

let groupsObserver: ResizeObserver | null = null;
watch(groupsRef, (el) => {
  groupsObserver?.disconnect();
  if (!el || typeof ResizeObserver === 'undefined') return;
  groupsObserver = new ResizeObserver(() => updateScrollHints());
  groupsObserver.observe(el);
});

onMounted(() =>
  requestAnimationFrame(() => {
    revealActiveButton();
    updateScrollHints();
  }),
);
onUnmounted(() => groupsObserver?.disconnect());

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
    <div
      v-if="navVisible"
      ref="groupsRef"
      class="nav-groups"
      :class="{ 'more-before': moreBefore, 'more-after': moreAfter }"
      :key="displayMode"
      @scroll.passive="updateScrollHints"
    >
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
            :aria-label="panelTitle(p)"
          >
            <iconify-icon :icon="panelIcon(p)"></iconify-icon>
            <span class="nav-label">{{ panelTitle(p) }}</span>
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
            :aria-label="panelTitle(p)"
          >
            <iconify-icon :icon="panelIcon(p)"></iconify-icon>
            <span class="nav-label">{{ panelTitle(p) }}</span>
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
            :aria-label="panelTitle(p)"
          >
            <iconify-icon :icon="panelIcon(p)"></iconify-icon>
            <span class="nav-label">{{ panelTitle(p) }}</span>
          </button>
        </div>

        <div class="nav-spacer"></div>

        <button
          class="nav-btn energy-btn"
          :class="{ active: uiStore.activePanel === 'credits' && uiStore.isPanelOpen }"
          @click="handlePanelClick('credits')"
          :title="t('sidebar.energy')"
          :aria-label="t('sidebar.energy')"
        >
          <iconify-icon :icon="panelIcons.credits"></iconify-icon>
          <span class="nav-label">{{ t('sidebar.energy') }}</span>
        </button>

        <button
          class="nav-btn account-btn"
          :class="{ active: uiStore.activePanel === 'account' && uiStore.isPanelOpen }"
          @click="handlePanelClick('account')"
          :title="t('sidebar.account')"
          :aria-label="t('sidebar.account')"
        >
          <iconify-icon icon="ph:user-duotone"></iconify-icon>
          <span class="nav-label">{{ t('sidebar.account') }}</span>
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
            :aria-label="panelTitle(p)"
          >
            <iconify-icon :icon="panelIcon(p)"></iconify-icon>
            <span class="nav-label">{{ panelTitle(p) }}</span>
          </button>
        </div>
      </template>
    </div>

    <!-- Phone dock only: the settings/apps switch lives at the dock's end, under the
         thumb. Elsewhere SidebarModeSwitch's floating button does this job. -->
    <button
      class="nav-btn dock-mode-btn"
      :class="{ 'apps-mode': displayMode === 'apps' }"
      :disabled="uiStore.isNavAnimating"
      :title="modeTitle"
      :aria-label="modeTitle"
      @click="toggleMode"
    >
      <iconify-icon :icon="modeIcon"></iconify-icon>
      <span class="nav-label">{{ modeLabel }}</span>
    </button>
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
  /* Never taller than the sidebar: on a short screen (a landscape phone, a small
     laptop window) the nav groups scroll instead of spilling past the bottom. */
  max-height: 100%;
  min-height: 0;
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
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
  /* A scroller clips its overflow, which would cut off the hover scale and the
     active glow. Reach into the column's padding so they have room to draw. */
  margin: -4px -10px;
  padding: 4px 10px;
}

.nav-groups::-webkit-scrollbar {
  display: none;
}

/* Fades at the ends that still have buttons out of view, so a rail cut short by
   the screen reads as scrollable rather than as all there is. */
.nav-groups.more-before {
  -webkit-mask-image: linear-gradient(to bottom, transparent, #000 24px);
  mask-image: linear-gradient(to bottom, transparent, #000 24px);
}

.nav-groups.more-after {
  -webkit-mask-image: linear-gradient(to top, transparent, #000 24px);
  mask-image: linear-gradient(to top, transparent, #000 24px);
}

.nav-groups.more-before.more-after {
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent,
    #000 24px,
    #000 calc(100% - 24px),
    transparent
  );
  mask-image: linear-gradient(
    to bottom,
    transparent,
    #000 24px,
    #000 calc(100% - 24px),
    transparent
  );
}

/* Labels and the dock's mode switch only show in the phone dock (main.css, PHONES). */
.nav-label,
.nav-btn.dock-mode-btn {
  display: none;
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
}

/* A touch screen keeps :hover on the last button tapped; only grow under a mouse. */
@media (hover: hover) {
  .nav-btn:hover {
    transform: scale(1.08);
  }
}

.nav-btn.active {
  background: var(--accent-glow);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
  box-shadow:
    0 0 20px var(--accent-glow),
    0 0 0 1px rgba(0, 217, 255, 0.2) inset;
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
