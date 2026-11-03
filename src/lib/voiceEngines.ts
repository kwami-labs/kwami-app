/**
 * The three voice pipelines, and which models each one accepts.
 *
 * - `stt-llm-tts` (standard): every stage its own provider.
 * - `realtime` (Live): one model hears, thinks and speaks with its own voice.
 * - `hybrid` (Live + TTS): the Live model hears and thinks but answers in
 *   text, and the TTS speaks -- Live's turn-taking with any voice, a Gemini TTS
 *   direction or an ElevenLabs voice included.
 *
 * Hybrid only works with a Live model that can answer in text. Gemini's Live
 * models answer only in audio: measured with the agent's voice lab on
 * 2026-10-22, every one of them closed a text session with 1007, while
 * gpt-realtime and gpt-realtime-mini answered in text in 0.3-0.7 s. So the
 * panel never builds "Gemini Live + a TTS": it greys those models out on
 * Live + TTS and moves the engine to one that works. The agent applies the
 * same rule (agent/src/domain/pipelines.py) and reports its list in
 * `brain_status.hybridRealtime`, which wins over the copy here.
 */

import type { BrainStatus } from './brain';
import { voiceProviderHasKey } from './brain';

export type PipelineMode = 'stt-llm-tts' | 'realtime' | 'hybrid';

export const PIPELINE_MODES: readonly PipelineMode[] = ['stt-llm-tts', 'realtime', 'hybrid'];

/** Realtime models that can answer in text, by name prefix. Mirrors the agent. */
export const TEXT_REALTIME_PREFIXES: Readonly<Record<string, readonly string[]>> = {
  openai: ['gpt-realtime', 'gpt-4o-realtime', 'gpt-4o-mini-realtime'],
  google: [],
};

/** The Live model Live + TTS falls back to when the chosen one cannot. */
export const HYBRID_DEFAULT = {
  provider: 'openai',
  model: 'gpt-realtime',
  voice: 'marin',
} as const;

export function isPipelineMode(value: unknown): value is PipelineMode {
  return typeof value === 'string' && (PIPELINE_MODES as readonly string[]).includes(value);
}

/** A Live model is the one that hears and thinks (Live, and Live + TTS). */
export function usesLiveModel(mode: PipelineMode): boolean {
  return mode === 'realtime' || mode === 'hybrid';
}

/** A TTS speaks (standard, and Live + TTS). */
export function usesTts(mode: PipelineMode): boolean {
  return mode !== 'realtime';
}

function bareModel(model: string): string {
  const slash = model.indexOf('/');
  return (slash === -1 ? model : model.slice(slash + 1)).toLowerCase();
}

/** Whether this Live model can answer in text, so a TTS can speak for it. */
export function realtimeSpeaksText(
  provider: string | null | undefined,
  model: string | null | undefined,
  status: BrainStatus | null = null,
): boolean {
  if (!provider || !model) return false;
  const key = provider.toLowerCase() === 'gemini' ? 'google' : provider.toLowerCase();
  const table = status?.hybridRealtime ?? TEXT_REALTIME_PREFIXES;
  const name = bareModel(model);
  return (table[key] ?? []).some((prefix) => name.startsWith(prefix));
}

interface LiveModel {
  provider: string;
  model: string;
  voice?: string;
}

/**
 * The Live model to use on Live + TTS: the current one if it can answer in
 * text, else the default one if the agent has its key, else null (Live + TTS
 * cannot be offered).
 */
export function hybridModelFor(current: LiveModel, status: BrainStatus | null): LiveModel | null {
  if (realtimeSpeaksText(current.provider, current.model, status)) return current;
  if (
    realtimeSpeaksText(HYBRID_DEFAULT.provider, HYBRID_DEFAULT.model, status) &&
    voiceProviderHasKey(status, 'realtime', HYBRID_DEFAULT.provider)
  ) {
    return { ...HYBRID_DEFAULT };
  }
  return null;
}

/**
 * A saved or requested pipeline corrected to one that can be built: Live + TTS
 * on a model that only answers in audio becomes Live with that model's voice,
 * as the agent would build it.
 */
export function buildableMode(
  mode: PipelineMode,
  current: LiveModel,
  status: BrainStatus | null,
): PipelineMode {
  if (mode === 'hybrid' && !realtimeSpeaksText(current.provider, current.model, status)) {
    return 'realtime';
  }
  return mode;
}
