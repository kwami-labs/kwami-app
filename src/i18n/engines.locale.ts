/**
 * Strings for the voice pipelines in the Models panel: standard, Live, and
 * Live + TTS, and the notices when the panel corrects a combination that
 * cannot be built (lib/voiceEngines.ts).
 *
 * vue-i18n v11 reads braces and pipes as message syntax: only {named} slots.
 */
export const enginesEn = {
  engines: {
    standard: 'Standard',
    standardDesc: 'STT + LLM + TTS',
    live: 'Live',
    liveDesc: 'One model hears and speaks · sees',
    hybrid: 'Live + TTS',
    hybridDesc: 'Live thinks, the TTS speaks',
    hybridUnavailableTitle:
      'Needs a Live model that answers in text (OpenAI Realtime) and its key on the agent. Gemini Live only answers in audio.',
    hybridIntro:
      'The Live model hears and thinks; the TTS below speaks. Only Live models that answer in text can do it: Gemini Live only answers with its own voice.',
    audioOnly: 'Own voice only',
    audioOnlyTitle: 'Answers only in audio: it cannot speak through a TTS (Live + TTS).',
    textReady: 'Live + TTS',
    liveAudioOnly:
      'That Live model only answers with its own voice, so the engine is now Live (no TTS).',
    hybridModelSwapped:
      'Gemini Live only answers in audio, so Live + TTS uses OpenAI gpt-realtime to hear and think.',
    hybridUnavailable:
      'Live + TTS needs OpenAI Realtime and its key on the agent (OPENAI_API_KEY). The engine has not changed.',
    liveModelSection: 'Live model (hears and thinks)',
    ttsSection: 'TTS (speaks)',
    close: 'Close',
  },
};

export const enginesEs: typeof enginesEn = {
  engines: {
    standard: 'Estándar',
    standardDesc: 'Oído + cerebro + voz',
    live: 'Live',
    liveDesc: 'Un modelo oye y habla · ve',
    hybrid: 'Live + TTS',
    hybridDesc: 'Live piensa, el TTS habla',
    hybridUnavailableTitle:
      'Necesita un modelo Live que conteste en texto (OpenAI Realtime) y su clave en el agente. Gemini Live solo contesta en audio.',
    hybridIntro:
      'El modelo Live oye y piensa; el TTS de abajo habla. Solo pueden hacerlo los modelos Live que contestan en texto: Gemini Live solo habla con su propia voz.',
    audioOnly: 'Solo voz propia',
    audioOnlyTitle: 'Solo contesta en audio: no puede hablar por un TTS (Live + TTS).',
    textReady: 'Live + TTS',
    liveAudioOnly:
      'Ese modelo Live solo contesta con su propia voz, así que el motor pasa a Live (sin TTS).',
    hybridModelSwapped:
      'Gemini Live solo contesta en audio, así que Live + TTS usa OpenAI gpt-realtime para oír y pensar.',
    hybridUnavailable:
      'Live + TTS necesita OpenAI Realtime y su clave en el agente (OPENAI_API_KEY). El motor no ha cambiado.',
    liveModelSection: 'Modelo Live (oye y piensa)',
    ttsSection: 'TTS (habla)',
    close: 'Cerrar',
  },
};
