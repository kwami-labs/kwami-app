<script setup lang="ts">
/**
 * The live cloud-browser panel.
 *
 * It renders in three layouts (see `stores/navigation.ts`): docked as a split
 * pane, floating as a draggable window, or expanded to fullscreen. The agent
 * drives the same actions by voice through `set_browser_panel`, so everything
 * here goes through the store rather than local component state -- otherwise
 * "make the browser bigger" and clicking the expand button would diverge.
 *
 * Two things about dragging a window that contains an iframe:
 *
 * 1. **The iframe eats the pointer.** As soon as the cursor crosses into it,
 *    mousemove goes to the iframe's document, not ours, and the drag stops
 *    dead halfway. A transparent shield is laid over the iframe for the
 *    duration of every drag and resize.
 * 2. **Pointer capture is not enough on its own**, because the capture is on
 *    our header element and the events still never reach it from inside the
 *    iframe. Capture handles the cursor leaving the *window*; the shield
 *    handles it entering the iframe. Both are needed.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useNavigation } from '@/composables/useNavigation';
import { type BrowserPanelLayout } from '@/stores/navigation';

const {
  isActive,
  liveUrl,
  currentUrl,
  currentTitle,
  isPersistent,
  layout,
  floatingRect,
  isManipulating,
  isFloating,
  isFullscreen,
  setLayout,
  setRect,
  syncToViewport,
  centerPanel,
  setManipulating,
  requestBrowserClose,
} = useNavigation();
const { t } = useI18n();

const isLoaded = ref(false);
const showPanel = ref(false);
const hasError = ref(false);
const hasTimedOut = ref(false);
/** Bumped to force the iframe to remount on retry. */
const reloadKey = ref(0);

/**
 * The iframe's `load` event never fires when the session URL 404s, the session
 * has expired, or the target sends X-Frame-Options — so the skeleton spun
 * forever with no way out.
 */
const LOAD_TIMEOUT_MS = 20_000;
let loadTimer: ReturnType<typeof setTimeout> | null = null;

function clearLoadTimer() {
  if (loadTimer) {
    clearTimeout(loadTimer);
    loadTimer = null;
  }
}

function startLoadTimer() {
  clearLoadTimer();
  loadTimer = setTimeout(() => {
    if (!isLoaded.value) hasTimedOut.value = true;
  }, LOAD_TIMEOUT_MS);
}

// Animate in when active with a liveUrl
watch(
  () => isActive.value && !!liveUrl.value,
  (shouldShow) => {
    isLoaded.value = false;
    hasError.value = false;
    hasTimedOut.value = false;
    if (shouldShow) {
      startLoadTimer();
      // Trigger enter animation on next frame
      requestAnimationFrame(() => {
        showPanel.value = true;
      });
    } else {
      clearLoadTimer();
      showPanel.value = false;
    }
  },
  { immediate: true },
);

function onIframeLoad() {
  isLoaded.value = true;
  hasError.value = false;
  hasTimedOut.value = false;
  clearLoadTimer();
}

function onIframeError() {
  hasError.value = true;
  clearLoadTimer();
}

function retry() {
  hasError.value = false;
  hasTimedOut.value = false;
  isLoaded.value = false;
  reloadKey.value += 1;
  startLoadTimer();
}

const isFailed = computed(() => hasError.value || hasTimedOut.value);

function handleClose() {
  requestBrowserClose();
}

const displayUrl = computed(() => {
  if (!currentUrl.value) return '';
  try {
    const u = new URL(currentUrl.value);
    return u.hostname + (u.pathname !== '/' ? u.pathname : '');
  } catch {
    return currentUrl.value;
  }
});

const iframeSrc = computed(() => liveUrl.value || '');

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/**
 * Where fullscreen returns to. Captured on the way in, because "collapse"
 * meaning "go back to docked" would silently undo a user who was floating.
 */
const layoutBeforeFullscreen = ref<BrowserPanelLayout>('docked');

function expand() {
  if (isFullscreen.value) return;
  layoutBeforeFullscreen.value = layout.value;
  setLayout('fullscreen');
}

function collapse() {
  setLayout(layoutBeforeFullscreen.value === 'fullscreen' ? 'docked' : layoutBeforeFullscreen.value);
}

function toggleExpanded() {
  if (isFullscreen.value) collapse();
  else expand();
}

function toggleFloating() {
  if (isFloating.value) setLayout('docked');
  else {
    layoutBeforeFullscreen.value = 'floating';
    setLayout('floating');
  }
}

/** Escape leaves fullscreen — the panel covers everything, including its own chrome. */
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isFullscreen.value) {
    event.stopPropagation();
    collapse();
  }
}

const floatingStyle = computed(() => {
  if (!isFloating.value) return undefined;
  const { x, y, width, height } = floatingRect.value;
  return {
    left: `${x}px`,
    top: `${y}px`,
    width: `${width}px`,
    height: `${height}px`,
  };
});

// ---------------------------------------------------------------------------
// Drag and resize
// ---------------------------------------------------------------------------

type Gesture = {
  mode: 'move' | 'resize';
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  originWidth: number;
  originHeight: number;
  target: HTMLElement;
};

let gesture: Gesture | null = null;

function beginGesture(mode: Gesture['mode'], event: PointerEvent) {
  // Only the floating layout has anything to move or resize, and only a
  // primary-button drag should start one -- a right-click on the header is a
  // context menu, not a gesture.
  if (!isFloating.value || event.button !== 0) return;

  const target = event.currentTarget as HTMLElement;
  gesture = {
    mode,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originX: floatingRect.value.x,
    originY: floatingRect.value.y,
    originWidth: floatingRect.value.width,
    originHeight: floatingRect.value.height,
    target,
  };

  try {
    target.setPointerCapture(event.pointerId);
  } catch {
    // Capture is an optimisation for the cursor leaving the window; the
    // listeners below still work without it.
  }
  setManipulating(true);
  event.preventDefault();
}

function onPointerMove(event: PointerEvent) {
  if (!gesture || event.pointerId !== gesture.pointerId) return;
  const dx = event.clientX - gesture.startX;
  const dy = event.clientY - gesture.startY;

  if (gesture.mode === 'move') {
    setRect({ x: gesture.originX + dx, y: gesture.originY + dy });
  } else {
    setRect({
      width: gesture.originWidth + dx,
      height: gesture.originHeight + dy,
    });
  }
}

function endGesture(event: PointerEvent) {
  if (!gesture || event.pointerId !== gesture.pointerId) return;
  try {
    gesture.target.releasePointerCapture(gesture.pointerId);
  } catch {
    // Already released, or never captured.
  }
  gesture = null;
  setManipulating(false);
}

/**
 * Nudge the panel with the keyboard.
 *
 * A pointer drag is not available to everyone, and a panel that can only be
 * moved by dragging is a panel some users cannot move at all.
 */
const NUDGE = 24;
function onHeaderKeydown(event: KeyboardEvent) {
  if (!isFloating.value) return;
  const moves: Record<string, [number, number]> = {
    ArrowLeft: [-NUDGE, 0],
    ArrowRight: [NUDGE, 0],
    ArrowUp: [0, -NUDGE],
    ArrowDown: [0, NUDGE],
  };
  const delta = moves[event.key];
  if (!delta) return;
  event.preventDefault();
  setRect({ x: floatingRect.value.x + delta[0], y: floatingRect.value.y + delta[1] });
}

function onResizeKeydown(event: KeyboardEvent) {
  if (!isFloating.value) return;
  const sizes: Record<string, [number, number]> = {
    ArrowLeft: [-NUDGE, 0],
    ArrowRight: [NUDGE, 0],
    ArrowUp: [0, -NUDGE],
    ArrowDown: [0, NUDGE],
  };
  const delta = sizes[event.key];
  if (!delta) return;
  event.preventDefault();
  setRect({
    width: floatingRect.value.width + delta[0],
    height: floatingRect.value.height + delta[1],
  });
}

function onWindowResize() {
  syncToViewport();
}

onMounted(() => {
  window.addEventListener('resize', onWindowResize);
  // A panel restored from a previous session on a bigger monitor can land
  // entirely off-screen, with no header to grab and no close button to click.
  syncToViewport();
});

onBeforeUnmount(() => {
  clearLoadTimer();
  window.removeEventListener('resize', onWindowResize);
  setManipulating(false);
});
</script>

<template>
  <Transition name="browser-panel">
    <div
      v-if="showPanel && liveUrl"
      id="kwami-browser-panel"
      class="browser-panel"
      :class="[`browser-panel--${layout}`, { 'browser-panel--busy': isManipulating }]"
      :style="floatingStyle"
      role="region"
      :aria-label="t('browser.panelLabel')"
      @keydown="onKeydown"
    >
      <!-- Header bar: also the drag handle when floating -->
      <div
        class="browser-panel__header"
        :class="{ 'browser-panel__header--draggable': isFloating }"
        :tabindex="isFloating ? 0 : -1"
        :role="isFloating ? 'button' : undefined"
        :aria-label="isFloating ? t('browser.moveHint') : undefined"
        @pointerdown="beginGesture('move', $event)"
        @pointermove="onPointerMove"
        @pointerup="endGesture"
        @pointercancel="endGesture"
        @keydown="onHeaderKeydown"
        @dblclick="toggleExpanded"
      >
        <div class="browser-panel__url-bar">
          <div
            class="browser-panel__url-dot"
            :class="
              isPersistent
                ? 'browser-panel__url-dot--green'
                : 'browser-panel__url-dot--amber'
            "
            :title="isPersistent ? t('browser.signedInHint') : t('browser.ephemeralHint')"
          />
          <span class="browser-panel__url-text" :title="currentUrl">
            {{ displayUrl || t('browser.loading') }}
          </span>
          <span v-if="!isPersistent" class="browser-panel__badge">
            {{ t('browser.ephemeral') }}
          </span>
        </div>
        <div class="browser-panel__actions">
          <span v-if="currentTitle" class="browser-panel__title">{{ currentTitle }}</span>

          <button
            v-if="isFloating"
            class="browser-panel__btn"
            :title="t('browser.center')"
            :aria-label="t('browser.center')"
            @pointerdown.stop
            @click="centerPanel"
          >
            <iconify-icon icon="ph:crosshair-simple" aria-hidden="true" />
          </button>

          <button
            class="browser-panel__btn"
            :title="isFloating ? t('browser.dock') : t('browser.float')"
            :aria-label="isFloating ? t('browser.dock') : t('browser.float')"
            :aria-pressed="isFloating"
            @pointerdown.stop
            @click="toggleFloating"
          >
            <iconify-icon
              :icon="isFloating ? 'ph:sidebar-simple' : 'ph:browsers'"
              aria-hidden="true"
            />
          </button>

          <button
            class="browser-panel__btn"
            :title="isFullscreen ? t('browser.collapse') : t('browser.expand')"
            :aria-label="isFullscreen ? t('browser.collapse') : t('browser.expand')"
            :aria-pressed="isFullscreen"
            @pointerdown.stop
            @click="toggleExpanded"
          >
            <iconify-icon
              :icon="isFullscreen ? 'ph:corners-in' : 'ph:corners-out'"
              aria-hidden="true"
            />
          </button>

          <button
            class="browser-panel__btn browser-panel__btn--close"
            :title="t('browser.close')"
            :aria-label="t('browser.close')"
            @pointerdown.stop
            @click="handleClose"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path
                d="M1 1L13 13M13 1L1 13"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      <!-- Browser iframe -->
      <div class="browser-panel__viewport">
        <!-- Failure state: the iframe's load event never fires for a 404,
             an expired session or an X-Frame-Options refusal. -->
        <div v-if="isFailed" class="browser-panel__error" role="alert">
          <iconify-icon icon="ph:warning-circle-duotone" aria-hidden="true" />
          <p class="browser-panel__error-title">
            {{ hasTimedOut ? t('browser.timeout') : t('browser.error') }}
          </p>
          <p class="browser-panel__error-hint">{{ t('browser.errorHint') }}</p>
          <div class="browser-panel__error-actions">
            <button class="browser-panel__retry" @click="retry">{{ t('browser.retry') }}</button>
            <button class="browser-panel__retry" @click="handleClose">
              {{ t('browser.close') }}
            </button>
          </div>
        </div>

        <!-- Loading skeleton -->
        <div v-else-if="!isLoaded" class="browser-panel__skeleton">
          <div class="browser-panel__skeleton-pulse" />
          <span class="browser-panel__skeleton-text">{{ t('browser.connecting') }}</span>
        </div>

        <iframe
          v-if="iframeSrc && !isFailed"
          :key="reloadKey"
          :src="iframeSrc"
          class="browser-panel__iframe"
          :title="t('browser.panelLabel')"
          allow="autoplay; clipboard-write"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          referrerpolicy="no-referrer"
          @load="onIframeLoad"
          @error="onIframeError"
        />

        <!-- Pointer shield. Without it a drag dies the instant the cursor
             crosses into the iframe, because the events go to its document. -->
        <div v-if="isManipulating" class="browser-panel__shield" aria-hidden="true" />
      </div>

      <!-- Resize grip (floating only) -->
      <button
        v-if="isFloating"
        class="browser-panel__grip"
        :title="t('browser.resizeHint')"
        :aria-label="t('browser.resizeHint')"
        @pointerdown="beginGesture('resize', $event)"
        @pointermove="onPointerMove"
        @pointerup="endGesture"
        @pointercancel="endGesture"
        @keydown="onResizeKeydown"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path
            d="M11 5L5 11M11 9L9 11"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.browser-panel__error {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  text-align: center;
}
.browser-panel__error iconify-icon {
  font-size: 32px;
  color: var(--danger, #ef4444);
}
.browser-panel__error-title {
  margin: 0;
  font-weight: 600;
}
.browser-panel__error-hint {
  margin: 0;
  max-width: 36ch;
  font-size: 12px;
  opacity: 0.7;
}
.browser-panel__error-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}
.browser-panel__retry {
  padding: 6px 14px;
  font-size: 12px;
  border-radius: 6px;
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.15));
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.browser-panel__retry:hover {
  background: var(--bg-hover, rgba(255, 255, 255, 0.06));
}

.browser-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #0d0d0f; /* Solid dark background to prevent iframe bleed */
  border-left: 1px solid rgba(255, 255, 255, 0.08);
}

/* Docked: a split pane beside the avatar, sized by App.vue's splitter. */
.browser-panel--docked {
  flex: 1;
  height: 100vh;
  z-index: 900;
  border-radius: 0;
}

/* Floating: a window over the scene, positioned from the store. */
.browser-panel--floating {
  position: fixed;
  z-index: 1200;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  box-shadow:
    0 24px 64px rgba(0, 0, 0, 0.55),
    0 2px 8px rgba(0, 0, 0, 0.4);
}

/* Fullscreen: over everything, including the sidebar. */
.browser-panel--fullscreen {
  position: fixed;
  inset: 0;
  z-index: 1300;
  border: none;
  border-radius: 0;
}

/* While dragging, suppress the text selection a fast drag otherwise paints
   across the header and the page behind it. */
.browser-panel--busy {
  user-select: none;
}

/* Header bar */
.browser-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
  user-select: none;
}

.browser-panel__header--draggable {
  cursor: grab;
  touch-action: none; /* or the browser scrolls instead of dragging */
}
.browser-panel--busy .browser-panel__header--draggable {
  cursor: grabbing;
}
.browser-panel__header--draggable:focus-visible {
  outline: 2px solid var(--accent-primary, #6366f1);
  outline-offset: -2px;
}

.browser-panel__url-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.browser-panel__url-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.browser-panel__url-dot--green {
  background: #34d058;
  box-shadow: 0 0 6px rgba(52, 208, 88, 0.4);
}

/* Amber: the session is ephemeral, so nothing signed into will be kept. */
.browser-panel__url-dot--amber {
  background: #f0a52e;
  box-shadow: 0 0 6px rgba(240, 165, 46, 0.4);
}

.browser-panel__url-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.browser-panel__badge {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 10px;
  letter-spacing: 0.02em;
  color: #f0a52e;
  background: rgba(240, 165, 46, 0.12);
}

.browser-panel__actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.browser-panel__title {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
  max-width: 120px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.browser-panel__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.15s ease;
}

.browser-panel__btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.85);
}

.browser-panel__btn[aria-pressed='true'] {
  color: var(--accent-primary, #818cf8);
  background: rgba(129, 140, 248, 0.16);
}

.browser-panel__btn--close:hover {
  background: rgba(255, 70, 70, 0.2);
  color: #ff5555;
}

/* Viewport */
.browser-panel__viewport {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.browser-panel__iframe {
  width: 100%;
  height: 100%;
  border: none;
  background: #0d0d0f;
}

/* Covers the iframe so pointer events keep reaching us mid-gesture. */
.browser-panel__shield {
  position: absolute;
  inset: 0;
  z-index: 2;
  cursor: inherit;
}

/* Resize grip */
.browser-panel__grip {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.35);
  cursor: nwse-resize;
  touch-action: none;
  z-index: 3;
}
.browser-panel__grip:hover,
.browser-panel__grip:focus-visible {
  color: rgba(255, 255, 255, 0.8);
}

/* Loading skeleton */
.browser-panel__skeleton {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: #0d0d0f;
  z-index: 1;
}

.browser-panel__skeleton-pulse {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: conic-gradient(
    from 0deg,
    transparent 0%,
    rgba(99, 102, 241, 0.5) 30%,
    transparent 60%
  );
  animation: skeleton-spin 1.2s linear infinite;
}

.browser-panel__skeleton-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.35);
  letter-spacing: 0.02em;
}

@keyframes skeleton-spin {
  to { transform: rotate(360deg); }
}

/* Enter/leave transitions. The docked panel animates its flex basis as part of
   the split; the overlay layouts just fade, because animating `flex` on a
   fixed-position element does nothing and left it appearing with a jump. */
.browser-panel-enter-active,
.browser-panel-leave-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.browser-panel-enter-from.browser-panel--docked,
.browser-panel-leave-to.browser-panel--docked {
  opacity: 0;
  flex: 0 0 0px;
  min-width: 0;
}
.browser-panel-enter-from.browser-panel--floating,
.browser-panel-leave-to.browser-panel--floating,
.browser-panel-enter-from.browser-panel--fullscreen,
.browser-panel-leave-to.browser-panel--fullscreen {
  opacity: 0;
  transform: scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
  .browser-panel-enter-active,
  .browser-panel-leave-active {
    transition: opacity 0.15s linear;
  }
  .browser-panel-enter-from.browser-panel--floating,
  .browser-panel-leave-to.browser-panel--floating,
  .browser-panel-enter-from.browser-panel--fullscreen,
  .browser-panel-leave-to.browser-panel--fullscreen {
    transform: none;
  }
  .browser-panel__skeleton-pulse {
    animation: none;
  }
}

/* Responsive: on a small screen a floating window is unusable, so the panel
   stacks below the scene instead of hovering over it. */
@media (max-width: 640px) {
  .browser-panel--docked {
    border-left: none;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
  .browser-panel--floating {
    inset: auto 0 0 0;
    width: auto !important;
    height: 60vh !important;
    left: 0 !important;
    top: auto !important;
    border-radius: 12px 12px 0 0;
  }
  .browser-panel__grip {
    display: none;
  }
}
</style>
