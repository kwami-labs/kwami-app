<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { useVoiceStore } from '@/stores/voice';
import { useKwami } from '@/composables/useKwami';
import BaseButton from '@/components/ui/BaseButton.vue';
import { sendRawConfigUpdate } from '@/lib/agentConfigUpdate';
import {
  GEMINI_STANDARD,
  GEMINI_LIVE_MODEL,
  VOICE_PERSONAS,
  activePersona,
  liveSampleUrl,
  sampleUrl,
  type VoiceEngine,
  type VoicePersona,
} from '@/lib/voicePersonas';

/**
 * Character voices: Jarvis (male) and Friday (female), each a prebuilt Gemini
 * voice plus a spoken direction, on either engine:
 *
 * - Gemini TTS (standard pipeline: Gemini STT -> Gemini Flash -> Gemini TTS):
 *   the sound the user chose, the direction going to the TTS itself;
 * - Gemini Live: near-instant, the direction going into the instructions.
 *
 * A character is applied to both engines at once, so switching engine keeps
 * the same voice and direction.
 */
const { t, locale } = useI18n();
const voiceStore = useVoiceStore();
const { realtime, tts, pipelineMode } = storeToRefs(voiceStore);
const { kwami, isConnected } = useKwami();

const engine = computed<VoiceEngine>(() =>
  pipelineMode.value === 'realtime' ? 'gemini-live' : 'gemini-tts',
);
const activeVoice = computed(() =>
  engine.value === 'gemini-live' ? realtime.value.voice : tts.value.voice,
);
const activeStyle = computed(() =>
  engine.value === 'gemini-live' ? (realtime.value.style ?? '') : (tts.value.style ?? ''),
);
const usingGemini = computed(() =>
  engine.value === 'gemini-live'
    ? realtime.value.provider === 'google'
    : tts.value.provider === 'gemini',
);
const current = computed(() =>
  usingGemini.value ? activePersona(activeVoice.value, activeStyle.value) : null,
);

/**
 * One voice on: while a direction is set, the character in use is the only one
 * shown with its voice, and every other one is off -- no samples, no voices to
 * pick -- until the user switches to it on purpose.
 */
const locked = computed(() => activeStyle.value.trim() !== '');
const isOn = (p: VoicePersona) => !locked.value || current.value?.id === p.id;
const voicesOf = (p: VoicePersona) =>
  locked.value ? [activeVoice.value] : [p.voice, ...p.alternatives];
const showDesign = ref<string | null>(null);
const copied = ref<string | null>(null);

// -- samples ---------------------------------------------------------------------

const playing = ref<string | null>(null);
let audio: HTMLAudioElement | null = null;

function stop() {
  audio?.pause();
  audio = null;
  playing.value = null;
}

function playUrl(key: string, url: string) {
  if (playing.value === key) return stop();
  stop();
  audio = new Audio(url);
  playing.value = key;
  audio.onended = stop;
  audio.onerror = stop;
  void audio.play().catch(stop);
}

function play(persona: VoicePersona, voice: string) {
  playUrl(`${persona.id}-${voice}`, sampleUrl(persona.id, voice));
}

function playLive(persona: VoicePersona) {
  playUrl(`${persona.id}-live`, liveSampleUrl(persona));
}

onBeforeUnmount(stop);

// -- reaching the agent ----------------------------------------------------------

/** Everything either engine needs, so a switch never lands on a stale engine. */
function engineFields() {
  return {
    realtimeProvider: realtime.value.provider,
    realtimeModel: realtime.value.model,
    realtimeVoice: realtime.value.voice,
    realtimeStyle: realtime.value.style ?? '',
    stt_provider: voiceStore.stt.provider,
    stt_model: voiceStore.stt.model,
    stt_language: voiceStore.stt.language,
    llm_provider: voiceStore.llm.provider,
    llm_model: voiceStore.llm.model,
    tts_provider: tts.value.provider,
    tts_model: tts.value.model,
    tts_voice: tts.value.voice,
    tts_style: tts.value.style ?? '',
  };
}

function pushToAgent(switchedEngine: boolean) {
  const instance = kwami.value;
  if (!instance) return;
  // The SDK's copy is what the next connect sends.
  instance.agent.updateConfig({
    livekit: { ...instance.agent.getConfig().livekit, voice: voiceStore.voiceConfig },
  });
  if (!isConnected.value) return;
  if (switchedEngine) {
    sendRawConfigUpdate(instance, 'pipeline', {
      pipelineType: pipelineMode.value,
      ...engineFields(),
    });
  } else if (engine.value === 'gemini-live') {
    instance.agent.syncConfigToBackend('voice', {
      realtimeProvider: realtime.value.provider,
      realtimeModel: realtime.value.model,
      realtimeVoice: realtime.value.voice,
      realtimeStyle: realtime.value.style ?? '',
    });
  } else {
    instance.agent.syncConfigToBackend('voice', {
      tts_provider: tts.value.provider,
      tts_model: tts.value.model,
      tts_voice: tts.value.voice,
      tts_style: tts.value.style ?? '',
    });
  }
}

/** Puts a voice and direction on both engines. */
function setVoice(voice: string, style: string) {
  voiceStore.updateRealtime({
    provider: 'google',
    // Keep a Gemini Live model already chosen; otherwise the default one.
    model: realtime.value.provider === 'google' ? realtime.value.model : GEMINI_LIVE_MODEL,
    voice,
    style,
  });
  voiceStore.updateTTS({ ...GEMINI_STANDARD.tts, voice, style });
}

function apply(persona: VoicePersona, voice = persona.voice) {
  cancelDraft();
  setVoice(voice, persona.style);
  pushToAgent(false);
}

function setEngine(next: VoiceEngine) {
  if (next === engine.value) return;
  cancelDraft();
  // The persona travels with the switch.
  setVoice(activeVoice.value, activeStyle.value);
  if (next === 'gemini-tts') {
    voiceStore.updateSTT({ ...GEMINI_STANDARD.stt });
    voiceStore.updateLLM({ ...GEMINI_STANDARD.llm });
    voiceStore.setPipelineMode('stt-llm-tts');
  } else {
    voiceStore.setPipelineMode('realtime');
  }
  pushToAgent(true);
}

// -- free-form direction ------------------------------------------------------------

const styleDraft = ref(activeStyle.value);
let styleTimer: ReturnType<typeof setTimeout> | null = null;
function cancelDraft() {
  if (styleTimer) clearTimeout(styleTimer);
  styleTimer = null;
}
// A persona applied, an engine switched or a kwami loaded replaces the text.
watch(activeStyle, (value) => {
  if (!styleTimer) styleDraft.value = value;
});
function onStyleInput(value: string) {
  styleDraft.value = value;
  cancelDraft();
  // Debounced: each push rebuilds the voice engine.
  styleTimer = setTimeout(() => {
    styleTimer = null;
    const style = value.slice(0, 1200);
    voiceStore.updateRealtime({ style });
    voiceStore.updateTTS({ style });
    pushToAgent(false);
  }, 1200);
}
function clearStyle() {
  onStyleInput('');
}

async function copyDesign(persona: VoicePersona) {
  try {
    await navigator.clipboard.writeText(persona.designPrompt);
    copied.value = persona.id;
    setTimeout(() => (copied.value = null), 1500);
  } catch {
    copied.value = null;
  }
}

const summary = (p: VoicePersona) => (locale.value.startsWith('es') ? p.summary.es : p.summary.en);
</script>

<template>
  <div class="personas">
    <p class="hint">{{ t('voicePersonas.hint') }}</p>

    <div class="engine">
      <span class="option-label">{{ t('voicePersonas.engine') }}</span>
      <div class="engine-toggle">
        <button
          class="engine-btn"
          :class="{ on: engine === 'gemini-tts' }"
          @click="setEngine('gemini-tts')"
        >
          <strong>{{ t('voicePersonas.engineTts') }}</strong>
          <span>{{ t('voicePersonas.engineTtsHint') }}</span>
        </button>
        <button
          class="engine-btn"
          :class="{ on: engine === 'gemini-live' }"
          @click="setEngine('gemini-live')"
        >
          <strong>{{ t('voicePersonas.engineLive') }}</strong>
          <span>{{ t('voicePersonas.engineLiveHint') }}</span>
        </button>
      </div>
    </div>

    <article
      v-for="p in VOICE_PERSONAS"
      :key="p.id"
      class="persona"
      :class="{ active: current?.id === p.id, off: !isOn(p) }"
    >
      <header class="persona-head">
        <iconify-icon
          :icon="p.gender === 'male' ? 'ph:gender-male-duotone' : 'ph:gender-female-duotone'"
          class="gender"
        />
        <div class="persona-title">
          <strong>{{ p.name }}</strong>
          <span>{{ t(p.gender === 'male' ? 'voicePersonas.male' : 'voicePersonas.female') }}</span>
        </div>
        <span v-if="current?.id === p.id" class="badge">{{ t('voicePersonas.inUse') }}</span>
        <span v-else-if="!isOn(p)" class="badge off-badge">{{ t('voicePersonas.off') }}</span>
      </header>

      <!-- Off: nothing to play or pick, only a deliberate switch. -->
      <BaseButton
        v-if="!isOn(p)"
        size="sm"
        variant="secondary"
        icon="ph:power-duotone"
        @click="apply(p)"
        >{{ t('voicePersonas.switchTo', { name: p.name }) }}</BaseButton
      >

      <template v-else>
        <p class="summary">{{ summary(p) }}</p>

        <div class="voices">
          <div
            v-for="v in voicesOf(p)"
            :key="v"
            class="voice-chip"
            :class="{ chosen: activeVoice === v && current?.id === p.id }"
          >
            <button
              class="play"
              :aria-label="t('voicePersonas.listen', { voice: v })"
              @click="play(p, v)"
            >
              <iconify-icon :icon="playing === `${p.id}-${v}` ? 'ph:stop-fill' : 'ph:play-fill'" />
            </button>
            <button class="pick" :disabled="locked" @click="apply(p, v)">
              {{ v }}<span v-if="v === p.voice && !locked" class="suggested"> ★</span>
            </button>
          </div>
        </div>

        <details class="style">
          <summary>{{ t('voicePersonas.direction') }}</summary>
          <p>{{ p.style }}</p>
        </details>

        <div class="actions">
          <BaseButton
            v-if="current?.id !== p.id"
            size="sm"
            icon="ph:check-bold"
            @click="apply(p)"
            >{{ t('voicePersonas.use', { name: p.name }) }}</BaseButton
          >
          <BaseButton
            size="sm"
            variant="secondary"
            :icon="playing === `${p.id}-live` ? 'ph:stop-fill' : 'ph:broadcast-duotone'"
            @click="playLive(p)"
            >{{ t('voicePersonas.liveSample') }}</BaseButton
          >
          <BaseButton
            size="sm"
            variant="secondary"
            icon="ph:magic-wand-duotone"
            @click="showDesign = showDesign === p.id ? null : p.id"
            >{{ t('voicePersonas.designPrompt') }}</BaseButton
          >
        </div>
        <div v-if="showDesign === p.id" class="design">
          <p class="hint">{{ t('voicePersonas.designHint') }}</p>
          <p class="design-text">{{ p.designPrompt }}</p>
          <BaseButton size="sm" variant="secondary" icon="ph:copy-duotone" @click="copyDesign(p)">{{
            copied === p.id ? t('voicePersonas.copied') : t('voicePersonas.copy')
          }}</BaseButton>
        </div>
      </template>
    </article>

    <div class="custom">
      <label class="option-label" for="voice-style">{{
        t('voicePersonas.currentDirection')
      }}</label>
      <textarea
        id="voice-style"
        rows="4"
        :value="styleDraft"
        :placeholder="t('voicePersonas.directionPlaceholder')"
        @input="onStyleInput(($event.target as HTMLTextAreaElement).value)"
      />
      <div class="custom-foot">
        <span class="hint small">{{ t('voicePersonas.directionHint') }}</span>
        <button v-if="styleDraft" class="link" @click="clearStyle">
          {{ t('voicePersonas.clear') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.engine {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.engine-toggle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.engine-btn {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--glass-border);
  background: var(--surface-1);
  color: var(--text-secondary);
  text-align: left;
  cursor: pointer;
  font-family: inherit;
}
.engine-btn strong {
  font-size: 12px;
  color: var(--text-primary);
}
.engine-btn span {
  font-size: 10px;
  color: var(--text-tertiary);
}
.engine-btn.on {
  border-color: var(--accent-primary);
  background: var(--accent-glow);
}
.personas {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.hint {
  font-size: 11px;
  color: var(--text-tertiary);
  margin: 0;
  line-height: 1.4;
}
.hint.small {
  font-size: 10px;
}
.persona {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: var(--radius-lg);
  background: var(--surface-1);
  border: 1px solid var(--surface-2);
}
.persona.off {
  opacity: 0.55;
  gap: 6px;
}
.off-badge {
  background: var(--surface-2);
  color: var(--text-tertiary);
}
.voice-chip .pick:disabled {
  cursor: default;
}
.persona.active {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 1px var(--accent-glow);
}
.persona-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.gender {
  font-size: 22px;
  color: var(--accent-primary);
}
.persona-title {
  display: flex;
  flex-direction: column;
  flex: 1;
}
.persona-title strong {
  font-size: 14px;
  color: var(--text-primary);
}
.persona-title span {
  font-size: 10px;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.badge {
  font-size: 10px;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--accent-glow);
  color: var(--text-primary);
}
.summary {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.4;
}
.voices {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.voice-chip {
  display: inline-flex;
  align-items: stretch;
  border-radius: 999px;
  border: 1px solid var(--glass-border);
  overflow: hidden;
}
.voice-chip.chosen {
  border-color: var(--accent-primary);
  background: var(--accent-glow);
}
.voice-chip button {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 11px;
  cursor: pointer;
  padding: 5px 8px;
}
.voice-chip .play {
  padding: 5px 6px 5px 9px;
  color: var(--accent-primary);
  display: inline-flex;
  align-items: center;
}
.voice-chip .pick {
  padding-left: 2px;
  padding-right: 10px;
}
.suggested {
  color: #fbbf24;
}
.style summary {
  font-size: 11px;
  color: var(--text-secondary);
  cursor: pointer;
}
.style p,
.design-text {
  margin: 6px 0 0;
  font-size: 11px;
  color: var(--text-tertiary);
  line-height: 1.45;
}
.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.design {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--surface-2);
}
.custom {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.option-label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}
textarea {
  width: 100%;
  padding: 8px 12px;
  background: var(--surface-2);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 12px;
  outline: none;
  resize: vertical;
  box-sizing: border-box;
  font-family: inherit;
}
.custom-foot {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.link {
  background: none;
  border: none;
  color: var(--accent-primary);
  font-size: 11px;
  cursor: pointer;
}
</style>
