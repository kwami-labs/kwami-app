<script setup lang="ts">
import { computed } from 'vue';

export type ModelType = 'llm' | 'stt' | 'tts';

export interface ModelInfo {
  provider: string;
  model: string;
}

const props = defineProps<{
  modelValue: ModelType;
  llmModel?: ModelInfo;
  sttModel?: ModelInfo;
  ttsModel?: ModelInfo;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: ModelType): void;
}>();

const selected = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const tabs: { id: ModelType; icon: string; label: string }[] = [
  { id: 'llm', icon: 'ph:brain-duotone', label: 'LLM' },
  { id: 'stt', icon: 'ph:ear-duotone', label: 'STT' },
  { id: 'tts', icon: 'lucide:audio-lines', label: 'TTS' },
];

function getModelForTab(tabId: ModelType): ModelInfo | undefined {
  if (tabId === 'llm') return props.llmModel;
  if (tabId === 'stt') return props.sttModel;
  if (tabId === 'tts') return props.ttsModel;
  return undefined;
}

// Strip provider prefix from model name if present (e.g., "deepgram/aura-1" -> "aura-1")
function getModelDisplayName(model: string): string {
  if (model.includes('/')) {
    return model.split('/').pop() || model;
  }
  return model;
}

function getProviderIcon(provider: string): string {
  const icons: Record<string, string> = {
    openai: 'simple-icons:openai',
    google: 'simple-icons:googlegemini',
    deepseek: 'game-icons:whale-tail',
    moonshot: 'ph:moon-duotone',
    anthropic: 'simple-icons:anthropic',
    groq: 'ph:lightning-duotone',
    mistralai: 'ph:wind-duotone',
    assemblyai: 'ph:waveform-duotone',
    deepgram: 'simple-icons:deepgram',
    cartesia: 'ph:speaker-high-duotone',
    elevenlabs: 'simple-icons:elevenlabs',
    rime: 'ph:speaker-simple-high-duotone',
  };
  return icons[provider?.toLowerCase()] || 'ph:cube-duotone';
}
</script>

<template>
  <div class="model-type-tabs">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      class="tab-btn"
      :class="{ active: selected === tab.id }"
      @click="selected = tab.id"
    >
      <div class="tab-header">
        <iconify-icon :icon="tab.icon" class="tab-icon"></iconify-icon>
        <span class="tab-label">{{ tab.label }}</span>
      </div>
      <div v-if="getModelForTab(tab.id)" class="tab-model">
        <iconify-icon :icon="getProviderIcon(getModelForTab(tab.id)!.provider)" class="model-provider-icon"></iconify-icon>
        <span class="model-name">{{ getModelDisplayName(getModelForTab(tab.id)!.model) }}</span>
      </div>
    </button>
  </div>
</template>

<style scoped>
.model-type-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  background: var(--surface-1);
  padding: 4px;
  border-radius: var(--radius-lg);
  gap: 4px;
}

.tab-btn {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  padding: 10px 12px;
  border-radius: var(--radius-lg);
  cursor: pointer;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-secondary);
  transition: all var(--duration-fast) var(--ease-in-out);
  font-family: inherit;
  text-align: left;
  min-width: 0;
}

.tab-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tab-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.tab-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.tab-model {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  min-width: 0;
}

.model-provider-icon {
  font-size: 11px;
  flex-shrink: 0;
  margin-top: 1px;
  opacity: 0.7;
}

.model-name {
  font-size: 10px;
  font-weight: 500;
  color: var(--text-primary);
  word-break: break-word;
  line-height: 1.3;
}

.tab-btn:hover:not(.active) {
  background: var(--surface-2);
  color: var(--text-primary);
}

.tab-btn.active {
  background: var(--surface-2);
  color: var(--accent-primary);
  border-color: var(--accent-primary);
}

.tab-btn.active .model-provider-icon {
  opacity: 1;
}
</style>
