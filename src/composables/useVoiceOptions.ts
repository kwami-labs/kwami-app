import { computed, ref, watch } from 'vue';
import { useVoicesApi, type Voice } from './useVoicesApi';
import { useLanguagesApi, type Language } from './useLanguagesApi';
import {
    VOICE_STT_PROVIDERS,
    VOICE_LLM_PROVIDERS,
    VOICE_TTS_PROVIDERS,
    VOICE_REALTIME_PROVIDERS,
    VOICE_STT_MODELS,
    VOICE_LLM_MODELS,
    VOICE_TTS_MODELS,
    VOICE_REALTIME_MODELS,
    VOICE_FALLBACK_STT_LANGUAGES,
    VOICE_FALLBACK_TTS_VOICES,
    VOICE_FALLBACK_REALTIME_VOICES,
    VOICE_UI_PRESETS,
} from 'kwami';

// Cache for API-fetched voices
const apiTtsVoices = ref<Record<string, Voice[]>>({});
const apiRealtimeVoices = ref<Record<string, Voice[]>>({});

// Cache for API-fetched languages
const apiSttLanguages = ref<Record<string, Language[]>>({});

export function useVoiceOptions(
    stt: { value: { provider: string } },
    llm: { value: { provider: string } },
    tts: { value: { provider: string } },
    realtime: { value: { provider: string } }
) {
    const { fetchTTSVoicesByProvider, fetchRealtimeVoicesByProvider } = useVoicesApi();
    const { fetchSTTLanguagesByProvider } = useLanguagesApi();

    // Fetch voices from API when provider changes
    async function fetchTtsVoicesForProvider(provider: string) {
        if (apiTtsVoices.value[provider]) return; // Already cached
        try {
            const result = await fetchTTSVoicesByProvider(provider);
            if (result?.voices) {
                apiTtsVoices.value[provider] = result.voices;
            }
        } catch (e) {
            console.warn(`Failed to fetch TTS voices for ${provider}, using fallback`, e);
        }
    }

    async function fetchRealtimeVoicesForProvider(provider: string) {
        if (apiRealtimeVoices.value[provider]) return; // Already cached
        try {
            const result = await fetchRealtimeVoicesByProvider(provider);
            if (result?.voices) {
                apiRealtimeVoices.value[provider] = result.voices;
            }
        } catch (e) {
            console.warn(`Failed to fetch Realtime voices for ${provider}, using fallback`, e);
        }
    }

    // Fetch languages from API when provider changes
    async function fetchSttLanguagesForProvider(provider: string) {
        if (apiSttLanguages.value[provider]) return; // Already cached
        try {
            const result = await fetchSTTLanguagesByProvider(provider);
            if (result?.languages) {
                apiSttLanguages.value[provider] = result.languages;
            }
        } catch (e) {
            console.warn(`Failed to fetch STT languages for ${provider}, using fallback`, e);
        }
    }

    // Watch for provider changes and fetch voices/languages
    watch(() => tts.value.provider, (provider) => {
        fetchTtsVoicesForProvider(provider);
    }, { immediate: true });

    watch(() => realtime.value.provider, (provider) => {
        fetchRealtimeVoicesForProvider(provider);
    }, { immediate: true });

    watch(() => stt.value.provider, (provider) => {
        fetchSttLanguagesForProvider(provider);
    }, { immediate: true });
    const sttProviders = VOICE_STT_PROVIDERS;

    const sttModels = computed(() => {
        return VOICE_STT_MODELS[stt.value.provider as keyof typeof VOICE_STT_MODELS] || [{ model: 'default', name: 'Default' }];
    });

    const sttLanguages = computed(() => {
        const provider = stt.value.provider;

        // Use API languages if available
        const apiLanguages = apiSttLanguages.value[provider];
        if (apiLanguages && apiLanguages.length > 0) {
            return apiLanguages.map(lang => {
                let label = lang.name;
                if (lang.region) {
                    label += ` (${lang.region})`;
                }
                return { value: lang.code, label };
            });
        }

        // Fall back to hardcoded languages
        return VOICE_FALLBACK_STT_LANGUAGES;
    });

    const llmProviders = VOICE_LLM_PROVIDERS;

    const llmModels = computed(() => {
        return VOICE_LLM_MODELS[llm.value.provider as keyof typeof VOICE_LLM_MODELS] || [{ model: 'default', name: 'Default' }];
    });

    const ttsProviders = VOICE_TTS_PROVIDERS;

    const ttsModels = computed(() => {
        return VOICE_TTS_MODELS[tts.value.provider as keyof typeof VOICE_TTS_MODELS] || [{ model: 'default', name: 'Default' }];
    });

    const ttsVoices = computed(() => {
        const provider = tts.value.provider;
        
        // Use API voices if available
        const apiVoices = apiTtsVoices.value[provider];
        if (apiVoices && apiVoices.length > 0) {
            return apiVoices.map(v => ({
                id: v.id,
                name: v.name,
                category: v.category || 'Other',
            }));
        }
        
        // Fall back to hardcoded voices
        return VOICE_FALLBACK_TTS_VOICES[provider as keyof typeof VOICE_FALLBACK_TTS_VOICES] || [{ id: 'default', name: 'Default', category: 'Default' }];
    });

    // Group voices by category for better UI
    const groupedVoices = computed(() => {
        const voices = ttsVoices.value;
        const groups: Record<string, typeof voices> = {};

        voices.forEach(voice => {
            const category = voice.category || 'Other';
            if (!groups[category]) {
                groups[category] = [];
            }
            groups[category].push(voice);
        });

        return groups;
    });

    const realtimeProviders = VOICE_REALTIME_PROVIDERS;

    const realtimeModels = computed(() => {
        return VOICE_REALTIME_MODELS[realtime.value.provider as keyof typeof VOICE_REALTIME_MODELS] || [{ model: 'default', name: 'Default' }];
    });

    const realtimeVoices = computed(() => {
        const provider = realtime.value.provider;
        
        // Use API voices if available
        const apiVoices = apiRealtimeVoices.value[provider];
        if (apiVoices && apiVoices.length > 0) {
            return apiVoices.map(v => ({
                id: v.id,
                name: v.name,
            }));
        }
        
        // Fall back to hardcoded voices
        return VOICE_FALLBACK_REALTIME_VOICES[provider as keyof typeof VOICE_FALLBACK_REALTIME_VOICES] || [{ id: 'default', name: 'Default' }];
    });

    const presets = VOICE_UI_PRESETS;

    return {
        sttProviders,
        sttModels,
        sttLanguages,
        llmProviders,
        llmModels,
        ttsProviders,
        ttsModels,
        ttsVoices,
        groupedVoices,
        realtimeProviders,
        realtimeModels,
        realtimeVoices,
        presets
    };
}
