<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { randomBlobAudio, randomBlobFrequencyBands } from 'kwami';
import { useBlobXyzStore } from '@/stores/avatar.blob-xyz';
import PanelSection from '@/components/ui/PanelSection.vue';
import BaseSlider from '@/components/ui/BaseSlider.vue';
import BaseToggle from '@/components/ui/BaseToggle.vue';
import AudioVisualizer from './AudioVisualizer.vue';
import MicrophoneControl from './MicrophoneControl.vue';

const blobStore = useBlobXyzStore();
const { audio } = storeToRefs(blobStore);
const { t } = useI18n();

function randomizeAudio() {
  Object.assign(audio.value, randomBlobAudio());
}

function randomizeFrequencyBands() {
  audio.value.frequencySpikes = randomBlobFrequencyBands();
}
</script>

<template>
  <PanelSection :title="t('audioPanel.blobTitle')" icon="ph:microphone-stage-duotone" collapsible>
    <p class="section-desc">{{ t('audioPanel.blobDesc') }}</p>
  </PanelSection>

  <PanelSection :title="t('audioPanel.audioReactivity')" icon="ph:microphone-duotone" collapsible>
    <template #actions>
      <button class="dice-btn" @click="randomizeAudio" :title="t('audioPanel.randomizeAudio')">
        <iconify-icon icon="ph:dice-three-duotone"></iconify-icon>
      </button>
    </template>
    <p class="section-desc">{{ t('audioPanel.reactsToSound') }}</p>
    <div class="toggle-row">
      <BaseToggle :label="t('audioPanel.enableAudioEffects')" v-model="audio.enabled" />
    </div>

    <MicrophoneControl />
    <AudioVisualizer />

    <div v-if="audio.enabled" class="slider-group" style="margin-top: 12px">
      <BaseSlider :label="t('audioPanel.intensity')" :description="t('audioPanel.intensityDesc')" :min="0.1" :max="4" :step="0.1" v-model="audio.reactivity" />
      <BaseSlider :label="t('audioPanel.spikeDensity')" :description="t('audioPanel.spikeDensityDesc')" :min="0" :max="4" :step="0.1" v-model="audio.spikeDensity" />
      <BaseSlider :label="t('audioPanel.threshold')" :description="t('audioPanel.thresholdDesc')" :min="0.01" :max="0.2" :step="0.005" v-model="audio.sensitivity" />
    </div>
  </PanelSection>

  <PanelSection v-if="audio.enabled" :title="t('audioPanel.audioDynamics')" icon="ph:waveform-duotone" collapsible>
    <p class="section-desc">{{ t('audioPanel.dynamicsDesc') }}</p>
    <div class="slider-group">
      <BaseSlider :label="t('audioPanel.smoothness')" :description="t('audioPanel.smoothnessDesc')" :min="0" :max="1" :step="0.05" v-model="audio.responseSpeed" />
      <BaseSlider :label="t('audioPanel.punch')" :description="t('audioPanel.punchDesc')" :min="0" :max="1" :step="0.05" v-model="audio.transientBoost" />
    </div>
    <div class="toggle-row" style="margin-top: 12px">
      <BaseToggle :label="t('audioPanel.rotateWhilePlaying')" v-model="audio.rotateWhilePlaying" />
    </div>
  </PanelSection>

  <PanelSection v-if="audio.enabled" :title="t('audioPanel.frequencyBalance')" icon="ph:equalizer-duotone" collapsible>
    <template #actions>
      <button class="dice-btn" @click="randomizeFrequencyBands" :title="t('audioPanel.randomizeFrequencies')">
        <iconify-icon icon="ph:dice-three-duotone"></iconify-icon>
      </button>
    </template>
    <p class="section-desc">{{ t('audioPanel.frequencyDesc') }}</p>
    <div class="slider-group">
      <BaseSlider :label="t('audioPanel.bass')" :description="t('audioPanel.bassDesc')" :min="0" :max="2" :step="0.05" v-model="audio.frequencySpikes.bass" />
      <BaseSlider :label="t('audioPanel.mid')" :description="t('audioPanel.midDesc')" :min="0" :max="2" :step="0.05" v-model="audio.frequencySpikes.mid" />
      <BaseSlider :label="t('audioPanel.high')" :description="t('audioPanel.highDesc')" :min="0" :max="2" :step="0.05" v-model="audio.frequencySpikes.high" />
    </div>
  </PanelSection>
</template>

<style scoped>
@import '@/styles/avatar-settings.css';
</style>
