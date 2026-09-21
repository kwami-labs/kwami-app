<script setup lang="ts">
import type { LLMProvider } from 'kwami';
import { ref, computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useModelsApi, type InferenceModel } from '@/composables/useModelsApi';
import { useVoiceStore } from '@/stores/voice';
import { useKwami } from '@/composables/useKwami';
import { storeToRefs } from 'pinia';
import PanelSection from '@/components/ui/PanelSection.vue';
import ModelCard from '@/components/ui/ModelCard.vue';
import BaseSlider from '@/components/ui/BaseSlider.vue';

const { fetchLLMInferenceModels, llmInferenceModels, isLoading } = useModelsApi();
const { t } = useI18n();
const voiceStore = useVoiceStore();
const { llm, modelsUI } = storeToRefs(voiceStore);
const { kwami, isConnected } = useKwami();

// Local state (synced from store)
const selectedProvider = ref<string>(llm.value.provider);
const selectedModel = ref<string>(llm.value.model);

// Persisted UI state via store
const expandedProvider = computed({
  get: () => modelsUI.value.llmExpandedProvider,
  set: (v) => {
    modelsUI.value.llmExpandedProvider = v;
  },
});
const sortBy = computed({
  get: () => modelsUI.value.llmSortBy,
  set: (v) => {
    modelsUI.value.llmSortBy = v;
  },
});

// Expand the selected provider's accordion
function expandSelectedProvider() {
  if (selectedProvider.value && sortBy.value === 'provider') {
    expandedProvider.value = 'llm-' + selectedProvider.value;
  }
}

// Handle accordion toggle
function handleAccordionToggle(sectionId: string | undefined, wasCollapsed: boolean) {
  if (wasCollapsed) {
    expandedProvider.value = sectionId || null;
  } else {
    expandedProvider.value = null;
  }
}

// Fetch models on mount and expand selected provider (only if no stored state)
onMounted(async () => {
  await fetchLLMInferenceModels();
  if (expandedProvider.value === null) {
    expandSelectedProvider();
  }
});

// All models flat list
const allModels = computed(() => {
  if (!llmInferenceModels.value?.models) return [];
  return llmInferenceModels.value.models;
});

// Min/max calculations for range bars
const minContext = computed(() => {
  if (!allModels.value.length) return 0;
  return Math.min(...allModels.value.map((m) => m.context_window));
});

const maxContext = computed(() => {
  if (!allModels.value.length) return 1;
  return Math.max(...allModels.value.map((m) => m.context_window));
});

const minPrice = computed(() => {
  if (!allModels.value.length) return 0;
  const prices = allModels.value
    .filter((m) => m.providers && Object.keys(m.providers).length > 0)
    .map((m) => Math.min(...Object.values(m.providers).map((p) => p.input_per_1m)));
  return prices.length ? Math.min(...prices) : 0;
});

const maxPrice = computed(() => {
  if (!allModels.value.length) return 1;
  const prices = allModels.value
    .filter((m) => m.providers && Object.keys(m.providers).length > 0)
    .map((m) => Math.min(...Object.values(m.providers).map((p) => p.input_per_1m)));
  return prices.length ? Math.max(...prices) : 1;
});

// Models grouped by provider (for accordion view)
const modelsByProvider = computed(() => {
  if (!allModels.value.length) return {};

  const grouped: Record<string, InferenceModel[]> = {};
  for (const model of allModels.value) {
    const provider = model.provider;
    if (!grouped[provider]) grouped[provider] = [];
    grouped[provider].push(model);
  }
  // Models within each provider keep their original order (newest first from YAML)
  return grouped;
});

// Flat sorted list (for price/context/speed view)
const sortedModelsFlat = computed(() => {
  if (!allModels.value.length) return [];

  const models = [...allModels.value];

  if (sortBy.value === 'price') {
    // Highest price first (most expensive at top)
    models.sort((a, b) => {
      const priceA = a.providers
        ? Math.min(...Object.values(a.providers).map((p) => p.input_per_1m))
        : 0;
      const priceB = b.providers
        ? Math.min(...Object.values(b.providers).map((p) => p.input_per_1m))
        : 0;
      return priceB - priceA;
    });
  } else if (sortBy.value === 'context') {
    // Highest context first
    models.sort((a, b) => b.context_window - a.context_window);
  } else if (sortBy.value === 'languages') {
    // Multilingual first, then by language count
    models.sort((a, b) => {
      const aMulti = a.languages?.includes('multilingual') ? 1 : 0;
      const bMulti = b.languages?.includes('multilingual') ? 1 : 0;
      if (aMulti !== bMulti) return bMulti - aMulti;
      return (b.languages?.length ?? 0) - (a.languages?.length ?? 0);
    });
  } else if (sortBy.value === 'speed') {
    // Fastest first
    const speedOrder: Record<string, number> = { fast: 0, standard: 1, slow: 2 };
    models.sort((a, b) => (speedOrder[a.speed] ?? 1) - (speedOrder[b.speed] ?? 1));
  }

  return models;
});

const hasInferenceModels = computed(() => {
  return allModels.value.length > 0;
});

function getProviderIcon(provider: string): string {
  const icons: Record<string, string> = {
    openai: 'simple-icons:openai',
    google: 'simple-icons:googlegemini',
    deepseek: 'game-icons:whale-tail',
    moonshot: 'ph:moon-duotone',
    anthropic: 'simple-icons:anthropic',
    groq: 'ph:lightning-duotone',
    mistralai: 'ph:wind-duotone',
  };
  return icons[provider.toLowerCase()] || 'ph:cube-duotone';
}

function selectModel(modelId: string, provider: string) {
  selectedProvider.value = provider;
  selectedModel.value = modelId;

  voiceStore.updateLLM({
    provider: provider as LLMProvider,
    model: modelId,
  });

  if (isConnected.value && kwami.value) {
    kwami.value.agent.syncConfigToBackend('llm', {
      provider,
      model: modelId,
      temperature: llm.value.temperature,
      maxTokens: llm.value.maxTokens,
    });
  }
}

watch(
  () => [llm.value.provider, llm.value.model],
  ([newProvider, newModel]) => {
    selectedProvider.value = newProvider || '';
    selectedModel.value = newModel || '';
    // Auto-expand the new provider's accordion
    expandSelectedProvider();
  },
);

function updateTemperature(value: number) {
  voiceStore.updateLLM({ temperature: value });

  if (isConnected.value && kwami.value) {
    kwami.value.agent.syncConfigToBackend('llm', {
      provider: llm.value.provider,
      model: llm.value.model,
      temperature: value,
      maxTokens: llm.value.maxTokens,
    });
  }
}

function updateMaxTokens(value: number) {
  voiceStore.updateLLM({ maxTokens: value });
  if (isConnected.value && kwami.value) {
    kwami.value.agent.syncConfigToBackend('llm', {
      provider: llm.value.provider,
      model: llm.value.model,
      temperature: llm.value.temperature,
      maxTokens: value,
    });
  }
}
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
          :class="{ active: sortBy === 'context' }"
          @click="sortBy = 'context'"
        >
          {{ t('modelTabs.context') }}
        </button>
        <button
          class="sort-btn"
          :class="{ active: sortBy === 'languages' }"
          @click="sortBy = 'languages'"
        >
          {{ t('modelTabs.languages') }}
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
          :sectionId="'llm-' + String(provider)"
          :collapsed="expandedProvider !== 'llm-' + String(provider)"
          @toggle="handleAccordionToggle"
        >
          <div class="models-grid">
            <ModelCard
              v-for="model in models"
              :key="model.model_id"
              :model="model"
              :selected="llm.model === model.model_id"
              :minContext="minContext"
              :maxContext="maxContext"
              :minPrice="minPrice"
              :maxPrice="maxPrice"
              @select="selectModel"
            />
          </div>
        </PanelSection>
      </template>

      <!-- Flat sorted view (for price/context/speed) -->
      <template v-else>
        <div class="models-grid">
          <ModelCard
            v-for="model in sortedModelsFlat"
            :key="model.model_id"
            :model="model"
            :selected="selectedModel === model.model_id"
            :minContext="minContext"
            :maxContext="maxContext"
            :minPrice="minPrice"
            :maxPrice="maxPrice"
            @select="selectModel"
          />
        </div>
      </template>

      <div v-if="!hasInferenceModels" class="empty-state">
        <iconify-icon icon="ph:brain-duotone"></iconify-icon>
        <span>{{ t('modelTabs.noModelsAvailable') }}</span>
      </div>

      <!-- Parameters -->
      <PanelSection
        :title="t('modelTabs.parameters')"
        icon="ph:sliders-horizontal-duotone"
        collapsible
        defaultCollapsed
      >
        <div class="params-form">
          <BaseSlider
            :label="t('modelTabs.temperature')"
            :min="0"
            :max="1"
            :step="0.05"
            :modelValue="llm.temperature"
            @update:modelValue="updateTemperature"
            :showValue="true"
          />
          <p class="param-hint">{{ t('modelTabs.temperatureHint') }}</p>

          <BaseSlider
            :label="t('modelTabs.maxTokens')"
            :min="64"
            :max="4096"
            :step="64"
            :modelValue="llm.maxTokens"
            @update:modelValue="updateMaxTokens"
            :showValue="true"
          />
          <p class="param-hint">{{ t('modelTabs.maxTokensHint') }}</p>
        </div>
      </PanelSection>
    </template>
  </div>
</template>

<style scoped>
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
  border-radius: var(--radius-lg);
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
  border-radius: var(--radius-lg);
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

.params-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.param-hint {
  font-size: 9px;
  color: var(--text-muted);
  margin: 0 0 8px 0;
  padding-left: 4px;
}
</style>
