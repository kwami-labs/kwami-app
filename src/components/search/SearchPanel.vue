<script setup lang="ts">
/**
 * Search results as a window, rather than as cards orbiting the avatar.
 *
 * `SearchOrbitCards.vue` is still the default and still the nicer thing to
 * look at, but it is built for glancing at four or five results while the
 * avatar stays the centre of the screen. It cannot be scrolled, it cannot hold
 * twenty results, and it cannot be put somewhere out of the way while the user
 * reads. This is the same data in a panel that can.
 *
 * Layout state lives in `stores/search.ts` (on the shared core in
 * `lib/panelLayout.ts`), not in this component, for the same reason
 * `BrowserPanel.vue` does it that way: the agent drives expand, move and
 * resize by voice through `set_search_panel`, and a memory held here would
 * make "expand it, read it, put it back" behave differently from clicking the
 * same buttons.
 *
 * The drag handling mirrors BrowserPanel deliberately -- pointer capture for
 * the cursor leaving the window, plus keyboard nudges, because a panel that
 * can only be moved by dragging is a panel some users cannot move at all.
 * There is no iframe here, so this needs no pointer shield.
 */
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useSearchResults } from '@/composables/useSearchResults';

const {
  query,
  results,
  answer,
  error,
  isSearching,
  focusedIndex,
  hasResults,
  isWindowed,
  layout,
  rect,
  isFloating,
  isFullscreen,
  setLayout,
  collapseFullscreen,
  toggleFullscreen,
  setRect,
  syncToViewport,
  centerPanel,
  setManipulating,
  focusResult,
  removeResultAt,
  clear,
} = useSearchResults();

const { t } = useI18n();

const isVisible = computed(
  () => isWindowed.value && (hasResults.value || isSearching.value || !!error.value),
);

const floatingStyle = computed(() => {
  if (!isFloating.value) return undefined;
  const { x, y, width, height } = rect.value;
  return {
    left: `${x}px`,
    top: `${y}px`,
    width: `${width}px`,
    height: `${height}px`,
  };
});

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Open a result in the cloud browser panel.
 *
 * Asks the agent rather than navigating here, so the page opens in the same
 * Browserbase session that carries the user's logins -- opening it in a raw
 * iframe would land them signed out of everything.
 */
function openInBrowser(url: string, index: number) {
  if (!url) return;
  focusResult(index);
  const payload = new TextEncoder().encode(
    JSON.stringify({ type: 'browser_open_request', url }),
  );
  window.dispatchEvent(new CustomEvent('kwami:send_data', { detail: payload }));
}

function toggleDocked() {
  setLayout(isFloating.value ? 'docked' : 'floating');
}

function closePanel() {
  // Back to the orbit cards rather than clearing the results: the user asked
  // for a different presentation, not to throw the search away.
  setLayout('docked');
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isFullscreen.value) {
    event.stopPropagation();
    collapseFullscreen();
  }
}

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
  // Only the floating layout has anything to move, and only a primary-button
  // drag should start one -- a right-click on the header is a context menu.
  if (!isFloating.value || event.button !== 0) return;

  const target = event.currentTarget as HTMLElement;
  gesture = {
    mode,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originX: rect.value.x,
    originY: rect.value.y,
    originWidth: rect.value.width,
    originHeight: rect.value.height,
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
    setRect({ width: gesture.originWidth + dx, height: gesture.originHeight + dy });
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

const NUDGE = 24;
const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-NUDGE, 0],
  ArrowRight: [NUDGE, 0],
  ArrowUp: [0, -NUDGE],
  ArrowDown: [0, NUDGE],
};

function onHeaderKeydown(event: KeyboardEvent) {
  if (!isFloating.value) return;
  const delta = ARROWS[event.key];
  if (!delta) return;
  event.preventDefault();
  setRect({ x: rect.value.x + delta[0], y: rect.value.y + delta[1] });
}

function onResizeKeydown(event: KeyboardEvent) {
  if (!isFloating.value) return;
  const delta = ARROWS[event.key];
  if (!delta) return;
  event.preventDefault();
  setRect({ width: rect.value.width + delta[0], height: rect.value.height + delta[1] });
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
  window.removeEventListener('resize', onWindowResize);
  setManipulating(false);
});
</script>

<template>
  <Transition name="search-panel">
    <div
      v-if="isVisible"
      id="kwami-search-panel"
      class="search-panel"
      :class="`search-panel--${layout}`"
      :style="floatingStyle"
      role="region"
      :aria-label="t('searchPanel.panelLabel')"
      @keydown="onKeydown"
    >
      <div
        class="search-panel__header"
        :class="{ 'search-panel__header--draggable': isFloating }"
        :tabindex="isFloating ? 0 : -1"
        :role="isFloating ? 'button' : undefined"
        :aria-label="isFloating ? t('searchPanel.moveHint') : undefined"
        @pointerdown="beginGesture('move', $event)"
        @pointermove="onPointerMove"
        @pointerup="endGesture"
        @pointercancel="endGesture"
        @keydown="onHeaderKeydown"
        @dblclick="toggleFullscreen"
      >
        <div class="search-panel__title">
          <iconify-icon icon="ph:magnifying-glass" />
          <span class="search-panel__query">{{ query || t('searchPanel.untitled') }}</span>
          <span v-if="results.length" class="search-panel__count">{{ results.length }}</span>
        </div>

        <div class="search-panel__actions">
          <button
            type="button"
            class="search-panel__button"
            :aria-label="t('searchPanel.centerHint')"
            :title="t('searchPanel.centerHint')"
            :disabled="!isFloating"
            @click="centerPanel"
          >
            <iconify-icon icon="ph:crosshair-simple" />
          </button>
          <button
            type="button"
            class="search-panel__button"
            :aria-label="isFloating ? t('searchPanel.dockHint') : t('searchPanel.floatHint')"
            :title="isFloating ? t('searchPanel.dockHint') : t('searchPanel.floatHint')"
            @click="toggleDocked"
          >
            <iconify-icon :icon="isFloating ? 'ph:circles-three' : 'ph:browsers'" />
          </button>
          <button
            type="button"
            class="search-panel__button"
            :aria-label="isFullscreen ? t('searchPanel.collapseHint') : t('searchPanel.expandHint')"
            :title="isFullscreen ? t('searchPanel.collapseHint') : t('searchPanel.expandHint')"
            @click="toggleFullscreen"
          >
            <iconify-icon :icon="isFullscreen ? 'ph:corners-in' : 'ph:corners-out'" />
          </button>
          <button
            type="button"
            class="search-panel__button"
            :aria-label="t('searchPanel.closeHint')"
            :title="t('searchPanel.closeHint')"
            @click="closePanel"
          >
            <iconify-icon icon="ph:x" />
          </button>
        </div>
      </div>

      <div class="search-panel__body">
        <p v-if="error" class="search-panel__error">{{ error }}</p>

        <p v-else-if="isSearching" class="search-panel__status">
          {{ t('searchPanel.searching') }}
        </p>

        <template v-else>
          <p v-if="answer" class="search-panel__answer">{{ answer }}</p>

          <p v-if="!results.length" class="search-panel__status">
            {{ t('searchPanel.noResults') }}
          </p>

          <ol v-else class="search-panel__list">
            <li
              v-for="(result, index) in results"
              :key="`${result.url}-${index}`"
              class="search-panel__item"
              :class="{ 'search-panel__item--focused': index === focusedIndex }"
            >
              <img
                v-if="result.image"
                class="search-panel__thumb"
                :src="result.image"
                :alt="''"
                loading="lazy"
              />
              <div class="search-panel__item-body">
                <p class="search-panel__item-title">
                  {{ result.product_name || result.title }}
                </p>
                <p class="search-panel__item-host">
                  {{ hostOf(result.url) }}
                  <span v-if="result.price" class="search-panel__price">{{ result.price }}</span>
                </p>
                <p v-if="result.content" class="search-panel__item-snippet">
                  {{ result.content }}
                </p>
                <ul v-if="result.features?.length" class="search-panel__features">
                  <li v-for="feature in result.features" :key="feature">{{ feature }}</li>
                </ul>
                <div class="search-panel__item-actions">
                  <button
                    type="button"
                    class="search-panel__link"
                    @click="openInBrowser(result.url, index)"
                  >
                    {{ t('searchPanel.openInBrowser') }}
                  </button>
                  <!-- The user's own browser, for anything the cloud session
                       should not or cannot load. -->
                  <a
                    class="search-panel__link search-panel__link--muted"
                    :href="result.url"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {{ t('searchPanel.openInTab') }}
                  </a>
                  <button
                    type="button"
                    class="search-panel__link search-panel__link--muted"
                    @click="removeResultAt(index)"
                  >
                    {{ t('searchPanel.dismiss') }}
                  </button>
                </div>
              </div>
            </li>
          </ol>
        </template>
      </div>

      <div class="search-panel__footer">
        <button type="button" class="search-panel__link search-panel__link--muted" @click="clear">
          {{ t('searchPanel.clearAll') }}
        </button>
      </div>

      <div
        v-if="isFloating"
        class="search-panel__resize"
        role="slider"
        tabindex="0"
        :aria-label="t('searchPanel.resizeHint')"
        :aria-valuenow="rect.width"
        :aria-valuemin="320"
        :aria-valuemax="4096"
        @pointerdown="beginGesture('resize', $event)"
        @pointermove="onPointerMove"
        @pointerup="endGesture"
        @pointercancel="endGesture"
        @keydown="onResizeKeydown"
      />
    </div>
  </Transition>
</template>

<style scoped>
.search-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-panel, #0d0d0f);
  color: var(--text-primary, #f5f5f5);
}

/* Floating: a window over the scene, positioned from the store. */
.search-panel--floating {
  position: fixed;
  z-index: 1180; /* Just under the browser panel, which the user opens second. */
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.12));
  border-radius: 12px;
  box-shadow:
    0 24px 64px rgba(0, 0, 0, 0.55),
    0 2px 8px rgba(0, 0, 0, 0.4);
}

.search-panel--fullscreen {
  position: fixed;
  inset: 0;
  z-index: 1300;
  border-radius: 0;
}

.search-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
  flex: 0 0 auto;
}
.search-panel__header--draggable {
  cursor: grab;
  touch-action: none;
}
.search-panel__header--draggable:active {
  cursor: grabbing;
}

.search-panel__title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 13px;
}
.search-panel__query {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.search-panel__count {
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 11px;
  background: var(--bg-hover, rgba(255, 255, 255, 0.08));
}

.search-panel__actions {
  display: flex;
  gap: 2px;
  flex: 0 0 auto;
}
.search-panel__button {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 15px;
}
.search-panel__button:hover:not(:disabled) {
  background: var(--bg-hover, rgba(255, 255, 255, 0.08));
}
.search-panel__button:disabled {
  opacity: 0.35;
  cursor: default;
}

.search-panel__body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 10px 12px;
}

.search-panel__status,
.search-panel__error {
  margin: 12px 0;
  font-size: 13px;
  opacity: 0.75;
}
.search-panel__error {
  color: var(--danger, #ef4444);
  opacity: 1;
}

.search-panel__answer {
  margin: 0 0 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--bg-hover, rgba(255, 255, 255, 0.05));
  font-size: 13px;
  line-height: 1.5;
}

.search-panel__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.search-panel__item {
  display: flex;
  gap: 10px;
  padding: 10px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: var(--bg-hover, rgba(255, 255, 255, 0.04));
}
.search-panel__item--focused {
  border-color: var(--accent-primary, #6ea8fe);
}

.search-panel__thumb {
  width: 64px;
  height: 64px;
  flex: 0 0 auto;
  object-fit: cover;
  border-radius: 8px;
}

.search-panel__item-body {
  min-width: 0;
  flex: 1 1 auto;
}
.search-panel__item-title {
  margin: 0 0 2px;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.35;
}
.search-panel__item-host {
  margin: 0 0 4px;
  font-size: 11px;
  opacity: 0.6;
  display: flex;
  gap: 8px;
}
.search-panel__price {
  opacity: 1;
  font-weight: 600;
}
.search-panel__item-snippet {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  opacity: 0.8;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.search-panel__features {
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.search-panel__features li {
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 10px;
  background: var(--bg-hover, rgba(255, 255, 255, 0.08));
}

.search-panel__item-actions {
  display: flex;
  gap: 10px;
  margin-top: 6px;
}

.search-panel__link {
  padding: 0;
  border: none;
  background: none;
  color: var(--accent-primary, #6ea8fe);
  font-size: 11px;
  cursor: pointer;
  text-decoration: none;
}
.search-panel__link:hover {
  text-decoration: underline;
}
.search-panel__link--muted {
  color: inherit;
  opacity: 0.6;
}

.search-panel__footer {
  flex: 0 0 auto;
  padding: 6px 12px;
  border-top: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
}

.search-panel__resize {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 18px;
  height: 18px;
  cursor: nwse-resize;
  touch-action: none;
}
.search-panel__resize::after {
  content: '';
  position: absolute;
  right: 4px;
  bottom: 4px;
  width: 8px;
  height: 8px;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  opacity: 0.4;
}

.search-panel-enter-active,
.search-panel-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}
.search-panel-enter-from,
.search-panel-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@media (prefers-reduced-motion: reduce) {
  .search-panel-enter-active,
  .search-panel-leave-active {
    transition: none;
  }
}
</style>
