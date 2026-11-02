/**
 * Which voices fit which voice model, and what choosing one has to change.
 *
 * The catalogue lists voices per provider, but a voice only works on some of its
 * models: tts-1 stops at nine of OpenAI's voices, a Deepgram voice is Aura 1 or
 * Aura 2, and Rime keeps a set per model. The agent would replace a voice the model
 * does not take with its default, so the user would hear another voice than the one
 * marked. Mirrors `OpenAIVoices` and `_create_deepgram_tts` in the agent.
 */

import type { Voice } from '@/composables/useVoicesApi';
import { bareModelId, sameModel } from './voiceCatalog';
import {
  TTS_ENGINE_BY_PROVIDER,
  VOICE_PERSONAS,
  activePersona,
  engineVoices,
  personaVoice,
  voiceSampleUrl,
  type VoiceEngine,
  type VoicePersona,
} from './voicePersonas';

export type VoiceKind = 'tts' | 'realtime';

export interface PickableVoice extends Voice {
  /** The character this voice was chosen for. */
  character?: string;
  /** The first choice for that character on this engine. */
  suggested?: boolean;
}

/** OpenAI voices tts-1 and tts-1-hd do not take. */
const OPENAI_NEWEST = new Set(['ballad', 'verse', 'marin', 'cedar']);

/** A Deepgram voice that is a whole model id: aura-2-nestor-es. */
const DEEPGRAM_FULL_ID = /^aura-(2-)?[a-z]+-[a-z]{2}$/;

function deepgramFamily(model: string): 'aura-1' | 'aura-2' {
  return bareModelId(model).startsWith('aura-2') ? 'aura-2' : 'aura-1';
}

/** Providers whose voices speak any language of the model, whatever they are tagged. */
export function speaksAnyLanguage(provider: string): boolean {
  return ['elevenlabs', 'openai', 'gemini'].includes(provider);
}

/** The voices of a provider that this model can speak with. */
export function voicesForModel<V extends Voice>(
  provider: string,
  model: string,
  voices: readonly V[],
): V[] {
  const bare = bareModelId(model);
  if (provider === 'openai' && bare.startsWith('tts-1')) {
    return voices.filter((v) => !OPENAI_NEWEST.has(v.id));
  }
  if (provider === 'deepgram') {
    const family = deepgramFamily(model);
    return voices.filter((v) => (v.id.startsWith('aura-2-') ? 'aura-2' : 'aura-1') === family);
  }
  if (provider === 'rime') {
    const own = voices.filter((v) => v.category === bare);
    return own.length ? own : [...voices];
  }
  return [...voices];
}

function engineOf(kind: VoiceKind, provider: string): VoiceEngine | null {
  if (kind === 'realtime') return provider === 'openai' ? 'openai-realtime' : 'gemini-live';
  return TTS_ENGINE_BY_PROVIDER[provider] ?? null;
}

function characterEntries(persona: VoicePersona, engine: VoiceEngine) {
  const own = engineVoices(persona, engine);
  return own
    ? own.map((v) => ({ id: v.id, name: v.name }))
    : [persona.voice, ...persona.alternatives].map((id) => ({ id, name: id }));
}

/**
 * The catalogue with the characters' voices marked and first.
 *
 * A voice the catalogue does not list is added, except where the list is the
 * account's own (`live`): a designed voice missing from it does not exist for this
 * deployment, and choosing it would be silence until the fallback spoke.
 */
export function withCharacterVoices(
  kind: VoiceKind,
  provider: string,
  voices: readonly Voice[],
  live: boolean,
): PickableVoice[] {
  const engine = engineOf(kind, provider);
  const rest: PickableVoice[] = voices.map((v) => ({ ...v }));
  if (!engine) return rest;
  const first: PickableVoice[] = [];
  for (const persona of VOICE_PERSONAS) {
    characterEntries(persona, engine).forEach((entry, index) => {
      const at = rest.findIndex((v) => v.id === entry.id);
      const listed = at === -1 ? null : rest.splice(at, 1)[0];
      if (!listed && live) return;
      const already = first.find((v) => v.id === entry.id);
      if (already) return;
      first.push({
        id: entry.id,
        name: listed?.name ?? entry.name,
        category: listed?.category ?? null,
        gender: listed?.gender ?? persona.gender,
        language: listed?.language ?? null,
        description: listed?.description ?? null,
        preview_url: listed?.preview_url ?? voiceSampleUrl(persona, engine, entry.id),
        character: persona.name,
        suggested: index === 0,
      });
    });
  }
  return [...first, ...rest];
}

/** Whether a voice is in this language: "es" takes es-ES and es-MX, untagged takes any. */
export function matchesLanguage(voice: Voice, language: string): boolean {
  if (language === 'all' || !voice.language || voice.language === 'multilingual') return true;
  return voice.language === language || voice.language.startsWith(`${language}-`);
}

/** Lower-case, without accents, so "alvaro" finds Álvaro. */
function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function matchesSearch(voice: PickableVoice, query: string): boolean {
  const wanted = fold(query.trim());
  if (!wanted) return true;
  return [voice.name, voice.id, voice.description, voice.language, voice.character]
    .filter(Boolean)
    .some((field) => fold(String(field)).includes(wanted));
}

/** Every language present, each base first and then its regions: es, es-ES, es-MX. */
export function languagesOf(voices: readonly Voice[]): string[] {
  const tags = new Set<string>();
  for (const voice of voices) {
    if (!voice.language || voice.language === 'multilingual') continue;
    tags.add(voice.language.split('-')[0]);
    tags.add(voice.language);
  }
  return [...tags].sort();
}

/** The key a voice is remembered under: one per model, one per Deepgram family. */
export function modelVoiceKey(kind: VoiceKind, provider: string, model: string): string {
  const id = provider === 'deepgram' ? deepgramFamily(model) : bareModelId(model);
  return `${kind}:${provider}:${id}`;
}

/**
 * What choosing a voice changes on a TTS. A Deepgram voice decides the model: Aura 2's
 * are whole model ids, and an Aura 1 voice under one of those would never be heard.
 */
export function ttsVoicePatch(
  provider: string,
  model: string,
  voice: string,
): { model: string; voice: string } {
  if (provider === 'deepgram') {
    if (DEEPGRAM_FULL_ID.test(voice)) return { model: voice, voice };
    if (DEEPGRAM_FULL_ID.test(bareModelId(model))) return { model: 'aura-1', voice };
  }
  return { model, voice };
}

/** Whether a model card is the model in use: a Deepgram voice-as-model is its family's. */
export function sameTtsModel(provider: string, current: string, card: string): boolean {
  if (sameModel(current, card)) return true;
  return (
    provider === 'deepgram' &&
    DEEPGRAM_FULL_ID.test(bareModelId(current)) &&
    deepgramFamily(current) === bareModelId(card)
  );
}

interface CurrentTts {
  provider: string;
  voice: string;
  style?: string;
}

/**
 * The voice a model gets when it is selected: the one chosen for it before; on the
 * same provider the current one if the model takes it; else the character's, or
 * none, which leaves the choice to the agent's default for that provider.
 */
function voiceForNewModel(
  current: CurrentTts,
  provider: string,
  model: string,
  remembered: Readonly<Record<string, string>>,
): string {
  const saved = remembered[modelVoiceKey('tts', provider, model)];
  if (saved) return saved;
  const fits = (id: string) =>
    voicesForModel(provider, model, [{ id } as Voice]).length > 0 && Boolean(id);
  if (provider === current.provider && fits(current.voice)) return current.voice;
  const engine = TTS_ENGINE_BY_PROVIDER[provider];
  if (!engine) return '';
  const persona = activePersona(current.voice, current.style ?? '') ?? VOICE_PERSONAS[0];
  const suggested = personaVoice(persona, engine);
  return fits(suggested) ? suggested : '';
}

export function voiceAfterModelChange(
  current: CurrentTts,
  provider: string,
  model: string,
  remembered: Readonly<Record<string, string>>,
): { model: string; voice: string } {
  const voice = voiceForNewModel(current, provider, model, remembered);
  return ttsVoicePatch(provider, model, voice);
}
