<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import WelcomeBlob from './WelcomeBlob.vue';
import LoginButton from './LoginButton.vue';
import SoundtrackPill from './SoundtrackPill.vue';
import AuthPreferencesPill from './AuthPreferencesPill.vue';
import WelcomeVideoBackground from './WelcomeVideoBackground.vue';
import { useWelcomeBackground } from '@/composables/useWelcomeBackground';
import { useWelcomeSoundtrack } from '@/composables/useSoundtrack';
import { useWelcomeKwamiHit } from '@/composables/useWelcomeKwamiHit';
import { isAuthChromeTarget } from '@/utils/blobHitTest';

const { t } = useI18n();
const loginOpen = ref(false);
const { video, shuffle } = useWelcomeBackground();
const { currentTrack } = useWelcomeSoundtrack();
const { hitsKwami } = useWelcomeKwamiHit();
const youtubeOn = computed(() => Boolean(currentTrack.value?.youtube));

/**
 * Double-click the empty backdrop to roll another clip. The same shuffle as
 * the preferences pill — this is just a shorter reach. Clicks on the avatar,
 * the login chrome, or an open panel are someone else's gesture.
 */
function onBackgroundDblClick(event: MouseEvent) {
  if (loginOpen.value) return;
  if (isAuthChromeTarget(event.target)) return;
  if (hitsKwami(event.clientX, event.clientY)) return;
  shuffle();
}
</script>

<template>
  <div class="page" @dblclick="onBackgroundDblClick">
    <WelcomeVideoBackground />

    <!-- A blue glow tuned for the painted gradient; over a video it only
         muddies whatever is playing. -->
    <div v-if="!video && !youtubeOn" class="ambient" aria-hidden="true" />

    <h1 v-if="!loginOpen" class="hero-title" aria-label="kwami">
      <span class="title-main">KWAMI</span>
    </h1>

    <p class="title-sub" :class="{ 'title-sub--hidden': loginOpen }">THE AI THAT FEELS ALIVE</p>

    <LoginButton v-model:open="loginOpen" />

    <SoundtrackPill :login-open="loginOpen" />

    <p class="video-hint" :class="{ 'video-hint--hidden': loginOpen }">
      <span>{{ t('auth.backgroundDblclickHint') }}</span>
      <span>{{ t('auth.backgroundDblclickHintRest') }}</span>
    </p>
    <AuthPreferencesPill />

    <div class="blob-zone">
      <WelcomeBlob />
    </div>

    <div class="auth-footer">
      <p>{{ t('auth.footer') }}</p>
    </div>
  </div>
</template>

<style scoped>
.page {
  position: absolute;
  inset: 0;
  overflow: hidden;
  z-index: 1000;
  background: var(--auth-bg);
  transition: background 260ms ease;
}

.ambient {
  position: fixed;
  top: -20%;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 1000px;
  height: 52%;
  background: var(--auth-ambient);
  pointer-events: none;
  z-index: 0;
}

.hero-title {
  position: fixed;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 31;
  margin: 0;
  text-align: center;
  white-space: nowrap;
  pointer-events: none;
}

.title-main {
  display: block;
  font-size: clamp(3.2rem, 17vw, 10.2rem);
  font-weight: 900;
  line-height: 0.84;
  letter-spacing: 0.03em;
  color: var(--auth-text);
  text-shadow: var(--auth-title-glow);
}

.title-sub {
  position: fixed;
  left: 50%;
  top: 60%;
  transform: translateX(-50%);
  z-index: 31;
  margin: 0;
  font-size: clamp(0.75rem, 1.9vw, 1.1rem);
  letter-spacing: 0.42em;
  font-weight: 700;
  color: var(--auth-text-muted);
  text-align: center;
  white-space: nowrap;
  pointer-events: none;
  transition: opacity 220ms ease;
}

.title-sub--hidden {
  opacity: 0;
}

.blob-zone {
  position: fixed;
  inset: 0;
  z-index: 3;
  pointer-events: none;
}

.auth-footer {
  position: fixed;
  left: 50%;
  bottom: 20px;
  transform: translateX(-50%);
  text-align: center;
  z-index: 6;
  pointer-events: none;
}

.auth-footer p {
  font-size: 11px;
  color: var(--auth-text-faint);
  margin: 0;
  letter-spacing: 0.5px;
}

.video-hint {
  /* Same corner as AuthPreferencesPill (right/bottom 20px, ~42px tall). */
  position: fixed;
  right: 20px;
  bottom: 70px;
  z-index: 47;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin: 0;
  font-size: 10px;
  line-height: 1.35;
  letter-spacing: 0.12em;
  text-transform: lowercase;
  color: var(--auth-text-faint);
  text-align: right;
  pointer-events: none;
  transition: opacity 220ms ease;
}

.video-hint span {
  white-space: nowrap;
}

.video-hint--hidden {
  opacity: 0;
}

@media (max-width: 900px) {
  .title-sub {
    top: 60%;
  }
}
</style>
