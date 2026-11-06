/**
 * Character voices: Jarvis (male) and Friday (female), after the Iron Man AIs.
 *
 * Gemini Live only speaks with its 30 prebuilt voices -- no cloned or designed
 * ones -- so a character here is three things:
 *
 * - `voice`: the closest prebuilt Gemini voice, with `alternatives` to try;
 * - `style`: a speaking direction the agent puts in the instructions, which
 *   native-audio models follow (pace, pitch, diction, attitude);
 * - `designPrompt`: a description for a voice-design TTS (ElevenLabs Voice
 *   Design or similar) for when the standard pipeline takes over the voice.
 *
 * The directions name the fictional AIs (JARVIS, FRIDAY) as a register to aim
 * for, at the user's request (2026-10-09); they describe a manner of speaking
 * and never ask for an actor's voice. Gemini cannot clone one anyway. The
 * `designPrompt`s leave the names out: voice-design services refuse them, and
 * a description of traits works better there.
 *
 * Samples in `public/voices/` were generated with Gemini TTS, which uses the
 * same prebuilt voices, reading the same sentence under each `style`.
 *
 * Each character also has ElevenLabs voices (`elevenlabs`), for the third
 * engine. The designed ones come first -- for Jarvis, four tuned on 2026-11-05
 * for a deeper, cinematic butler register; for Friday, two from 2026-11-01 --
 * all built with Voice Design from the `designPrompt` (Creator plan) and saved
 * in the account, picked by measuring takes on Flash v2.5 (pitch, contour,
 * pace). The stock voices stay behind them, so a kwami saved with one keeps its
 * character.
 * The `*-elevenlabs-*` samples are Flash takes. ElevenLabs reads no direction;
 * the style stays set anyway, because a set direction is what locks the voice
 * against the agent's own switching.
 */

export type VoiceGender = 'male' | 'female';

/**
 * Every engine a character can speak on. The standard ones (STT -> LLM -> TTS)
 * are named after the TTS that speaks; the realtime ones are one
 * speech-to-speech model each. Measured on 2026-10-20, end of speech to first
 * audio on the agent: about 1.3 s on the standard pipeline with a fast ear,
 * about 2 s on either realtime model.
 *
 * - elevenlabs: Flash v2.5, the fastest TTS (0.24 s to first audio);
 * - cartesia: Sonic 3.5, a designed voice of its own and Spanish ones (0.44 s);
 * - deepgram: Aura 2, whose Spanish voices are models (0.74 s);
 * - openai-tts: tts-1, about 1 s;
 * - gemini-tts: the sound the user chose on 2026-10-09 -- but a free-tier key
 *   allows ten requests a day, after which the agent's fallback speaks;
 * - gemini-live / openai-realtime: one model that hears and speaks, and the
 *   only engines that can see the camera or a shared screen.
 */
export type VoiceEngine =
  | 'elevenlabs'
  | 'cartesia'
  | 'deepgram'
  | 'openai-tts'
  | 'gemini-tts'
  | 'gemini-live'
  | 'openai-realtime';

export const VOICE_ENGINES: readonly VoiceEngine[] = [
  'elevenlabs',
  'cartesia',
  'deepgram',
  'openai-tts',
  'gemini-tts',
  'gemini-live',
  'openai-realtime',
];

export const GEMINI_LIVE_MODEL = 'gemini-3.1-flash-live-preview';
export const OPENAI_REALTIME_MODEL = 'gpt-realtime';

export interface EngineSpec {
  kind: 'standard' | 'realtime';
  /** The TTS provider (standard) or the realtime provider, as the agent names it. */
  provider: string;
  model: string;
  /** Whether the engine reads the voice direction (`style`). */
  readsDirection: boolean;
}

export const ENGINE_SPECS: Record<VoiceEngine, EngineSpec> = {
  elevenlabs: {
    kind: 'standard',
    provider: 'elevenlabs',
    model: 'eleven_flash_v2_5',
    readsDirection: false,
  },
  cartesia: { kind: 'standard', provider: 'cartesia', model: 'sonic-3.5', readsDirection: false },
  // A Deepgram Aura voice *is* a model ("aura-2-nestor-es"): see `ttsFor`.
  deepgram: { kind: 'standard', provider: 'deepgram', model: 'aura-2', readsDirection: false },
  // tts-1, not gpt-4o-mini-tts: the latter took 7-9 s for a sentence on
  // 2026-10-20, tts-1 a steady second.
  'openai-tts': {
    kind: 'standard',
    provider: 'openai',
    model: 'tts-1',
    readsDirection: false,
  },
  'gemini-tts': {
    kind: 'standard',
    provider: 'gemini',
    model: 'gemini-3.1-flash-tts-preview',
    readsDirection: true,
  },
  'gemini-live': {
    kind: 'realtime',
    provider: 'google',
    model: GEMINI_LIVE_MODEL,
    readsDirection: true,
  },
  'openai-realtime': {
    kind: 'realtime',
    provider: 'openai',
    model: OPENAI_REALTIME_MODEL,
    readsDirection: true,
  },
};

export const isRealtimeEngine = (engine: VoiceEngine) => ENGINE_SPECS[engine].kind === 'realtime';

/**
 * The ear of every standard engine: Deepgram Nova 3 in Spanish. Gemini's
 * transcriber took 1.24 s after the end of speech to give its final text
 * (2026-10-20) and misheard "Jarvis"; Nova 3 took 0.3 s and heard it.
 */
export const FAST_STT = { provider: 'deepgram', model: 'nova-3', language: 'es' } as const;

/** The STT the app shipped with before FAST_STT, upgraded on load. */
export const LEGACY_DEFAULT_STT = {
  provider: 'gemini',
  model: 'gemini-3.5-transcribe-live',
} as const;

/**
 * The standard pipeline: Deepgram listens, Gemini thinks, Gemini speaks. The
 * agent backs each stage with another provider when one fails (a spent
 * free-tier quota, an outage), so a dead Gemini never leaves Jarvis mute.
 */
export const CLAUDE_VOICE_LLM = { provider: 'anthropic', model: 'claude-haiku-5-5' } as const;

export const GEMINI_STANDARD = {
  stt: FAST_STT,
  llm: { provider: 'google', model: 'gemini-3.5-flash' },
  tts: { provider: 'gemini', model: 'gemini-3.1-flash-tts-preview' },
} as const;

/**
 * Jarvis on the standard pipeline (2026-10-19): Gemini listens and thinks,
 * ElevenLabs speaks. Flash v2.5 was the fastest TTS measured (0.19 s to first
 * audio) and is billed per use; Gemini TTS on a free-tier key allows ten
 * requests a day, and a spent quota leaves Jarvis mute. The voice is the one
 * designed for him, Cine: a deep, controlled, cinematic butler.
 */
export const JARVIS_ELEVENLABS_VOICE = 'hJ8c5S51sAyQqz7QaCFy';
export const ELEVENLABS_TTS = { provider: 'elevenlabs', model: 'eleven_flash_v2_5' } as const;
export const JARVIS_STANDARD = {
  stt: GEMINI_STANDARD.stt,
  // The user's rule (2026-11-02): Claude thinks, not Gemini. Haiku for a call: 0.75 s
  // to the first token, measured with ~120 tools. It answers through the API key:
  // a call's turns need streaming and tools, which the PC's account does not give.
  llm: CLAUDE_VOICE_LLM,
  tts: { ...ELEVENLABS_TTS, voice: JARVIS_ELEVENLABS_VOICE },
} as const;

/** A provider's voice by its id, with the name the panel shows. */
export interface EngineVoice {
  id: string;
  name: string;
}
/** Kept for older imports. */
export type ElevenLabsVoice = EngineVoice;

export interface VoicePersona {
  id: 'jarvis' | 'friday';
  name: string;
  gender: VoiceGender;
  /** Realtime provider and the prebuilt voice it uses. */
  provider: 'google';
  voice: string;
  alternatives: string[];
  /** Direction for the realtime model, in the language it will speak. */
  style: string;
  /** ElevenLabs voices for the character, designed then stock; the first is the suggested one. */
  elevenlabs: readonly EngineVoice[];
  /** Voices on the other engines, suggested first (Spanish ones where they exist). */
  cartesia: readonly EngineVoice[];
  deepgram: readonly EngineVoice[];
  openai: readonly EngineVoice[];
  openaiRealtime: readonly EngineVoice[];
  /** For a voice-design TTS later on. */
  designPrompt: string;
  /** One-line summary for the panel, per locale. */
  summary: { en: string; es: string };
  /** Earlier versions of `style`, so a kwami saved with one is upgraded. */
  legacyStyles: string[];
}

export const VOICE_PERSONAS: readonly VoicePersona[] = [
  {
    id: 'jarvis',
    name: 'Jarvis',
    gender: 'male',
    provider: 'google',
    voice: 'Charon',
    alternatives: ['Orus', 'Iapetus', 'Algieba'],
    // Measured in Spanish on Flash v2.5. Designed for Jarvis with Voice Design
    // from his designPrompt, aimed at a deeper, cinematic butler register: Cine
    // 97 Hz with a very flat, controlled contour; Grave 115 Hz with more presence;
    // Sobrio 111 Hz, even and calm; Claro 122 Hz, a touch brighter. Then the
    // earlier designed pair: Británico 142 Hz, light and medium-pitched like the
    // film's AI; Seco 121 Hz, the briskest. Of the stock ones: George 124 Hz with a
    // flat contour and an unhurried pace, the butler register; Roger the deepest
    // and flattest (101 Hz) but casual in manner; Daniel formal and slow; Brian deep.
    elevenlabs: [
      { id: JARVIS_ELEVENLABS_VOICE, name: 'Cine' },
      { id: 'gPMMGH6RuQIzTEF7tPvh', name: 'Grave' },
      { id: 'qSukQ8DWG391NxzhQB8J', name: 'Sobrio' },
      { id: 'TPiookPUZQ1R0cC2Enwe', name: 'Claro' },
      { id: 'WHOJDqzCafRk2dAUIxxB', name: 'Británico' },
      { id: 'tjU8IXOtwi9SR61U8hgY', name: 'Seco' },
      { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George' },
      { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger' },
      { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel' },
      { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian' },
    ],
    // Sonic-3.5 is Jarvis's own voice, designed in Cartesia Sonic 3.5 and served
    // through LiveKit Inference (a "v_" id, not a UUID). Marcos and Gonzalo are
    // Cartesia's own Spanish (Spain) male voices, calm and warmer. Deepgram's
    // Spanish Aura voice for a man is Néstor.
    cartesia: [
      { id: 'v_ZMPWZvfoRpsC', name: 'Sonic-3.5' },
      { id: '13ff5deb-2591-42ad-a356-63a04e524411', name: 'Marcos' },
      { id: '58e531e3-b212-49df-adee-c335a19c2429', name: 'Gonzalo' },
    ],
    deepgram: [{ id: 'aura-2-nestor-es', name: 'Néstor' }],
    openai: [
      { id: 'onyx', name: 'Onyx' },
      { id: 'ash', name: 'Ash' },
    ],
    openaiRealtime: [
      { id: 'cedar', name: 'Cedar' },
      { id: 'ash', name: 'Ash' },
    ],
    style:
      'Habla como JARVIS, el mayordomo digital de Tony Stark en Iron Man, en castellano de ' +
      'España culto y neutro. Perfil: mayordomo británico de la vieja escuela convertido en ' +
      'inteligencia artificial; voz masculina madura, grave y aterciopelada, con resonancia ' +
      'de pecho y muy poco aire, extremadamente controlada. Cercanía: volumen bajo y ' +
      'próximo, como si hablara al oído a través de un auricular, sin proyectar nunca la ' +
      'voz. Entonación: contorno casi plano y sereno; las frases afirmativas caen ' +
      'suavemente al final; las preguntas suben apenas, con cortesía. Ritmo: medido y sin ' +
      'prisa, cada consonante articulada con precisión; una pausa breve y exacta después de ' +
      '«señor» y antes de cada cifra. Actitud: deferencia impecable, afecto discreto e ' +
      'ironía británica por atenuación, que se intuye en una ligerísima sonrisa al decir lo ' +
      'obvio. Nunca suena robótico, entusiasmado ni comercial.',
    designPrompt:
      'A witty artificial intelligence butler: a British man in his late thirties speaking ' +
      'fluent Castilian Spanish with a very slight refined English lilt. Light, smooth, ' +
      'medium-pitched tenor-baritone, not deep. Dry, understated and effortlessly clever, ' +
      'polite with a hint of sarcasm. Brisk, precise and fluid delivery, almost flat ' +
      'intonation, unemotional yet warm, crisp consonants. Close microphone, clean studio ' +
      'recording, no reverb, no noise.',
    summary: {
      en: 'Old-school butler AI, as JARVIS: deep velvety pitch, unhurried, impeccable, dry wit.',
      es: 'Mayordomo digital al estilo JARVIS: timbre grave y aterciopelado, pausado, impecable, ironía seca.',
    },
    legacyStyles: [
      'Habla como JARVIS, el mayordomo digital de Tony Stark en Iron Man, en castellano de ' +
        'España neutro. Voz masculina madura de mayordomo inglés de la vieja escuela: timbre ' +
        'grave y aterciopelado, más grave de lo habitual, con resonancia de pecho; ritmo pausado ' +
        'y uniforme; dicción impecable y muy nítida; cortesía exacta y calma imperturbable, como ' +
        'quien sirve con discreción absoluta. Ironía seca y contenida, apenas insinuada, nunca ' +
        'teatral. Pequeñas pausas antes de las cifras importantes. Nunca suena entusiasmado, ' +
        'apresurado ni comercial.',
      'Voz masculina madura de mayordomo inglés refinado que habla castellano de España ' +
        'neutro: timbre medio-grave, ritmo pausado y uniforme, dicción muy nítida, calma ' +
        'imperturbable y autoridad tranquila. El humor es seco y contenido, nunca teatral; ' +
        'pequeñas pausas antes de las cifras importantes. Nunca suena entusiasmado ni comercial.',
    ],
  },
  {
    id: 'friday',
    name: 'Friday',
    gender: 'female',
    provider: 'google',
    voice: 'Aoede',
    alternatives: ['Kore', 'Sulafat', 'Despina'],
    // Irlandesa, designed: 185 Hz, soft with a light lilt. Serena, designed: 167 Hz,
    // lower and flatter. Of the stock ones: Jessica young, bright and warm (205 Hz); Alice
    // the most melodic and quickest, Sarah bright, Lily velvety.
    elevenlabs: [
      { id: '7DhuphZTKDjiMKbUjawV', name: 'Irlandesa' },
      { id: 'r38nWKEfEkdcb3l6HqyC', name: 'Serena' },
      { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica' },
      { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice' },
      { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah' },
      { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily' },
    ],
    cartesia: [
      { id: 'de38f545-c574-44e8-9b54-a7d6fec1c6b1', name: 'Marta' },
      { id: '1cc00672-e9d4-455e-b3fb-31dfb7aad231', name: 'Laura' },
    ],
    deepgram: [{ id: 'aura-2-celeste-es', name: 'Celeste' }],
    openai: [
      { id: 'nova', name: 'Nova' },
      { id: 'coral', name: 'Coral' },
    ],
    openaiRealtime: [
      { id: 'marin', name: 'Marin' },
      { id: 'shimmer', name: 'Shimmer' },
    ],
    style:
      'Habla como FRIDAY, la asistente digital de Tony Stark en Iron Man, en castellano de ' +
      'España. Perfil: copiloto joven, despierta y de total confianza; voz femenina de ' +
      'timbre agudo, luminoso y suave, casi angelical, limpia y con un brillo delicado, sin ' +
      'estridencias. Cercanía: volumen próximo, como por un auricular, natural y relajado. ' +
      'Entonación: melódica y viva, con un vaivén ligeramente cantarín heredado de su ' +
      'acento irlandés, trasladado al castellano; los finales de frase quedan ligeros, a ' +
      'veces apenas ascendentes. Ritmo: ágil y eficiente, frases cortas, sin atropellarse, ' +
      'con respiraciones naturales. Actitud: cómplice, directa y resolutiva, cálida y con ' +
      'un punto pícaro, siempre respetuosa con el señor. Nunca chillona, infantil ni ' +
      'exagerada.',
    designPrompt:
      'A capable artificial intelligence co-pilot: an Irish woman in her thirties speaking ' +
      'fluent Castilian Spanish with a slight soft Irish lilt. Soft, medium-pitched, slightly ' +
      'husky and calm voice, never shrill. Matter-of-fact, understated and quietly warm, with ' +
      'gentle musical rises at the end of phrases. Relaxed yet quick, natural conversational ' +
      'delivery. Close microphone, clean studio recording, no reverb, no noise.',
    summary: {
      en: 'Co-pilot AI, as FRIDAY: high, bright, almost angelic, quick and warm.',
      es: 'Copiloto digital al estilo FRIDAY: timbre agudo y luminoso, casi angelical, ágil y cálida.',
    },
    legacyStyles: [
      'Habla como FRIDAY, la asistente digital de Tony Stark en Iron Man, en castellano de ' +
        'España. Voz femenina joven de timbre agudo, luminoso y suave, casi angelical: limpia, ' +
        'aireada y dulce, sin estridencias. Ritmo ágil y eficiente pero sin atropellarse; tono ' +
        'cercano y directo con un punto desenfadado y una cadencia ligeramente musical. Cálida, ' +
        'segura y resolutiva; nunca chillona, infantil ni exagerada.',
      'Voz femenina joven y segura que habla castellano de España: timbre medio, cálido y ' +
        'claro, ritmo ágil y eficiente, tono cercano y directo con un punto desenfadado y una ' +
        'cadencia ligeramente musical. Profesional y resolutiva; nunca burbujeante ni exagerada.',
    ],
  },
];

/** Where the panel finds a persona's sample for a given prebuilt voice. */
export function sampleUrl(persona: VoicePersona['id'], voice: string): string {
  return `/voices/${persona}-${voice.toLowerCase()}.wav`;
}

/** The persona's Spanish take on Flash v2.5 with one of its ElevenLabs voices. */
export function elevenlabsSampleUrl(persona: VoicePersona['id'], voiceName: string): string {
  return engineSampleUrl(persona, 'elevenlabs', voiceName);
}

/** A persona's Spanish sample on a TTS engine, by the voice's panel name. */
export function engineSampleUrl(
  persona: VoicePersona['id'],
  engine: string,
  voiceName: string,
): string {
  const slug = voiceName.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return `/voices/${persona}-${engine}-${slug}.wav`;
}

/** Where a persona's voice on an engine can be heard, or null (no sample). */
export function voiceSampleUrl(
  persona: VoicePersona,
  engine: VoiceEngine,
  voice: string,
): string | null {
  switch (engine) {
    case 'gemini-tts':
    case 'gemini-live':
      return sampleUrl(persona.id, voice);
    case 'elevenlabs':
    case 'cartesia':
    case 'deepgram':
      return engineSampleUrl(persona.id, engine, voiceLabel(voice));
    case 'openai-tts':
      return engineSampleUrl(persona.id, 'openai', voiceLabel(voice));
    default:
      return null;
  }
}

/** The non-Gemini voice list a persona has for an engine. */
export function engineVoices(
  persona: VoicePersona,
  engine: VoiceEngine,
): readonly EngineVoice[] | null {
  switch (engine) {
    case 'elevenlabs':
      return persona.elevenlabs;
    case 'cartesia':
      return persona.cartesia;
    case 'deepgram':
      return persona.deepgram;
    case 'openai-tts':
      return persona.openai;
    case 'openai-realtime':
      return persona.openaiRealtime;
    default:
      return null;
  }
}

export const TTS_ENGINE_BY_PROVIDER: Record<string, VoiceEngine> = {
  elevenlabs: 'elevenlabs',
  cartesia: 'cartesia',
  deepgram: 'deepgram',
  openai: 'openai-tts',
};

/** The engine a voice config is on, as the character panel sees it. */
export function voiceEngine(
  pipelineMode: string,
  ttsProvider: string,
  realtimeProvider = 'google',
): VoiceEngine {
  if (pipelineMode === 'realtime') {
    return realtimeProvider === 'openai' ? 'openai-realtime' : 'gemini-live';
  }
  return TTS_ENGINE_BY_PROVIDER[ttsProvider] ?? 'gemini-tts';
}

/** The voice a persona speaks with on an engine: its suggested one there. */
export function personaVoice(persona: VoicePersona, engine: VoiceEngine): string {
  return engineVoices(persona, engine)?.[0]?.id ?? persona.voice;
}

/** The voices a persona offers on an engine, suggested first. */
export function personaVoices(persona: VoicePersona, engine: VoiceEngine): string[] {
  const voices = engineVoices(persona, engine);
  return voices ? voices.map((v) => v.id) : [persona.voice, ...persona.alternatives];
}

/**
 * The TTS settings that make a voice speak on a standard engine. Deepgram
 * names its Spanish voices as models, so the voice goes in both fields.
 */
export function ttsFor(
  engine: VoiceEngine,
  voice: string,
): { provider: string; model: string; voice: string } {
  const spec = ENGINE_SPECS[engine];
  if (engine === 'deepgram') return { provider: spec.provider, model: voice, voice };
  return { provider: spec.provider, model: spec.model, voice };
}

/** A voice id as the panel shows it: provider ids by their name. */
export function voiceLabel(voice: string): string {
  for (const persona of VOICE_PERSONAS) {
    for (const list of [
      persona.elevenlabs,
      persona.cartesia,
      persona.deepgram,
      persona.openai,
      persona.openaiRealtime,
    ]) {
      const match = list.find((v) => v.id === voice);
      if (match) return match.name;
    }
  }
  return voice;
}

/**
 * A real Gemini Live turn (gemini-3.1-flash-live-preview) with the persona's
 * suggested voice and its direction in the instructions, as the agent sends it.
 */
export function liveSampleUrl(persona: VoicePersona): string {
  return `/voices/${persona.id}-live-${persona.voice.toLowerCase()}.wav`;
}

/** The current text of a persona style saved by an earlier version, or the style unchanged. */
export function upgradeStyle(style: string): string {
  return VOICE_PERSONAS.find((p) => p.legacyStyles.includes(style))?.style ?? style;
}

/**
 * One voice on (the user's rule, 2026-10-09): while a voice direction is set
 * for the engine in use, the voice is locked. Nothing switches it -- not the
 * agent's tools, not the voice list -- until the user picks another character
 * or clears the direction. Returns the character, a custom direction, or null.
 */
export function voiceLock(
  pipelineMode: string,
  realtime: { voice: string; style?: string },
  tts: { voice: string; style?: string },
): { persona: VoicePersona | null; voice: string } | null {
  const active = pipelineMode === 'realtime' ? realtime : tts;
  const style = (active.style ?? '').trim();
  if (!style) return null;
  return { persona: activePersona(active.voice, active.style ?? ''), voice: active.voice };
}

/** The persona whose voice and style are both in use, if any. */
export function activePersona(voice: string, style: string): VoicePersona | null {
  return (
    VOICE_PERSONAS.find(
      (p) =>
        p.style === style &&
        (p.voice === voice ||
          p.alternatives.includes(voice) ||
          [p.elevenlabs, p.cartesia, p.deepgram, p.openai, p.openaiRealtime].some((list) =>
            list.some((v) => v.id === voice),
          )),
    ) ?? null
  );
}

/** Gemini's own one-word character for each voice, in Spanish for the panel. */
export const GEMINI_CHARACTER_ES: Record<string, string> = {
  Soft: 'Suave',
  Friendly: 'Amable',
  Gravelly: 'Rasgada',
  Smooth: 'Aterciopelada',
  Firm: 'Firme',
  Breezy: 'Desenfadada',
  Bright: 'Luminosa',
  'Easy-going': 'Tranquila',
  Informative: 'Informativa',
  Breathy: 'Aireada',
  Clear: 'Clara',
  Excitable: 'Vehemente',
  Mature: 'Madura',
  Upbeat: 'Animada',
  Youthful: 'Juvenil',
  Forward: 'Resuelta',
  Lively: 'Viva',
  Knowledgeable: 'Experta',
  Even: 'Uniforme',
  Warm: 'Cálida',
  Gentle: 'Delicada',
  Casual: 'Informal',
};

/** The voice catalogue calls Gemini "gemini"; the agent and the store say "google". */
export function catalogProvider(provider: string): string {
  return provider === 'google' ? 'gemini' : provider;
}
