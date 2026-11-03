<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { PipelineMode } from '@/lib/voiceEngines';

const props = defineProps<{
  modelValue: PipelineMode;
  /** Live + TTS cannot be built right now (no Live model that answers in text). */
  hybridDisabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: PipelineMode): void;
}>();
const { t } = useI18n();

const selected = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const options = computed(() => [
  {
    id: 'stt-llm-tts' as const,
    icon: 'ph:flow-arrow-duotone',
    name: t('engines.standard'),
    desc: t('engines.standardDesc'),
    disabled: false,
    title: '',
  },
  {
    id: 'realtime' as const,
    icon: 'ph:video-camera-duotone',
    name: t('engines.live'),
    desc: t('engines.liveDesc'),
    disabled: false,
    title: '',
  },
  {
    id: 'hybrid' as const,
    icon: 'ph:waveform-duotone',
    name: t('engines.hybrid'),
    desc: t('engines.hybridDesc'),
    disabled: !!props.hybridDisabled,
    title: props.hybridDisabled ? t('engines.hybridUnavailableTitle') : '',
  },
]);
</script>

<template>
  <div class="pipeline-selector" role="radiogroup">
    <button
      v-for="option in options"
      :key="option.id"
      class="pipeline-btn"
      role="radio"
      :aria-checked="selected === option.id"
      :class="{ active: selected === option.id, disabled: option.disabled }"
      :disabled="option.disabled"
      :title="option.title || undefined"
      @click="selected = option.id"
    >
      <div class="pipeline-icon">
        <iconify-icon :icon="option.icon"></iconify-icon>
      </div>
      <div class="pipeline-info">
        <span class="pipeline-name">{{ option.name }}</span>
        <span class="pipeline-desc">{{ option.desc }}</span>
      </div>
    </button>
  </div>
</template>

<style scoped>
.pipeline-selector {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 8px;
  padding: 4px;
  background: var(--surface-1);
  border-radius: var(--radius-lg);
}

.pipeline-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-in-out);
  text-align: left;
  font-family: inherit;
  min-width: 0;
}

.pipeline-btn:hover:not(.active):not(.disabled) {
  background: var(--surface-2);
}

.pipeline-btn.active {
  background: var(--accent-glow);
  border-color: var(--accent-primary);
}

.pipeline-btn.disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.pipeline-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: var(--surface-2);
  border-radius: var(--radius-lg);
  font-size: 18px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.pipeline-btn.active .pipeline-icon {
  background: var(--accent-glow);
  color: var(--accent-primary);
}

.pipeline-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.pipeline-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.pipeline-btn.active .pipeline-name {
  color: var(--accent-primary);
}

.pipeline-desc {
  font-size: 10px;
  color: var(--text-muted);
}
</style>
