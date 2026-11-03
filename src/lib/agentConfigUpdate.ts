import type { Kwami } from 'kwami';

/**
 * Send a config update whose `updateType` the installed SDK does not name.
 *
 * `Agent.syncConfigToBackend`'s union is
 * `'voice' | 'soul' | 'tools' | 'full' | 'llm' | 'memory'`, and the backend
 * also understands `'pipeline'` for switching between the standard and
 * realtime pipelines mid-session. The app depends on the published `kwami`
 * package rather than the workspace source, so widening that union means
 * republishing the SDK; this reaches the same `sendConfigUpdate` the typed
 * method does, via the pipeline the SDK already exposes for exactly this.
 *
 * Returns false when there is no connected pipeline to send on, so callers can
 * tell the user the truth instead of reporting a switch that never left.
 */
export function sendRawConfigUpdate(
  instance: Kwami,
  updateType: string,
  config: Record<string, unknown>,
): boolean {
  const pipeline = instance.agent.getPipeline() as {
    sendConfigUpdate?: (type: string, config: unknown) => void;
  } | null;
  if (!pipeline || typeof pipeline.sendConfigUpdate !== 'function') return false;
  try {
    pipeline.sendConfigUpdate(updateType, config);
    return true;
  } catch {
    return false;
  }
}

interface EngineState {
  stt: { provider: string; model: string; language?: string };
  llm: { provider: string; model: string };
  tts: { provider: string; model: string; voice: string; style?: string };
  realtime: { provider: string; model: string; voice: string; style?: string };
}

/**
 * Everything any pipeline needs, sent with a `'pipeline'` switch so the agent
 * never lands on a stale engine: the hybrid pipeline reads both the realtime
 * and the TTS fields.
 */
export function engineSwitchFields(state: EngineState): Record<string, unknown> {
  return {
    realtimeProvider: state.realtime.provider,
    realtimeModel: state.realtime.model,
    realtimeVoice: state.realtime.voice,
    realtimeStyle: state.realtime.style ?? '',
    stt_provider: state.stt.provider,
    stt_model: state.stt.model,
    stt_language: state.stt.language,
    llm_provider: state.llm.provider,
    llm_model: state.llm.model,
    tts_provider: state.tts.provider,
    tts_model: state.tts.model,
    tts_voice: state.tts.voice,
    tts_style: state.tts.style ?? '',
  };
}
