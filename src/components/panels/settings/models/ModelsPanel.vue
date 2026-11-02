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
import BrainFlow from './BrainFlow.vue';
import BrainSettings from './BrainSettings.vue';
import { JARVIS_VOICE, voiceProviderHasKey } from '@/lib/brain';
import { GEMINI_STANDARD, JARVIS_STANDARD, VOICE_PERSONAS } from '@/lib/voicePersonas';
import { hybridModelFor, type PipelineMode } from '@/lib/voiceEngines';
import { engineSwitchFields, sendRawConfigUpdate } from '@/lib/agentConfigUpdate';
import { useKwami } from '@/composables/useKwami';

const voiceStore = useVoiceStore();
const { t } = useI18n();
const { llm, stt, tts, realtime, pipelineMode, modelsUI, brainStatus, engineNotice } =
  storeToRefs(voiceStore);

// Jarvis's voice: Deepgram listening, Claude thinking and ElevenLabs speaking
// (a paid TTS instead of the free-tier Gemini one), or one of the
// other character engines (Gemini TTS, Gemini Live). Offered when the voice is
// on none of them, or when one of its providers has no key on the agent.
const CHARACTER_TTS: readonly string[] = [
  JARVIS_STANDARD.tts.provider,
  GEMINI_STANDARD.tts.provider,
];
// Gemini thinking is the user's choice too ("the voice also answers"), and older saves.
const CHARACTER_LLM: readonly string[] = [
  JARVIS_STANDARD.llm.provider,
  GEMINI_STANDARD.llm.provider,
];
// On Live + TTS the Live model hears and thinks: Jarvis is the character TTS.
const voiceIsJarvis = computed(() => {
  if (pipelineMode.value === 'realtime') return realtime.value.provider === JARVIS_VOICE.provider;
  if (pipelineMode.value === 'hybrid') return CHARACTER_TTS.includes(tts.value.provider);
  return (
    stt.value.provider === JARVIS_STANDARD.stt.provider &&
    CHARACTER_LLM.includes(llm.value.provider) &&
    CHARACTER_TTS.includes(tts.value.provider)
  );
});
const voiceProviderMissingKey = computed(() => {
  const status = brainStatus.value;
  const realtimeMissing = !voiceProviderHasKey(status, 'realtime', realtime.value.provider);
  const ttsMissing = !voiceProviderHasKey(status, 'tts', tts.value.provider);
  const missing =
    pipelineMode.value === 'realtime'
      ? realtimeMissing
      : pipelineMode.value === 'hybrid'
        ? realtimeMissing || ttsMissing
        : !voiceProviderHasKey(status, 'stt', stt.value.provider) ||
          !voiceProviderHasKey(status, 'llm', llm.value.provider) ||
          ttsMissing;
  return voiceIsJarvis.value && missing;
});
function useJarvisVoice() {
  const jarvis = VOICE_PERSONAS[0];
  voiceStore.updateSTT({ ...JARVIS_STANDARD.stt });
  voiceStore.updateLLM({ ...JARVIS_STANDARD.llm });
  // The direction is kept although ElevenLabs does not read it: a set
  // direction is what locks the voice against the agent's own switching.
  voiceStore.updateTTS({ ...JARVIS_STANDARD.tts, style: jarvis.style });
  voiceStore.updateRealtime({ ...JARVIS_VOICE, style: jarvis.style });
  voiceStore.setPipelineMode('stt-llm-tts');
}
const panelIcon = panelIcons.models ?? 'ph:cpu-duotone';

// The pipeline, through the store: Live + TTS may swap the Live model for one
// that answers in text, or be refused when none can.
const pipelineType = computed({
  get: () => pipelineMode.value,
  set: (value: PipelineMode) => {
    if (value === pipelineMode.value) return;
    if (voiceStore.setPipelineMode(value)) pushPipeline();
  },
});

const { kwami, isConnected } = useKwami();
/** The SDK's copy is what the next connect sends; a live session switches now. */
function pushPipeline() {
  const instance = kwami.value;
  if (!instance) return;
  instance.agent.updateConfig({
    livekit: { ...instance.agent.getConfig().livekit, voice: voiceStore.voiceConfig },
  });
  if (!isConnected.value) return;
  sendRawConfigUpdate(instance, 'pipeline', {
    pipelineType: pipelineMode.value,
    ...engineSwitchFields({
      stt: stt.value,
      llm: llm.value,
      tts: tts.value,
      realtime: realtime.value,
    }),
  });
}
/** No Live model that answers in text has its key on the agent. */
const hybridDisabled = computed(() => hybridModelFor(realtime.value, brainStatus.value) === null);

// Active model type tab (for standard pipeline) - persisted in store
const activeModelType = computed({
  get: () => modelsUI.value.activeModelType as ModelType,
  set: (value: ModelType) => {
    modelsUI.value.activeModelType = value;
  },
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
    <!-- Who does what: voice -> bridge -> brain -->
    <PanelSection :title="t('brainPanel.flowTitle')" icon="ph:flow-arrow-duotone" collapsible>
      <BrainFlow />
    </PanelSection>

    <!-- Voice -->
    <PanelSection :title="t('brainPanel.voiceSectionTitle')" icon="ph:microphone-duotone">
      <PipelineSelector v-model="pipelineType" :hybrid-disabled="hybridDisabled" />
      <div v-if="engineNotice" class="engine-notice" role="status">
        <iconify-icon icon="ph:info-duotone"></iconify-icon>
        <p>{{ t(`engines.${engineNotice}`) }}</p>
        <button
          class="engine-notice-close"
          :aria-label="t('engines.close')"
          @click="engineNotice = null"
        >
          <iconify-icon icon="ph:x"></iconify-icon>
        </button>
      </div>
      <div v-if="!voiceIsJarvis || voiceProviderMissingKey" class="voice-hint">
        <iconify-icon icon="ph:warning-duotone"></iconify-icon>
        <p>
          <template v-if="voiceProviderMissingKey">{{ t('models.voiceNoKey') }} </template>
          {{ t('models.jarvisVoiceHint') }}
        </p>
        <button class="voice-hint-btn" @click="useJarvisVoice">
          {{ t('models.useJarvisVoice') }}
        </button>
      </div>
    </PanelSection>

    <!-- Standard Pipeline -->
    <template v-if="pipelineType === 'stt-llm-tts'">
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

    <!-- Realtime Pipeline (Live, and the Live model of Live + TTS) -->
    <template v-if="pipelineType === 'realtime' || pipelineType === 'hybrid'">
      <PanelSection :title="pipelineType === 'hybrid' ? t('engines.liveModelSection') : undefined">
        <p v-if="pipelineType === 'hybrid'" class="hybrid-intro">{{ t('engines.hybridIntro') }}</p>
        <div class="realtime-section">
          <!-- Realtime Model Summary -->
          <div class="realtime-model-summary">
            <div class="realtime-header">
              <iconify-icon icon="ph:lightning-duotone" class="realtime-icon"></iconify-icon>
              <span class="realtime-label">{{ t('models.realtimeModel') }}</span>
            </div>
            <div class="realtime-model">
              <iconify-icon
                :icon="getProviderIcon(realtime.provider)"
                class="realtime-provider-icon"
              ></iconify-icon>
              <span class="realtime-model-name">{{ realtime.model }}</span>
            </div>
          </div>

          <div class="tab-content">
            <RealtimeTab />
          </div>
        </div>
      </PanelSection>
      <PanelSection
        v-if="pipelineType === 'hybrid'"
        :title="t('engines.ttsSection')"
        icon="lucide:audio-lines"
      >
        <div class="tab-content">
          <TTSTab />
        </div>
      </PanelSection>
    </template>

    <!-- Brain -->
    <PanelSection :title="t('brainPanel.brainSectionTitle')" icon="ph:brain-duotone">
      <BrainSettings />
    </PanelSection>
  </BasePanel>
</template>

<style scoped>
.models-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.voice-hint {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-lg);
  background: rgba(251, 191, 36, 0.08);
  border: 1px solid rgba(251, 191, 36, 0.35);
}

.voice-hint iconify-icon {
  color: #fbbf24;
  font-size: 16px;
}

.voice-hint p {
  flex: 1;
  min-width: 160px;
  margin: 0;
  font-size: 11px;
  line-height: 1.4;
  color: var(--text-secondary);
}

.voice-hint-btn {
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid var(--accent-primary);
  background: var(--accent-glow);
  color: var(--text-primary);
  font-size: 11px;
  cursor: pointer;
}

.engine-notice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-lg);
  background: var(--accent-glow);
  border: 1px solid var(--accent-primary);
}

.engine-notice iconify-icon {
  color: var(--accent-primary);
  font-size: 16px;
  flex-shrink: 0;
}

.engine-notice p {
  flex: 1;
  margin: 0;
  font-size: 11px;
  line-height: 1.4;
  color: var(--text-secondary);
}

.engine-notice-close {
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0;
}

.hybrid-intro {
  margin: 0 0 10px;
  font-size: 11px;
  line-height: 1.4;
  color: var(--text-secondary);
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
