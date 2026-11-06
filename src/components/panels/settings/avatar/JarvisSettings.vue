<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import {
  useJarvisStore,
  type JarvisPalettePreset,
  type JarvisQuality,
} from '@/stores/avatar.jarvis';
import PanelSection from '@/components/ui/PanelSection.vue';
import BaseSlider from '@/components/ui/BaseSlider.vue';
import BaseToggle from '@/components/ui/BaseToggle.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import BaseColorPicker from '@/components/ui/BaseColorPicker.vue';
import BaseInput from '@/components/ui/BaseInput.vue';

const { t } = useI18n();
const jarvisStore = useJarvisStore();
const { state } = storeToRefs(jarvisStore);

const paletteOptions = computed(() => [
  { label: t('jarvisAvatar.paletteHoloCyan'), value: 'holo-cyan' },
  { label: t('jarvisAvatar.paletteNeonViolet'), value: 'neon-violet' },
  { label: t('jarvisAvatar.paletteArcWhite'), value: 'arc-white' },
  { label: t('jarvisAvatar.paletteAlertAmber'), value: 'alert-amber' },
]);

const qualityOptions = computed(() => [
  { label: t('jarvisAvatar.qualityLow'), value: 'low' },
  { label: t('jarvisAvatar.qualityMedium'), value: 'medium' },
  { label: t('jarvisAvatar.qualityHigh'), value: 'high' },
]);
</script>

<template>
  <PanelSection :title="t('jarvisAvatar.look')" icon="ph:swatches-duotone" collapsible>
    <p class="section-desc">{{ t('jarvisAvatar.lookDesc') }}</p>
    <BaseSelect
      :label="t('jarvisAvatar.palette')"
      :options="paletteOptions"
      :model-value="state.palettePreset"
      @update:model-value="jarvisStore.applyPalettePreset($event as JarvisPalettePreset)"
    />
    <div class="color-grid">
      <BaseColorPicker :label="t('jarvisAvatar.primary')" v-model="state.color.primary" />
      <BaseColorPicker :label="t('jarvisAvatar.secondary')" v-model="state.color.secondary" />
      <BaseColorPicker :label="t('jarvisAvatar.accent')" v-model="state.color.accent" />
      <BaseColorPicker :label="t('jarvisAvatar.alert')" v-model="state.color.alert" />
    </div>
  </PanelSection>

  <PanelSection :title="t('jarvisAvatar.behaviour')" icon="ph:sliders-duotone" collapsible>
    <BaseSlider
      :label="t('jarvisAvatar.intensity')"
      :min="0.3"
      :max="2"
      :step="0.01"
      v-model="state.intensity"
    />
    <BaseSlider
      :label="t('jarvisAvatar.reactivity')"
      :description="t('jarvisAvatar.reactivityDesc')"
      :min="0"
      :max="2.5"
      :step="0.05"
      v-model="state.reactivity"
    />
    <BaseSlider
      :label="t('jarvisAvatar.rotationSpeed')"
      :min="0"
      :max="3"
      :step="0.05"
      v-model="state.rotationSpeed"
    />
    <BaseSlider
      :label="t('jarvisAvatar.parallax')"
      :min="0"
      :max="1.5"
      :step="0.05"
      v-model="state.parallax"
    />
    <BaseSlider
      :label="t('jarvisAvatar.depth')"
      :description="t('jarvisAvatar.depthDesc')"
      :min="0"
      :max="2"
      :step="0.05"
      v-model="state.depth"
    />
    <BaseSlider
      :label="t('jarvisAvatar.scale')"
      :min="0.5"
      :max="1.6"
      :step="0.01"
      v-model="state.scale"
    />
  </PanelSection>

  <PanelSection :title="t('jarvisAvatar.interface')" icon="ph:monitor-duotone" collapsible>
    <BaseInput
      :label="t('jarvisAvatar.title')"
      :model-value="state.title"
      maxlength="24"
      @update:model-value="state.title = String($event)"
    />
    <div class="toggle-stack">
      <BaseToggle :label="t('jarvisAvatar.labels')" v-model="state.labels" />
      <BaseToggle :label="t('jarvisAvatar.panels')" v-model="state.panels" />
      <BaseToggle :label="t('jarvisAvatar.grid')" v-model="state.grid" />
      <BaseToggle :label="t('jarvisAvatar.backdrop')" v-model="state.backdrop" />
    </div>
    <BaseSelect
      :label="t('jarvisAvatar.quality')"
      :options="qualityOptions"
      :model-value="state.quality"
      @update:model-value="state.quality = $event as JarvisQuality"
    />
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
  margin-top: 10px;
}

.toggle-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 12px 0;
}
</style>
