<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { panelIcons } from '@/constants/panel-icons';
import { useKwami } from '@/composables/useKwami';
import { useVoiceStore } from '@/stores/voice';
import { storeToRefs } from 'pinia';
import type { VoiceEnhancementsConfig, VADConfig } from 'kwami';
import PanelSection from '@/components/ui/PanelSection.vue';
import BaseToggle from '@/components/ui/BaseToggle.vue';
import BaseSlider from '@/components/ui/BaseSlider.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import PanelHeaderControls from '@/components/ui/PanelHeaderControls.vue';

const { kwami, isConnected } = useKwami();
const { t } = useI18n();
const voiceStore = useVoiceStore();
const { enhancementsState } = storeToRefs(voiceStore);

// Reactive references backed by store (persist across panel switches)
const turnDetection = enhancementsState.value.turnDetection;
const interruptions = enhancementsState.value.interruptions;
const noiseCancellation = enhancementsState.value.noiseCancellation;
const vad = enhancementsState.value.vad;
const audioProcessing = enhancementsState.value.audioProcessing;
const performance = enhancementsState.value.performance;

// Restore from kwami agent config on first mount
onMounted(() => {
  if (enhancementsState.value.initialized || !kwami.value) return;

  try {
    const livekitVoice = kwami.value.agent.getConfig().livekit?.voice;
    if (livekitVoice?.enhancements) {
      const e = livekitVoice.enhancements;
      if (e.turnDetection) {
        turnDetection.enabled = e.turnDetection.enabled ?? turnDetection.enabled;
        turnDetection.mode = (e.turnDetection.mode as typeof turnDetection.mode) ?? turnDetection.mode;
        turnDetection.model = (e.turnDetection.model as typeof turnDetection.model) ?? turnDetection.model;
        turnDetection.minEndpointingDelay = e.turnDetection.minEndpointingDelay ?? turnDetection.minEndpointingDelay;
        turnDetection.maxEndpointingDelay = e.turnDetection.maxEndpointingDelay ?? turnDetection.maxEndpointingDelay;
        interruptions.enabled = e.turnDetection.allowInterruptions ?? interruptions.enabled;
        interruptions.minDuration = e.turnDetection.minInterruptionDuration ?? interruptions.minDuration;
        interruptions.minWords = e.turnDetection.minInterruptionWords ?? interruptions.minWords;
      }
      if (e.noiseCancellation) {
        noiseCancellation.enabled = e.noiseCancellation.enabled ?? noiseCancellation.enabled;
        noiseCancellation.mode = (e.noiseCancellation.mode as typeof noiseCancellation.mode) ?? noiseCancellation.mode;
      }
      if (e.echoCancellation !== undefined) audioProcessing.echoCancellation = e.echoCancellation;
      if (e.autoGainControl !== undefined) audioProcessing.autoGainControl = e.autoGainControl;
      if (e.preemptiveGeneration !== undefined) performance.preemptiveGeneration = e.preemptiveGeneration;
    }
    if (livekitVoice?.vad) {
      const v = livekitVoice.vad;
      vad.provider = v.provider ?? vad.provider;
      vad.threshold = v.threshold ?? vad.threshold;
      vad.minSpeech = v.minSpeechDuration ?? vad.minSpeech;
      vad.minSilence = v.minSilenceDuration ?? vad.minSilence;
    }
  } catch (e) {
    console.warn('Failed to restore enhancements from kwami:', e);
  }

  enhancementsState.value.initialized = true;
});

function applySettings() {
  if (!kwami.value) return;

  const config: VoiceEnhancementsConfig = {
    turnDetection: {
      enabled: turnDetection.enabled,
      mode: turnDetection.mode,
      model: turnDetection.model,
      minEndpointingDelay: turnDetection.minEndpointingDelay,
      maxEndpointingDelay: turnDetection.maxEndpointingDelay,
      allowInterruptions: interruptions.enabled,
      minInterruptionDuration: interruptions.minDuration,
      minInterruptionWords: interruptions.minWords,
    },
    noiseCancellation: { enabled: noiseCancellation.enabled, mode: noiseCancellation.mode },
    echoCancellation: audioProcessing.echoCancellation,
    autoGainControl: audioProcessing.autoGainControl,
    preemptiveGeneration: performance.preemptiveGeneration,
  };

  const vadConfig: VADConfig = {
    provider: vad.provider as 'silero',
    threshold: vad.threshold,
    minSpeechDuration: vad.minSpeech,
    minSilenceDuration: vad.minSilence,
  };

  // Update local config
  kwami.value.agent.updateConfig({
    livekit: {
      ...kwami.value.agent.getConfig().livekit,
      voice: {
        ...kwami.value.agent.getConfig().livekit?.voice,
        enhancements: config,
        vad: vadConfig,
      },
    },
  });

  // If connected, sync to backend immediately
  if (isConnected.value) {
    console.log('📤 Syncing enhancements to backend:', config);
    kwami.value.agent.syncConfigToBackend('voice', {
      enhancements: config,
      vad: vadConfig,
    });
  }

  console.log('Enhancements applied:', config, vadConfig);
}

// =============================================================================
// Live Update Watchers - Apply settings automatically when values change
// =============================================================================

// Debounce helper to avoid too many updates
let applyTimeout: ReturnType<typeof setTimeout> | null = null;
function debouncedApply() {
  if (applyTimeout) clearTimeout(applyTimeout);
  applyTimeout = setTimeout(() => {
    applySettings();
  }, 300);
}

// Watch all enhancement settings for changes
watch(() => turnDetection.enabled, debouncedApply);
watch(() => turnDetection.mode, debouncedApply);
watch(() => turnDetection.model, debouncedApply);
watch(() => turnDetection.minEndpointingDelay, debouncedApply);
watch(() => turnDetection.maxEndpointingDelay, debouncedApply);

watch(() => interruptions.enabled, debouncedApply);
watch(() => interruptions.minDuration, debouncedApply);
watch(() => interruptions.minWords, debouncedApply);

watch(() => noiseCancellation.enabled, debouncedApply);
watch(() => noiseCancellation.mode, debouncedApply);

watch(() => vad.provider, debouncedApply);
watch(() => vad.threshold, debouncedApply);
watch(() => vad.minSpeech, debouncedApply);
watch(() => vad.minSilence, debouncedApply);

watch(() => audioProcessing.echoCancellation, debouncedApply);
watch(() => audioProcessing.autoGainControl, debouncedApply);

watch(() => performance.preemptiveGeneration, debouncedApply);
</script>

<template>
  <div class="panel-inner">
    <div class="panel-header">
      <iconify-icon :icon="panelIcons.enhancements" class="panel-icon"></iconify-icon>
      <h2>{{ t('enhancements.title') }}</h2>
      <PanelHeaderControls />
    </div>

    <div class="panel-body">
      <!-- Turn Detection -->
      <PanelSection :title="t('enhancements.turnDetection')" icon="ph:chat-circle-dots-duotone">
        <div class="row">
          <div class="info">
            <span class="label">{{ t('enhancements.enableTurnDetection') }}</span>
            <span class="desc">{{ t('enhancements.enableTurnDetectionDesc') }}</span>
          </div>
          <BaseToggle v-model="turnDetection.enabled" />
        </div>

        <div class="config-form" v-if="turnDetection.enabled">
          <BaseSelect
            :label="t('enhancements.detectionMode')"
            v-model="turnDetection.mode"
            :options="[
              { label: t('enhancements.modeModel'), value: 'model' },
              { label: t('enhancements.modeVad'), value: 'vad' },
              { label: t('enhancements.modeStt'), value: 'stt' },
              { label: t('enhancements.modeManual'), value: 'manual' },
            ]"
          />

          <BaseSelect
            v-if="turnDetection.mode === 'model'"
            :label="t('enhancements.modelType')"
            v-model="turnDetection.model"
            :options="[
              { label: t('enhancements.multilingual'), value: 'multilingual' },
              { label: t('enhancements.englishOnly'), value: 'english' },
            ]"
          />

          <BaseSlider
            :label="t('enhancements.minEndpointDelay')"
            :min="0"
            :max="2"
            :step="0.1"
            v-model="turnDetection.minEndpointingDelay"
          />
          <BaseSlider
            :label="t('enhancements.maxEndpointDelay')"
            :min="1"
            :max="5"
            :step="0.5"
            v-model="turnDetection.maxEndpointingDelay"
          />
        </div>
      </PanelSection>

      <!-- Interruptions -->
      <PanelSection :title="t('enhancements.interruptions')" icon="ph:hand-palm-duotone">
        <div class="row">
          <div class="info">
            <span class="label">{{ t('enhancements.allowInterruptions') }}</span>
            <span class="desc">{{ t('enhancements.allowInterruptionsDesc') }}</span>
          </div>
          <BaseToggle v-model="interruptions.enabled" />
        </div>
        <div class="config-form" v-if="interruptions.enabled">
          <BaseSlider
            :label="t('enhancements.minInterruptionDuration')"
            :min="0.1"
            :max="1.5"
            :step="0.1"
            v-model="interruptions.minDuration"
          />
          <BaseSlider
            :label="t('enhancements.minInterruptionWords')"
            :min="0"
            :max="5"
            :step="1"
            v-model="interruptions.minWords"
          />
        </div>
      </PanelSection>

      <!-- Noise Cancellation -->
      <PanelSection :title="t('enhancements.noiseCancellation')" icon="ph:speaker-x-duotone">
        <div class="row">
          <div class="info">
            <span class="label">{{ t('enhancements.enableNoiseCancellation') }}</span>
            <span class="desc">{{ t('enhancements.enableNoiseCancellationDesc') }}</span>
          </div>
          <BaseToggle v-model="noiseCancellation.enabled" />
        </div>
        <div class="config-form" v-if="noiseCancellation.enabled">
          <BaseSelect
            :label="t('enhancements.mode')"
            v-model="noiseCancellation.mode"
            :options="[
              { label: t('enhancements.modeBvc'), value: 'bvc' },
              { label: t('enhancements.modeKrisp'), value: 'krisp' },
              { label: t('enhancements.modeDefault'), value: 'default' },
            ]"
          />
        </div>
      </PanelSection>

      <!-- VAD Settings -->
      <PanelSection :title="t('enhancements.vad')" icon="ph:waveform-duotone">
        <div class="config-form">
          <BaseSelect
            :label="t('enhancements.provider')"
            v-model="vad.provider"
            :options="[{ label: 'Silero', value: 'silero' }]"
          />
          <BaseSlider
            :label="t('enhancements.speechThreshold')"
            :min="0"
            :max="1"
            :step="0.05"
            v-model="vad.threshold"
          />
          <BaseSlider
            :label="t('enhancements.minSpeechDuration')"
            :min="0"
            :max="0.5"
            :step="0.05"
            v-model="vad.minSpeech"
          />
          <BaseSlider
            :label="t('enhancements.minSilenceDuration')"
            :min="0.1"
            :max="1"
            :step="0.1"
            v-model="vad.minSilence"
          />
        </div>
      </PanelSection>

      <!-- Audio Enhancements -->
      <PanelSection :title="t('enhancements.audioProcessing')" icon="ph:speaker-high-duotone">
        <div class="row">
          <div class="info">
            <span class="label">{{ t('enhancements.echoCancellation') }}</span>
            <span class="desc">{{ t('enhancements.echoCancellationDesc') }}</span>
          </div>
          <BaseToggle v-model="audioProcessing.echoCancellation" />
        </div>
        <div class="row">
          <div class="info">
            <span class="label">{{ t('enhancements.autoGainControl') }}</span>
            <span class="desc">{{ t('enhancements.autoGainControlDesc') }}</span>
          </div>
          <BaseToggle v-model="audioProcessing.autoGainControl" />
        </div>
      </PanelSection>

      <!-- Performance -->
      <PanelSection :title="t('enhancements.performance')" icon="ph:lightning-duotone">
        <div class="row">
          <div class="info">
            <span class="label">{{ t('enhancements.preemptiveGeneration') }}</span>
            <span class="desc">{{ t('enhancements.preemptiveGenerationDesc') }}</span>
          </div>
          <BaseToggle v-model="performance.preemptiveGeneration" />
        </div>
      </PanelSection>

    </div>
  </div>
</template>

<style scoped>
.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--surface-1);
  border-radius: 10px;
  margin-bottom: 12px;
}
.info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}
.desc {
  font-size: 11px;
  color: var(--text-tertiary);
}
.config-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
  background: var(--surface-0);
  padding: 12px;
  border-radius: 8px;
}

.status-indicator {
  margin: 0;
}

.live-notice,
.saved-notice {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: var(--radius-md);
  font-size: 12px;
  font-weight: 500;
  margin: 0;
}

.live-notice {
  background: linear-gradient(135deg, rgba(0, 217, 255, 0.1), rgba(0, 255, 136, 0.1));
  border: 1px solid rgba(0, 217, 255, 0.2);
  color: var(--accent-primary);
}

.live-notice iconify-icon {
  font-size: 16px;
  animation: pulse 2s ease-in-out infinite;
}

.saved-notice {
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
}

.saved-notice iconify-icon {
  font-size: 16px;
  color: var(--text-muted);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
