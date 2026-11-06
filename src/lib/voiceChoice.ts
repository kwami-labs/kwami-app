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
  isLiveKitVoice,
  personaVoice,
  voiceSampleUrl,
  type LiveKitCustomVoice,
  type VoiceEngine,
  type VoicePersona,
} from './voicePersonas';

export type VoiceKind = 'tts' | 'realtime';

export interface PickableVoice extends Voice {
  /** The character this voice was chosen for. */
  character?: string;
  /** The first choice for that character on this engine. */
  suggested?: boolean;
  /** A LiveKit voice the user added by id: no catalogue knows it, so nothing can speak a sample. */
  custom?: boolean;
}

/** The section the LiveKit voices are shown under in a Cartesia list. */
export const LIVEKIT_CATEGORY = 'LiveKit';

/** OpenAI voices tts-1 and tts-1-hd do not take. */
const OPENAI_NEWEST = new Set(['ballad', 'verse', 'marin', 'cedar']);

/** A Deepgram voice that is a whole model id: aura-2-nestor-es. */
const DEEPGRAM_FULL_ID = /^aura-(2-)?[a-z]+-[a-z]{2}$/;

function deepgramFamily(model: string): 'aura-1' | 'aura-2' {
  return bareModelId(model).startsWith('aura-2') ? 'aura-2' : 'aura-1';
}

/** Providers that publish no sample of their voices: the API speaks one (`/voices/preview`). */
const SPOKEN_ON_REQUEST = new Set(['cartesia', 'rime', 'openai', 'gemini']);

/** Whether a voice can be heard before choosing it. Not a character's voice from another list. */
export function canHear(provider: string, voice: PickableVoice): boolean {
  return Boolean(voice.preview_url) || (SPOKEN_ON_REQUEST.has(provider) && !voice.custom);
}

/** The key of a favourite: the same id on two providers is two voices. */
export function favoriteKey(provider: string, voiceId: string): string {
  return `${provider}:${voiceId}`;
}

/** The voice in use first, then the favourites; each group keeps the catalogue's order. */
export function inPickingOrder<V extends { id: string }>(
  voices: readonly V[],
  current: string,
  isFavorite: (id: string) => boolean,
): V[] {
  const rank = (v: V) => (v.id === current ? 0 : isFavorite(v.id) ? 1 : 2);
  return voices
    .map((voice, index) => ({ voice, index }))
    .sort((a, b) => rank(a.voice) - rank(b.voice) || a.index - b.index)
    .map(({ voice }) => voice);
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

/**
 * A character's voices on an engine. On Cartesia its LiveKit voices come first:
 * they travel as Cartesia ("v_" ids through LiveKit Inference).
 */
function characterEntries(persona: VoicePersona, engine: VoiceEngine) {
  const own = engineVoices(persona, engine);
  const entries = own
    ? own.map((v) => ({ id: v.id, name: v.name }))
    : [persona.voice, ...persona.alternatives].map((id) => ({ id, name: id }));
  return engine === 'cartesia' ? [...persona.livekit, ...entries] : entries;
}

/**
 * The catalogue with the characters' voices marked and first.
 *
 * A voice the catalogue does not list is added, except where the list is the
 * account's own (`live`): a designed voice missing from it does not exist for this
 * deployment, and choosing it would be silence until the fallback spoke. On
 * Cartesia, the LiveKit voices the user added (`custom`) follow the characters'.
 */
export function withCharacterVoices(
  kind: VoiceKind,
  provider: string,
  voices: readonly Voice[],
  live: boolean,
  custom: readonly LiveKitCustomVoice[] = [],
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
      const livekit = isLiveKitVoice(entry.id);
      first.push({
        id: entry.id,
        name: listed?.name ?? entry.name,
        category: listed?.category ?? (livekit ? LIVEKIT_CATEGORY : null),
        gender: listed?.gender ?? persona.gender,
        language: listed?.language ?? null,
        description: listed?.description ?? null,
        preview_url:
          listed?.preview_url ?? voiceSampleUrl(persona, livekit ? 'livekit' : engine, entry.id),
        character: persona.name,
        suggested: index === 0,
      });
    });
  }
  if (engine === 'cartesia') {
    for (const voice of custom) {
      if (first.some((v) => v.id === voice.id)) continue;
      const at = rest.findIndex((v) => v.id === voice.id);
      const listed = at === -1 ? null : rest.splice(at, 1)[0];
      first.push({
        id: voice.id,
        name: voice.name,
        category: LIVEKIT_CATEGORY,
        gender: listed?.gender ?? null,
        language: listed?.language ?? null,
        description: listed?.description ?? null,
        preview_url: listed?.preview_url ?? null,
        // A catalogue that knows it can speak a sample; otherwise none can.
        custom: !listed,
      });
    }
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
