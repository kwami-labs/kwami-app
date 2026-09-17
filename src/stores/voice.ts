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

const STORAGE_KEY = 'kwami-voice-config';

// Extended store configs with required fields for UI
export interface STTConfig extends Omit<LibSTTConfig, 'provider' | 'language'> {
  provider: STTProvider;
  model: string;
  language: STTLanguage;
}

export interface LLMConfig extends Omit<LibLLMConfig, 'provider'> {
  provider: LLMProvider;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface TTSConfig extends Omit<LibTTSConfig, 'provider'> {
  provider: TTSProvider;
  model: string;
  voice: string;
  speed: number;
}

export interface RealtimeConfig extends Omit<LibRealtimeConfig, 'provider' | 'modalities'> {
  provider: RealtimeProvider;
  model: string;
  voice: string;
  modalities: RealtimeModality[];
}

export const useVoiceStore = defineStore('voice', () => {
  // Pipeline mode - using correct VoicePipelineType values
  const pipelineMode = ref<'stt-llm-tts' | 'realtime'>('stt-llm-tts');

  // STT Configuration
  const stt = ref<STTConfig>({
    provider: 'deepgram',
    model: 'nova-2',
    language: 'en',
  });

  // LLM Configuration
  const llm = ref<LLMConfig>({
    provider: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 1024,
  });

  // TTS Configuration (default to OpenAI which doesn't require paid billing)
  const tts = ref<TTSConfig>({
    provider: 'openai',
    model: 'tts-1',
    voice: 'nova',
    speed: 1.0,
  });

  // Realtime Configuration
  const realtime = ref<RealtimeConfig>({
    provider: 'openai',
    model: 'gpt-4o-realtime-preview',
    voice: 'alloy',
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
  });

  // Memory panel UI state
  const memoryUI = ref({
    activeTab: 'facts' as 'facts' | 'entities' | 'messages',
    graphModalOpen: false,
    contextSize: 'balanced' as 'lean' | 'balanced' | 'rich',
    includeFacts: true,
  });

  // Enhancements panel state (full config, not just UI)
  const enhancementsState = ref({
    initialized: false,
    turnDetection: {
      enabled: true,
      mode: 'model' as 'vad' | 'stt' | 'model' | 'manual',
      model: 'multilingual' as 'english' | 'multilingual',
      minEndpointingDelay: 0.5,
      maxEndpointingDelay: 3.0,
    },
    interruptions: { enabled: true, minDuration: 0.5, minWords: 0 },
    noiseCancellation: { enabled: true, mode: 'bvc' as 'bvc' | 'krisp' | 'default' },
    vad: { provider: 'silero' as const, threshold: 0.5, minSpeech: 0.1, minSilence: 0.5 },
    audioProcessing: { echoCancellation: true, autoGainControl: true },
    performance: { preemptiveGeneration: false },
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
  }

  function applyPreset(preset: {
    stt: STTConfig;
    llm: LLMConfig;
    tts: TTSConfig;
  }) {
    stt.value = { ...preset.stt };
    llm.value = { ...preset.llm };
    tts.value = { ...preset.tts };
  }

  function setActivePreset(presetId: string) {
    activePreset.value = presetId;
  }

  function setPipelineMode(mode: 'stt-llm-tts' | 'realtime') {
    pipelineMode.value = mode;
  }

  // Get full voice config for sending to agent
  const voiceConfig = computed((): VoicePipelineConfig => ({
    type: pipelineMode.value,
    stt: stt.value,
    llm: llm.value,
    tts: tts.value,
    realtime: realtime.value,
  }));

  // ============================================================================
  // Persistence
  // ============================================================================

  function applySnapshot(settings: Record<string, unknown>) {
    if (!settings) return;
    try {
      if (settings.pipelineMode != null) pipelineMode.value = settings.pipelineMode as typeof pipelineMode.value;
      if (settings.stt && typeof settings.stt === 'object') stt.value = { ...stt.value, ...settings.stt } as STTConfig;
      if (settings.llm && typeof settings.llm === 'object') llm.value = { ...llm.value, ...settings.llm } as LLMConfig;
      if (settings.tts && typeof settings.tts === 'object') tts.value = { ...tts.value, ...settings.tts } as TTSConfig;
      if (settings.realtime && typeof settings.realtime === 'object') realtime.value = { ...realtime.value, ...settings.realtime } as RealtimeConfig;
      if (settings.activePreset != null) activePreset.value = settings.activePreset as string;
      if (settings.modelsUI && typeof settings.modelsUI === 'object') modelsUI.value = { ...modelsUI.value, ...settings.modelsUI };
      if (settings.voiceUI && typeof settings.voiceUI === 'object') voiceUI.value = { ...voiceUI.value, ...settings.voiceUI };
      const soulUIFromSettings = (settings.soulUI ?? settings.personaUI) as Record<string, unknown> | undefined;
      const soulConfigFromSettings = (settings.soulConfig ?? settings.personaConfig) as Record<string, unknown> | undefined;
      if (soulUIFromSettings && typeof soulUIFromSettings === 'object') soulUI.value = { ...soulUI.value, ...soulUIFromSettings };
      if (soulConfigFromSettings && typeof soulConfigFromSettings === 'object') soulConfig.value = { ...soulConfig.value, ...soulConfigFromSettings } as typeof soulConfig.value;
      if (settings.memoryUI && typeof settings.memoryUI === 'object') memoryUI.value = { ...memoryUI.value, ...settings.memoryUI };
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
      soulConfig: { ...soulConfig.value, emotionalTraits: { ...soulConfig.value.emotionalTraits } },
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
    [pipelineMode, stt, llm, tts, realtime, activePreset, soulUI, soulConfig, memoryUI, enhancementsState],
    () => { saveSettings(); },
    { deep: true },
  );

  return {
    pipelineMode,
    stt,
    llm,
    tts,
    realtime,
    activePreset,
    modelsUI,
    voiceUI,
    soulUI,
    soulConfig,
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
