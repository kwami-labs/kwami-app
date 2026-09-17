<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { useBlackHoleStore } from '@/stores/avatar.black-hole';
import { randomInRange } from '@/utils/color';
import PanelSection from '@/components/ui/PanelSection.vue';
import BaseSlider from '@/components/ui/BaseSlider.vue';
import BaseToggle from '@/components/ui/BaseToggle.vue';
import AudioVisualizer from './AudioVisualizer.vue';
import MicrophoneControl from './MicrophoneControl.vue';

const blackHoleStore = useBlackHoleStore();
const { audio } = storeToRefs(blackHoleStore);
const { t } = useI18n();

function randomizeAudio() {
  audio.value.reactivity = randomInRange(0.5, 2, 0.1);
  audio.value.smoothing = randomInRange(0.7, 0.95, 0.01);
}

function randomizeFrequencyEffects() {
  audio.value.frequencyEffects = {
    bassDiskGlow: randomInRange(0.2, 0.8, 0.05),
    midDiskSpeed: randomInRange(0.1, 0.5, 0.05),
    highStarTwinkle: randomInRange(0.2, 0.6, 0.05),
  };
}
</script>

<template>
  <PanelSection :title="t('audioPanel.blackHoleTitle')" icon="ph:waveform-duotone" collapsible>
    <p class="section-desc">{{ t('audioPanel.blackHoleDesc') }}</p>
  </PanelSection>

  <PanelSection :title="t('audioPanel.audioReactivity')" icon="ph:microphone-duotone" collapsible>
    <template #actions>
      <button class="dice-btn" @click="randomizeAudio" :title="t('audioPanel.randomizeAudioSettings')">
        <iconify-icon icon="ph:dice-three-duotone"></iconify-icon>
      </button>
    </template>
    <p class="section-desc">{{ t('audioPanel.blackHoleReactsToSound') }}</p>

    <div class="toggle-row">
      <BaseToggle :label="t('audioPanel.enableAudioEffects')" v-model="audio.enabled" />
    </div>

    <MicrophoneControl />
    <AudioVisualizer />

    <div v-if="audio.enabled" class="slider-group" style="margin-top: 12px">
      <BaseSlider :label="t('audioPanel.reactivity')" :min="0" :max="2" :step="0.1" v-model="audio.reactivity" />
      <BaseSlider :label="t('audioPanel.smoothing')" :min="0.5" :max="0.99" :step="0.01" v-model="audio.smoothing" />
    </div>
  </PanelSection>

  <PanelSection v-if="audio.enabled" :title="t('audioPanel.frequencyResponse')" icon="ph:equalizer-duotone" collapsible>
    <template #actions>
      <button class="dice-btn" @click="randomizeFrequencyEffects" :title="t('audioPanel.randomizeFrequencyResponse')">
        <iconify-icon icon="ph:dice-three-duotone"></iconify-icon>
      </button>
    </template>
    <p class="section-desc">{{ t('audioPanel.frequencyResponseDesc') }}</p>

    <div class="slider-group">
      <BaseSlider :label="t('audioPanel.bassDiskGlow')" :min="0" :max="1" :step="0.05" v-model="audio.frequencyEffects.bassDiskGlow" />
      <BaseSlider :label="t('audioPanel.midDiskSpeed')" :min="0" :max="1" :step="0.05" v-model="audio.frequencyEffects.midDiskSpeed" />
      <BaseSlider :label="t('audioPanel.highStarTwinkle')" :min="0" :max="1" :step="0.05" v-model="audio.frequencyEffects.highStarTwinkle" />
    </div>
  </PanelSection>
</template>

<style scoped>
@import '@/styles/avatar-settings.css';
</style>
