<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useModelsApi, type InferenceTTSModel } from '@/composables/useModelsApi';
import { useVoiceStore } from '@/stores/voice';
import { useKwami } from '@/composables/useKwami';
import { storeToRefs } from 'pinia';
import type { TTSProvider } from 'kwami';
import { voiceKeyName, voiceProviderHasKey } from '@/lib/brain';
import { mergeModels, sameModel, voiceProviderServed } from '@/lib/voiceCatalog';
import PanelSection from '@/components/ui/PanelSection.vue';
import TTSModelCard from '@/components/ui/TTSModelCard.vue';

const {
  fetchTTSInferenceModels,
  fetchTTSPluginModels,
  ttsInferenceModels,
  ttsPluginModels,
  isLoading,
} = useModelsApi();
const { t } = useI18n();
const voiceStore = useVoiceStore();
const { tts, modelsUI, brainStatus } = storeToRefs(voiceStore);

/** False only when the agent reported this provider's key missing. */
function providerHasKey(provider: string): boolean {
  return voiceProviderHasKey(brainStatus.value, 'tts', provider);
}
/** False when the agent has no factory for it and would build another one. */
function providerServed(provider: string): boolean {
  return voiceProviderServed(brainStatus.value, 'tts', provider);
}
function providerUsable(provider: string): boolean {
  return providerServed(provider) && providerHasKey(provider);
}
function unusableTitle(provider: string): string {
  return providerServed(provider) ? t('brainPanel.noKey') : t('brainPanel.notServed');
}
const { kwami, isConnected } = useKwami();

// Local state (synced from store)
const selectedProvider = ref<string>(tts.value.provider);
const selectedModel = ref<string>(tts.value.model);

// Persisted UI state via store
const expandedProvider = computed({
  get: () => modelsUI.value.ttsExpandedProvider,
  set: (v) => {
    modelsUI.value.ttsExpandedProvider = v;
  },
});

// Expand the selected provider's accordion
function expandSelectedProvider() {
  if (selectedProvider.value && sortBy.value === 'provider') {
    expandedProvider.value = 'tts-' + selectedProvider.value;
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
  await Promise.all([fetchTTSInferenceModels(), fetchTTSPluginModels()]);
  if (expandedProvider.value === null) {
    expandSelectedProvider();
  }
});

// const inferenceModelsByProvider = computed(() => {
//   if (!ttsInferenceModels.value?.models) return {};

//   const grouped: Record<string, InferenceTTSModel[]> = {};
//   for (const model of ttsInferenceModels.value.models) {
//     const provider = model.provider;
//     if (!grouped[provider]) grouped[provider] = [];
//     grouped[provider].push(model);
//   }
//   return grouped;
// });

/** Inference models plus those only our own keys reach (Gemini TTS, ElevenLabs v3...). */
const allModels = computed<InferenceTTSModel[]>(() =>
  mergeModels(
    'tts',
    ttsInferenceModels.value?.models ?? [],
    ttsPluginModels.value?.providers,
    (m) => ({ ...m, description: null }),
  ),
);

const hasInferenceModels = computed(() => allModels.value.length > 0);

// Persisted sorting via store
const sortBy = computed({
  get: () => modelsUI.value.ttsSortBy,
  set: (v) => {
    modelsUI.value.ttsSortBy = v;
  },
});

// Min/max calculations
const minPrice = computed(() => {
  const models = allModels.value;
  const prices = models
    .map((m) => m.pricing?.scale_per_1m_chars)
    .filter((p) => p !== undefined) as number[];
  return prices.length ? Math.min(...prices) : 0;
});

const maxPrice = computed(() => {
  const models = allModels.value;
  const prices = models
    .map((m) => m.pricing?.scale_per_1m_chars)
    .filter((p) => p !== undefined) as number[];
  return prices.length ? Math.max(...prices) : 1;
});

// Count advanced features
function countAdvancedFeatures(features: string[]): number {
  const advanced = ['voice_cloning', 'emotion_control', 'ultra_low_latency'];
  return features.filter((f) => advanced.includes(f)).length;
}

// Models grouped by provider (for accordion view)
const modelsByProvider = computed(() => {
  const models = allModels.value;
  if (!models.length) return {};

  const grouped: Record<string, InferenceTTSModel[]> = {};
  for (const model of models) {
    const provider = model.provider;
    if (!grouped[provider]) grouped[provider] = [];
    grouped[provider].push(model);
  }
  return grouped;
});

// Flat sorted list (for price/features view)
const sortedModelsFlat = computed(() => {
  const models = allModels.value;
  if (!models.length) return [];

  const sorted = [...models];

  if (sortBy.value === 'price') {
    // Highest price first
    sorted.sort(
      (a, b) => (b.pricing?.scale_per_1m_chars || 0) - (a.pricing?.scale_per_1m_chars || 0),
    );
  } else if (sortBy.value === 'features') {
    // Most features first
    sorted.sort((a, b) => countAdvancedFeatures(b.features) - countAdvancedFeatures(a.features));
  } else if (sortBy.value === 'speed') {
    // Fastest first
    const speedOrder: Record<string, number> = { fast: 0, standard: 1, slow: 2 };
    sorted.sort((a, b) => (speedOrder[a.speed] ?? 1) - (speedOrder[b.speed] ?? 1));
  }

  return sorted;
});

function getProviderIcon(provider: string): string {
  const icons: Record<string, string> = {
    cartesia: 'ph:speaker-high-duotone',
    deepgram: 'simple-icons:deepgram',
    elevenlabs: 'simple-icons:elevenlabs',
    inworld: 'ph:robot-duotone',
    rime: 'ph:speaker-simple-high-duotone',
    openai: 'simple-icons:openai',
    google: 'simple-icons:googlecloud',
    gemini: 'simple-icons:googlegemini',
    groq: 'ph:lightning-duotone',
  };
  return icons[provider.toLowerCase()] || 'ph:speaker-high-duotone';
}

function selectModel(modelId: string, provider: string) {
  // Without its key, or without a factory, the agent would build another
  // provider instead.
  if (!providerUsable(provider)) return;
  selectedProvider.value = provider;
  selectedModel.value = modelId;

  voiceStore.updateTTS({
    provider: provider as TTSProvider,
    model: modelId,
  });

  if (isConnected.value && kwami.value) {
    kwami.value.agent.updateTtsLive({
      provider,
      model: modelId,
    });
  }
}

watch(
  () => [tts.value.provider, tts.value.model],
  ([newProvider, newModel]) => {
    selectedProvider.value = newProvider || '';
    selectedModel.value = newModel || '';
    expandSelectedProvider();
  },
);
</script>

<template>
  <div class="tab-content">
    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <iconify-icon icon="ph:spinner-duotone" class="spinner"></iconify-icon>
      <span>{{ t('modelTabs.loadingModels') }}</span>
    </div>

    <template v-if="!isLoading">
      <!-- Sort Controls -->
      <div class="sort-row">
        <span class="sort-label">{{ t('modelTabs.sort') }}</span>
        <button
          class="sort-btn"
          :class="{ active: sortBy === 'provider' }"
          @click="sortBy = 'provider'"
        >
          {{ t('modelTabs.provider') }}
        </button>
        <button class="sort-btn" :class="{ active: sortBy === 'price' }" @click="sortBy = 'price'">
          {{ t('modelTabs.price') }}
        </button>
        <button
          class="sort-btn"
          :class="{ active: sortBy === 'features' }"
          @click="sortBy = 'features'"
        >
          {{ t('modelTabs.features') }}
        </button>
        <button class="sort-btn" :class="{ active: sortBy === 'speed' }" @click="sortBy = 'speed'">
          {{ t('modelTabs.speed') }}
        </button>
      </div>

      <!-- Models by Provider (accordion view) -->
      <template v-if="sortBy === 'provider'">
        <PanelSection
          v-for="(models, provider) in modelsByProvider"
          :key="provider"
          :title="String(provider).charAt(0).toUpperCase() + String(provider).slice(1)"
          :icon="getProviderIcon(String(provider))"
          collapsible
          noPaddingX
          :sectionId="'tts-' + String(provider)"
          :collapsed="expandedProvider !== 'tts-' + String(provider)"
          @toggle="handleAccordionToggle"
        >
          <p v-if="!providerServed(String(provider))" class="no-key">
            <iconify-icon icon="ph:prohibit-duotone"></iconify-icon>
            {{ t('brainPanel.notServedHint') }}
          </p>
          <p v-else-if="!providerHasKey(String(provider))" class="no-key">
            <iconify-icon icon="ph:key-duotone"></iconify-icon>
            {{ t('brainPanel.noKeyHint', { key: voiceKeyName('tts', String(provider)) }) }}
          </p>
          <div class="models-grid">
            <TTSModelCard
              v-for="model in models"
              :key="model.model_id"
              :model="model"
              :selected="tts.provider === model.provider && sameModel(tts.model, model.model_id)"
              :minPrice="minPrice"
              :maxPrice="maxPrice"
              :class="{ locked: !providerUsable(model.provider) }"
              :disabled="!providerUsable(model.provider)"
              :title="providerUsable(model.provider) ? undefined : unusableTitle(model.provider)"
              @select="selectModel"
            />
          </div>
        </PanelSection>
      </template>

      <!-- Flat sorted view (for price/features) -->
      <template v-else>
        <div class="models-grid">
          <TTSModelCard
            v-for="model in sortedModelsFlat"
            :key="model.model_id"
            :model="model"
            :selected="
              selectedProvider === model.provider && sameModel(selectedModel, model.model_id)
            "
            :minPrice="minPrice"
            :maxPrice="maxPrice"
            :class="{ locked: !providerUsable(model.provider) }"
            :disabled="!providerUsable(model.provider)"
            :title="providerUsable(model.provider) ? undefined : unusableTitle(model.provider)"
            @select="selectModel"
          />
        </div>
      </template>

      <div v-if="!hasInferenceModels" class="empty-state">
        <iconify-icon icon="lucide:audio-lines"></iconify-icon>
        <span>{{ t('modelTabs.noModelsAvailable') }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.no-key {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 8px;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 11px;
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.1);
}

.locked {
  opacity: 0.45;
  cursor: not-allowed;
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
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
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.sort-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.sort-label {
  font-size: 9px;
  color: var(--text-muted);
  margin-right: 4px;
}

.sort-btn {
  padding: 4px 8px;
  font-size: 9px;
  font-weight: 500;
  font-family: inherit;
  background: var(--surface-1);
  border: 1px solid transparent;
  border-radius: var(--radius-xl);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-in-out);
}

.sort-btn:hover {
  background: var(--surface-2);
  color: var(--text-primary);
}

.sort-btn.active {
  background: var(--accent-glow);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.source-tabs {
  display: flex;
  background: var(--surface-1);
  padding: 3px;
  border-radius: var(--radius-xl);
  gap: 3px;
}

.source-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 8px 10px;
  border-radius: var(--radius-lg);
  cursor: pointer;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  transition: all var(--duration-fast) var(--ease-in-out);
  font-size: 11px;
  font-weight: 500;
  font-family: inherit;
}

.source-btn iconify-icon {
  font-size: 12px;
}

.source-btn:hover:not(:disabled) {
  background: var(--surface-2);
  color: var(--text-primary);
}

.source-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.source-btn.active {
  background: var(--surface-2);
  color: var(--accent-primary);
}

.models-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
