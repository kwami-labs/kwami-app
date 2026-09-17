<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useVoiceStore } from '@/stores/voice';
import { storeToRefs } from 'pinia';
import BasePanel from '@/components/ui/BasePanel.vue';
import PanelSection from '@/components/ui/PanelSection.vue';
import { panelIcons } from '@/constants/panel-icons';
import PipelineSelector from './PipelineSelector.vue';
import ModelTypeTabs, { type ModelType } from './ModelTypeTabs.vue';
import LLMTab from './tabs/LLMTab.vue';
import STTTab from './tabs/STTTab.vue';
import TTSTab from './tabs/TTSTab.vue';
import RealtimeTab from './tabs/RealtimeTab.vue';

const voiceStore = useVoiceStore();
const { t } = useI18n();
const { llm, stt, tts, realtime, pipelineMode, modelsUI } = storeToRefs(voiceStore);
const panelIcon = panelIcons.models ?? 'ph:cpu-duotone';

// Pipeline type - synced with store (converts between UI value and store value)
const pipelineType = computed({
  get: () => pipelineMode.value === 'realtime' ? 'realtime' : 'standard',
  set: (value: 'standard' | 'realtime') => {
    voiceStore.setPipelineMode(value === 'realtime' ? 'realtime' : 'stt-llm-tts');
  }
});

// Active model type tab (for standard pipeline) - persisted in store
const activeModelType = computed({
  get: () => modelsUI.value.activeModelType as ModelType,
  set: (value: ModelType) => { modelsUI.value.activeModelType = value; }
});

// Provider icons
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
  return icons[provider.toLowerCase()] || 'ph:cube-duotone';
}
</script>

<template>
  <BasePanel :icon="panelIcon" :title="t('models.title')">
    <!-- Pipeline Selector -->
    <PanelSection>
      <PipelineSelector v-model="pipelineType" />
    </PanelSection>

    <!-- Standard Pipeline -->
    <template v-if="pipelineType === 'standard'">
      <!-- Model Type Tabs + Content in same section -->
      <PanelSection>
        <div class="models-section">
          <ModelTypeTabs 
            v-model="activeModelType"
            :llmModel="{ provider: llm.provider, model: llm.model }"
            :sttModel="{ provider: stt.provider, model: stt.model }"
            :ttsModel="{ provider: tts.provider, model: tts.model }"
          />
          
          <div class="tab-content">
            <LLMTab v-if="activeModelType === 'llm'" />
            <STTTab v-if="activeModelType === 'stt'" />
            <TTSTab v-if="activeModelType === 'tts'" />
          </div>
        </div>
      </PanelSection>
    </template>

    <!-- Realtime Pipeline -->
    <template v-if="pipelineType === 'realtime'">
      <PanelSection>
        <div class="realtime-section">
          <!-- Realtime Model Summary -->
          <div class="realtime-model-summary">
            <div class="realtime-header">
              <iconify-icon icon="ph:lightning-duotone" class="realtime-icon"></iconify-icon>
              <span class="realtime-label">{{ t('models.realtimeModel') }}</span>
            </div>
            <div class="realtime-model">
              <iconify-icon :icon="getProviderIcon(realtime.provider)" class="realtime-provider-icon"></iconify-icon>
              <span class="realtime-model-name">{{ realtime.model }}</span>
            </div>
          </div>
          
          <div class="tab-content">
            <RealtimeTab />
          </div>
        </div>
      </PanelSection>
    </template>
  </BasePanel>
</template>

<style scoped>
.models-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.realtime-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tab-content {
  display: flex;
  flex-direction: column;
}

/* Realtime Model Summary */
.realtime-model-summary {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  background: var(--surface-2);
  border: 1px solid var(--accent-primary);
  border-radius: var(--radius-lg);
}

.realtime-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.realtime-icon {
  font-size: 16px;
  color: var(--accent-primary);
}

.realtime-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--accent-primary);
}

.realtime-model {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}

.realtime-provider-icon {
  font-size: 14px;
  color: var(--text-secondary);
  flex-shrink: 0;
  margin-top: 2px;
}

.realtime-model-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  word-break: break-word;
  line-height: 1.3;
}
</style>
