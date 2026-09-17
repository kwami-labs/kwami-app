<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useParticlesFaceStore } from '@/stores/avatar.particles-face';
import PanelSection from '@/components/ui/PanelSection.vue';
import BaseSlider from '@/components/ui/BaseSlider.vue';
import BaseColorPicker from '@/components/ui/BaseColorPicker.vue';

const { t } = useI18n();
const pfStore = useParticlesFaceStore();
</script>

<template>
  <!-- Colors -->
  <PanelSection :title="t('particlesFace.colors')" icon="ph:palette-duotone" collapsible>
    <p class="section-desc">{{ t('particlesFace.colorsDesc') }}</p>
    <div class="color-row">
      <label class="color-label">{{ t('particlesFace.primary') }}</label>
      <BaseColorPicker v-model="pfStore.state.color" />
    </div>
    <div class="color-row">
      <label class="color-label">{{ t('particlesFace.secondary') }}</label>
      <BaseColorPicker v-model="pfStore.state.secondaryColor" />
    </div>
  </PanelSection>

  <!-- Appearance -->
  <PanelSection :title="t('particlesFace.appearance')" icon="ph:eye-duotone" collapsible>
    <p class="section-desc">{{ t('particlesFace.appearanceDesc') }}</p>
    <BaseSlider
      v-model="pfStore.state.particleSize"
      :min="0.02" :max="0.3" :step="0.01"
      :label="t('particlesFace.particleSize')"
    />
    <BaseSlider
      v-model="pfStore.state.opacity"
      :min="0.1" :max="1" :step="0.05"
      :label="t('theme.opacity')"
    />
    <BaseSlider
      v-model="pfStore.state.faceScale"
      :min="1.5" :max="4.5" :step="0.1"
      :label="t('particlesFace.faceScale')"
    />
    <BaseSlider
      v-model="pfStore.state.scale"
      :min="0.2" :max="3" :step="0.05"
      :label="t('particlesFace.overallScale')"
    />
    <BaseSlider
      v-model="pfStore.state.depthSpread"
      :min="0.2" :max="1.8" :step="0.05"
      :label="t('particlesFace.depthSpread')"
    />
  </PanelSection>

  <!-- Speaking -->
  <PanelSection :title="t('particlesFace.speakingAnimation')" icon="ph:waveform-duotone" collapsible>
    <p class="section-desc">{{ t('particlesFace.speakingDesc') }}</p>
    <BaseSlider
      v-model="pfStore.state.mouthAmplitude"
      :min="0" :max="1.5" :step="0.05"
      :label="t('particlesFace.mouthAmplitude')"
    />
    <BaseSlider
      v-model="pfStore.state.speakingReactivity"
      :min="0" :max="3" :step="0.1"
      :label="t('particlesFace.speakingReactivity')"
    />
  </PanelSection>

  <!-- Animation -->
  <PanelSection :title="t('particlesFace.motion')" icon="ph:wind-duotone" collapsible>
    <p class="section-desc">{{ t('particlesFace.motionDesc') }}</p>
    <BaseSlider
      v-model="pfStore.state.breathingSpeed"
      :min="0.1" :max="4" :step="0.1"
      :label="t('particlesFace.breathingSpeed')"
    />
    <BaseSlider
      v-model="pfStore.state.breathingAmplitude"
      :min="0" :max="0.03" :step="0.001"
      :label="t('particlesFace.breathingAmplitude')"
    />
    <BaseSlider
      v-model="pfStore.state.driftSpeed"
      :min="0" :max="2" :step="0.05"
      :label="t('particlesFace.driftSpeed')"
    />
    <BaseSlider
      v-model="pfStore.state.driftAmplitude"
      :min="0" :max="0.02" :step="0.001"
      :label="t('particlesFace.driftAmplitude')"
    />
    <BaseSlider
      v-model="pfStore.state.listeningPulse"
      :min="0" :max="2" :step="0.05"
      :label="t('particlesFace.listeningPulse')"
    />
    <BaseSlider
      v-model="pfStore.state.thinkingSpeed"
      :min="0.5" :max="6" :step="0.1"
      :label="t('particlesFace.thinkingSpeed')"
    />
  </PanelSection>

  <!-- Ambient -->
  <PanelSection :title="t('particlesFace.ambientParticles')" icon="ph:sparkle-duotone" collapsible>
    <p class="section-desc">{{ t('particlesFace.ambientDesc') }}</p>
    <BaseSlider
      v-model="pfStore.state.ambientParticles"
      :min="0" :max="200" :step="5"
      :label="t('particlesFace.count')"
    />
    <BaseSlider
      v-model="pfStore.state.ambientRadius"
      :min="1" :max="10" :step="0.5"
      :label="t('particlesFace.radius')"
    />
  </PanelSection>
</template>

<style scoped>
.section-desc {
  font-size: 11px;
  color: var(--text-muted);
  margin: 0 0 12px 0;
  line-height: 1.4;
}

.color-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.color-label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}
</style>
