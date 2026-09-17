<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useNavigation } from '@/composables/useNavigation';

const { isActive, liveUrl, currentUrl, currentTitle, requestBrowserClose } = useNavigation();
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

onUnmounted(clearLoadTimer);

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
</script>

<template>
  <Transition name="browser-panel">
    <div
      v-if="showPanel && liveUrl"
        id="kwami-browser-panel"
        class="browser-panel"
      >
        <!-- Header bar -->
        <div class="browser-panel__header">
          <div class="browser-panel__url-bar">
            <div class="browser-panel__url-dot browser-panel__url-dot--green" />
            <span class="browser-panel__url-text" :title="currentUrl">
              {{ displayUrl || t('browser.loading') }}
            </span>
          </div>
          <div class="browser-panel__actions">
            <span v-if="currentTitle" class="browser-panel__title">{{ currentTitle }}</span>
            <button
              class="browser-panel__close"
              :title="t('browser.close')"
              :aria-label="t('browser.close')"
              @click="handleClose"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
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
            allow="autoplay; clipboard-write"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            referrerpolicy="no-referrer"
            @load="onIframeLoad"
            @error="onIframeError"
          />
        </div>
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
  flex: 1; /* Takes 50% of the screen */
  height: 100vh;
  z-index: 900;
  overflow: hidden;
  background: #0d0d0f; /* Solid dark background to prevent iframe bleed */
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0;
}

/* Header bar */
.browser-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
  user-select: none;
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

.browser-panel__url-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.browser-panel__actions {
  display: flex;
  align-items: center;
  gap: 10px;
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

.browser-panel__close {
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
  transition: all 0.15s ease;
}

.browser-panel__close:hover {
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

/* Enter/leave transitions (slide from side) */
.browser-panel-enter-active,
.browser-panel-leave-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.browser-panel-enter-from,
.browser-panel-leave-to {
  opacity: 0;
  flex: 0 0 0px;
  min-width: 0;
}

/* Responsive: stack vertically on small screens */
@media (max-width: 640px) {
  .browser-panel {
    border-left: none;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
}
</style>
