<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { useEyeIrisStore, type EyeIrisPalettePreset } from '@/stores/avatar.eye-iris';
import { randomInRange } from '@/utils/color';
import PanelSection from '@/components/ui/PanelSection.vue';
import BaseSlider from '@/components/ui/BaseSlider.vue';
import BaseToggle from '@/components/ui/BaseToggle.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import BaseColorPicker from '@/components/ui/BaseColorPicker.vue';

const { t } = useI18n();
const eyeIrisStore = useEyeIrisStore();
const { state } = storeToRefs(eyeIrisStore);

const paletteOptions = computed(() => [
  { label: t('eyeIrisAvatar.presetLightBrown'), value: 'light-brown' },
  { label: t('eyeIrisAvatar.presetHazel'), value: 'hazel' },
  { label: t('eyeIrisAvatar.presetBlueGrey'), value: 'blue-grey' },
  { label: t('eyeIrisAvatar.presetGreenBlue'), value: 'green-blue' },
]);

function applyPreset(preset: EyeIrisPalettePreset) {
  eyeIrisStore.applyPalettePreset(preset);
}

function randomizeProcedural() {
  state.value.geometry.irisRadius = randomInRange(0.82, 0.98, 0.01);
  state.value.geometry.pupilRadius = randomInRange(0.16, 0.36, 0.01);
  state.value.geometry.limbalRingWidth = randomInRange(0.03, 0.14, 0.01);
  state.value.detail.fiberDensity = randomInRange(80, 1000, 1);
  state.value.detail.fiberSharpness = randomInRange(0.2, 1.4, 0.01);
  state.value.detail.radialStreakStrength = randomInRange(0.2, 1.1, 0.01);
  state.value.detail.collaretteStrength = randomInRange(0.1, 1.0, 0.01);
  state.value.detail.limbalIntensity = randomInRange(0.2, 1.2, 0.01);
  state.value.detail.noiseStrength = randomInRange(0.1, 2.6, 0.01);
  state.value.detail.cryptStrength = randomInRange(0.1, 1.3, 0.01);
  state.value.detail.furrowStrength = randomInRange(0.1, 1.2, 0.01);
  state.value.detail.ringContrast = randomInRange(0.1, 1.2, 0.01);
  state.value.detail.sectorMix = randomInRange(0, 1, 0.01);
  state.value.detail.pigmentMottleStrength = randomInRange(0.1, 1.4, 0.01);
  state.value.detail.spokesStrength = randomInRange(0.1, 1.4, 0.01);
  state.value.detail.innerRingStrength = randomInRange(0.1, 1.4, 0.01);
  state.value.animation.shimmerSpeed = randomInRange(0, 0.8, 0.01);
  state.value.animation.shimmerStrength = randomInRange(0, 0.6, 0.01);
  state.value.animation.patternFlow = randomInRange(0, 0.35, 0.01);
  if (Math.floor(Math.random() * 3) === 0) {
    state.value.animation.patternRotation = randomInRange(-0.12, 0.12, 0.01);
  } else {
    state.value.animation.patternRotation = 0;
  }
}
</script>

<template>
  <PanelSection :title="t('eyeIrisAvatar.palettes')" icon="ph:swatches-duotone" collapsible>
    <p class="section-desc">{{ t('eyeIrisAvatar.palettesDesc') }}</p>
    <BaseSelect
      :label="t('eyeIrisAvatar.palettePreset')"
      :options="paletteOptions"
      :model-value="state.palettePreset"
      @update:model-value="applyPreset($event as EyeIrisPalettePreset)"
    />
  </PanelSection>

  <PanelSection :title="t('eyeIrisAvatar.colors')" icon="ph:paint-brush-duotone" collapsible>
    <p class="section-desc">{{ t('eyeIrisAvatar.colorsDesc') }}</p>
    <div class="color-grid">
      <BaseColorPicker :label="t('eyeIrisAvatar.base')" v-model="state.color.base" />
      <BaseColorPicker :label="t('eyeIrisAvatar.secondary')" v-model="state.color.secondary" />
      <BaseColorPicker :label="t('eyeIrisAvatar.accent')" v-model="state.color.accent" />
      <BaseColorPicker :label="t('eyeIrisAvatar.limbal')" v-model="state.color.limbal" />
      <BaseColorPicker :label="t('eyeIrisAvatar.collaretteColor')" v-model="state.color.collarette" />
      <BaseColorPicker :label="t('eyeIrisAvatar.cryptColor')" v-model="state.color.crypt" />
      <BaseColorPicker :label="t('eyeIrisAvatar.streakColor')" v-model="state.color.streak" />
    </div>
  </PanelSection>

  <PanelSection :title="t('eyeIrisAvatar.proceduralDetails')" icon="ph:sliders-duotone" collapsible>
    <template #actions>
      <button class="dice-btn" @click="randomizeProcedural" :title="t('eyeIrisAvatar.randomizeProcedural')">
        <iconify-icon icon="ph:dice-three-duotone"></iconify-icon>
      </button>
    </template>
    <div class="slider-group">
      <div class="group-block">
        <p class="group-title">Geometry</p>
        <BaseSlider :label="t('eyeIrisAvatar.irisRadius')" :min="0.82" :max="0.98" :step="0.01" v-model="state.geometry.irisRadius" />
        <BaseSlider :label="t('eyeIrisAvatar.pupilRadius')" :min="0.12" :max="0.5" :step="0.01" v-model="state.geometry.pupilRadius" />
        <BaseSlider :label="t('eyeIrisAvatar.limbalRingWidth')" :min="0.02" :max="0.16" :step="0.01" v-model="state.geometry.limbalRingWidth" />
        <BaseSlider :label="t('eyeIrisAvatar.scale')" :min="3.5" :max="8" :step="0.01" v-model="state.scale" />
      </div>

      <div class="group-block">
        <p class="group-title">Fibers</p>
        <BaseSlider :label="t('eyeIrisAvatar.fiberDensity')" :min="40" :max="1000" :step="1" v-model="state.detail.fiberDensity" />
        <BaseSlider :label="t('eyeIrisAvatar.fiberSharpness')" :min="0" :max="1.5" :step="0.01" v-model="state.detail.fiberSharpness" />
        <BaseSlider :label="t('eyeIrisAvatar.radialStreaks')" :min="0" :max="1.2" :step="0.01" v-model="state.detail.radialStreakStrength" />
        <BaseSlider :label="t('eyeIrisAvatar.noise')" :min="0" :max="3" :step="0.01" v-model="state.detail.noiseStrength" />
      </div>

      <div class="group-block">
        <p class="group-title">Structures</p>
        <BaseSlider :label="t('eyeIrisAvatar.collarette')" :min="0" :max="1.2" :step="0.01" v-model="state.detail.collaretteStrength" />
        <BaseSlider :label="t('eyeIrisAvatar.cryptStrength')" :min="0" :max="1.4" :step="0.01" v-model="state.detail.cryptStrength" />
        <BaseSlider :label="t('eyeIrisAvatar.furrowStrength')" :min="0" :max="1.4" :step="0.01" v-model="state.detail.furrowStrength" />
        <BaseSlider :label="t('eyeIrisAvatar.innerRingStrength')" :min="0" :max="1.5" :step="0.01" v-model="state.detail.innerRingStrength" />
        <BaseSlider :label="t('eyeIrisAvatar.limbalIntensity')" :min="0" :max="1.4" :step="0.01" v-model="state.detail.limbalIntensity" />
        <BaseSlider :label="t('eyeIrisAvatar.ringContrast')" :min="0" :max="1.4" :step="0.01" v-model="state.detail.ringContrast" />
      </div>

      <div class="group-block">
        <p class="group-title">Pigment Variation</p>
        <BaseSlider :label="t('eyeIrisAvatar.sectorMix')" :min="0" :max="1" :step="0.01" v-model="state.detail.sectorMix" />
        <BaseSlider :label="t('eyeIrisAvatar.pigmentMottleStrength')" :min="0" :max="1.5" :step="0.01" v-model="state.detail.pigmentMottleStrength" />
        <BaseSlider :label="t('eyeIrisAvatar.spokesStrength')" :min="0" :max="1.5" :step="0.01" v-model="state.detail.spokesStrength" />
      </div>

      <div class="group-block">
        <p class="group-title">Pattern Motion</p>
        <BaseSlider :label="t('eyeIrisAvatar.shimmerSpeed')" :min="0" :max="0.8" :step="0.01" v-model="state.animation.shimmerSpeed" />
        <BaseSlider :label="t('eyeIrisAvatar.shimmerStrength')" :min="0" :max="0.7" :step="0.01" v-model="state.animation.shimmerStrength" />
        <BaseSlider :label="t('eyeIrisAvatar.patternFlow')" :min="0" :max="0.5" :step="0.01" v-model="state.animation.patternFlow" />
        <BaseSlider :label="t('eyeIrisAvatar.patternRotation')" :min="-0.2" :max="0.2" :step="0.01" v-model="state.animation.patternRotation" />
      </div>

      <div class="group-block">
        <p class="group-title">Follow</p>
        <BaseToggle :label="t('eyeIrisAvatar.followEnabled')" v-model="state.follow.enabled" />
        <BaseSlider :label="t('eyeIrisAvatar.followSensitivity')" :min="0.2" :max="2" :step="0.01" v-model="state.follow.sensitivity" />
        <BaseToggle :label="t('eyeIrisAvatar.pupilMotion')" v-model="state.follow.pupilMotion" />
        <BaseSlider
          v-if="state.follow.pupilMotion"
          :label="t('eyeIrisAvatar.pupilMotionStrength')"
          :min="0"
          :max="0.3"
          :step="0.01"
          v-model="state.follow.pupilMotionStrength"
        />
      </div>
    </div>
  </PanelSection>

  <PanelSection :title="t('eyeIrisAvatar.audio')" icon="ph:waveform-duotone" collapsible>
    <div class="toggle-row">
      <BaseToggle :label="t('eyeIrisAvatar.audioEnabled')" v-model="state.audio.enabled" />
    </div>
    <div class="slider-group" v-if="state.audio.enabled">
      <BaseSlider :label="t('eyeIrisAvatar.audioReactivity')" :min="0" :max="2" :step="0.05" v-model="state.audio.reactivity" />
      <BaseSlider :label="t('eyeIrisAvatar.pupilResponse')" :min="0" :max="0.6" :step="0.01" v-model="state.audio.pupilResponse" />
      <BaseSlider :label="t('eyeIrisAvatar.shimmerResponse')" :min="0" :max="0.8" :step="0.01" v-model="state.audio.shimmerResponse" />
      <BaseSlider :label="t('eyeIrisAvatar.smoothing')" :min="0.6" :max="0.98" :step="0.01" v-model="state.audio.smoothing" />
    </div>
  </PanelSection>
</template>

<style scoped>
@import '@/styles/avatar-settings.css';

.section-desc {
  font-size: 11px;
  color: var(--text-muted);
  margin: 0 0 12px 0;
  line-height: 1.4;
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.group-block {
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 10px;
  margin-bottom: 8px;
  background: color-mix(in oklab, var(--surface-elevated), transparent 18%);
}

.group-title {
  margin: 0 0 8px 0;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
</style>
