import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import type {
  STTConfig as LibSTTConfig,
  LLMConfig as LibLLMConfig,
  TTSConfig as LibTTSConfig,
  RealtimeConfig as LibRealtimeConfig,
  STTProvider,
  STTLanguage,
  LLMProvider,
  TTSProvider,
  RealtimeProvider,
  RealtimeModality,
  VoicePipelineConfig,
} from 'kwami';
import { defaultCharter, normalizeCharter, type CharterConfig } from '@/lib/charter';
import {
  buildableMode,
  hybridModelFor,
  isPipelineMode,
  type PipelineMode,
} from '@/lib/voiceEngines';
import {
  brainPayload,
  defaultBrain,
  normalizeBrain,
  parseBrainStatus,
  type BrainConfig,
  type BrainStatus,
} from '@/lib/brain';
import {
  FAST_STT,
  CLAUDE_VOICE_LLM,
  GEMINI_STANDARD,
  LEGACY_DEFAULT_STT,
  VOICE_PERSONAS,
  upgradeStyle,
} from '@/lib/voicePersonas';

const STORAGE_KEY = 'kwami-voice-config';
/** What the agent last said about its brain: which keys it has, spend, tasks. */
const BRAIN_STATUS_KEY = 'kwami-brain-status';
/** How long a cached agent report is trusted before a session refreshes it. */
const BRAIN_STATUS_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Extended store configs with required fields for UI
export interface STTConfig extends Omit<LibSTTConfig, 'provider' | 'language'> {
  // 'gemini' (Gemini live transcription) is the agent's, not yet the SDK's.
  provider: STTProvider | 'gemini';
  model: string;
  language: STTLanguage;
}

export interface LLMConfig extends Omit<LibLLMConfig, 'provider'> {
  // The agent's LLM factory calls Gemini 'google'; the SDK's union says 'gemini'.
  provider: LLMProvider | 'google';
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface TTSConfig extends Omit<LibTTSConfig, 'provider'> {
  // 'gemini' (Gemini TTS) is the agent's, not yet the SDK's.
  provider: TTSProvider | 'gemini';
  model: string;
  voice: string;
  speed: number;
  /** Spoken direction for TTS engines that take one (Gemini TTS). */
  style?: string;
}

export interface RealtimeConfig extends Omit<LibRealtimeConfig, 'provider' | 'modalities'> {
  // The SDK names Gemini 'gemini'; the agent and the models catalogue say
  // 'google', which is what the Models panel stores and sends.
  provider: RealtimeProvider | 'google';
  model: string;
  voice: string;
  modalities: RealtimeModality[];
  /**
   * How the voice should sound (pace, pitch, diction). Gemini Live has only
   * prebuilt voices, so a character's voice is one of them plus this
   * direction, which the agent puts in its instructions (lib/voicePersonas.ts).
   */
  style?: string;
}

export const useVoiceStore = defineStore('voice', () => {
  // Pipeline mode - using correct VoicePipelineType values
  // Standard by default: Gemini TTS is Jarvis's voice; Gemini Live is the
  // faster alternative in the Voice panel.
  const pipelineMode = ref<PipelineMode>('stt-llm-tts');

  /**
   * Why the panel last changed the engine on its own (an i18n key under
   * `engines`), so it can say so instead of switching in silence.
   */
  const engineNotice = ref<string | null>(null);

  // STT Configuration
  // Defaults: the all-Gemini standard pipeline with Jarvis's voice, the sound
  // chosen on 2026-10-09 (lib/voicePersonas.ts). Only GOOGLE_API_KEY is needed.
  const stt = ref<STTConfig>({ ...GEMINI_STANDARD.stt });

  // LLM Configuration
  const llm = ref<LLMConfig>({
    ...CLAUDE_VOICE_LLM,
    temperature: 0.7,
    maxTokens: 1024,
  });

  // TTS Configuration
  const tts = ref<TTSConfig>({
    ...GEMINI_STANDARD.tts,
    voice: VOICE_PERSONAS[0].voice,
    style: VOICE_PERSONAS[0].style,
    speed: 1.0,
  });

  // Realtime Configuration
  // Defaults to the voice chosen for Jarvis: the only realtime provider this
  // deployment has a key for is Google.
  const realtime = ref<RealtimeConfig>({
    provider: 'google',
    model: 'gemini-3.1-flash-live-preview',
    voice: 'Charon',
    style: VOICE_PERSONAS[0].style,
    modalities: ['text', 'audio'],
  });

  // Active preset
  const activePreset = ref('balanced');

  // ============================================================================
  // Panel UI state (persists across panel switches)
  // ============================================================================

  // Models panel UI state
  const modelsUI = ref({
    activeModelType: 'llm' as 'llm' | 'stt' | 'tts',
    llmSortBy: 'provider' as 'provider' | 'price' | 'context' | 'languages' | 'speed',
    sttSortBy: 'provider' as 'provider' | 'price' | 'languages' | 'speed',
    ttsSortBy: 'provider' as 'provider' | 'price' | 'features' | 'speed',
    llmExpandedProvider: null as string | null,
    sttExpandedProvider: null as string | null,
    ttsExpandedProvider: null as string | null,
    realtimeExpandedProvider: null as string | null,
    realtimeVideoEnabled: false,
    /** The voice last chosen for each voice model (`modelVoiceKey`). */
    voiceByModel: {} as Record<string, string>,
  });

  // Voice panel UI state
  const voiceUI = ref({
    languageFilter: 'all',
    genderFilter: 'all',
    searchQuery: '',
  });

  // Soul panel UI state + persisted config
  const soulUI = ref({
    selectedCategory: null as string | null,
    selectedTemplateId: null as string | null,
  });

  const soulConfig = ref({
    name: 'Kwami',
    personality: '',
    conversationStyle: 'friendly',
    language: 'en',
    responseLength: 'medium' as 'short' | 'medium' | 'long',
    emotionalTone: 'neutral' as
      | 'neutral'
      | 'warm'
      | 'enthusiastic'
      | 'calm'
      | 'playful'
      | 'confident'
      | 'serious'
      | 'compassionate',
    systemPrompt: '',
    traits: [] as string[],
    emotionalTraits: {
      happiness: 0,
      energy: 0,
      confidence: 0,
      calmness: 0,
      optimism: 0,
      socialness: 0,
      patience: 0,
      empathy: 0,
      curiosity: 0,
      creativity: 0,
    },
    charter: defaultCharter() as CharterConfig,
  });

  // The brain: the models the voice hands work to (lib/brain.ts).
  const brain = ref<BrainConfig>(defaultBrain());

  // Runtime report from the agent. Cached locally so the panel can show which
  // providers have keys before a session starts; never saved with the kwami.
  // A day-old report is dropped: on 2026-10-23 one from nine days before
  // still said OpenAI had no key and greyed out Live + TTS until a call began.
  const brainStatus = ref<BrainStatus | null>(null);
  try {
    const cached = localStorage.getItem(BRAIN_STATUS_KEY);
    const parsed = cached ? (JSON.parse(cached) as BrainStatus) : null;
    if (parsed && Date.now() - (parsed.receivedAt ?? 0) < BRAIN_STATUS_MAX_AGE_MS) {
      brainStatus.value = parsed;
    }
  } catch {
    brainStatus.value = null;
  }

  function applyBrainStatus(raw: unknown) {
    const parsed = parseBrainStatus(raw);
    if (!parsed) return;
    brainStatus.value = parsed;
    try {
      localStorage.setItem(BRAIN_STATUS_KEY, JSON.stringify(parsed));
    } catch {
      // Storage full or blocked: the status is still live in memory.
    }
  }

  // Memory panel UI state
  const memoryUI = ref({
    activeTab: 'facts' as 'facts' | 'entities' | 'messages',
    graphModalOpen: false,
    contextSize: 'balanced' as 'lean' | 'balanced' | 'rich',
    includeFacts: true,
  });

  // Enhancements panel state (full config, not just UI)
  // The agent's own tuning for Spanish conversation (kwami-lk-agent,
  // runtime/turn_taking.py). The agent applies whatever this sends, so a
  // default here that differs from it silently replaces that tuning.
  const enhancementsState = ref({
    initialized: false,
    turnDetection: {
      enabled: true,
      mode: 'model' as 'vad' | 'stt' | 'model',
      model: 'multilingual' as 'english' | 'multilingual',
      minEndpointingDelay: 0.4,
      maxEndpointingDelay: 2.5,
    },
    interruptions: { enabled: true, minDuration: 0.4, minWords: 0 },
    noiseCancellation: { enabled: true, mode: 'bvc' as 'bvc' | 'krisp' | 'default' },
    vad: { provider: 'silero' as const, threshold: 0.5, minSpeech: 0.1, minSilence: 0.3 },
    audioProcessing: { echoCancellation: true, autoGainControl: true },
    performance: { preemptiveGeneration: true },
  });

  // Update functions
  function updateSTT(config: Partial<STTConfig>) {
    stt.value = { ...stt.value, ...config };
  }

  function updateLLM(config: Partial<LLMConfig>) {
    llm.value = { ...llm.value, ...config };
  }

  function updateTTS(config: Partial<TTSConfig>) {
    tts.value = { ...tts.value, ...config };
  }

  function updateRealtime(config: Partial<RealtimeConfig>) {
    realtime.value = { ...realtime.value, ...config };
    // A Live model that only answers in audio cannot speak through the TTS:
    // Live + TTS becomes Live, with that model's own voice.
    const mode = buildableMode(pipelineMode.value, realtime.value, brainStatus.value);
    if (mode !== pipelineMode.value) {
      pipelineMode.value = mode;
      engineNotice.value = 'liveAudioOnly';
    }
  }

  function applyPreset(preset: { stt: STTConfig; llm: LLMConfig; tts: TTSConfig }) {
    stt.value = { ...preset.stt };
    llm.value = { ...preset.llm };
    tts.value = { ...preset.tts };
  }

  function setActivePreset(presetId: string) {
    activePreset.value = presetId;
  }

  /**
   * Switch the voice pipeline. Live + TTS needs a Live model that answers in
   * text: the current one is swapped for one that does (and the panel says
   * so), and with none available the switch is refused. Returns whether the
   * pipeline is now `mode`.
   */
  function setPipelineMode(mode: PipelineMode): boolean {
    engineNotice.value = null;
    if (mode === 'hybrid') {
      const model = hybridModelFor(realtime.value, brainStatus.value);
      if (!model) {
        engineNotice.value = 'hybridUnavailable';
        return false;
      }
      if (model.provider !== realtime.value.provider || model.model !== realtime.value.model) {
        realtime.value = { ...realtime.value, ...model } as RealtimeConfig;
        engineNotice.value = 'hybridModelSwapped';
      }
    }
    pipelineMode.value = mode;
    return true;
  }

  // Get full voice config for sending to agent
  const voiceConfig = computed((): VoicePipelineConfig => ({
    type: pipelineMode.value,
    // 'gemini' providers pass through the SDK untouched to the agent.
    stt: stt.value as VoicePipelineConfig['stt'],
    llm: llm.value as VoicePipelineConfig['llm'],
    tts: tts.value as VoicePipelineConfig['tts'],
    // 'google' passes through the SDK untouched to the agent, which expects it.
    realtime: realtime.value as VoicePipelineConfig['realtime'],
  }));

  // ============================================================================
  // Persistence
  // ============================================================================

  function applySnapshot(settings: Record<string, unknown>) {
    if (!settings) return;
    try {
      if (isPipelineMode(settings.pipelineMode)) pipelineMode.value = settings.pipelineMode;
      if (settings.stt && typeof settings.stt === 'object') {
        stt.value = { ...stt.value, ...settings.stt } as STTConfig;
        // The old default ear, Gemini transcribe-live, finalised 1.24 s after
        // the end of speech (2026-10-20): saves still on it move to the fast one.
        if (
          stt.value.provider === LEGACY_DEFAULT_STT.provider &&
          stt.value.model === LEGACY_DEFAULT_STT.model
        )
          stt.value = { ...stt.value, ...FAST_STT } as STTConfig;
      }
      if (settings.llm && typeof settings.llm === 'object')
        llm.value = { ...llm.value, ...settings.llm } as LLMConfig;
      if (settings.tts && typeof settings.tts === 'object') {
        tts.value = { ...tts.value, ...settings.tts } as TTSConfig;
        if (tts.value.style) tts.value.style = upgradeStyle(tts.value.style);
      }
      if (settings.realtime && typeof settings.realtime === 'object') {
        realtime.value = { ...realtime.value, ...settings.realtime } as RealtimeConfig;
        // A kwami saved with an earlier wording of Jarvis or Friday gets the current one.
        if (realtime.value.style) realtime.value.style = upgradeStyle(realtime.value.style);
      }
      // A save on Live + TTS with a Live model that only answers in audio is
      // built as Live by the agent; show it as that.
      pipelineMode.value = buildableMode(pipelineMode.value, realtime.value, brainStatus.value);
      if (settings.activePreset != null) activePreset.value = settings.activePreset as string;
      if (settings.modelsUI && typeof settings.modelsUI === 'object')
        modelsUI.value = { ...modelsUI.value, ...settings.modelsUI };
      if (settings.voiceUI && typeof settings.voiceUI === 'object')
        voiceUI.value = { ...voiceUI.value, ...settings.voiceUI };
      const soulUIFromSettings = (settings.soulUI ?? settings.personaUI) as
        Record<string, unknown> | undefined;
      const soulConfigFromSettings = (settings.soulConfig ?? settings.personaConfig) as
        Record<string, unknown> | undefined;
      if (soulUIFromSettings && typeof soulUIFromSettings === 'object')
        soulUI.value = { ...soulUI.value, ...soulUIFromSettings };
      if (soulConfigFromSettings && typeof soulConfigFromSettings === 'object')
        soulConfig.value = {
          ...soulConfig.value,
          ...soulConfigFromSettings,
          // Saves from before the charter existed have none; older charters
          // lack newer fields. Either way, fill from the defaults.
          charter: normalizeCharter(soulConfigFromSettings.charter),
        } as typeof soulConfig.value;
      if (settings.brain && typeof settings.brain === 'object')
        brain.value = normalizeBrain(settings.brain);
      if (settings.memoryUI && typeof settings.memoryUI === 'object')
        memoryUI.value = { ...memoryUI.value, ...settings.memoryUI };
      if (settings.enhancementsState && typeof settings.enhancementsState === 'object') {
        const s = settings.enhancementsState as Record<string, unknown>;
        const e = enhancementsState.value;
        // Object.assign, not reassignment: EnhancementsPanel captures these
        // nested objects once at setup (`const vad = enhancementsState.value.vad`).
        // Replacing them left the panel's v-models and watchers bound to
        // orphaned objects after a kwami switch — the controls still moved,
        // but nothing reached the store or the agent.
        const merge = (target: Record<string, unknown>, source: unknown) => {
          if (source && typeof source === 'object') Object.assign(target, source);
        };
        merge(e.turnDetection, s.turnDetection);
        // "Manual" waited for the app to commit each turn, which it never
        // does: Jarvis heard the user and never answered.
        if ((e.turnDetection.mode as string) === 'manual') e.turnDetection.mode = 'model';
        merge(e.interruptions, s.interruptions);
        merge(e.noiseCancellation, s.noiseCancellation);
        merge(e.vad, s.vad);
        merge(e.audioProcessing, s.audioProcessing);
        merge(e.performance, s.performance);
        e.initialized = true;
      }
    } catch (e) {
      console.warn('Failed to apply voice snapshot:', e);
    }
  }

  function getSnapshot() {
    return {
      pipelineMode: pipelineMode.value,
      stt: { ...stt.value },
      llm: { ...llm.value },
      tts: { ...tts.value },
      realtime: { ...realtime.value },
      activePreset: activePreset.value,
      modelsUI: { ...modelsUI.value },
      voiceUI: { ...voiceUI.value },
      soulUI: { ...soulUI.value },
      soulConfig: {
        ...soulConfig.value,
        emotionalTraits: { ...soulConfig.value.emotionalTraits },
        charter: { ...soulConfig.value.charter, watch: [...soulConfig.value.charter.watch] },
      },
      brain: brainPayload(brain.value),
      memoryUI: { ...memoryUI.value },
      enhancementsState: {
        turnDetection: { ...enhancementsState.value.turnDetection },
        interruptions: { ...enhancementsState.value.interruptions },
        noiseCancellation: { ...enhancementsState.value.noiseCancellation },
        vad: { ...enhancementsState.value.vad },
        audioProcessing: { ...enhancementsState.value.audioProcessing },
        performance: { ...enhancementsState.value.performance },
      },
    };
  }

  function loadSettings() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      applySnapshot(JSON.parse(saved) as Record<string, unknown>);
    } catch (e) {
      console.warn('Failed to load voice settings:', e);
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(getSnapshot()));
    } catch (e) {
      console.warn('Failed to save voice settings:', e);
    }
  }

  // Auto-save when any config changes
  watch(
    [
      pipelineMode,
      stt,
      llm,
      tts,
      realtime,
      activePreset,
      soulUI,
      soulConfig,
      brain,
      memoryUI,
      enhancementsState,
    ],
    () => {
      saveSettings();
    },
    { deep: true },
  );

  return {
    pipelineMode,
    engineNotice,
    stt,
    llm,
    tts,
    realtime,
    activePreset,
    modelsUI,
    voiceUI,
    soulUI,
    soulConfig,
    brain,
    brainStatus,
    applyBrainStatus,
    memoryUI,
    enhancementsState,
    updateSTT,
    updateLLM,
    updateTTS,
    updateRealtime,
    applyPreset,
    setActivePreset,
    setPipelineMode,
    voiceConfig,
    loadSettings,
    saveSettings,
    getSnapshot,
    applySnapshot,
  };
});
