<script setup lang="ts">
/**
 * The login screen's transport: play/pause, what is on, and a way to change it.
 *
 * Styled against `AuthPage`'s own glass idiom (literal rgba, blurred backdrop)
 * rather than the `--surface-*` / `--accent-*` theme tokens, which are what the
 * signed-in chrome is built on and are not what this screen is painted with.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useWelcomeSoundtrack } from '@/composables/useSoundtrack';

const { t } = useI18n();
const { currentTrack, isPlaying, toggle, next } = useWelcomeSoundtrack();

const toggleLabel = computed(() =>
  isPlaying.value ? t('musicPlayer.pauseTrack') : t('musicPlayer.playTrack'),
);
</script>

<template>
  <div class="soundtrack-pill" :class="{ 'soundtrack-pill--open': currentTrack !== null }">
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
        class="pill-btn"
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
  border: 1px solid rgba(255, 255, 255, 0.24);
  background: linear-gradient(
    130deg,
    rgba(255, 255, 255, 0.26) 0%,
    rgba(255, 255, 255, 0.12) 46%,
    rgba(255, 255, 255, 0.08) 100%
  );
  backdrop-filter: blur(18px) saturate(170%);
  -webkit-backdrop-filter: blur(18px) saturate(170%);
  box-shadow: 0 14px 38px rgba(16, 28, 56, 0.44);
  pointer-events: auto;
  transition:
    max-width 260ms ease,
    border-color 220ms ease,
    box-shadow 220ms ease;
}

.soundtrack-pill--open {
  border-color: rgba(255, 255, 255, 0.3);
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
  color: rgba(246, 248, 255, 0.86);
  cursor: pointer;
  text-decoration: none;
  transition:
    background 180ms ease,
    color 180ms ease,
    transform 180ms ease;
}

.pill-btn:hover {
  background: rgba(255, 255, 255, 0.16);
  color: #f7f9ff;
  transform: translateY(-1px);
}

.pill-btn:focus-visible {
  outline: 2px solid rgba(53, 158, 238, 0.85);
  outline-offset: 2px;
}

.pill-btn iconify-icon {
  font-size: 15px;
}

.pill-btn--main {
  background: rgba(255, 255, 255, 0.14);
  color: #f7f9ff;
}

.pill-btn--main iconify-icon {
  font-size: 16px;
}

.pill-btn--credit {
  color: rgba(246, 248, 255, 0.62);
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
  color: #f6f8ff;
}

.pill-sep {
  flex: 0 0 auto;
  color: rgba(180, 188, 210, 0.6);
}

.pill-artist {
  flex: 0 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  color: rgba(180, 188, 210, 0.92);
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
   crowds the hero wordmark. */
@media (max-width: 600px) {
  .pill-track,
  .pill-btn--credit {
    display: none;
  }
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
