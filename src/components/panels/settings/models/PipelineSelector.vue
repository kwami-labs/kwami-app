<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  modelValue: 'standard' | 'realtime';
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: 'standard' | 'realtime'): void;
}>();
const { t } = useI18n();

const selected = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});
</script>

<template>
  <div class="pipeline-selector">
    <button
      class="pipeline-btn"
      :class="{ active: selected === 'standard' }"
      @click="selected = 'standard'"
    >
      <div class="pipeline-icon">
        <iconify-icon icon="ph:flow-arrow-duotone"></iconify-icon>
      </div>
      <div class="pipeline-info">
        <span class="pipeline-name">{{ t('models.standardPipeline') }}</span>
        <span class="pipeline-desc">{{ t('models.standardPipelineDesc') }}</span>
      </div>
    </button>
    
    <button
      class="pipeline-btn"
      :class="{ active: selected === 'realtime' }"
      @click="selected = 'realtime'"
    >
      <div class="pipeline-icon">
        <iconify-icon icon="ph:video-camera-duotone"></iconify-icon>
      </div>
      <div class="pipeline-info">
        <span class="pipeline-name">{{ t('models.realtimeMultimodal') }}</span>
        <span class="pipeline-desc">{{ t('models.realtimeMultimodalDesc') }}</span>
      </div>
    </button>
  </div>
</template>

<style scoped>
.pipeline-selector {
  display: flex;
  gap: 8px;
  padding: 4px;
  background: var(--surface-1);
  border-radius: var(--radius-lg);
}

.pipeline-btn {
  flex: 1;
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
}

.pipeline-btn:hover:not(.active) {
  background: var(--surface-2);
}

.pipeline-btn.active {
  background: var(--accent-glow);
  border-color: var(--accent-primary);
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
