import { computed } from 'vue';
import { createSimpleResource } from '@/lib/catalogResource';
// Types for API responses

export interface ProviderPricing {
  input_per_1m: number;
  cached_per_1m: number | null;
  output_per_1m: number;
}

export interface InferenceModel {
  model_id: string;
  display_name: string;
  provider: string;
  context_window: number;
  max_output: number | null;
  capabilities: string[];
  languages: string[];
  speed: 'fast' | 'standard' | 'slow';
  tier: 'flagship' | 'standard' | 'budget';
  description: string | null;
  providers: Record<string, ProviderPricing>;
}

export interface InferenceModelsResponse {
  last_updated: string;
  models: InferenceModel[];
}

export interface PluginModel {
  model_id: string;
  display_name: string;
  provider: string;
  context_window: number;
  max_output: number | null;
  capabilities: string[];
  languages: string[];
  speed: 'fast' | 'standard' | 'slow';
  tier: 'flagship' | 'standard' | 'budget';
}

export interface PluginModelsResponse {
  source: 'sdk' | 'fallback';
  providers: Record<string, PluginModel[]>;
}

// STT Types
export interface STTPricing {
  build_ship_per_min: number;
  scale_per_min: number;
}

export interface InferenceSTTModel {
  model_id: string;
  display_name: string;
  provider: string;
  languages: string[];
  features: string[];
  speed: 'fast' | 'standard' | 'slow';
  tier: 'flagship' | 'standard' | 'budget';
  description: string | null;
  pricing: STTPricing;
}

export interface InferenceSTTResponse {
  last_updated: string;
  models: InferenceSTTModel[];
}

export interface PluginSTTModel {
  model_id: string;
  display_name: string;
  provider: string;
  languages: string[];
  features: string[];
  speed: 'fast' | 'standard' | 'slow';
  tier: 'flagship' | 'standard' | 'budget';
}

export interface PluginSTTResponse {
  source: 'sdk' | 'fallback';
  providers: Record<string, PluginSTTModel[]>;
}

// TTS Types
export interface TTSPricing {
  build_ship_per_1m_chars: number;
  scale_per_1m_chars: number;
}

export interface InferenceTTSModel {
  model_id: string;
  display_name: string;
  provider: string;
  languages: string[];
  features: string[];
  speed: 'fast' | 'standard' | 'slow';
  tier: 'flagship' | 'standard' | 'budget';
  description: string | null;
  pricing: TTSPricing;
}

export interface InferenceTTSResponse {
  last_updated: string;
  models: InferenceTTSModel[];
}

export interface PluginTTSModel {
  model_id: string;
  display_name: string;
  provider: string;
  languages: string[];
  features: string[];
  speed: 'fast' | 'standard' | 'slow';
  tier: 'flagship' | 'standard' | 'budget';
}

export interface PluginTTSResponse {
  source: 'sdk' | 'fallback';
  providers: Record<string, PluginTTSModel[]>;
}

// Legacy type for Realtime
export interface ModelsResponse {
  source: 'sdk' | 'fallback';
  inference: string[];
  plugins: Record<string, string[]>;
}

export interface CapabilitiesResponse {
  llm: ModelTypeCapabilities;
  stt: ModelTypeCapabilities;
  tts: ModelTypeCapabilities;
  realtime: ModelTypeCapabilities;
  vision: VisionCapableModels;
  video_input: VideoInputModels;
}

export interface ModelTypeCapabilities {
  description: string;
  input: string[];
  output: string[];
  features: string[];
  optional_input?: string[];
}

export interface VisionCapableModels {
  description: string;
  models: Record<string, string[]>;
  usage_notes: string;
}

export interface VideoInputModels {
  description: string;
  models: Record<string, string[]>;
  usage_notes: string;
}

// Singleton state for caching

/**
 * Eight independent catalogue endpoints.
 *
 * Previously each had its own hand-written fetch-cache-swallow block sharing a
 * single module-level `isLoading`, so the first request to finish cleared the
 * flag for all eight and the four model tabs rendered empty. Each resource now
 * owns its own ref-counted loading state and de-duplicates in-flight requests.
 */
const resources = {
  llmInference: createSimpleResource<InferenceModelsResponse>({
    path: '/models/llm',
    label: 'LLM inference models',
  }),
  llmPlugin: createSimpleResource<PluginModelsResponse>({
    path: '/models/llm/plugins',
    label: 'LLM plugin models',
  }),
  sttInference: createSimpleResource<InferenceSTTResponse>({
    path: '/models/stt',
    label: 'STT inference models',
  }),
  sttPlugin: createSimpleResource<PluginSTTResponse>({
    path: '/models/stt/plugins',
    label: 'STT plugin models',
  }),
  ttsInference: createSimpleResource<InferenceTTSResponse>({
    path: '/models/tts',
    label: 'TTS inference models',
  }),
  ttsPlugin: createSimpleResource<PluginTTSResponse>({
    path: '/models/tts/plugins',
    label: 'TTS plugin models',
  }),
  realtime: createSimpleResource<ModelsResponse>({
    path: '/models/realtime',
    label: 'realtime models',
  }),
  capabilities: createSimpleResource<CapabilitiesResponse>({
    path: '/models/capabilities',
    label: 'model capabilities',
  }),
};

const allResources = Object.values(resources);

export function useModelsApi() {
  function isVisionCapable(provider: string, model: string): boolean {
    const vision = resources.capabilities.data.value?.vision?.models;
    if (!vision) return false;
    const providerModels = vision[provider.toLowerCase()];
    return providerModels?.some((m) => model.includes(m) || m.includes(model)) ?? false;
  }

  function clearCache() {
    allResources.forEach((r) => r.clear());
  }

  return {
    // State
    llmInferenceModels: resources.llmInference.data,
    llmPluginModels: resources.llmPlugin.data,
    sttInferenceModels: resources.sttInference.data,
    sttPluginModels: resources.sttPlugin.data,
    ttsInferenceModels: resources.ttsInference.data,
    ttsPluginModels: resources.ttsPlugin.data,
    realtimeModels: resources.realtime.data,
    capabilities: resources.capabilities.data,
    isLoading: computed(() => allResources.some((r) => r.isLoading.value)),
    error: computed(() => allResources.find((r) => r.error.value)?.error.value ?? null),

    // Methods
    fetchLLMInferenceModels: resources.llmInference.fetch,
    fetchLLMPluginModels: resources.llmPlugin.fetch,
    fetchSTTInferenceModels: resources.sttInference.fetch,
    fetchSTTPluginModels: resources.sttPlugin.fetch,
    fetchTTSInferenceModels: resources.ttsInference.fetch,
    fetchTTSPluginModels: resources.ttsPlugin.fetch,
    fetchRealtimeModels: resources.realtime.fetch,
    fetchCapabilities: resources.capabilities.fetch,
    isVisionCapable,
    clearCache,
  };
}
