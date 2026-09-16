import { computed } from 'vue';
import { createCatalogResource, createSimpleResource } from '@/lib/catalogResource';
// =============================================================================
// Types
// =============================================================================

export interface Language {
  code: string;
  name: string;
  native_name: string | null;
  region: string | null;
}

export interface ProviderLanguagesResponse {
  provider: string;
  languages: Language[];
  source: 'sdk' | 'yaml';
}

export interface AllLanguagesResponse {
  providers: Record<string, ProviderLanguagesResponse>;
  total_languages: number;
  total_providers: number;
}

export interface LanguageListResponse {
  languages: Language[];
  count: number;
}

const sttResource = createCatalogResource<AllLanguagesResponse, ProviderLanguagesResponse>({
  path: '/languages/stt',
  label: 'STT languages',
});

const ttsResource = createCatalogResource<AllLanguagesResponse, ProviderLanguagesResponse>({
  path: '/languages/tts',
  label: 'TTS languages',
});

const realtimeResource = createCatalogResource<AllLanguagesResponse, ProviderLanguagesResponse>({
  path: '/languages/realtime',
  label: 'realtime languages',
});

/** Flat list, not keyed by provider — a plain cached GET. */
const allLanguagesResource = createSimpleResource<LanguageListResponse>({
  path: '/languages',
  label: 'languages',
});

const catalogResources = [sttResource, ttsResource, realtimeResource];

export function useLanguagesApi() {
  /** Languages for a provider, fetching if not already cached. */
  async function getLanguagesForProvider(
    provider: string,
    type: 'stt' | 'tts' | 'realtime',
  ): Promise<Language[]> {
    const resource =
      type === 'stt' ? sttResource : type === 'tts' ? ttsResource : realtimeResource;
    const result = await resource.fetchProvider(provider);
    return result?.languages || [];
  }

  function formatLanguageOption(lang: Language): { value: string; label: string } {
    const label = lang.region ? `${lang.name} (${lang.region})` : lang.name;
    return { value: lang.code, label };
  }

  function clearCache() {
    catalogResources.forEach((r) => r.clear());
    allLanguagesResource.clear();
  }

  return {
    // State
    sttLanguages: sttResource.all,
    ttsLanguages: ttsResource.all,
    realtimeLanguages: realtimeResource.all,
    allLanguages: allLanguagesResource.data,
    isLoading: computed(
      () =>
        allLanguagesResource.isLoading.value || catalogResources.some((r) => r.isLoading.value),
    ),
    error: computed(
      () =>
        allLanguagesResource.error.value ??
        catalogResources.find((r) => r.error.value)?.error.value ??
        null,
    ),

    // Methods
    fetchSTTLanguages: sttResource.fetchAll,
    fetchSTTLanguagesByProvider: sttResource.fetchProvider,
    fetchTTSLanguages: ttsResource.fetchAll,
    fetchTTSLanguagesByProvider: ttsResource.fetchProvider,
    fetchRealtimeLanguages: realtimeResource.fetchAll,
    fetchRealtimeLanguagesByProvider: realtimeResource.fetchProvider,
    fetchAllLanguages: allLanguagesResource.fetch,
    getLanguagesForProvider,
    formatLanguageOption,
    clearCache,
  };
}
