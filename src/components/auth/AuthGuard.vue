<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useAuthStore } from '@/stores/auth';
import AuthPage from './AuthPage.vue';
import WelcomeRings from '@/components/welcome/WelcomeRings.vue';

const WELCOME_SOUND = '/welcome.mp3';
const MIN_WELCOME_MS = 3500;

const authStore = useAuthStore();
const showWelcomeLayer = ref(false);
const welcomeStartedAt = ref<number>(0);
let hideTimeoutId: ReturnType<typeof setTimeout> | null = null;

function playWelcomeSound() {
  try {
    const audio = new Audio(WELCOME_SOUND);
    audio.volume = 0.6;
    audio.play().catch(() => {});
  } catch {
    // ignore
  }
}

function hideWelcomeWhenReady() {
  if (hideTimeoutId) return;
  const elapsed = Date.now() - welcomeStartedAt.value;
  const remaining = Math.max(0, MIN_WELCOME_MS - elapsed);
  hideTimeoutId = setTimeout(() => {
    hideTimeoutId = null;
    showWelcomeLayer.value = false;
  }, remaining);
}

watch(
  () => authStore.loading,
  (loading) => {
    if (loading) {
      showWelcomeLayer.value = true;
      welcomeStartedAt.value = Date.now();
      playWelcomeSound();
    } else {
      hideWelcomeWhenReady();
    }
  },
  { immediate: true },
);

onMounted(() => {
  authStore.initAuth();
});

onUnmounted(() => {
  if (hideTimeoutId) clearTimeout(hideTimeoutId);
});
</script>

<template>
  <div class="auth-guard">
    <!-- Welcome layer: rings + wordmark (Vue component so it always renders) -->
    <Transition name="fade">
      <div v-if="showWelcomeLayer" class="loading-container welcome-layer">
        <WelcomeRings
          :ring-count="120"
          :ring-stroke-width="2"
          :base-radius-ratio="0.12"
          :cycle-seconds="6"
          :ring-pulse-px-per-index="4"
          :rotation-degrees-per-second="360"
          :animate-gradient="true"
          :include-wordmark="true"
          :opacity="1"
          :running="true"
          z-index="1"
        />
      </div>
    </Transition>

    <!-- App content (always rendered for canvas background) -->
    <div class="app-content" :class="{ 'behind-auth': showWelcomeLayer || (!authStore.isAuthenticated && !authStore.loading) }">
      <slot />
    </div>

    <!-- Auth overlay (shown when not authenticated and welcome is done) -->
    <Transition name="fade">
      <AuthPage v-if="!authStore.isAuthenticated && !showWelcomeLayer" />
    </Transition>
  </div>
</template>

<style scoped>
.auth-guard {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
}

.loading-container.welcome-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #050510 0%, #0a0a20 50%, #050510 100%);
  z-index: 2000;
}

.app-content {
  width: 100%;
  height: 100%;
  transition: filter 0.3s ease;
}

/* When auth overlay is shown, slightly blur the background canvas */
.app-content.behind-auth {
  pointer-events: none;
}

/* Fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
