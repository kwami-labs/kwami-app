import { type Ref } from 'vue';
import type { STTConfig, LLMConfig, TTSConfig, RealtimeConfig } from '@/stores/voice';

export function useVoiceLiveUpdates(
    kwami: Ref<any>,
    isConnected: Ref<boolean>,
     
    _voiceStore: any,
    state: {
        stt: Ref<STTConfig>;
        llm: Ref<LLMConfig>;
        tts: Ref<TTSConfig>;
        realtime: Ref<RealtimeConfig>;
        pipelineMode: Ref<'stt-llm-tts' | 'realtime'>;
    }
) {
    const { stt, llm, tts, realtime, pipelineMode } = state;

    function applyConfig() {
        if (!kwami.value) return;

        if (pipelineMode.value === 'stt-llm-tts') {
            const config = {
                stt: { provider: stt.value.provider, model: stt.value.model, language: stt.value.language },
                llm: {
                    provider: llm.value.provider,
                    model: llm.value.model,
                    temperature: llm.value.temperature,
                    maxTokens: llm.value.maxTokens,
                },
                tts: {
                    provider: tts.value.provider,
                    model: tts.value.model,
                    voice: tts.value.voice,
                    speed: tts.value.speed
                },
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const voiceConfig = config as any;
            kwami.value.agent.updateConfig({
                livekit: { ...kwami.value.agent.getConfig().livekit, voice: voiceConfig },
            });
        } else {
            // Realtime config
             
            const config = {
                type: 'realtime' as const,
                realtime: {
                    provider: realtime.value.provider,
                    model: realtime.value.model,
                    voice: realtime.value.voice,
                    modalities: realtime.value.modalities,
                }
            } as any;
            kwami.value.agent.updateConfig({
                livekit: { ...kwami.value.agent.getConfig().livekit, voice: config },
            });
        }

        console.log('Voice config applied', { mode: pipelineMode.value, stt: stt.value, llm: llm.value, tts: tts.value, realtime: realtime.value });
    }

    function updateVoiceLive() {
        console.log('📤 updateVoiceLive called, isConnected:', isConnected.value);

        if (!kwami.value) {
            console.warn('❌ Cannot update voice: kwami not initialized');
            return;
        }
        if (!isConnected.value) {
            console.warn('❌ Cannot update voice: not connected');
            return;
        }

        // Include provider so agent can switch TTS providers if needed
        const voiceConfig = {
            tts_provider: tts.value.provider,
            tts_model: tts.value.model,
            tts_voice: tts.value.voice,
            tts_speed: tts.value.speed,
            stt_language: stt.value.language,
        };

        console.log('🔊 Sending voice update:', voiceConfig);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        kwami.value.agent.updateVoiceLive(voiceConfig as any);
    }

    function updateLlmLive() {
        console.log('📤 updateLlmLive called, isConnected:', isConnected.value);

        if (!kwami.value) {
            console.warn('❌ Cannot update LLM: kwami not initialized');
            return;
        }
        if (!isConnected.value) {
            console.warn('❌ Cannot update LLM: not connected');
            return;
        }

        const llmConfig = {
            provider: llm.value.provider,
            model: llm.value.model,
            temperature: llm.value.temperature,
            maxTokens: llm.value.maxTokens,
        };

        console.log('🧠 Sending LLM update:', llmConfig);
        kwami.value.agent.updateLlmLive(llmConfig);
    }

    function updateSttLive() {
        console.log('📤 updateSttLive called, isConnected:', isConnected.value);

        if (!kwami.value || !isConnected.value) return;

        const sttConfig = {
            stt_provider: stt.value.provider,
            stt_model: stt.value.model,
            stt_language: stt.value.language,
        };

        console.log('🎤 Sending STT update:', sttConfig);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        kwami.value.agent.updateVoiceLive(sttConfig as any);
    }

    return {
        applyConfig,
        updateVoiceLive,
        updateLlmLive,
        updateSttLive
    };
}
