import { computed } from 'vue';
import { createCatalogResource } from '@/lib/catalogResource';
// =============================================================================
// Types
// =============================================================================

export interface Voice {
  id: string;
  name: string;
  category: string | null;
  gender: 'male' | 'female' | 'neutral' | null;
  language: string | null;
  description: string | null;
}

export interface ProviderVoicesResponse {
  provider: string;
  voices: Voice[];
  source: 'sdk' | 'yaml';
  count: number;
}

export interface AllVoicesResponse {
  providers: Record<string, ProviderVoicesResponse>;
  total_voices: number;
  total_providers: number;
}

// =============================================================================
// Singleton State (cached across component instances)
// =============================================================================

/**
 * `providers` is keyed by provider name, so fetchProvider can hydrate straight
 * from an already-loaded `all` payload instead of making a second request.
 */
const ttsVoicesResource = createCatalogResource<AllVoicesResponse, ProviderVoicesResponse>({
  path: '/voices/tts',
  label: 'TTS voices',
});

const realtimeVoicesResource = createCatalogResource<AllVoicesResponse, ProviderVoicesResponse>({
  path: '/voices/realtime',
  label: 'realtime voices',
});

export function useVoicesApi() {
  /** Voices for a provider, fetching if not already cached. */
  async function getVoicesForProvider(
    provider: string,
    type: 'tts' | 'realtime',
  ): Promise<Voice[]> {
    const resource = type === 'tts' ? ttsVoicesResource : realtimeVoicesResource;
    const result = await resource.fetchProvider(provider);
    return result?.voices || [];
  }

  /** Group voices by category for UI display. */
  function groupVoicesByCategory(voices: Voice[]): Record<string, Voice[]> {
    const groups: Record<string, Voice[]> = {};
    for (const voice of voices) {
      const category = voice.category || 'Other';
      (groups[category] ??= []).push(voice);
    }
    return groups;
  }

  function clearCache() {
    ttsVoicesResource.clear();
    realtimeVoicesResource.clear();
  }

  return {
    // State
    ttsVoices: ttsVoicesResource.all,
    realtimeVoices: realtimeVoicesResource.all,
    isLoading: computed(
      () => ttsVoicesResource.isLoading.value || realtimeVoicesResource.isLoading.value,
    ),
    error: computed(
      () => ttsVoicesResource.error.value ?? realtimeVoicesResource.error.value,
    ),

    // Methods
    fetchTTSVoices: ttsVoicesResource.fetchAll,
    fetchTTSVoicesByProvider: ttsVoicesResource.fetchProvider,
    fetchRealtimeVoices: realtimeVoicesResource.fetchAll,
    fetchRealtimeVoicesByProvider: realtimeVoicesResource.fetchProvider,
    getVoicesForProvider,
    groupVoicesByCategory,
    clearCache,
  };
}
