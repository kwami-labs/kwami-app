/**
 * The Models tabs' catalogue: LiveKit Inference plus the models only our own
 * keys reach, under the names the agent builds them with.
 *
 * What matters: Jarvis's own models (Gemini transcription, Gemini 3.5 Flash,
 * Gemini TTS, ElevenLabs Flash) are listed and recognised as the ones in use,
 * no model is listed twice, and a provider the agent cannot build is told
 * apart from one that only lacks its key.
 */
import { describe, expect, it } from 'vitest';
import {
  bareModelId,
  mergeModels,
  sameModel,
  voiceProviderServed,
} from '../../src/lib/voiceCatalog';
import type { BrainStatus } from '../../src/lib/brain';

type Entry = { model_id: string; provider: string; source?: string };

const inference: Entry[] = [
  { model_id: 'elevenlabs/eleven_flash_v2_5', provider: 'elevenlabs', source: 'inference' },
  { model_id: 'inworld/tts-1', provider: 'inworld', source: 'inference' },
];
const plugins: Record<string, Entry[]> = {
  elevenlabs: [
    { model_id: 'eleven_flash_v2_5', provider: 'elevenlabs' },
    { model_id: 'eleven_v3', provider: 'elevenlabs' },
  ],
  gemini: [{ model_id: 'gemini-3.1-flash-tts-preview', provider: 'gemini' }],
};
const fill = (m: Entry): Entry => ({ ...m, source: 'plugin' });

describe('model ids', () => {
  it('compares with or without the provider prefix and ElevenLabs spellings', () => {
    expect(bareModelId('deepgram/nova-3')).toBe('nova-3');
    expect(bareModelId('gemini-3.5-flash')).toBe('gemini-3.5-flash');
    expect(sameModel('elevenlabs/eleven_flash_v2_5', 'eleven_flash_v2_5')).toBe(true);
    expect(sameModel('eleven-flash-v2.5', 'eleven_flash_v2_5')).toBe(true);
    expect(sameModel('eleven_flash_v2_5', 'eleven_flash_v2')).toBe(false);
  });
});

describe('mergeModels', () => {
  it('adds the plugin-only models after the Inference ones, each once', () => {
    const merged = mergeModels('tts', inference, plugins, fill);
    expect(merged.map((m) => `${m.provider}:${m.model_id}:${m.source}`)).toEqual([
      'elevenlabs:elevenlabs/eleven_flash_v2_5:inference',
      'inworld:inworld/tts-1:inference',
      'elevenlabs:eleven_v3:plugin',
      'gemini:gemini-3.1-flash-tts-preview:plugin',
    ]);
  });

  it('works before the plugin catalogue has loaded', () => {
    expect(mergeModels('tts', inference, undefined, fill)).toHaveLength(2);
    expect(mergeModels('tts', [], null, fill)).toEqual([]);
  });

  it('renames plugin providers the agent spells differently (mistralai -> mistral)', () => {
    const merged = mergeModels(
      'llm',
      [],
      { mistralai: [{ model_id: 'mistral-large', provider: 'mistralai' }] },
      fill,
    );
    expect(merged[0]).toMatchObject({ provider: 'mistral', model_id: 'mistral-large' });
  });
});

describe('voiceProviderServed', () => {
  const status = {
    voiceKeys: { tts: { elevenlabs: true, gemini: false } },
  } as unknown as BrainStatus;

  it('is false only for a provider the agent does not list for that stage', () => {
    expect(voiceProviderServed(status, 'tts', 'gemini')).toBe(true);
    expect(voiceProviderServed(status, 'tts', 'ElevenLabs')).toBe(true);
    expect(voiceProviderServed(status, 'tts', 'inworld')).toBe(false);
  });

  it('serves everything while nothing is known', () => {
    expect(voiceProviderServed(null, 'tts', 'inworld')).toBe(true);
    expect(voiceProviderServed(status, 'stt', 'anything')).toBe(true);
    const older = { voiceKeys: { tts: {} } } as unknown as BrainStatus;
    expect(voiceProviderServed(older, 'tts', 'inworld')).toBe(true);
  });
});
