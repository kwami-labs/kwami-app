<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { useVoiceStore } from '@/stores/voice';
import { useKwami } from '@/composables/useKwami';
import { engineSwitchFields, sendRawConfigUpdate } from '@/lib/agentConfigUpdate';
import { modelUsable, voiceProviderHasKey } from '@/lib/brain';
import { CLAUDE_VOICE_LLM, FAST_STT, GEMINI_STANDARD } from '@/lib/voicePersonas';

/**
 * Who hears, who thinks and who speaks on a call, and the one choice behind it.
 *
 * Three ways to have it, built from what already exists: the brain's `relay`, and
 * the pipeline with its LLM. The order of `mode` matters: passing everything on wins,
 * whatever pipeline the voice is on.
 */
type Mode = 'relay' | 'direct' | 'voice';

const { t } = useI18n();
const voiceStore = useVoiceStore();
const { brain, brainStatus, pipelineMode, stt, llm, tts, realtime } = storeToRefs(voiceStore);
const { kwami, isConnected } = useKwami();

const mode = computed<Mode>(() => {
  if (brain.value.relay === 'everything') return 'relay';
  return pipelineMode.value === 'stt-llm-tts' && llm.value.provider === 'anthropic'
    ? 'direct'
    : 'voice';
});

/** The same update the Models panel sends: the SDK's copy, and a live call at once. */
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

function choose(next: Mode) {
  if (next === mode.value) return;
  brain.value = { ...brain.value, relay: next === 'relay' ? 'everything' : 'work_only' };
  if (next === 'direct') {
    voiceStore.updateSTT({ ...FAST_STT });
    voiceStore.updateLLM({ ...CLAUDE_VOICE_LLM });
    voiceStore.setPipelineMode('stt-llm-tts');
    pushPipeline();
  } else if (next === 'voice' && llm.value.provider === 'anthropic') {
    voiceStore.updateLLM({ ...GEMINI_STANDARD.llm });
    pushPipeline();
  }
}

const noClaudeKey = computed(() => !voiceProviderHasKey(brainStatus.value, 'llm', 'anthropic'));

const hears = computed(() =>
  pipelineMode.value === 'stt-llm-tts'
    ? `${stt.value.provider} · ${stt.value.model}`
    : `${realtime.value.provider} · ${realtime.value.model}`,
);
const director = computed(() => {
  const models = brain.value.models;
  return (
    models.find((m) => m.id === (brainStatus.value?.director || brain.value.director)) ??
    models.find((m) => m.roles.includes('standard') && modelUsable(m, brainStatus.value))
  );
});
const thinks = computed(() => {
  if (mode.value === 'direct') return `${llm.value.provider} · ${llm.value.model}`;
  if (mode.value === 'relay') return director.value?.label ?? t('brainPanel.nobody');
  return pipelineMode.value === 'stt-llm-tts' ? llm.value.model : realtime.value.model;
});
const speaks = computed(() =>
  pipelineMode.value === 'realtime'
    ? `${realtime.value.provider} · ${realtime.value.voice}`
    : `${tts.value.provider} · ${tts.value.model}`,
);
const chain = computed(() => [
  { key: 'hears', icon: 'ph:ear-duotone', value: hears.value },
  { key: 'thinks', icon: 'ph:brain-duotone', value: thinks.value },
  { key: 'speaks', icon: 'ph:speaker-high-duotone', value: speaks.value },
]);

const modes: { id: Mode; title: string; hint: string }[] = [
  { id: 'relay', title: 'mind.modeRelay', hint: 'mind.modeRelayHint' },
  { id: 'direct', title: 'mind.modeDirect', hint: 'mind.modeDirectHint' },
  { id: 'voice', title: 'mind.modeVoice', hint: 'mind.modeVoiceHint' },
];
</script>

<template>
  <div class="thinking">
    <ul class="chain">
      <li v-for="row in chain" :key="row.key" class="stage">
        <iconify-icon :icon="row.icon" class="stage-icon" />
        <span class="stage-name">{{ t(`mind.${row.key}`) }}</span>
        <span class="stage-value">{{ row.value }}</span>
      </li>
    </ul>
    <div class="modes" role="radiogroup" :aria-label="t('mind.callTitle')">
      <button
        v-for="m in modes"
        :key="m.id"
        class="mode"
        role="radio"
        :aria-checked="mode === m.id"
        :class="{ on: mode === m.id }"
        @click="choose(m.id)"
      >
        <span class="mode-title">{{ t(m.title) }}</span>
        <span v-if="mode === m.id" class="mode-hint">{{ t(m.hint) }}</span>
      </button>
    </div>
    <p v-if="mode === 'direct' && noClaudeKey" class="warn">{{ t('mind.noClaudeKey') }}</p>
  </div>
</template>

<style scoped>
.thinking {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.chain {
  list-style: none;
  margin: 0;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-radius: var(--radius-lg);
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
}
.stage {
  display: grid;
  grid-template-columns: 16px 42px minmax(0, 1fr);
  align-items: center;
  gap: 6px;
  font-size: 11px;
}
.stage-icon {
  font-size: 14px;
  color: var(--accent-primary);
}
.stage-name {
  color: var(--text-tertiary);
}
.stage-value {
  color: var(--text-primary);
  overflow-wrap: anywhere;
}
.modes {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.mode {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  text-align: left;
  border-radius: 8px;
  border: 1px solid var(--surface-2);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}
.mode.on {
  border-color: var(--accent-primary);
  background: var(--surface-1);
  color: var(--text-primary);
}
.mode-title {
  font-size: 12px;
  font-weight: 600;
}
.mode-hint {
  font-size: 10px;
  line-height: 1.4;
  color: var(--text-tertiary);
}
.warn {
  margin: 0;
  font-size: 11px;
  color: #fbbf24;
}
</style>
