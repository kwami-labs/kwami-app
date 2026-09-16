<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useModelsApi } from '@/composables/useModelsApi';
import { useVoiceStore } from '@/stores/voice';
import { storeToRefs } from 'pinia';
import type { RealtimeProvider } from 'kwami';
import PanelSection from '@/components/ui/PanelSection.vue';

const { fetchRealtimeModels, realtimeModels, isLoading } = useModelsApi();
const { t } = useI18n();
const voiceStore = useVoiceStore();
const { realtime, modelsUI } = storeToRefs(voiceStore);

// Persisted UI state via store
const videoEnabled = computed({
  get: () => modelsUI.value.realtimeVideoEnabled,
  set: (v) => { modelsUI.value.realtimeVideoEnabled = v; }
});
const expandedProvider = computed({
  get: () => modelsUI.value.realtimeExpandedProvider,
  set: (v) => { modelsUI.value.realtimeExpandedProvider = v; }
});

// Expand selected provider on mount
function expandSelectedProvider() {
  if (realtime.value.provider) {
    expandedProvider.value = 'rt-' + realtime.value.provider;
  }
}

function handleAccordionToggle(sectionId: string | undefined, wasCollapsed: boolean) {
  if (wasCollapsed) {
    expandedProvider.value = sectionId || null;
  } else {
    expandedProvider.value = null;
  }
}

onMounted(async () => {
  await fetchRealtimeModels();
  if (expandedProvider.value === null) {
    expandSelectedProvider();
  }
});

const modelsByProvider = computed(() => {
  if (!realtimeModels.value?.plugins) return {};
  return realtimeModels.value.plugins;
});

const hasModels = computed(() => {
  return Object.keys(modelsByProvider.value).length > 0;
});

function getProviderIcon(provider: string): string {
  const icons: Record<string, string> = {
    openai: 'simple-icons:openai',
    google: 'simple-icons:googlegemini',
    aws: 'simple-icons:amazonaws',
  };
  return icons[provider.toLowerCase()] || 'ph:video-camera-duotone';
}

function selectModel(modelId: string, provider: string) {
  voiceStore.updateRealtime({
    provider: provider as RealtimeProvider,
    model: modelId,
  });
  expandSelectedProvider();
}

// Known model metadata (since realtime models don't have enriched data yet)
const modelInfo: Record<string, { name: string; features: string[]; video: boolean }> = {
  'gpt-4o-realtime-preview': { name: 'GPT-4o Realtime', features: ['audio', 'function_calling'], video: true },
  'gpt-4o-mini-realtime-preview': { name: 'GPT-4o Mini Realtime', features: ['audio', 'function_calling'], video: false },
  'gemini-2.0-flash-exp': { name: 'Gemini 2.0 Flash', features: ['audio', 'function_calling'], video: true },
  'gemini-live-2.5-flash-native-audio': { name: 'Gemini Live 2.5', features: ['audio', 'native_audio'], video: true },
  'amazon.nova-sonic-v1:0': { name: 'Nova Sonic', features: ['audio'], video: false },
  'amazon.nova-2-sonic-v1:0': { name: 'Nova 2 Sonic', features: ['audio'], video: false },
};

function getModelInfo(modelId: string) {
  return modelInfo[modelId] || { name: modelId, features: [], video: false };
}
</script>

<template>
  <div class="tab-content">
    <!-- Info Banner -->
    <div class="info-banner">
      <iconify-icon icon="ph:info-duotone"></iconify-icon>
      <p>{{ t('modelTabs.realtimeInfo') }}</p>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <iconify-icon icon="ph:spinner-duotone" class="spinner"></iconify-icon>
      <span>{{ t('modelTabs.loadingModels') }}</span>
    </div>

    <template v-if="!isLoading && hasModels">
      <!-- Models by Provider -->
      <PanelSection
        v-for="(models, provider) in modelsByProvider"
        :key="provider"
        :title="String(provider).charAt(0).toUpperCase() + String(provider).slice(1)"
        :icon="getProviderIcon(String(provider))"
        collapsible
        :sectionId="'rt-' + String(provider)"
        :collapsed="expandedProvider !== 'rt-' + String(provider)"
        @toggle="handleAccordionToggle"
      >
        <div class="models-list">
          <button
            v-for="model in models"
            :key="model"
            class="realtime-model-card"
            :class="{ selected: realtime.model === model }"
            @click="selectModel(model, String(provider))"
          >
            <div class="model-header">
              <iconify-icon :icon="getProviderIcon(String(provider))" class="provider-icon"></iconify-icon>
              <span class="model-name">{{ getModelInfo(model).name }}</span>
            </div>
            <div class="model-id">{{ model }}</div>
            <div class="model-features">
              <span v-if="getModelInfo(model).features.includes('audio')" class="feature audio" :title="t('modelTabs.bidirectionalAudio')">
                <iconify-icon icon="ph:waveform-duotone"></iconify-icon>
                <span class="feature-label">{{ t('modelTabs.audio') }}</span>
              </span>
              <span v-if="getModelInfo(model).video" class="feature video" :title="t('modelTabs.videoInput')">
                <iconify-icon icon="ph:video-camera-duotone"></iconify-icon>
                <span class="feature-label">{{ t('modelTabs.video') }}</span>
              </span>
              <span v-if="getModelInfo(model).features.includes('function_calling')" class="feature tools" :title="t('modelTabs.functionCalling')">
                <iconify-icon icon="ph:wrench-duotone"></iconify-icon>
                <span class="feature-label">{{ t('modelTabs.tools') }}</span>
              </span>
            </div>
            <div class="selected-indicator">
              <iconify-icon icon="ph:check-circle-duotone"></iconify-icon>
            </div>
          </button>
        </div>
      </PanelSection>

      <!-- Video Settings -->
      <PanelSection :title="t('modelTabs.realtimeVideoInput')" icon="ph:video-camera-duotone" collapsible defaultCollapsed>
        <div class="video-settings">
          <label class="toggle-row">
            <span>{{ t('modelTabs.enableVideo') }}</span>
            <button
              class="toggle-btn"
              :class="{ active: videoEnabled }"
              @click="videoEnabled = !videoEnabled"
            >
              <span class="toggle-track">
                <span class="toggle-thumb"></span>
              </span>
            </button>
          </label>
          <p class="setting-hint">{{ t('modelTabs.videoHint') }}</p>
          
          <div v-if="videoEnabled" class="video-options">
            <p class="coming-soon">
              <iconify-icon icon="ph:hammer-duotone"></iconify-icon>
              {{ t('modelTabs.cameraSettingsSoon') }}
            </p>
          </div>
        </div>
      </PanelSection>
    </template>

    <!-- Empty State -->
    <div v-if="!isLoading && !hasModels" class="empty-state">
      <iconify-icon icon="ph:video-camera-slash-duotone"></iconify-icon>
      <span>{{ t('modelTabs.noRealtimeModels') }}</span>
    </div>
  </div>
</template>

<style scoped>
.tab-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-banner {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: var(--radius-lg);
}

.info-banner iconify-icon {
  font-size: 16px;
  color: #60a5fa;
  flex-shrink: 0;
  margin-top: 1px;
}

.info-banner p {
  font-size: 11px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.4;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px 20px;
  color: var(--text-secondary);
  font-size: 13px;
}

.spinner {
  font-size: 24px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.models-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.realtime-model-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  background: var(--surface-1);
  border: 1px solid var(--surface-2);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-in-out);
  text-align: left;
  font-family: inherit;
}

.realtime-model-card:hover:not(.selected) {
  background: var(--surface-2);
  border-color: var(--accent-primary);
  box-shadow: 0 2px 12px var(--accent-glow);
}

.realtime-model-card.selected {
  background: var(--accent-glow);
  border-color: var(--accent-primary);
}

.model-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.provider-icon {
  font-size: 14px;
  color: var(--text-muted);
}

.realtime-model-card.selected .provider-icon {
  color: var(--accent-primary);
}

.model-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.model-id {
  font-size: 9px;
  color: var(--text-muted);
  font-family: var(--font-mono, monospace);
}

.model-features {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.feature {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: var(--radius-lg);
  font-size: 11px;
}

.feature iconify-icon {
  font-size: 12px;
}

.feature-label {
  font-size: 9px;
  font-weight: 500;
}

.feature.audio {
  background: rgba(74, 222, 128, 0.2);
  color: #4ade80;
}

.feature.video {
  background: rgba(167, 139, 250, 0.2);
  color: #a78bfa;
}

.feature.tools {
  background: rgba(96, 165, 250, 0.2);
  color: #60a5fa;
}

.realtime-model-card.selected .feature {
  background: var(--accent-glow);
  color: var(--accent-primary);
}

.selected-indicator {
  position: absolute;
  top: 12px;
  right: 12px;
  font-size: 18px;
  color: var(--accent-primary);
  opacity: 0;
  transform: scale(0.8);
  transition: all var(--duration-fast) var(--ease-out);
}

.realtime-model-card.selected .selected-indicator {
  opacity: 1;
  transform: scale(1);
}

.video-settings {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-primary);
}

.toggle-btn {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
}

.toggle-track {
  display: block;
  width: 36px;
  height: 20px;
  background: var(--surface-2);
  border-radius: var(--radius-lg);
  position: relative;
  transition: background var(--duration-fast) var(--ease-in-out);
}

.toggle-btn.active .toggle-track {
  background: var(--accent-primary);
}

.toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background: white;
  border-radius: var(--radius-lg);
  transition: transform var(--duration-fast) var(--ease-in-out);
}

.toggle-btn.active .toggle-thumb {
  transform: translateX(16px);
}

.setting-hint {
  font-size: 10px;
  color: var(--text-muted);
  margin: 0;
}

.video-options {
  padding-top: 8px;
}

.coming-soon {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--text-muted);
  margin: 0;
}

.coming-soon iconify-icon {
  font-size: 14px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px 20px;
  color: var(--text-muted);
  font-size: 13px;
}

.empty-state iconify-icon {
  font-size: 32px;
}
</style>
