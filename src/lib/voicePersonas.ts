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
 */

export type VoiceGender = 'male' | 'female';

/**
 * gemini-tts: standard pipeline, Gemini STT -> Gemini Flash -> Gemini TTS, the
 * sound the user chose (2026-10-09). gemini-live: one realtime model, faster.
 */
export type VoiceEngine = 'gemini-tts' | 'gemini-live';

export const GEMINI_LIVE_MODEL = 'gemini-3.1-flash-live-preview';

/** The all-Gemini standard pipeline: only GOOGLE_API_KEY is needed. */
export const GEMINI_STANDARD = {
  stt: { provider: 'gemini', model: 'gemini-3.5-transcribe-live', language: 'es' },
  llm: { provider: 'google', model: 'gemini-3.5-flash' },
  tts: { provider: 'gemini', model: 'gemini-3.1-flash-tts-preview' },
} as const;

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
      'Voz masculina de unos 50 años, mayordomo inglés de la vieja escuela que habla castellano ' +
      'de España neutro: timbre grave y aterciopelado con resonancia de pecho, dicción ' +
      'impecable, ritmo pausado, calma absoluta e ironía seca y contenida. Grabación de ' +
      'estudio, sin reverberación ni ruido.',
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
      'Voz femenina de unos 28 años que habla castellano de España: timbre agudo, luminoso y ' +
      'suave, casi angelical, limpio y aireado; ritmo ágil sin atropellarse; tono cálido, ' +
      'cercano y seguro con un punto desenfadado. Grabación de estudio, sin reverberación ni ' +
      'ruido.',
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
      (p) => p.style === style && (p.voice === voice || p.alternatives.includes(voice)),
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
