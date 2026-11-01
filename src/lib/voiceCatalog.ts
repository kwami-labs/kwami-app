/**
 * The models each voice stage can pick, as the agent will build them.
 *
 * The Models tabs listed only the LiveKit Inference catalogue, so the models
 * Jarvis actually runs on our own keys -- Gemini transcription, Gemini 3.5
 * Flash, Gemini TTS, ElevenLabs Flash through the plugin -- never showed up, and
 * the one in use was never marked as chosen. The agent builds every stage with
 * the provider's own plugin anyway (Inference only for Rime, or ElevenLabs
 * without a key), so the plugin catalogue is merged in: the Inference entry
 * wins where both list the same model, because it carries pricing.
 */

import type { BrainStatus, VoiceStage } from './brain';

/** "deepgram/nova-3" -> "nova-3"; a bare id is returned as is. */
export function bareModelId(id: string): string {
  const slash = id.indexOf('/');
  return slash === -1 ? id : id.slice(slash + 1);
}

/**
 * Whether two model ids name the same model, with or without the provider
 * prefix, and with ElevenLabs' dashes or underscores (eleven-flash-v2.5).
 */
export function sameModel(a: string, b: string): boolean {
  const norm = (id: string) => bareModelId(id).replace(/[-.]/g, '_').toLowerCase();
  return norm(a) === norm(b);
}

/**
 * Plugin catalogue names the agent spells differently. "mistralai" is the
 * LiveKit plugin; the agent's LLM factory calls it "mistral".
 */
const PLUGIN_PROVIDER_ALIASES: Partial<Record<VoiceStage, Record<string, string>>> = {
  llm: { mistralai: 'mistral' },
};

interface CatalogEntry {
  model_id: string;
  provider: string;
}

/**
 * Inference models first, then every plugin model they do not already list.
 * `fill` turns a plugin entry into the tab's model shape (the fields only the
 * Inference catalogue has).
 */
export function mergeModels<I extends CatalogEntry, P extends CatalogEntry>(
  stage: VoiceStage,
  inference: readonly I[],
  plugins: Readonly<Record<string, readonly P[]>> | null | undefined,
  fill: (model: P) => I,
): I[] {
  const aliases = PLUGIN_PROVIDER_ALIASES[stage] ?? {};
  const merged = [...inference];
  const seen = new Set(inference.map((m) => `${m.provider}:${bareModelId(m.model_id)}`));
  for (const [catalogProvider, models] of Object.entries(plugins ?? {})) {
    const provider = aliases[catalogProvider] ?? catalogProvider;
    for (const model of models) {
      const key = `${provider}:${bareModelId(model.model_id)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(fill({ ...model, provider }));
    }
  }
  return merged;
}

/**
 * Whether the agent can build this provider at all. Its status lists every
 * provider its factories know for each stage (with or without a key); one it
 * leaves out -- Inworld, Moonshot, Groq TTS... -- would be swapped for another
 * provider. Unknown (no status yet, or an older agent) counts as served.
 */
export function voiceProviderServed(
  status: BrainStatus | null,
  stage: VoiceStage,
  provider: string,
): boolean {
  const stageKeys = status?.voiceKeys?.[stage];
  if (!stageKeys || Object.keys(stageKeys).length === 0) return true;
  return provider.toLowerCase() in stageKeys;
}
