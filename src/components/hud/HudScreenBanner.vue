<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useHudStore } from '@/stores/hud';

/**
 * Which screen this is, said for a moment as it comes into view (by click, Ctrl+Alt and
 * a number or an arrow, or Jarvis), and where a window went when it was dropped on
 * another screen's tab. Screens look alike; without it the user could not tell which
 * one they were on.
 */
const { t } = useI18n();
const hud = useHudStore();

const SHOW_MS = 1300;
const shown = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;

const notice = computed(() => {
  const n = hud.screenNotice;
  if (!n) return null;
  const index = hud.screens.findIndex((s) => s.id === n.screen);
  if (index === -1) return null;
  const name = hud.screens[index].name || t('hud.screens.default', { n: index + 1 });
  const count = hud.windowsOn(n.screen);
  return {
    number: index + 1,
    name,
    detail: n.moved
      ? t('hud.screens.movedThere', { title: n.moved })
      : count
        ? t('hud.screens.windows', { n: count }, count)
        : t('hud.screens.empty'),
  };
});

watch(
  () => hud.screenNotice?.at,
  (at) => {
    if (!at) return;
    shown.value = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => (shown.value = false), SHOW_MS);
  },
);

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer);
});
</script>

<template>
  <Transition name="hud-banner">
    <div v-if="shown && notice" class="hud-screen-banner" role="status" aria-live="polite">
      <span class="banner-n">{{ notice.number }}</span>
      <span class="banner-text">
        <strong>{{ notice.name }}</strong>
        <small>{{ notice.detail }}</small>
      </span>
    </div>
  </Transition>
</template>

<style scoped>
.hud-screen-banner {
  position: absolute;
  left: 50%;
  top: 18%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 22px 12px 14px;
  border: 1px solid var(--hud-line);
  background: rgba(4, 16, 24, 0.82);
  box-shadow:
    0 0 32px rgba(var(--hud-rgb), 0.25),
    inset 0 0 24px rgba(var(--hud-rgb), 0.08);
  clip-path: polygon(
    12px 0,
    100% 0,
    100% calc(100% - 12px),
    calc(100% - 12px) 100%,
    0 100%,
    0 12px
  );
  pointer-events: none;
  z-index: 950;
}
.banner-n {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: 1px solid var(--hud-line);
  font-family: var(--hud-mono);
  font-size: 20px;
  font-weight: 700;
  color: var(--hud-accent);
  text-shadow: 0 0 12px rgba(var(--hud-rgb), 0.7);
}
.banner-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.banner-text strong {
  font-family: var(--hud-font);
  font-size: 18px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--hud-text);
}
.banner-text small {
  font-family: var(--hud-mono);
  font-size: 11.5px;
  color: var(--hud-dim);
}

.hud-banner-enter-active,
.hud-banner-leave-active {
  transition:
    opacity 0.18s ease-out,
    transform 0.18s ease-out;
}
.hud-banner-enter-from,
.hud-banner-leave-to {
  opacity: 0;
  transform: translate(-50%, -8px);
}
</style>
