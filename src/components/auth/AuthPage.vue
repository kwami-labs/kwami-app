<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import WelcomeBlob from './WelcomeBlob.vue';
import LoginButton from './LoginButton.vue';

const { t } = useI18n();
const loginOpen = ref(false);
</script>

<template>
  <div class="page">
    <div class="ambient" aria-hidden="true" />

    <h1 class="hero-title" :class="{ 'hero-title--compact': loginOpen }" aria-label="kwami">
      <span class="title-main">KWAMI</span>
    </h1>

    <p class="title-sub" :class="{ 'title-sub--hidden': loginOpen }">THE AI THAT FEELS ALIVE</p>

    <LoginButton v-model:open="loginOpen" />

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
  background:
    radial-gradient(ellipse 120% 82% at 50% -20%, rgba(53, 158, 238, 0.1), transparent 55%),
    radial-gradient(ellipse 76% 55% at 82% 32%, rgba(239, 71, 111, 0.08), transparent 52%),
    radial-gradient(ellipse 76% 55% at 10% 70%, rgba(3, 206, 164, 0.08), transparent 50%),
    #06070a;
}

.ambient {
  position: fixed;
  top: -20%;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 1000px;
  height: 52%;
  background: radial-gradient(ellipse at center, rgba(53, 158, 238, 0.1) 0%, transparent 72%);
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
  transition: top 300ms ease, transform 300ms ease, z-index 300ms ease;
}

.hero-title--compact {
  top: 32%;
  transform: translate(-50%, -50%) scale(0.31);
  z-index: 46;
}

.title-main {
  display: block;
  font-size: clamp(3.2rem, 17vw, 10.2rem);
  font-weight: 900;
  line-height: 0.84;
  letter-spacing: 0.03em;
  color: #f6f8ff;
  text-shadow: 0 0 34px rgba(53, 158, 238, 0.22);
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
  color: rgba(180, 188, 210, 0.9);
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
  color: rgba(255, 255, 255, 0.3);
  margin: 0;
  letter-spacing: 0.5px;
}

@media (max-width: 900px) {
  .hero-title--compact {
    top: 31%;
    transform: translate(-50%, -50%) scale(0.28);
  }

  .title-sub {
    top: 60%;
  }

}
</style>
