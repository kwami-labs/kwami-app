<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import PanelSection from '@/components/ui/PanelSection.vue';
import BaseSlider from '@/components/ui/BaseSlider.vue';
import BaseToggle from '@/components/ui/BaseToggle.vue';

export interface StarFieldConfig {
  enabled: boolean;
  count: number;
  fieldRadius: number;
  twinkleSpeed: number;
  rotationSpeed: number;
  minSize: number;
  maxSize: number;
}

export interface SceneEffectsConfig {
  starField: StarFieldConfig;
}

const effects = defineModel<SceneEffectsConfig>('effects', { required: true });
const { t } = useI18n();

interface StarPreset {
  id: string;
  name: string;
  icon: string;
  config: Omit<StarFieldConfig, 'enabled'>;
}

const starPresets: StarPreset[] = [
  {
    id: 'subtle',
    name: 'Subtle',
    icon: 'ph:star-duotone',
    config: {
      count: 3000,
      fieldRadius: 600,
      twinkleSpeed: 0.8,
      rotationSpeed: 0.00015,
      minSize: 0.4,
      maxSize: 1.8,
    },
  },
  {
    id: 'classic',
    name: 'Classic',
    icon: 'ph:star-four-duotone',
    config: {
      count: 7000,
      fieldRadius: 500,
      twinkleSpeed: 1.4,
      rotationSpeed: 0.00025,
      minSize: 0.6,
      maxSize: 3.0,
    },
  },
  {
    id: 'dense',
    name: 'Dense',
    icon: 'ph:sparkle-duotone',
    config: {
      count: 16000,
      fieldRadius: 400,
      twinkleSpeed: 2.0,
      rotationSpeed: 0.0004,
      minSize: 0.3,
      maxSize: 2.2,
    },
  },
  {
    id: 'nebula',
    name: 'Nebula',
    icon: 'ph:planet-duotone',
    config: {
      count: 12000,
      fieldRadius: 300,
      twinkleSpeed: 3.0,
      rotationSpeed: 0.0006,
      minSize: 0.8,
      maxSize: 4.5,
    },
  },
  {
    id: 'distant',
    name: 'Distant',
    icon: 'ph:binoculars-duotone',
    config: {
      count: 5000,
      fieldRadius: 900,
      twinkleSpeed: 0.5,
      rotationSpeed: 0.0001,
      minSize: 0.2,
      maxSize: 1.2,
    },
  },
  {
    id: 'hyper',
    name: 'Hyperspace',
    icon: 'ph:shooting-star-duotone',
    config: {
      count: 20000,
      fieldRadius: 250,
      twinkleSpeed: 4.5,
      rotationSpeed: 0.002,
      minSize: 1.0,
      maxSize: 5.0,
    },
  },
];

function applyPreset(preset: StarPreset) {
  const sf = effects.value.starField;
  sf.count = preset.config.count;
  sf.fieldRadius = preset.config.fieldRadius;
  sf.twinkleSpeed = preset.config.twinkleSpeed;
  sf.rotationSpeed = preset.config.rotationSpeed;
  sf.minSize = preset.config.minSize;
  sf.maxSize = preset.config.maxSize;
  if (!sf.enabled) sf.enabled = true;
}
</script>

<template>
  <PanelSection :title="t('scene.starFields')" icon="ph:star-duotone" collapsible>
    <div class="effect-header">
      <BaseToggle
        :label="t('scene.enableStars')"
        :modelValue="effects.starField.enabled"
        @update:modelValue="effects.starField.enabled = $event"
      />
    </div>

    <template v-if="effects.starField.enabled">
      <div class="presets-row">
        <button
          v-for="preset in starPresets"
          :key="preset.id"
          class="preset-chip"
          :title="preset.name"
          @click="applyPreset(preset)"
        >
          <iconify-icon :icon="preset.icon"></iconify-icon>
          <span>{{ preset.name }}</span>
        </button>
      </div>

      <div class="settings-group">
        <BaseSlider
          :label="t('scene.starCount')"
          :modelValue="effects.starField.count"
          @update:modelValue="effects.starField.count = $event"
          :min="1000"
          :max="20000"
          :step="1000"
        />
        <BaseSlider
          :label="t('scene.fieldRadius')"
          :modelValue="effects.starField.fieldRadius"
          @update:modelValue="effects.starField.fieldRadius = $event"
          :min="200"
          :max="1000"
          :step="50"
        />
        <div class="size-row">
          <BaseSlider
            :label="t('scene.minSize')"
            :modelValue="effects.starField.minSize"
            @update:modelValue="effects.starField.minSize = $event"
            :min="0.1"
            :max="3.0"
            :step="0.1"
          />
          <BaseSlider
            :label="t('scene.maxSize')"
            :modelValue="effects.starField.maxSize"
            @update:modelValue="effects.starField.maxSize = $event"
            :min="1.0"
            :max="8.0"
            :step="0.5"
          />
        </div>
        <BaseSlider
          :label="t('scene.twinkleSpeed')"
          :modelValue="effects.starField.twinkleSpeed"
          @update:modelValue="effects.starField.twinkleSpeed = $event"
          :min="0"
          :max="5"
          :step="0.1"
        />
        <BaseSlider
          :label="t('scene.rotationSpeed')"
          :modelValue="effects.starField.rotationSpeed * 10000"
          @update:modelValue="effects.starField.rotationSpeed = $event / 10000"
          :min="0"
          :max="50"
          :step="1"
        />
      </div>
    </template>

    <p class="effect-hint">
      <iconify-icon icon="ph:info-duotone"></iconify-icon>
      {{ t('scene.starsHint') }}
    </p>
  </PanelSection>
</template>

<style scoped>
.effect-header {
  margin-bottom: 12px;
}

.presets-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
}

.preset-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.preset-chip:hover {
  background: var(--accent-glow);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
  transform: translateY(-1px);
}

.preset-chip:active {
  transform: scale(0.96);
}

.preset-chip iconify-icon {
  font-size: 14px;
}

.settings-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
}

.size-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.effect-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  padding: 8px 10px;
  background: var(--surface-1);
  border-radius: var(--radius-md);
  font-size: 11px;
  color: var(--text-muted);
}

.effect-hint iconify-icon {
  font-size: 14px;
  color: var(--accent-primary);
}
</style>
