<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, type Component } from 'vue';
import './hud.css';
import { storeToRefs } from 'pinia';
import { useHudStore, type HudKind, type HudWidget } from '@/stores/hud';
import { useVoiceStore } from '@/stores/voice';
import HudActionLog from './HudActionLog.vue';
import HudDock from './HudDock.vue';
import HudScreenBanner from './HudScreenBanner.vue';
import TaskWidget from './widgets/TaskWidget.vue';
import DocumentWidget from './widgets/DocumentWidget.vue';
import VideoWidget from './widgets/VideoWidget.vue';
import WebWidget from './widgets/WebWidget.vue';
import ImageWidget from './widgets/ImageWidget.vue';
import BrowserWidget from './widgets/BrowserWidget.vue';
import ToolWidget from './widgets/ToolWidget.vue';
import { closeOrphans } from '@/lib/hud/nativeWeb';
import { taskKey } from '@/lib/hud/actions';
import { isEditableTarget } from '@/utils/keyboard';
import { useAvatarAside } from '@/composables/useAvatarAside';

/**
 * Jarvis's HUD over the avatar: its windows, the lines that tie each one to the core,
 * the action log and the dock. It fills the avatar's area (not the sidebar or the
 * browser split), lets every click through to the avatar except on its own windows,
 * and tells the store its size so windows stay on screen as the layout changes.
 * Jarvis's own figure moves aside to the part no window covers (`useAvatarAside`).
 */
const hud = useHudStore();
useAvatarAside();

/**
 * A screen coming into view: its windows fade in quickly instead of each unfolding as if
 * it had just opened, so going from screen to screen is one quick motion.
 */
const screenIn = ref(false);
let screenInTimer: ReturnType<typeof setTimeout> | null = null;
watch(
  () => hud.activeScreen,
  () => {
    screenIn.value = true;
    if (screenInTimer) clearTimeout(screenInTimer);
    screenInTimer = setTimeout(() => (screenIn.value = false), 260);
  },
);
const { brainStatus } = storeToRefs(useVoiceStore());

const WIDGETS: Record<HudKind, Component> = {
  task: TaskWidget,
  document: DocumentWidget,
  video: VideoWidget,
  web: WebWidget,
  image: ImageWidget,
  browser: BrowserWidget,
  tool: ToolWidget,
};

const root = ref<HTMLElement | null>(null);
let observer: ResizeObserver | null = null;
let sidebar: Element | null = null;
/** Watches the layout's direct children only: the sidebar is one, and mounts after the HUD. */
let mounts: MutationObserver | null = null;
/** A free band narrower than this is no place for a window: then the HUD uses it all. */
const MIN_FREE_BAND = 360;

/**
 * The HUD's size, and the band the sidebar's panel covers. That panel floats over the
 * avatar (fixed, above the HUD), so a window placed under it would be lost.
 */
function measure() {
  if (!root.value) return;
  const box = root.value.getBoundingClientRect();
  let left = 0;
  let right = 0;
  const side = sidebar?.getBoundingClientRect();
  if (side && side.width > 0 && side.height > box.height / 2) {
    if (side.left + side.width / 2 < box.left + box.width / 2)
      left = Math.max(0, side.right - box.left);
    else right = Math.max(0, box.right - side.left);
  }
  if (box.width - left - right < MIN_FREE_BAND) left = right = 0;
  hud.setCover(
    side && side.width > 0
      ? {
          x: Math.round(side.left - box.left),
          y: Math.round(side.top - box.top),
          w: Math.round(side.width),
          h: Math.round(side.height),
        }
      : null,
  );
  hud.setViewport({ width: box.width, height: box.height, left, right });
}

/** The sidebar mounts after the HUD, and comes and goes with the session. */
function findSidebar() {
  const found = document.querySelector('.sidebar');
  if (found === sidebar) return;
  if (sidebar) observer?.unobserve(sidebar);
  sidebar = found;
  if (sidebar) observer?.observe(sidebar);
  measure();
}

onMounted(() => {
  if (!root.value) return;
  observer = new ResizeObserver(() => measure());
  observer.observe(root.value);
  findSidebar();
  const layout = document.getElementById('kwami-root');
  if (layout) {
    mounts = new MutationObserver(findSidebar);
    mounts.observe(layout, { childList: true });
  }
  window.addEventListener('keydown', onKey);
  // Web views left by a reload would lie over the app with no window to close them.
  void closeOrphans(hud.widgets.filter((w) => w.kind === 'web').map((w) => w.id));
  window.addEventListener('resize', measure);
});

onBeforeUnmount(() => {
  observer?.disconnect();
  mounts?.disconnect();
  window.removeEventListener('resize', measure);
  window.removeEventListener('keydown', onKey);
});

/** The number in a window's code: its place among the windows of its kind. */
function indexOf(widget: HudWidget): number {
  return hud.widgets.filter((w) => w.kind === widget.kind).indexOf(widget);
}

function isBusy(widget: HudWidget): boolean {
  if (widget.kind !== 'task') return widget.kind === 'browser';
  return (
    brainStatus.value?.tasks.some((t) => taskKey(t) === widget.taskId && t.status === 'running') ??
    false
  );
}

/**
 * Screens from the keyboard: Ctrl+Alt+1..9 go to one, Ctrl+Alt+arrows to the next or
 * the one before, Ctrl+Alt+N makes a new one, Ctrl+Alt+O lays this one's windows out,
 * Ctrl+Alt+E arranges by hand (edit mode). In edit mode, Escape leaves it and Delete
 * closes the window in front.
 */
function onKey(e: KeyboardEvent) {
  if (hud.editing && !isEditableTarget(e.target)) {
    if (e.key === 'Escape') {
      hud.setEditing(false);
      e.preventDefault();
      return;
    }
    if (e.key === 'Delete' && hud.focusedId) {
      hud.close(hud.focusedId);
      e.preventDefault();
      return;
    }
  }
  if (!e.ctrlKey || !e.altKey || e.metaKey || isEditableTarget(e.target)) return;
  const key = e.key.toLowerCase();
  const digit = /^[1-9]$/.test(e.key) ? Number(e.key) : 0;
  if (digit && hud.screens[digit - 1]) hud.switchScreen(hud.screens[digit - 1].id);
  else if (key === 'arrowright') hud.cycleScreen(1);
  else if (key === 'arrowleft') hud.cycleScreen(-1);
  else if (key === 'n') hud.addScreen();
  else if (key === 'o') hud.organize();
  else if (key === 'e') hud.setEditing(!hud.editing);
  else return;
  e.preventDefault();
}

/** From the core (wherever Jarvis's figure is now) to the nearest edge of each window. */
const tethers = computed(() => {
  const cx = hud.avatar.x;
  const cy = hud.avatar.y;
  return hud.visible.map((widget) => {
    const r = hud.rectOf(widget);
    const x = Math.min(Math.max(cx, r.x), r.x + r.w);
    const y = Math.min(Math.max(cy, r.y), r.y + r.h);
    return { id: widget.id, x1: cx, y1: cy, x2: x, y2: y, busy: isBusy(widget) };
  });
});
</script>

<template>
  <div
    ref="root"
    class="hud-layer"
    :class="{
      'is-editing': hud.editing,
      'is-manipulating': hud.manipulating > 0,
      'screen-in': screenIn,
    }"
    :style="{ '--hud-glass': String(hud.prefs.glass) }"
  >
    <template v-if="hud.prefs.enabled">
      <svg v-if="hud.prefs.tethers && tethers.length" class="hud-tethers" aria-hidden="true">
        <g v-for="line in tethers" :key="line.id" :class="{ busy: line.busy }">
          <line :x1="line.x1" :y1="line.y1" :x2="line.x2" :y2="line.y2" class="tether" />
          <circle :cx="line.x2" :cy="line.y2" r="3" class="tether-end" />
        </g>
        <circle :cx="hud.avatar.x" :cy="hud.avatar.y" r="5" class="tether-core" />
      </svg>

      <div
        v-if="hud.snapPreview"
        class="hud-snap-preview"
        :style="{
          left: `${hud.snapPreview.x}px`,
          top: `${hud.snapPreview.y}px`,
          width: `${hud.snapPreview.w}px`,
          height: `${hud.snapPreview.h}px`,
        }"
      ></div>

      <!-- Every window stays mounted while it exists: folded, on another screen or behind
           another tab, it is only hidden, so a page or a video keeps its place. -->
      <TransitionGroup name="hud-win">
        <component
          :is="WIDGETS[widget.kind]"
          v-for="widget in hud.widgets"
          v-show="hud.isShown(widget)"
          :key="widget.id"
          :widget="widget"
          :index="indexOf(widget)"
        />
      </TransitionGroup>

      <HudActionLog v-if="hud.prefs.actionLog" />
      <HudScreenBanner />
    </template>
    <HudDock />
  </div>
</template>

<style scoped>
.hud-tethers {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
}
.tether {
  stroke: rgba(var(--hud-rgb), 0.28);
  stroke-width: 1;
  stroke-dasharray: 2 7;
  animation: tether-flow 2.4s linear infinite;
}
.tether-end {
  fill: rgba(var(--hud-rgb), 0.7);
  filter: drop-shadow(0 0 4px rgba(var(--hud-rgb), 0.9));
}
.tether-core {
  fill: none;
  stroke: rgba(var(--hud-rgb), 0.5);
  stroke-width: 1;
}
.busy .tether {
  stroke: rgba(var(--hud-amber-rgb), 0.55);
  stroke-dasharray: 4 6;
  animation-duration: 0.9s;
}
.busy .tether-end {
  fill: var(--hud-amber);
}
@keyframes tether-flow {
  to {
    stroke-dashoffset: -36;
  }
}
@media (max-width: 767px) {
  .hud-tethers {
    display: none;
  }
}
</style>
