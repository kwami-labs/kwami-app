<script setup lang="ts">
/**
 * The login screen's transport: play/pause, what is on, a way to change it, and
 * how fast the avatar behind it reinvents itself.
 *
 * Styled against `AuthPage`'s own glass idiom -- the `--auth-*` tokens in
 * `variables.css` -- rather than the `--surface-*` / `--accent-*` theme tokens,
 * which are what the signed-in chrome is built on and are not what this screen
 * is painted with.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useWelcomeSoundtrack } from '@/composables/useSoundtrack';
import { useWelcomeRandomizer } from '@/composables/useWelcomeRandomizer';

/**
 * `loginOpen` collapses the pill to its play button. The login panel grew an
 * email form, and at small viewport sizes the expanded pill runs underneath it
 * — still clickable, since the pill sits above, but sitting over the form is
 * not what a background soundtrack control should be doing.
 */
const props = withDefaults(defineProps<{ loginOpen?: boolean }>(), { loginOpen: false });

const { t } = useI18n();
const { currentTrack, isPlaying, toggle, next } = useWelcomeSoundtrack();
const { intervalSeconds, cycleInterval } = useWelcomeRandomizer();

const toggleLabel = computed(() =>
  isPlaying.value ? t('musicPlayer.pauseTrack') : t('musicPlayer.playTrack'),
);

const randomizeLabel = computed(() =>
  t('welcomeScreen.randomizeEvery', { seconds: intervalSeconds.value }),
);
</script>

<template>
  <div
    class="soundtrack-pill"
    :class="{
      'soundtrack-pill--open': currentTrack !== null,
      'soundtrack-pill--compact': props.loginOpen,
    }"
  >
    <button
      class="pill-btn pill-btn--main"
      type="button"
      :aria-pressed="isPlaying"
      :title="toggleLabel"
      :aria-label="toggleLabel"
      @click="toggle"
    >
      <iconify-icon :icon="isPlaying ? 'ph:pause-fill' : 'ph:play-fill'"></iconify-icon>
    </button>

    <button
      class="pill-btn pill-btn--rate"
      type="button"
      :title="randomizeLabel"
      :aria-label="randomizeLabel"
      @click="cycleInterval"
    >
      <span aria-hidden="true">{{ intervalSeconds }}s</span>
    </button>

    <template v-if="currentTrack">
      <p class="pill-track" aria-live="polite">
        <span class="sr-only">{{ t('musicPlayer.nowPlaying') }}</span>
        <span class="pill-title">{{ currentTrack.title }}</span>
        <span class="pill-sep" aria-hidden="true">·</span>
        <span class="pill-artist">{{ currentTrack.artist }}</span>
      </p>

      <a
        v-if="currentTrack.youtube"
        class="pill-btn pill-btn--credit"
        :href="currentTrack.youtube"
        target="_blank"
        rel="noopener noreferrer"
        :title="t('musicPlayer.openOnYoutube')"
        :aria-label="t('musicPlayer.openOnYoutube')"
      >
        <iconify-icon icon="ph:youtube-logo-fill"></iconify-icon>
      </a>

      <button
        class="pill-btn pill-btn--next"
        type="button"
        :title="t('musicPlayer.nextTrack')"
        :aria-label="t('musicPlayer.nextTrack')"
        @click="next"
      >
        <iconify-icon icon="ph:skip-forward-fill"></iconify-icon>
      </button>
    </template>
  </div>
</template>

<style scoped>
.soundtrack-pill {
  /* Above AuthPage's own stack, which tops out at 46 (the compact wordmark),
     so the pill stays live while the login panel is open. */
  position: fixed;
  left: 20px;
  bottom: 20px;
  z-index: 47;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  max-width: min(420px, calc(100vw - 40px));
  border-radius: 999px;
  border: 1px solid var(--auth-glass-border);
  background: var(--auth-glass-bg);
  backdrop-filter: blur(18px) saturate(170%);
  -webkit-backdrop-filter: blur(18px) saturate(170%);
  box-shadow: var(--auth-glass-shadow);
  pointer-events: auto;
  transition:
    max-width 260ms ease,
    border-color 220ms ease,
    box-shadow 220ms ease;
}

.soundtrack-pill--open {
  border-color: var(--auth-glass-border-strong);
}

.pill-btn {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--auth-icon);
  cursor: pointer;
  text-decoration: none;
  transition:
    background 180ms ease,
    color 180ms ease,
    transform 180ms ease;
}

.pill-btn:hover {
  background: var(--auth-hover-fill);
  color: var(--auth-icon-strong);
  transform: translateY(-1px);
}

.pill-btn:focus-visible {
  outline: 2px solid var(--auth-focus-ring);
  outline-offset: 2px;
}

.pill-btn iconify-icon {
  font-size: 15px;
}

.pill-btn--main {
  background: var(--auth-active-fill);
  color: var(--auth-icon-strong);
}

.pill-btn--main iconify-icon {
  font-size: 16px;
}

.pill-btn--credit {
  color: var(--auth-icon-dim);
}

.pill-btn--rate {
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.01em;
  color: var(--auth-icon-dim);
}

.pill-track {
  min-width: 0;
  margin: 0;
  padding: 0 4px;
  display: flex;
  align-items: baseline;
  gap: 5px;
  font-size: 12px;
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
}

.pill-title {
  flex: 0 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 700;
  color: var(--auth-text);
}

.pill-sep {
  flex: 0 0 auto;
  color: var(--auth-text-dim);
}

.pill-artist {
  flex: 0 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--auth-text-muted);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Narrow screens: keep the transport, drop the credit line, so the pill never
   crowds the hero wordmark. Same treatment while the login panel is open, which
   is when the screen has the least room to spare. */
@media (max-width: 600px) {
  .pill-track,
  .pill-btn--credit {
    display: none;
  }
}

/* The rate button survives both, unlike the transport: it drives the avatar,
   which is the whole screen, and it is the one control with nothing to read. */
.soundtrack-pill--compact .pill-track,
.soundtrack-pill--compact .pill-btn--credit,
.soundtrack-pill--compact .pill-btn:not(.pill-btn--main):not(.pill-btn--rate) {
  display: none;
}

@media (prefers-reduced-motion: reduce) {
  .soundtrack-pill,
  .pill-btn {
    transition: none;
  }

  .pill-btn:hover {
    transform: none;
  }
}
</style>
