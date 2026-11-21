<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useHudStore, type HudKind, type HudWidget, type SizePreset } from '@/stores/hud';
import {
  isFeatured,
  magnetRect,
  resizeRect,
  snapRect,
  snapZoneAt,
  type HudRect,
  type ResizeEdge,
  type SnapZone,
} from '@/lib/hud/layout';

/**
 * The frame every HUD window shares: the chamfered glass panel, the ruled header
 * with its code, title (or tabs) and status, and the controls.
 *
 * Arranging is direct: drag by the header (to an edge or a corner to snap to a half
 * or a quarter, onto another window's header to become one of its tabs), or with Alt
 * held from anywhere in it; resize from any edge or corner; edges are drawn to the
 * screen's and to other windows' as they come near (Shift holds that off). In edit
 * mode the whole window drags and big controls size, feature, pin or close it.
 * Double-click the title to rename it, the header to maximise it; middle-click the
 * header to close it. Pointer events throughout, so a finger works as well as a mouse,
 * and the pointer is captured, so a page or a video under it never steals a drag.
 */
const props = defineProps<{
  widget: HudWidget;
  /** The readout before the title, e.g. `TSK-04`. */
  code: string;
  icon: string;
  status?: 'live' | 'running' | 'done' | 'error' | 'idle';
  statusLabel?: string;
}>();

const emit = defineEmits<{ (e: 'manipulating', active: boolean): void }>();

const { t } = useI18n();
const hud = useHudStore();

const KIND_ICONS: Record<HudKind, string> = {
  task: 'ph:brain-duotone',
  document: 'ph:article-ny-times-duotone',
  video: 'ph:film-strip-duotone',
  web: 'ph:globe-hemisphere-west-duotone',
  image: 'ph:image-duotone',
  browser: 'ph:browser-duotone',
  tool: 'ph:plugs-connected-duotone',
};

const rect = computed(() => hud.rectOf(props.widget));
const focused = computed(() =>
  hud.membersOf(props.widget).some((member) => member.id === hud.focusedId),
);
const tabs = computed(() => hud.membersOf(props.widget));
const dragging = ref(false);
const isDropTarget = computed(() => tabs.value.some((member) => member.id === hud.dropTarget));

// Placed with `translate`, not left/top: a drag then only moves a composited layer
// instead of repainting the glass and its shadows every frame.
const style = computed(() => ({
  translate: `${rect.value.x}px ${rect.value.y}px`,
  width: `${rect.value.w}px`,
  height: `${rect.value.h}px`,
  zIndex: String(props.widget.z),
}));

const EDGES: readonly ResizeEdge[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
const SIZES: readonly SizePreset[] = ['small', 'medium', 'large'];
const featured = computed(() => isFeatured(props.widget.kind));

// -- moving and resizing ------------------------------------------------------------

/** Below this travel a press is a click, not a drag: nothing moves, nothing is learnt. */
const DRAG_THRESHOLD = 4;

let origin: { px: number; py: number; x: number; y: number; w: number; h: number } | null = null;
let layerBox: DOMRect | null = null;
let mode: 'move' | ResizeEdge = 'move';
let frame = 0;
let pending: { x: number; y: number; free: boolean } | null = null;
let zone: SnapZone | null = null;
let moved = false;
let captured: { el: Element; id: number } | null = null;
const root = ref<HTMLElement | null>(null);
/** The size while it is being resized, shown on the window. */
const readout = ref('');

/**
 * Start moving (`move`) or resizing from an edge. From the header, a press on one of its
 * buttons or fields is theirs; from the body only in edit mode or with Alt held.
 */
function begin(e: PointerEvent, how: 'move' | ResizeEdge, from: 'head' | 'body' | 'grip' = 'grip') {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (from === 'body' && !hud.editing && !e.altKey) return;
  if (
    from !== 'grip' &&
    (e.target as HTMLElement).closest('button, input, select, textarea, a, [contenteditable]')
  ) {
    return;
  }
  e.preventDefault();
  e.stopPropagation();
  hud.focus(props.widget.id);
  layerBox = (root.value?.offsetParent as HTMLElement | null)?.getBoundingClientRect() ?? null;
  const r = rect.value;
  origin = { px: e.clientX, py: e.clientY, x: r.x, y: r.y, w: r.w, h: r.h };
  if (how === 'move' && props.widget.maximized) {
    // Dragged out of maximised: back to its own size, under the pointer where it was held.
    const saved = props.widget.rect;
    const along = (e.clientX - (layerBox?.left ?? 0) - r.x) / Math.max(1, r.w);
    origin.x = e.clientX - (layerBox?.left ?? 0) - along * saved.w;
    origin.w = saved.w;
    origin.h = saved.h;
  }
  mode = how;
  moved = false;
  try {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    captured = { el: e.currentTarget as Element, id: e.pointerId };
  } catch {
    captured = null;
  }
  dragging.value = true;
  hud.beginManipulate();
  emit('manipulating', true);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
}

function move(e: PointerEvent) {
  pending = { x: e.clientX, y: e.clientY, free: e.shiftKey };
  if (frame) return;
  frame = requestAnimationFrame(apply);
}

/** The other windows on screen, which this one's edges are drawn to. */
function othersRects(): HudRect[] {
  const own = new Set(tabs.value.map((member) => member.id));
  return hud.visible.filter((w) => !own.has(w.id)).map((w) => hud.rectOf(w));
}

/** The window under the pointer whose header would take this one as a tab. */
function headerUnder(x: number, y: number): string | null {
  const own = new Set(tabs.value.map((member) => member.id));
  for (const el of document.elementsFromPoint(x, y)) {
    const head = el.closest('.hud-head');
    const win = head?.closest<HTMLElement>('.hud-win');
    const id = win?.dataset.hudId;
    if (id && !own.has(id)) return id;
  }
  return null;
}

function apply() {
  frame = 0;
  if (!origin || !pending) return;
  const dx = pending.x - origin.px;
  const dy = pending.y - origin.py;
  // A press that has not travelled is a click: it must not end a grid or move anything.
  if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
  moved = true;
  const view = hud.viewport;
  if (mode === 'move') {
    let next: HudRect = { x: origin.x + dx, y: origin.y + dy, w: origin.w, h: origin.h };
    if (!pending.free) next = magnetRect(next, view, othersRects());
    hud.setRect(props.widget.id, next, true);
    const x = pending.x - (layerBox?.left ?? 0);
    const y = pending.y - (layerBox?.top ?? 0);
    hud.dropTarget = headerUnder(pending.x, pending.y);
    // An edge snaps only when the drag went toward it, not because the header began near it.
    zone = hud.dropTarget ? null : snapZoneAt(x, y, view, { dx, dy });
    hud.snapPreview = zone ? snapRect(zone, view) : null;
  } else {
    let next = resizeRect(origin, mode, dx, dy, view);
    if (!pending.free) next = magnetRect(next, view, othersRects(), mode);
    hud.setRect(props.widget.id, next, true);
    const now = hud.rectOf(props.widget);
    readout.value = `${Math.round(now.w)} × ${Math.round(now.h)}`;
  }
}

function end() {
  if (frame) cancelAnimationFrame(frame);
  apply();
  frame = 0;
  const target = hud.dropTarget;
  if (moved && mode === 'move' && target) hud.joinTabs(props.widget.id, target);
  else if (moved && mode === 'move' && zone) hud.snap(props.widget.id, zone);
  // Where the user put it by hand is where they like that kind of window.
  if (moved && !target) hud.learnPlacement(props.widget.id);
  hud.dropTarget = null;
  hud.snapPreview = null;
  zone = null;
  origin = null;
  pending = null;
  moved = false;
  readout.value = '';
  if (captured?.el.hasPointerCapture(captured.id)) captured.el.releasePointerCapture(captured.id);
  captured = null;
  dragging.value = false;
  hud.endManipulate();
  emit('manipulating', false);
  window.removeEventListener('pointermove', move);
  window.removeEventListener('pointerup', end);
  window.removeEventListener('pointercancel', end);
}

function onHeaderDoubleClick(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('button, input, .hud-title, .hud-tab')) return;
  hud.toggleMaximize(props.widget.id);
}

/** A middle click on the header closes the window, as on a browser's tab. */
function onHeaderAuxClick(e: MouseEvent) {
  if (e.button !== 1 || (e.target as HTMLElement).closest('.hud-tab, button, input')) return;
  e.preventDefault();
  hud.close(props.widget.id);
}

function sizeTo(size: SizePreset) {
  hud.resizeTo(props.widget.id, size);
}

// -- renaming ---------------------------------------------------------------------------

const renaming = ref(false);
const draft = ref('');
const renameInput = ref<HTMLInputElement | null>(null);

async function startRename() {
  menuOpen.value = false;
  draft.value = props.widget.title;
  renaming.value = true;
  await nextTick();
  renameInput.value?.select();
}

function finishRename(save: boolean) {
  if (save) hud.rename(props.widget.id, draft.value);
  renaming.value = false;
}

// -- the menu ----------------------------------------------------------------------------

const menuOpen = ref(false);
watch(menuOpen, (open, was) => {
  if (open !== was) hud.hideNative(open);
});

const otherScreens = computed(() =>
  hud.screens
    .map((screen, i) => ({
      ...screen,
      label: screen.name || t('hud.screens.default', { n: i + 1 }),
    }))
    .filter((screen) => screen.id !== props.widget.screen),
);

function moveTo(screenId: string) {
  hud.moveToScreen(props.widget.id, screenId);
  menuOpen.value = false;
}

function moveToNewScreen() {
  const here = hud.activeScreen;
  const screen = hud.addScreen();
  if (screen) {
    hud.moveToScreen(props.widget.id, screen.id);
    hud.switchScreen(here);
    hud.switchScreen(screen.id);
  }
  menuOpen.value = false;
}

function snapTo(where: SnapZone) {
  hud.snap(props.widget.id, where);
  menuOpen.value = false;
}

function detach() {
  hud.detachTab(props.widget.id);
  menuOpen.value = false;
}

onBeforeUnmount(() => {
  if (origin) end();
  if (menuOpen.value) hud.hideNative(false);
});
</script>

<template>
  <section
    ref="root"
    class="hud-win"
    :class="{
      'is-focused': focused,
      'is-dragging': dragging,
      'is-maximized': widget.maximized,
      'is-running': status === 'running',
      'is-drop-target': isDropTarget,
    }"
    :style="style"
    :data-hud-kind="widget.kind"
    :data-hud-id="widget.id"
    role="dialog"
    :aria-label="widget.title"
    @pointerdown.capture="hud.focus(widget.id)"
  >
    <div class="hud-shell">
      <div class="hud-inner">
        <header
          class="hud-head"
          @pointerdown="begin($event, 'move', 'head')"
          @dblclick="onHeaderDoubleClick"
          @mousedown.middle.prevent
          @auxclick="onHeaderAuxClick"
        >
          <span class="hud-code">{{ code }}</span>
          <template v-if="tabs.length > 1">
            <div class="hud-tabs" role="tablist">
              <div
                v-for="tab in tabs"
                :key="tab.id"
                class="hud-tab"
                :class="{ active: tab.id === widget.id }"
                role="tab"
                :aria-selected="tab.id === widget.id"
                :title="tab.title"
                @click="hud.activateTab(tab.id)"
                @auxclick.prevent="$event.button === 1 && hud.close(tab.id)"
              >
                <iconify-icon :icon="KIND_ICONS[tab.kind]"></iconify-icon>
                <span class="tab-title">{{ tab.title }}</span>
                <button
                  type="button"
                  class="tab-btn"
                  :title="t('hud.window.detach')"
                  @click.stop="hud.detachTab(tab.id)"
                >
                  <iconify-icon icon="ph:arrow-square-up-right"></iconify-icon>
                </button>
                <button
                  type="button"
                  class="tab-btn"
                  :title="t('hud.window.close')"
                  @click.stop="hud.close(tab.id)"
                >
                  <iconify-icon icon="ph:x"></iconify-icon>
                </button>
              </div>
            </div>
          </template>
          <template v-else>
            <iconify-icon :icon="icon" class="hud-head-icon"></iconify-icon>
            <input
              v-if="renaming"
              ref="renameInput"
              v-model="draft"
              class="hud-title-input"
              :aria-label="t('hud.window.rename')"
              @keydown.enter.prevent="finishRename(true)"
              @keydown.esc.prevent="finishRename(false)"
              @blur="finishRename(true)"
            />
            <h3
              v-else
              class="hud-title"
              :title="`${widget.title} · ${t('hud.window.renameHint')}`"
              @dblclick.stop="startRename"
            >
              {{ widget.title }}
            </h3>
          </template>
          <slot name="head" />
          <span v-if="status" class="hud-status" :class="status">{{ statusLabel }}</span>
          <div class="hud-btns">
            <div class="hud-menu-wrap">
              <button
                type="button"
                class="hud-icon-btn"
                :class="{ 'is-on': menuOpen }"
                :title="t('hud.window.menu')"
                :aria-expanded="menuOpen"
                @click="menuOpen = !menuOpen"
              >
                <iconify-icon icon="ph:dots-three-vertical-bold"></iconify-icon>
              </button>
              <div v-if="menuOpen" class="hud-menu" role="menu" @pointerdown.stop>
                <button type="button" role="menuitem" @click="startRename">
                  <iconify-icon icon="ph:pencil-simple"></iconify-icon>{{ t('hud.window.rename') }}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  @click="
                    hud.togglePin(widget.id);
                    menuOpen = false;
                  "
                >
                  <iconify-icon
                    :icon="widget.pinned ? 'ph:push-pin-slash' : 'ph:push-pin'"
                  ></iconify-icon
                  >{{ widget.pinned ? t('hud.window.unpin') : t('hud.window.pin') }}
                </button>
                <button
                  v-if="featured"
                  type="button"
                  role="menuitem"
                  @click="
                    hud.feature(widget.id);
                    menuOpen = false;
                  "
                >
                  <iconify-icon icon="ph:presentation"></iconify-icon>{{ t('hud.window.feature') }}
                </button>
                <span class="hud-menu-label">{{ t('hud.window.size') }}</span>
                <div class="hud-menu-row">
                  <button
                    v-for="size in SIZES"
                    :key="size"
                    type="button"
                    class="hud-size-btn"
                    :title="t(`hud.window.sizes.${size}`)"
                    @click="
                      sizeTo(size);
                      menuOpen = false;
                    "
                  >
                    {{ t(`hud.window.sizeShort.${size}`) }}
                  </button>
                </div>
                <button v-if="widget.group" type="button" role="menuitem" @click="detach">
                  <iconify-icon icon="ph:arrow-square-up-right"></iconify-icon
                  >{{ t('hud.window.detach') }}
                </button>
                <span class="hud-menu-label">{{ t('hud.window.snap') }}</span>
                <div class="hud-menu-row">
                  <button type="button" :title="t('hud.window.snapLeft')" @click="snapTo('left')">
                    <iconify-icon icon="ph:square-split-horizontal"></iconify-icon>
                  </button>
                  <button type="button" :title="t('hud.window.snapRight')" @click="snapTo('right')">
                    <iconify-icon
                      icon="ph:square-split-horizontal"
                      flip="horizontal"
                    ></iconify-icon>
                  </button>
                  <button
                    type="button"
                    :title="t('hud.window.snapTopLeft')"
                    @click="snapTo('topLeft')"
                  >
                    <iconify-icon icon="ph:arrow-up-left"></iconify-icon>
                  </button>
                  <button
                    type="button"
                    :title="t('hud.window.snapTopRight')"
                    @click="snapTo('topRight')"
                  >
                    <iconify-icon icon="ph:arrow-up-right"></iconify-icon>
                  </button>
                  <button
                    type="button"
                    :title="t('hud.window.snapBottomLeft')"
                    @click="snapTo('bottomLeft')"
                  >
                    <iconify-icon icon="ph:arrow-down-left"></iconify-icon>
                  </button>
                  <button
                    type="button"
                    :title="t('hud.window.snapBottomRight')"
                    @click="snapTo('bottomRight')"
                  >
                    <iconify-icon icon="ph:arrow-down-right"></iconify-icon>
                  </button>
                </div>
                <span class="hud-menu-label">{{ t('hud.window.moveTo') }}</span>
                <button
                  v-for="screen in otherScreens"
                  :key="screen.id"
                  type="button"
                  role="menuitem"
                  @click="moveTo(screen.id)"
                >
                  <iconify-icon icon="ph:monitor"></iconify-icon>{{ screen.label }}
                </button>
                <button type="button" role="menuitem" @click="moveToNewScreen">
                  <iconify-icon icon="ph:plus"></iconify-icon>{{ t('hud.screens.new') }}
                </button>
              </div>
            </div>
            <button
              type="button"
              class="hud-icon-btn hud-pin-btn"
              :class="{ 'is-on': widget.pinned }"
              :title="widget.pinned ? t('hud.window.unpin') : t('hud.window.pin')"
              :aria-pressed="widget.pinned"
              @click="hud.togglePin(widget.id)"
            >
              <iconify-icon
                :icon="widget.pinned ? 'ph:push-pin-fill' : 'ph:push-pin'"
              ></iconify-icon>
            </button>
            <button
              type="button"
              class="hud-icon-btn"
              :title="t('hud.window.minimize')"
              @click="hud.minimize(widget.id)"
            >
              <iconify-icon icon="ph:minus"></iconify-icon>
            </button>
            <button
              type="button"
              class="hud-icon-btn"
              :title="widget.maximized ? t('hud.window.restore') : t('hud.window.maximize')"
              @click="hud.toggleMaximize(widget.id)"
            >
              <iconify-icon
                :icon="widget.maximized ? 'ph:corners-in' : 'ph:corners-out'"
              ></iconify-icon>
            </button>
            <button
              type="button"
              class="hud-icon-btn danger"
              :title="t('hud.window.close')"
              @click="hud.close(widget.id)"
            >
              <iconify-icon icon="ph:x"></iconify-icon>
            </button>
          </div>
        </header>
        <div class="hud-body" @pointerdown="begin($event, 'move', 'body')">
          <slot />
          <!-- Edit mode: the whole window drags, and its controls are big enough to hit. -->
          <div v-if="hud.editing" class="hud-edit">
            <span class="hud-edit-size">{{ Math.round(rect.w) }} × {{ Math.round(rect.h) }}</span>
            <div class="hud-edit-row">
              <button
                v-for="size in SIZES"
                :key="size"
                type="button"
                class="hud-edit-btn"
                :title="t(`hud.window.sizes.${size}`)"
                @click="sizeTo(size)"
              >
                {{ t(`hud.window.sizeShort.${size}`) }}
              </button>
            </div>
            <div class="hud-edit-row">
              <button
                v-if="featured"
                type="button"
                class="hud-edit-btn"
                :title="t('hud.window.feature')"
                @click="hud.feature(widget.id)"
              >
                <iconify-icon icon="ph:presentation"></iconify-icon>
              </button>
              <button
                type="button"
                class="hud-edit-btn"
                :title="widget.maximized ? t('hud.window.restore') : t('hud.window.maximize')"
                @click="hud.toggleMaximize(widget.id)"
              >
                <iconify-icon
                  :icon="widget.maximized ? 'ph:corners-in' : 'ph:corners-out'"
                ></iconify-icon>
              </button>
              <button
                type="button"
                class="hud-edit-btn"
                :class="{ 'is-on': widget.pinned }"
                :title="widget.pinned ? t('hud.window.unpin') : t('hud.window.pin')"
                @click="hud.togglePin(widget.id)"
              >
                <iconify-icon
                  :icon="widget.pinned ? 'ph:push-pin-fill' : 'ph:push-pin'"
                ></iconify-icon>
              </button>
              <button
                type="button"
                class="hud-edit-btn"
                :title="t('hud.window.minimize')"
                @click="hud.minimize(widget.id)"
              >
                <iconify-icon icon="ph:minus"></iconify-icon>
              </button>
              <button
                type="button"
                class="hud-edit-btn danger"
                :title="t('hud.window.close')"
                @click="hud.close(widget.id)"
              >
                <iconify-icon icon="ph:x-bold"></iconify-icon>
              </button>
            </div>
          </div>
        </div>
        <footer v-if="$slots.footer" class="hud-foot">
          <slot name="footer" />
        </footer>
      </div>
    </div>
    <span class="hud-bracket tr"></span>
    <span class="hud-bracket bl"></span>
    <template v-if="!widget.maximized">
      <div
        v-for="edge in EDGES"
        :key="edge"
        class="hud-grip"
        :class="`g-${edge}`"
        :title="edge === 'se' ? t('hud.window.resize') : undefined"
        @pointerdown="begin($event, edge)"
      ></div>
    </template>
    <span v-if="readout" class="hud-readout">{{ readout }}</span>
  </section>
</template>
