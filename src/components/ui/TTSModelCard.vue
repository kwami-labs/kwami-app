<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { InferenceTTSModel, PluginTTSModel } from '@/composables/useModelsApi';
import RangeBar from './RangeBar.vue';

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
  model: InferenceTTSModel | PluginTTSModel;
  selected?: boolean;
  disabled?: boolean;
  // Min/max values for range calculations
  minPrice?: number;
  maxPrice?: number;
}>();

const emit = defineEmits<{
  (e: 'select', modelId: string, provider: string): void;
}>();

// Check if model has pricing (InferenceTTSModel)
const hasPricing = computed(() => 'pricing' in props.model && props.model.pricing);

// Provider icon mapping
const providerIcon = computed(() => {
  const icons: Record<string, string> = {
    cartesia: 'ph:speaker-high-duotone',
    deepgram: 'simple-icons:deepgram',
    elevenlabs: 'simple-icons:elevenlabs',
    inworld: 'ph:robot-duotone',
    rime: 'ph:speaker-simple-high-duotone',
    openai: 'simple-icons:openai',
    google: 'simple-icons:googlegemini',
    groq: 'ph:lightning-duotone',
  };
  return icons[props.model.provider.toLowerCase()] || 'ph:speaker-high-duotone';
});

// Get price per million chars
const pricePer1M = computed(() => {
  if (!hasPricing.value) return null;
  return (props.model as InferenceTTSModel).pricing.scale_per_1m_chars;
});

// Format price
const priceDisplay = computed(() => {
  if (pricePer1M.value === null) return null;
  const price = pricePer1M.value;
  return `$${price.toFixed(0)}`;
});

// Price percentage (proportional: lowest price = small bar, highest = 100%)
// Minimum floor of 8% so the bar is never invisible
const pricePercent = computed(() => {
  if (!props.minPrice || !props.maxPrice || pricePer1M.value === null) return 50;
  const range = props.maxPrice - props.minPrice;
  if (range === 0) return 50;
  const raw = ((pricePer1M.value - props.minPrice) / range) * 100;
  return Math.max(8, raw);
});

// Speed percentage and display
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

// Features count and display
const advancedFeatures = computed(() => {
  const advanced = ['voice_cloning', 'emotion_control', 'ultra_low_latency'];
  return props.model.features.filter((f) => advanced.includes(f));
});

const featuresPercent = computed(() => {
  // 0 features = 20%, 1 = 50%, 2 = 75%, 3 = 100%
  const count = advancedFeatures.value.length;
  if (count === 0) return 20;
  if (count === 1) return 50;
  if (count === 2) return 75;
  return 100;
});

const featuresDisplay = computed(() => {
  const count = advancedFeatures.value.length;
  if (count === 0) return t('ttsModelCard.featuresBasic');
  return t('ttsModelCard.featuresCount', { n: count }, count);
});

// Is multilingual
const isMultilingual = computed(() => {
  return props.model.languages.includes('multilingual');
});

// Formatted languages for tooltip
const formattedLanguages = computed(() => {
  return props.model.languages.map((code) => ({
    code,
    name: LANGUAGE_NAMES[code] || code.toUpperCase(),
  }));
});

// Show languages popover
const showLanguages = ref(false);

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
      <div v-if="priceDisplay" class="range-row">
        <RangeBar
          :value="pricePercent"
          icon="ph:currency-dollar-duotone"
          :label="t('sttModelCard.price')"
          :title="t('ttsModelCard.priceTitle', { price: priceDisplay })"
        />
        <span class="range-value">{{ priceDisplay }}</span>
      </div>
      <div class="range-row">
        <RangeBar
          :value="featuresPercent"
          icon="ph:sparkle-duotone"
          :label="t('ttsModelCard.features')"
          :title="t('ttsModelCard.featuresTitle', { summary: featuresDisplay })"
        />
        <span class="range-value">{{ featuresDisplay }}</span>
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

    <div v-if="advancedFeatures.length || model.languages.length > 0" class="card-features">
      <span
        v-if="advancedFeatures.includes('voice_cloning')"
        class="feature-badge clone"
        :title="t('ttsModelCard.titleVoiceCloning')"
      >
        <iconify-icon icon="ph:user-sound-duotone"></iconify-icon>
        <span class="feature-label">{{ t('ttsModelCard.featureClone') }}</span>
      </span>
      <span
        v-if="advancedFeatures.includes('emotion_control')"
        class="feature-badge emotion"
        :title="t('ttsModelCard.titleEmotionControl')"
      >
        <iconify-icon icon="ph:smiley-duotone"></iconify-icon>
        <span class="feature-label">{{ t('ttsModelCard.featureEmotion') }}</span>
      </span>
      <span
        v-if="model.languages.length > 0"
        class="feature-badge multilingual lang-trigger"
        :title="
          t('sttModelCard.languagesHeading', { n: model.languages.length }, model.languages.length)
        "
        @mouseenter="showLanguages = true"
        @mouseleave="showLanguages = false"
      >
        <iconify-icon icon="ph:globe-duotone"></iconify-icon>
        <span class="feature-label">{{
          isMultilingual ? t('sttModelCard.multiShort') : model.languages.length
        }}</span>

        <!-- Languages Popover -->
        <Transition name="fade">
          <div
            v-if="showLanguages && model.languages.length > 1"
            class="languages-popover"
            @click.stop
          >
            <div class="popover-header">
              <iconify-icon icon="ph:globe-duotone"></iconify-icon>
              <span>{{
                t(
                  'sttModelCard.languagesHeading',
                  { n: model.languages.length },
                  model.languages.length,
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
                {{ lang.code }}
              </span>
            </div>
          </div>
        </Transition>
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

.range-value {
  font-size: 9px;
  color: var(--text-muted);
  min-width: 38px;
  text-align: right;
}

.card-features {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: auto;
}

.feature-badge {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  border-radius: var(--radius-lg);
  font-size: 9px;
}

.feature-badge iconify-icon {
  font-size: 10px;
}

.feature-label {
  font-weight: 500;
}

.feature-badge.clone {
  background: rgba(147, 51, 234, 0.15);
  color: #a78bfa;
}

.feature-badge.emotion {
  background: rgba(251, 191, 36, 0.15);
  color: #fbbf24;
}

.feature-badge.multilingual {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
}

.lang-trigger {
  position: relative;
  cursor: pointer;
}

/* Languages Popover */
.languages-popover {
  position: absolute;
  bottom: 100%;
  left: 0;
  margin-bottom: 4px;
  padding: 8px;
  background: var(--surface-2);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 100;
  min-width: 180px;
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
  padding: 2px 6px;
  font-size: 9px;
  font-weight: 500;
  background: var(--surface-3);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  text-transform: uppercase;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.model-card.selected .feature-badge {
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
