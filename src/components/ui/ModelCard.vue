<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { InferenceModel, PluginModel } from '@/composables/useModelsApi';
import RangeBar from './RangeBar.vue';
import { getFlagIcon } from '@/constants/language-flags';

const { t } = useI18n();

// Language name mapping
const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  'en-US': 'English (US)',
  'en-GB': 'English (UK)',
  'en-AU': 'English (AU)',
  es: 'Spanish',
  'es-419': 'Spanish (LATAM)',
  'es-ES': 'Spanish (Spain)',
  fr: 'French',
  'fr-CA': 'French (CA)',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  'pt-BR': 'Portuguese (BR)',
  nl: 'Dutch',
  pl: 'Polish',
  ru: 'Russian',
  zh: 'Chinese',
  'zh-CN': 'Chinese (Simplified)',
  'zh-TW': 'Chinese (Traditional)',
  ja: 'Japanese',
  ko: 'Korean',
  ar: 'Arabic',
  hi: 'Hindi',
  tr: 'Turkish',
  vi: 'Vietnamese',
  th: 'Thai',
  id: 'Indonesian',
  sv: 'Swedish',
  da: 'Danish',
  no: 'Norwegian',
  fi: 'Finnish',
  cs: 'Czech',
  el: 'Greek',
  he: 'Hebrew',
  hu: 'Hungarian',
  ro: 'Romanian',
  uk: 'Ukrainian',
  multi: 'Multi-language',
  multilingual: 'Multilingual',
};

const props = defineProps<{
  model: InferenceModel | PluginModel;
  selected?: boolean;
  disabled?: boolean;
  // Min/max values for range calculations
  minContext?: number;
  maxContext?: number;
  minPrice?: number;
  maxPrice?: number;
}>();

const emit = defineEmits<{
  (e: 'select', modelId: string, provider: string): void;
}>();

// Check if model has providers (InferenceModel)
const hasProviders = computed(() => 'providers' in props.model && props.model.providers);

// Provider icon mapping
const providerIcon = computed(() => {
  const icons: Record<string, string> = {
    openai: 'simple-icons:openai',
    anthropic: 'simple-icons:anthropic',
    google: 'simple-icons:googlegemini',
    groq: 'ph:lightning-duotone',
    mistralai: 'ph:wind-duotone',
    deepseek: 'game-icons:whale-tail',
    cerebras: 'ph:cpu-duotone',
    together: 'ph:circles-three-duotone',
    perplexity: 'ph:compass-duotone',
    xai: 'ph:x-circle-duotone',
    moonshot: 'ph:moon-duotone',
  };
  return icons[props.model.provider.toLowerCase()] || 'ph:cube-duotone';
});

// Format context window
const contextDisplay = computed(() => {
  const ctx = props.model.context_window;
  if (ctx >= 1000000) return `${(ctx / 1000000).toFixed(0)}M`;
  if (ctx >= 1000) return `${(ctx / 1000).toFixed(0)}K`;
  return ctx.toString();
});

// Context percentage (higher context = higher bar = better)
// Minimum floor of 8% so the bar is never invisible
const contextPercent = computed(() => {
  if (!props.minContext || !props.maxContext) return 50;
  const range = props.maxContext - props.minContext;
  if (range === 0) return 50;
  const raw = ((props.model.context_window - props.minContext) / range) * 100;
  return Math.max(8, raw);
});

// Get the cheapest input price from providers
const inputPrice = computed(() => {
  if (!hasProviders.value) return null;

  const providers = (props.model as InferenceModel).providers;
  if (!providers || Object.keys(providers).length === 0) return null;

  const prices = Object.values(providers).map((p) => p.input_per_1m);
  return Math.min(...prices);
});

const priceDisplay = computed(() => {
  if (inputPrice.value === null) return null;
  const price = inputPrice.value;
  if (price < 0.1) return `$${price.toFixed(3)}`;
  if (price < 1) return `$${price.toFixed(2)}`;
  return `$${price.toFixed(1)}`;
});

// Price percentage (proportional: lowest price = small bar, highest = 100%)
// Minimum floor of 8% so the bar is never invisible
const pricePercent = computed(() => {
  if (!props.minPrice || !props.maxPrice || inputPrice.value === null) return 50;
  const range = props.maxPrice - props.minPrice;
  if (range === 0) return 50;
  const raw = ((inputPrice.value - props.minPrice) / range) * 100;
  return Math.max(8, raw);
});

// Speed percentage (fast = 100%, standard = 60%, slow = 30%)
const speedPercent = computed(() => {
  const speedValues: Record<string, number> = {
    fast: 100,
    standard: 60,
    slow: 30,
  };
  return speedValues[props.model.speed] || 60;
});

const speedDisplay = computed(() => {
  const keys: Record<string, string> = {
    fast: 'sttModelCard.speedFast',
    standard: 'sttModelCard.speedMedium',
    slow: 'sttModelCard.speedSlow',
  };
  return t(keys[props.model.speed] ?? 'sttModelCard.speedMedium');
});

// Formatted languages for tooltip
const formattedLanguages = computed(() => {
  if (!props.model.languages) return [];
  return props.model.languages.map((code) => ({
    code,
    name: LANGUAGE_NAMES[code] || code.toUpperCase(),
  }));
});

// Visible flags (show up to 6, then "+N")
const MAX_VISIBLE_FLAGS = 6;
const visibleLanguages = computed(() => formattedLanguages.value.slice(0, MAX_VISIBLE_FLAGS));
const extraLanguageCount = computed(() =>
  Math.max(0, formattedLanguages.value.length - MAX_VISIBLE_FLAGS),
);

// Show languages popover
const showLanguages = ref(false);

// Key capabilities to show (max 2)
const keyCapabilities = computed(() => {
  const priority = ['vision', 'function_calling', 'json_mode'];
  return props.model.capabilities.filter((c) => priority.includes(c)).slice(0, 2);
});

function handleClick() {
  if (!props.disabled) {
    emit('select', props.model.model_id, props.model.provider);
  }
}
</script>

<template>
  <button
    class="model-card"
    :class="{ selected, disabled }"
    @click="handleClick"
    :disabled="disabled"
  >
    <div class="card-header">
      <iconify-icon :icon="providerIcon" class="provider-icon"></iconify-icon>
      <span class="model-name">{{ model.display_name }}</span>
    </div>

    <!-- Range Bars -->
    <div class="card-ranges">
      <div class="range-row">
        <RangeBar
          :value="contextPercent"
          icon="ph:stack-duotone"
          :label="t('llmModelCard.context')"
          :title="t('llmModelCard.contextTitle', { ctx: contextDisplay })"
        />
        <span class="range-value">{{ contextDisplay }}</span>
      </div>
      <div v-if="priceDisplay" class="range-row">
        <RangeBar
          :value="pricePercent"
          icon="ph:currency-dollar-duotone"
          :label="t('sttModelCard.price')"
          :title="t('llmModelCard.priceTitle', { price: priceDisplay })"
        />
        <span class="range-value">{{ priceDisplay }}</span>
      </div>
      <!-- Language Flags -->
      <div v-if="formattedLanguages.length" class="lang-flags-row">
        <iconify-icon icon="ph:globe-duotone" class="lang-label-icon"></iconify-icon>
        <div
          class="lang-flags"
          @mouseenter="showLanguages = true"
          @mouseleave="showLanguages = false"
        >
          <iconify-icon
            v-for="lang in visibleLanguages"
            :key="lang.code"
            :icon="getFlagIcon(lang.code)"
            class="flag-icon"
            :title="lang.name"
          ></iconify-icon>
          <span v-if="extraLanguageCount > 0" class="lang-more">+{{ extraLanguageCount }}</span>

          <!-- Languages Popover -->
          <Transition name="fade">
            <div v-if="showLanguages && formattedLanguages.length > 1" class="languages-popover">
              <div class="popover-header">
                <iconify-icon icon="ph:globe-duotone"></iconify-icon>
                <span>{{
                  t(
                    'sttModelCard.languagesHeading',
                    { n: formattedLanguages.length },
                    formattedLanguages.length,
                  )
                }}</span>
              </div>
              <div class="languages-grid">
                <span
                  v-for="lang in formattedLanguages"
                  :key="lang.code"
                  class="lang-badge"
                  :title="lang.name"
                >
                  <iconify-icon :icon="getFlagIcon(lang.code)" class="badge-flag"></iconify-icon>
                  {{ lang.name }}
                </span>
              </div>
            </div>
          </Transition>
        </div>
      </div>
      <div class="range-row">
        <RangeBar
          :value="speedPercent"
          icon="ph:lightning-duotone"
          :label="t('sttModelCard.speed')"
          :title="t('sttModelCard.speedTitle', { speed: speedDisplay })"
        />
        <span class="range-value">{{ speedDisplay }}</span>
      </div>
    </div>

    <div v-if="keyCapabilities.length" class="card-capabilities">
      <span
        v-if="keyCapabilities.includes('vision')"
        class="cap-badge vision"
        :title="t('llmModelCard.titleVision')"
      >
        <iconify-icon icon="ph:eye-duotone"></iconify-icon>
        <span class="cap-label">{{ t('llmModelCard.capVision') }}</span>
      </span>
      <span
        v-if="keyCapabilities.includes('function_calling')"
        class="cap-badge tools"
        :title="t('llmModelCard.titleFunctionCalling')"
      >
        <iconify-icon icon="ph:wrench-duotone"></iconify-icon>
        <span class="cap-label">{{ t('llmModelCard.capTools') }}</span>
      </span>
    </div>

    <div class="selected-indicator">
      <iconify-icon icon="ph:check-circle-duotone"></iconify-icon>
    </div>
  </button>
</template>

<style scoped>
.model-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
  text-align: left;
  font-family: inherit;
  min-height: 90px;
}

.model-card:hover:not(.disabled):not(.selected) {
  background: var(--surface-2);
  border-color: var(--accent-primary);
  box-shadow: 0 2px 12px var(--accent-glow);
  transform: translateY(-1px);
}

.model-card.selected {
  background: var(--accent-glow);
  border-color: var(--accent-primary);
  box-shadow: 0 2px 12px var(--accent-glow);
}

.model-card.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.provider-icon {
  font-size: 12px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.model-card.selected .provider-icon {
  color: var(--accent-primary);
}

.model-name {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.card-ranges {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.range-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Language Flags Row */
.lang-flags-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.lang-label-icon {
  font-size: 10px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.lang-flags {
  display: flex;
  align-items: center;
  gap: 3px;
  position: relative;
  cursor: pointer;
  flex-wrap: wrap;
}

.flag-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.lang-more {
  font-size: 9px;
  font-weight: 600;
  color: var(--text-muted);
  padding: 0 3px;
}

/* Languages Popover */
.languages-popover {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  padding: 8px;
  background: var(--surface-2);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 100;
  min-width: 180px;
  max-width: 260px;
}

.popover-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 6px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--glass-border);
}

.popover-header iconify-icon {
  font-size: 12px;
  color: var(--accent-primary);
}

.languages-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.lang-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  font-size: 9px;
  font-weight: 500;
  background: var(--surface-3);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
}

.badge-flag {
  font-size: 12px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.range-value {
  font-size: 9px;
  color: var(--text-muted);
  min-width: 38px;
  text-align: right;
}

.card-capabilities {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: auto;
}

.cap-badge {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  border-radius: var(--radius-lg);
  font-size: 9px;
}

.cap-badge iconify-icon {
  font-size: 10px;
}

.cap-label {
  font-weight: 500;
}

.cap-badge.vision {
  background: rgba(147, 51, 234, 0.15);
  color: #a78bfa;
}

.cap-badge.tools {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
}

.model-card.selected .cap-badge {
  background: var(--accent-glow);
  color: var(--accent-primary);
}

.selected-indicator {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 16px;
  color: var(--accent-primary);
  opacity: 0;
  transform: scale(0.8);
  transition: all var(--duration-fast) var(--ease-out);
}

.model-card.selected .selected-indicator {
  opacity: 1;
  transform: scale(1);
}
</style>
