<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useVoiceStore } from '@/stores/voice';
import { useKwami } from '@/composables/useKwami';
import { storeToRefs } from 'pinia';
import BasePanel from '@/components/ui/BasePanel.vue';
import PanelSection from '@/components/ui/PanelSection.vue';
import { panelIcons } from '@/constants/panel-icons';
import BaseSlider from '@/components/ui/BaseSlider.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import { useVoicesApi, type Voice } from '@/composables/useVoicesApi';
import { useLanguagesApi, type Language } from '@/composables/useLanguagesApi';

const voiceStore = useVoiceStore();
const { t } = useI18n();
const { pipelineMode, tts, realtime, voiceUI } = storeToRefs(voiceStore);
const { kwami, isConnected } = useKwami();
const panelIcon = panelIcons.voice ?? 'mdi:account-voice';

const { 
  fetchTTSVoicesByProvider, 
  fetchRealtimeVoicesByProvider,
  isLoading: voicesLoading 
} = useVoicesApi();

const {
  fetchTTSLanguagesByProvider,
  fetchRealtimeLanguagesByProvider,
} = useLanguagesApi();

// Local state (fetched data — composables already cache these)
const ttsVoices = ref<Voice[]>([]);
const realtimeVoices = ref<Voice[]>([]);
const ttsLanguages = ref<Language[]>([]);
const realtimeLanguages = ref<Language[]>([]);

// Persisted filter state via store
const languageFilter = computed({
  get: () => voiceUI.value.languageFilter,
  set: (v) => { voiceUI.value.languageFilter = v; }
});
const genderFilter = computed({
  get: () => voiceUI.value.genderFilter,
  set: (v) => { voiceUI.value.genderFilter = v; }
});
const searchQuery = computed({
  get: () => voiceUI.value.searchQuery,
  set: (v) => { voiceUI.value.searchQuery = v; }
});

import { getFlagIcon } from '@/constants/language-flags';

// Provider icons
function getProviderIcon(provider: string): string {
  const icons: Record<string, string> = {
    openai: 'simple-icons:openai',
    cartesia: 'ph:speaker-high-duotone',
    elevenlabs: 'simple-icons:elevenlabs',
    deepgram: 'simple-icons:deepgram',
    google: 'simple-icons:googlegemini',
    rime: 'ph:speaker-simple-high-duotone',
    gemini: 'simple-icons:googlegemini',
  };
  return icons[provider.toLowerCase()] || 'ph:speaker-high-duotone';
}

// Fetch voices for TTS provider
async function loadTTSVoices() {
  const result = await fetchTTSVoicesByProvider(tts.value.provider);
  if (result?.voices) {
    ttsVoices.value = result.voices;
  }
}

// Fetch voices for Realtime provider
async function loadRealtimeVoices() {
  const result = await fetchRealtimeVoicesByProvider(realtime.value.provider);
  if (result?.voices) {
    realtimeVoices.value = result.voices;
  }
}

// Fetch languages for TTS provider
async function loadTTSLanguages() {
  const result = await fetchTTSLanguagesByProvider(tts.value.provider);
  if (result?.languages) {
    ttsLanguages.value = result.languages;
  }
}

// Fetch languages for Realtime provider
async function loadRealtimeLanguages() {
  const result = await fetchRealtimeLanguagesByProvider(realtime.value.provider);
  if (result?.languages) {
    realtimeLanguages.value = result.languages;
  }
}

// Current voices based on pipeline mode
const currentVoices = computed(() => {
  return pipelineMode.value === 'realtime' ? realtimeVoices.value : ttsVoices.value;
});

// Current languages based on pipeline mode (from languages API, not voice data)
const currentLanguages = computed(() => {
  return pipelineMode.value === 'realtime' ? realtimeLanguages.value : ttsLanguages.value;
});

// Language options for BaseSelect (from provider's supported languages)
const languageOptions = computed(() => {
  const langs = currentLanguages.value;
  if (langs.length === 0) {
    // Fallback to extracting from voices if languages not loaded
    const voices = currentVoices.value;
    const langSet = new Set<string>();
    voices.forEach(v => {
      if (v.language) langSet.add(v.language);
    });
    const voiceLangs = Array.from(langSet).sort();
    return [
      { label: t('voice.allLanguages'), value: 'all', icon: 'ph:globe-duotone' },
      ...voiceLangs.map(lang => ({ 
        label: lang, 
        value: lang, 
        icon: getFlagIcon(lang) 
      }))
    ];
  }
  
  return [
    { label: t('voice.allLanguages'), value: 'all', icon: 'ph:globe-duotone' },
    ...langs.map(lang => ({ 
      label: lang.name + (lang.region ? ` (${lang.region})` : ''), 
      value: lang.code, 
      icon: getFlagIcon(lang.code) 
    }))
  ];
});

// Gender options for BaseSelect
const genderOptions = computed(() => {
  const voices = currentVoices.value;
  const genderSet = new Set<string>();
  voices.forEach(v => {
    if (v.gender) genderSet.add(v.gender);
  });
  const genders = Array.from(genderSet).sort();
  return [
    { label: t('voice.allGenders'), value: 'all', icon: 'ph:users-duotone' },
    ...genders.map(gender => ({ 
      label: gender.charAt(0).toUpperCase() + gender.slice(1), 
      value: gender,
      icon: gender === 'male' ? 'ph:gender-male-duotone' : gender === 'female' ? 'ph:gender-female-duotone' : 'ph:gender-nonbinary-duotone'
    }))
  ];
});

// Check if provider supports the selected language (multilingual voices)
const providerSupportsLanguage = computed(() => {
  if (languageFilter.value === 'all') return true;
  return currentLanguages.value.some(l => l.code === languageFilter.value);
});

// Filtered voices
const filteredVoices = computed(() => {
  let voices = currentVoices.value;
  
  // Filter by language
  // For multilingual providers (like OpenAI), if the provider supports the language,
  // show all voices since any voice can speak any supported language
  if (languageFilter.value !== 'all') {
    // Check if any voice has this specific language tagged
    const hasVoicesWithLanguage = voices.some(v => v.language === languageFilter.value);
    
    if (hasVoicesWithLanguage) {
      // Filter to only voices tagged with this language
      voices = voices.filter(v => v.language === languageFilter.value);
    } else if (!providerSupportsLanguage.value) {
      // Provider doesn't support this language at all
      voices = [];
    }
    // Otherwise, provider supports language but voices aren't tagged - show all voices
  }
  
  // Filter by gender
  if (genderFilter.value !== 'all') {
    voices = voices.filter(v => v.gender === genderFilter.value);
  }
  
  // Filter by search query
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    voices = voices.filter(v => 
      v.name.toLowerCase().includes(query) ||
      v.id.toLowerCase().includes(query) ||
      (v.category && v.category.toLowerCase().includes(query))
    );
  }
  
  return voices;
});

// Group voices by category
const groupedVoices = computed(() => {
  const groups: Record<string, Voice[]> = {};
  
  for (const voice of filteredVoices.value) {
    const category = voice.category || t('voice.categoryOther');
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(voice);
  }
  
  return groups;
});

// Current selected voice
const selectedVoice = computed(() => {
  return pipelineMode.value === 'realtime' ? realtime.value.voice : tts.value.voice;
});

// Current provider
const currentProvider = computed(() => {
  return pipelineMode.value === 'realtime' ? realtime.value.provider : tts.value.provider;
});

// Current model
const currentModel = computed(() => {
  return pipelineMode.value === 'realtime' ? realtime.value.model : tts.value.model;
});

// Select a voice
function selectVoice(voiceId: string) {
  console.log(`🎙️ Voice selected: ${voiceId}, mode: ${pipelineMode.value}, connected: ${isConnected.value}`);
  
  if (pipelineMode.value === 'realtime') {
    voiceStore.updateRealtime({ voice: voiceId });
  } else {
    voiceStore.updateTTS({ voice: voiceId });
  }
  
  // Live update if connected
  if (isConnected.value && kwami.value) {
    const agent = kwami.value.agent;
    if (pipelineMode.value === 'realtime') {
      // Update realtime voice live
      if (agent && 'updateRealtimeLive' in agent && typeof agent.updateRealtimeLive === 'function') {
        console.log('⚡ Calling updateRealtimeLive with voice:', voiceId);
        agent.updateRealtimeLive({
          voice: voiceId,
        });
      } else {
        console.warn('⚠️ updateRealtimeLive not available on agent');
      }
    } else {
      // Update TTS voice live
      if (agent && 'updateTtsLive' in agent && typeof agent.updateTtsLive === 'function') {
        console.log('🔊 Calling updateTtsLive with voice:', voiceId, 'speed:', tts.value.speed);
        agent.updateTtsLive({
          voice: voiceId,
          speed: tts.value.speed,
        });
      } else {
        console.warn('⚠️ updateTtsLive not available on agent');
      }
    }
  } else {
    console.log('📴 Not connected, skipping live update');
  }
}

// Reset filters
function resetFilters() {
  languageFilter.value = 'all';
  genderFilter.value = 'all';
  searchQuery.value = '';
}

// Track previous providers so we only reset filters on actual provider *changes*
let prevTtsProvider = tts.value.provider;
let prevRealtimeProvider = realtime.value.provider;

// Watch provider changes (immediate loads data; only resets filters on actual change)
watch(() => tts.value.provider, (newProvider) => {
  loadTTSVoices();
  loadTTSLanguages();
  if (newProvider !== prevTtsProvider) {
    resetFilters();
    prevTtsProvider = newProvider;
  }
}, { immediate: true });

watch(() => realtime.value.provider, (newProvider) => {
  loadRealtimeVoices();
  loadRealtimeLanguages();
  if (newProvider !== prevRealtimeProvider) {
    resetFilters();
    prevRealtimeProvider = newProvider;
  }
}, { immediate: true });

// Watch pipeline mode changes — only reset if mode actually changed since last visit
let prevPipelineMode = pipelineMode.value;
watch(pipelineMode, (newMode) => {
  if (newMode !== prevPipelineMode) {
    resetFilters();
    prevPipelineMode = newMode;
  }
});

// Watch TTS speed changes for live updates
watch(() => tts.value.speed, (newSpeed) => {
  if (isConnected.value && kwami.value && pipelineMode.value !== 'realtime') {
    const agent = kwami.value.agent;
    if (agent && 'updateTtsLive' in agent && typeof agent.updateTtsLive === 'function') {
      agent.updateTtsLive({
        voice: tts.value.voice,
        speed: newSpeed,
      });
    }
  }
});
</script>

<template>
  <BasePanel :icon="panelIcon" :title="t('voice.title')">
    <!-- Current Model Context -->
    <PanelSection>
      <div class="model-context">
        <div class="context-badge" :class="pipelineMode">
          <iconify-icon :icon="pipelineMode === 'realtime' ? 'ph:lightning-duotone' : 'ph:speaker-high-duotone'"></iconify-icon>
          <span>{{ pipelineMode === 'realtime' ? t('voice.modeRealtime') : t('voice.modeTts') }}</span>
        </div>
        <div class="context-info">
          <div class="provider-row">
            <iconify-icon :icon="getProviderIcon(currentProvider)" class="provider-icon"></iconify-icon>
            <span class="provider-name">{{ currentProvider }}</span>
          </div>
          <span class="model-name">{{ currentModel }}</span>
        </div>
      </div>
    </PanelSection>

    <!-- Filters -->
    <PanelSection :title="t('voice.filterVoices')" icon="ph:funnel-duotone" collapsible>
      <div class="filters">
        <BaseInput
          v-model="searchQuery"
          :label="t('voice.search')"
          icon="ph:magnifying-glass-duotone"
          :placeholder="t('voice.searchPlaceholder')"
        />
        
        <BaseSelect
          v-if="languageOptions.length > 1"
          v-model="languageFilter"
          :label="t('voice.language')"
          icon="ph:globe-duotone"
          :options="languageOptions"
        />
        
        <BaseSelect
          v-if="genderOptions.length > 1"
          v-model="genderFilter"
          :label="t('voice.gender')"
          icon="ph:users-duotone"
          :options="genderOptions"
        />
      </div>
    </PanelSection>

    <!-- Multilingual Info Banner -->
    <PanelSection v-if="languageFilter !== 'all' && providerSupportsLanguage && !currentVoices.some(v => v.language === languageFilter)">
      <div class="multilingual-banner">
        <iconify-icon icon="ph:translate-duotone"></iconify-icon>
        <div class="banner-content">
          <span class="banner-title">{{ t('voice.multilingualVoices') }}</span>
          <span class="banner-text">{{ t('voice.multilingualSupport', { provider: currentProvider, language: languageOptions.find(l => l.value === languageFilter)?.label || languageFilter }) }}</span>
        </div>
      </div>
    </PanelSection>

    <!-- Voice Selection -->
    <PanelSection 
      v-for="(voices, category) in groupedVoices" 
      :key="category"
      :title="String(category)"
      :icon="category === 'Male' ? 'ph:gender-male-duotone' : category === 'Female' ? 'ph:gender-female-duotone' : 'ph:user-duotone'"
      collapsible
    >
      <div class="voices-grid">
        <button
          v-for="voice in voices"
          :key="voice.id"
          class="voice-card"
          :class="{ selected: selectedVoice === voice.id }"
          @click="selectVoice(voice.id)"
        >
          <div class="voice-header">
            <span class="voice-name">{{ voice.name }}</span>
            <div class="selected-check" v-if="selectedVoice === voice.id">
              <iconify-icon icon="ph:check-circle-duotone"></iconify-icon>
            </div>
          </div>
          <div class="voice-meta">
            <span v-if="voice.gender" class="voice-tag gender">
              <iconify-icon :icon="voice.gender === 'male' ? 'ph:gender-male' : voice.gender === 'female' ? 'ph:gender-female' : 'ph:gender-nonbinary'"></iconify-icon>
            </span>
            <span v-if="voice.language" class="voice-tag lang">
              <iconify-icon :icon="getFlagIcon(voice.language)" class="flag-icon"></iconify-icon>
              {{ voice.language }}
            </span>
          </div>
          <p v-if="voice.description" class="voice-description">{{ voice.description }}</p>
        </button>
      </div>
    </PanelSection>

    <!-- Loading State -->
    <PanelSection v-if="voicesLoading">
      <div class="loading-state">
        <iconify-icon icon="ph:spinner-duotone" class="spinner"></iconify-icon>
        <span>{{ t('voice.loadingVoices') }}</span>
      </div>
    </PanelSection>

    <!-- Empty State -->
    <PanelSection v-if="!voicesLoading && filteredVoices.length === 0">
      <div class="empty-state">
        <iconify-icon icon="ph:speaker-slash-duotone"></iconify-icon>
        <span>{{ t('voice.noVoicesMatch') }}</span>
        <button class="reset-btn" @click="resetFilters">
          {{ t('voice.resetFilters') }}
        </button>
      </div>
    </PanelSection>

    <!-- TTS Speed Control (only for standard pipeline) -->
    <PanelSection 
      v-if="pipelineMode !== 'realtime'" 
      :title="t('voice.voiceSettings')" 
      icon="ph:sliders-duotone"
    >
      <div class="settings-form">
        <BaseSlider 
          :label="t('voice.speed')" 
          :min="0.5" 
          :max="2" 
          :step="0.1" 
          v-model="tts.speed"
          :showValue="true"
        />
        <p class="setting-hint">{{ t('voice.speedHint') }}</p>
      </div>
    </PanelSection>
  </BasePanel>
</template>

<style scoped>
.model-context {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--surface-1);
  border-radius: var(--radius-lg);
  border: 1px solid var(--glass-border);
}

.context-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: var(--radius-md);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.context-badge.stt-llm-tts {
  background: rgba(74, 222, 128, 0.15);
  color: #4ade80;
}

.context-badge.realtime {
  background: rgba(251, 191, 36, 0.15);
  color: #fbbf24;
}

.context-badge iconify-icon {
  font-size: 14px;
}

.context-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.provider-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.provider-icon {
  font-size: 14px;
  color: var(--text-muted);
}

.provider-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  text-transform: capitalize;
}

.model-name {
  font-size: 10px;
  color: var(--text-muted);
  font-family: var(--font-mono, monospace);
}

/* Multilingual Banner */
.multilingual-banner {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  background: rgba(74, 222, 128, 0.1);
  border: 1px solid rgba(74, 222, 128, 0.3);
  border-radius: var(--radius-lg);
}

.multilingual-banner > iconify-icon {
  font-size: 18px;
  color: #4ade80;
  flex-shrink: 0;
  margin-top: 2px;
}

.banner-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.banner-title {
  font-size: 11px;
  font-weight: 600;
  color: #4ade80;
}

.banner-text {
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.4;
}

/* Filters */
.filters {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Voice Cards */
.voices-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.voice-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  background: var(--surface-1);
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-in-out);
  text-align: left;
  font-family: inherit;
}

.voice-card:hover {
  background: var(--surface-2);
  border-color: var(--glass-border);
  transform: translateY(-1px);
}

.voice-card.selected {
  background: var(--accent-glow);
  border-color: var(--accent-primary);
}

.voice-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.voice-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.selected-check {
  font-size: 18px;
  color: var(--accent-primary);
}

.voice-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.voice-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  font-size: 10px;
  font-weight: 500;
  border-radius: var(--radius-md);
}

.voice-tag.gender {
  background: rgba(167, 139, 250, 0.15);
  color: #a78bfa;
}

.voice-tag.lang {
  background: rgba(96, 165, 250, 0.15);
  color: #60a5fa;
}

.voice-tag iconify-icon {
  font-size: 12px;
}

.flag-icon {
  font-size: 14px !important;
}

.voice-description {
  font-size: 11px;
  color: var(--text-muted);
  margin: 0;
  line-height: 1.4;
}

/* Loading & Empty States */
.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px 20px;
  color: var(--text-muted);
  font-size: 13px;
}

.loading-state iconify-icon,
.empty-state iconify-icon {
  font-size: 32px;
}

.spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.reset-btn {
  padding: 8px 16px;
  background: var(--surface-2);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-in-out);
}

.reset-btn:hover {
  background: var(--accent-glow);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

/* Settings */
.settings-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.setting-hint {
  font-size: 10px;
  color: var(--text-muted);
  margin: 0;
}
</style>
