<script setup lang="ts">
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useVoiceStore } from '@/stores/voice';
import { useKwami } from '@/composables/useKwami';
import { storeToRefs } from 'pinia';
import BasePanel from '@/components/ui/BasePanel.vue';
import PanelSection from '@/components/ui/PanelSection.vue';
import { panelIcons } from '@/constants/panel-icons';
import BaseSlider from '@/components/ui/BaseSlider.vue';
import ModelVoicePicker from '../models/ModelVoicePicker.vue';
import VoicePersonas from './VoicePersonas.vue';
import VoiceThinking from './VoiceThinking.vue';
import { voiceLock } from '@/lib/voicePersonas';

const voiceStore = useVoiceStore();
const { t } = useI18n();
const { pipelineMode, tts, realtime } = storeToRefs(voiceStore);

/** Set while a character voice is in use: the agent then keeps to it. */
const lock = computed(() => voiceLock(pipelineMode.value, realtime.value, tts.value));
const { kwami, isConnected } = useKwami();
const panelIcon = panelIcons.voice ?? 'mdi:account-voice';

// Watch TTS speed changes for live updates
watch(
  () => tts.value.speed,
  (newSpeed) => {
    if (isConnected.value && kwami.value && pipelineMode.value !== 'realtime') {
      const agent = kwami.value.agent;
      if (agent && 'updateTtsLive' in agent && typeof agent.updateTtsLive === 'function') {
        agent.updateTtsLive({
          voice: tts.value.voice,
          speed: newSpeed,
        });
      }
    }
  },
);
</script>

<template>
  <BasePanel :icon="panelIcon" :title="t('voice.title')">
    <!-- Who hears, who thinks, who speaks -->
    <PanelSection :title="t('mind.callTitle')" icon="ph:flow-arrow-duotone">
      <VoiceThinking />
    </PanelSection>

    <!-- Character voices: Jarvis and Friday -->
    <PanelSection :title="t('voicePersonas.title')" icon="ph:mask-happy-duotone" collapsible>
      <VoicePersonas />
    </PanelSection>

    <!-- Every voice of the model that speaks, whatever the character says. -->
    <PanelSection>
      <div v-if="lock" class="locked-note">
        <iconify-icon icon="ph:lock-simple-duotone"></iconify-icon>
        <p>
          {{
            t('voicePersonas.locked', { name: lock.persona?.name ?? t('voicePersonas.yourVoice') })
          }}
        </p>
      </div>
      <ModelVoicePicker :kind="pipelineMode === 'realtime' ? 'realtime' : 'tts'" />
    </PanelSection>

    <!-- TTS Speed Control (only for standard pipeline) -->
    <PanelSection
      v-if="pipelineMode !== 'realtime' && tts.provider !== 'gemini'"
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
.locked-note {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  margin-bottom: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-lg);
  background: var(--surface-1);
  border: 1px solid var(--surface-2);
}
.locked-note iconify-icon {
  font-size: 18px;
  color: var(--accent-primary);
  flex-shrink: 0;
}
.locked-note p {
  margin: 0;
  font-size: 11px;
  line-height: 1.45;
  color: var(--text-secondary);
}
.settings-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.setting-hint {
  margin: 0;
  font-size: 11px;
  color: var(--text-tertiary);
  line-height: 1.4;
}
</style>
