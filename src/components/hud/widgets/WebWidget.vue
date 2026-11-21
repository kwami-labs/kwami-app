<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import HudWindow from '../HudWindow.vue';
import { useHudStore, type HudWidget } from '@/stores/hud';
import { hostOf, safeHttpUrl } from '@/lib/hud/media';
import {
  claimNative,
  nativeRect,
  nativeWeb,
  nativeWebAvailable,
  onNativeWebEvent,
  ownsNative,
  releaseNative,
} from '@/lib/hud/nativeWeb';
import { openExternal } from '@/lib/hud/external';

/**
 * A web page on Jarvis's screen instead of in another program.
 *
 * In the desktop app the page is a native web view laid exactly over this window's
 * body, so every site shows (an iframe is refused by most). It follows the window as
 * it moves and resizes, and steps aside when the window folds into the dock, when
 * another window lies on top of it, or while a menu is open. In the web app it is an
 * iframe, and the window says that some sites will not show there.
 */
const props = defineProps<{ widget: HudWidget; index: number }>();

const { t } = useI18n();
const hud = useHudStore();

/** The native view, until it fails to open: then the iframe, rather than a blank window. */
const native = ref(nativeWebAvailable());
const label = computed(() => props.widget.id.replace(/[^A-Za-z0-9-]/g, '-'));
/** This mount: the view is driven by its newest window only (lib/hud/nativeWeb). */
const owner = Symbol('hud-web');
const mine = () => ownsNative(label.value, owner);
const code = computed(() => `WEB-${String(props.index + 1).padStart(2, '0')}`);

const address = ref(props.widget.url ?? '');
const shown = ref(props.widget.url ?? '');
const typed = ref(address.value);
const loading = ref(true);
const zoom = ref(1);
const opened = ref(false);
const body = ref<HTMLElement | null>(null);
const manipulating = ref(false);

/** The sidebar's panel lies over this window: the native view would cover the panel. */
const underPanel = computed(() => hud.underCover(props.widget));

const visibleNow = computed(
  () =>
    hud.isShown(props.widget) &&
    !manipulating.value &&
    hud.nativeHidden === 0 &&
    !underPanel.value &&
    !hud.covered(props.widget),
);

function bounds() {
  const box = body.value?.getBoundingClientRect();
  return box ? { x: box.left, y: box.top, width: box.width, height: box.height } : null;
}

/** While the window unfolds its body is scaled: measured then, the view is a sliver. */
function unfolding(): boolean {
  const win = body.value?.closest('.hud-win');
  return !!win?.getAnimations?.().some((animation) => animation.playState === 'running');
}

let frame = 0;
/** What the view was last told, so an unchanged frame costs no call to the app. */
let told = '';
/** Opens that failed so far: a few are retried before the window falls back to an iframe. */
let failures = 0;
const OPEN_RETRIES = 3;
/** Unmounted: an open still in flight must close what it opens. */
let disposed = false;
function sync() {
  if (!native.value || frame || disposed) return;
  frame = requestAnimationFrame(async () => {
    frame = 0;
    if (!mine()) return;
    const box = bounds();
    if (!box) return;
    if (unfolding()) {
      setTimeout(sync, 120);
      return;
    }
    try {
      if (!opened.value) {
        if (!shown.value) return;
        await nativeWeb.open(label.value, shown.value, box);
        opened.value = true;
        failures = 0;
        if (disposed || !mine()) return;
        told = `${Math.round(box.x)},${Math.round(box.y)},${Math.round(box.width)},${Math.round(box.height)}`;
        if (!visibleNow.value) {
          await nativeWeb.place(label.value, box, false);
          told = 'hidden';
        }
        return;
      }
      const onScreen = visibleNow.value;
      const wanted = onScreen
        ? `${Math.round(box.x)},${Math.round(box.y)},${Math.round(box.width)},${Math.round(box.height)}`
        : 'hidden';
      if (wanted === told) return;
      told = wanted;
      await nativeWeb.place(label.value, box, onScreen);
    } catch (e) {
      if (opened.value || disposed || !mine()) {
        // A move the view missed: the next one sends it again.
        told = '';
        return;
      }
      failures += 1;
      if (failures < OPEN_RETRIES) {
        setTimeout(sync, 250 * 2 ** failures);
        return;
      }
      console.warn('[HUD] web view could not open; showing the page in a frame', e);
      // Never both: a view half made by the failed opens would lie over the frame.
      void nativeWeb.close(label.value).catch(() => {});
      native.value = false;
      shown.value = address.value;
    }
  });
}

function go(raw: string) {
  const url = safeHttpUrl(raw);
  if (!url) return;
  address.value = url;
  typed.value = url;
  loading.value = true;
  if (native.value && opened.value) void nativeWeb.navigate(label.value, url);
  else shown.value = url;
  sync();
}

function step(which: 'back' | 'forward' | 'reload') {
  if (native.value && opened.value) {
    void nativeWeb.history(label.value, which);
    return;
  }
  if (which === 'reload') {
    const current = shown.value;
    shown.value = '';
    void nextTick(() => (shown.value = current));
  }
}

function setZoom(delta: number) {
  zoom.value = Math.min(3, Math.max(0.3, Math.round((zoom.value + delta) * 10) / 10));
  if (native.value && opened.value) void nativeWeb.zoom(label.value, zoom.value);
}

let stopEvents: (() => void) | null = null;
let observer: ResizeObserver | null = null;

/** Send the bounds again, whatever was sent last: after the app comes back to the front. */
function resync() {
  told = '';
  sync();
}

/**
 * Every few seconds, whether the view is really over the window (in physical pixels),
 * and put it back if not: the one thing that cannot be allowed is a page lying
 * somewhere else on the app, whatever moved it there.
 */
const WATCH_MS = 3000;
let watchdog: ReturnType<typeof setInterval> | null = null;
async function check() {
  if (!native.value || !opened.value || !visibleNow.value || document.hidden || !mine()) return;
  const box = bounds();
  const real = await nativeRect(label.value);
  if (!box || !real) return;
  const dpr = window.devicePixelRatio || 1;
  const off =
    Math.abs(real.x - box.x * dpr) > 3 ||
    Math.abs(real.y - box.y * dpr) > 3 ||
    Math.abs(real.width - box.width * dpr) > 3 ||
    Math.abs(real.height - box.height * dpr) > 3;
  if (off) resync();
}

function onVisibility() {
  if (!document.hidden) resync();
}

function stopListening() {
  stopEvents?.();
  stopEvents = null;
}

onMounted(async () => {
  // A view left by this window's previous mount is taken over, not opened again.
  if (native.value && claimNative(label.value, owner)) opened.value = true;
  watchdog = setInterval(() => void check(), WATCH_MS);
  window.addEventListener('focus', resync);
  document.addEventListener('visibilitychange', onVisibility);
  // A reload unmounts nothing: the page-load listener would stay registered in the app,
  // and every later page load of the view would warn of a callback that is gone.
  window.addEventListener('pagehide', stopListening);
  observer = new ResizeObserver(() => sync());
  if (body.value) observer.observe(body.value);
  body.value?.closest('.hud-win')?.addEventListener('animationend', sync);
  window.addEventListener('resize', sync);
  stopEvents = await onNativeWebEvent((event) => {
    if (event.label !== label.value) return;
    loading.value = event.loading;
    address.value = event.url;
    if (document.activeElement?.getAttribute('data-hud-address') !== label.value) {
      typed.value = event.url;
    }
  });
  sync();
});

onBeforeUnmount(() => {
  if (frame) cancelAnimationFrame(frame);
  observer?.disconnect();
  window.removeEventListener('resize', sync);
  window.removeEventListener('focus', resync);
  document.removeEventListener('visibilitychange', onVisibility);
  window.removeEventListener('pagehide', stopListening);
  if (watchdog) clearInterval(watchdog);
  stopListening();
  disposed = true;
  // Closed a moment later, unless this window mounts again and takes it over; closed
  // even when not yet open, since the open may be on its way.
  if (native.value) releaseNative(label.value, owner);
});

watch(
  () => [hud.rectOf(props.widget), visibleNow.value, hud.viewport] as const,
  () => sync(),
  { deep: true },
);

// Opening the same window again with another address takes it there.
watch(
  () => props.widget.url,
  (url) => {
    if (url && url !== address.value) go(url);
  },
);

const host = computed(() => hostOf(address.value));
const secure = computed(() => address.value.startsWith('https://'));
</script>

<template>
  <HudWindow
    :widget="widget"
    :code="code"
    icon="ph:globe-hemisphere-west-duotone"
    :status="loading ? 'running' : 'live'"
    :status-label="loading ? t('hud.web.loading') : host"
    @manipulating="manipulating = $event"
  >
    <div class="web">
      <form class="web-bar" @submit.prevent="go(typed)">
        <button type="button" class="hud-icon-btn" :title="t('hud.web.back')" @click="step('back')">
          <iconify-icon icon="ph:arrow-left"></iconify-icon>
        </button>
        <button
          type="button"
          class="hud-icon-btn"
          :title="t('hud.web.forward')"
          @click="step('forward')"
        >
          <iconify-icon icon="ph:arrow-right"></iconify-icon>
        </button>
        <button
          type="button"
          class="hud-icon-btn"
          :title="t('hud.web.reload')"
          @click="step('reload')"
        >
          <iconify-icon
            :icon="loading ? 'ph:circle-notch' : 'ph:arrow-clockwise'"
            :class="{ 'hud-spin': loading }"
          ></iconify-icon>
        </button>
        <div class="web-address">
          <iconify-icon
            :icon="secure ? 'ph:lock-simple-duotone' : 'ph:warning-duotone'"
            :class="secure ? 'lock' : 'warn'"
          ></iconify-icon>
          <input
            v-model="typed"
            class="hud-input"
            :data-hud-address="label"
            :aria-label="t('hud.web.address')"
            spellcheck="false"
            @focus="($event.target as HTMLInputElement).select()"
          />
        </div>
        <button
          type="button"
          class="hud-icon-btn"
          :title="t('hud.web.zoomOut')"
          @click="setZoom(-0.1)"
        >
          <iconify-icon icon="ph:magnifying-glass-minus"></iconify-icon>
        </button>
        <span class="zoom">{{ Math.round(zoom * 100) }}%</span>
        <button
          type="button"
          class="hud-icon-btn"
          :title="t('hud.web.zoomIn')"
          @click="setZoom(0.1)"
        >
          <iconify-icon icon="ph:magnifying-glass-plus"></iconify-icon>
        </button>
        <button
          type="button"
          class="hud-icon-btn"
          :title="t('hud.web.openOutside')"
          @click="openExternal(address)"
        >
          <iconify-icon icon="ph:arrow-square-out"></iconify-icon>
        </button>
      </form>

      <div ref="body" class="web-body">
        <div v-if="native" class="web-native-placeholder">
          <div class="placeholder-grid" aria-hidden="true"></div>
          <iconify-icon
            icon="ph:globe-hemisphere-west-duotone"
            class="placeholder-icon"
          ></iconify-icon>
          <span class="placeholder-host">{{ host }}</span>
          <span v-if="underPanel" class="placeholder-note">{{ t('hud.web.underPanel') }}</span>
        </div>
        <iframe
          v-else-if="shown"
          :src="shown"
          :title="host"
          :style="{ zoom }"
          referrerpolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          @load="loading = false"
        ></iframe>
      </div>
    </div>
    <template #footer>
      <span>{{ native ? t('hud.web.readerHint') : t('hud.web.framed') }}</span>
    </template>
  </HudWindow>
</template>

<style scoped>
.web {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.web-bar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--hud-line-faint);
}

.web-address {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  margin: 0 4px;
}
.web-address iconify-icon {
  position: absolute;
  left: 8px;
  font-size: 13px;
}
.web-address .lock {
  color: var(--hud-green);
}
.web-address .warn {
  color: var(--hud-amber);
}
.web-address input {
  width: 100%;
  padding-left: 26px;
}

.zoom {
  min-width: 38px;
  text-align: center;
  font-family: var(--hud-mono);
  font-size: 10.5px;
  color: var(--hud-dim);
}

.web-body {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  background: #05090d;
}
.web-body iframe {
  flex: 1;
  border: 0;
  background: #fff;
}

.web-native-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--hud-dim);
}
.placeholder-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(var(--hud-rgb), 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(var(--hud-rgb), 0.06) 1px, transparent 1px);
  background-size: 24px 24px;
}
.placeholder-icon {
  font-size: 46px;
  color: rgba(var(--hud-rgb), 0.45);
}
.placeholder-note {
  position: relative;
  max-width: 80%;
  text-align: center;
  font-size: 12.5px;
  color: var(--hud-amber);
}
.placeholder-host {
  font-family: var(--hud-mono);
  font-size: 12px;
}
</style>
