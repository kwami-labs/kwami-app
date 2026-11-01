/**
 * Character voices: Jarvis (male) and Friday (female) on Gemini Live.
 *
 * What matters: applying a character sets the prebuilt voice *and* the speaking
 * direction (and the realtime pipeline they need); the direction rides along
 * when the voice reaches the agent; every candidate voice has a sample to
 * listen to; and the Gemini catalogue is asked for under the name it uses.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { enableAutoUnmount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { mountWithPinia } from '../helpers/mount';
import { i18n, setLocale } from '../../src/i18n';
import VoicePersonas from '../../src/components/panels/settings/voice/VoicePersonas.vue';
import { useVoiceStore } from '../../src/stores/voice';
import {
  JARVIS_ELEVENLABS_VOICE,
  VOICE_PERSONAS,
  VOICE_ENGINES,
  activePersona,
  catalogProvider,
  elevenlabsSampleUrl,
  personaVoices,
  voiceSampleUrl,
  liveSampleUrl,
  sampleUrl,
  upgradeStyle,
  voiceEngine,
  voiceLabel,
} from '../../src/lib/voicePersonas';

enableAutoUnmount(afterEach);

describe('voice personas', () => {
  it('has a male and a female character, each with a sample per candidate voice', () => {
    expect(VOICE_PERSONAS.map((p) => [p.name, p.gender])).toEqual([
      ['Jarvis', 'male'],
      ['Friday', 'female'],
    ]);
    for (const p of VOICE_PERSONAS) {
      for (const voice of [p.voice, ...p.alternatives]) {
        const file = resolve(__dirname, '../../public', sampleUrl(p.id, voice).slice(1));
        expect(existsSync(file), file).toBe(true);
      }
      const live = resolve(__dirname, '../../public', liveSampleUrl(p).slice(1));
      expect(existsSync(live), live).toBe(true);
      for (const voice of p.elevenlabs) {
        const file = resolve(
          __dirname,
          '../../public',
          elevenlabsSampleUrl(p.id, voice.name).slice(1),
        );
        expect(existsSync(file), file).toBe(true);
      }
    }
  });

  it('gives each character ElevenLabs stock voices, George first for Jarvis', () => {
    const [jarvis, friday] = VOICE_PERSONAS;
    expect(jarvis.elevenlabs[0]).toEqual({ id: JARVIS_ELEVENLABS_VOICE, name: 'George' });
    expect(friday.elevenlabs[0]!.name).toBe('Jessica');
    // ElevenLabs ids are 20 characters: the agent refuses shorter ones.
    for (const p of VOICE_PERSONAS) for (const v of p.elevenlabs) expect(v.id).toHaveLength(20);
    expect(activePersona('Xb7hH8MSUJpSbSDYk0k2', friday.style)?.id).toBe('friday');
    expect(voiceLabel('CwhRBWXzGAHq8TQ4Fs17')).toBe('Roger');
    expect(voiceLabel('Charon')).toBe('Charon');
  });

  it('tells the engine from the pipeline and the TTS provider', () => {
    expect(voiceEngine('realtime', 'elevenlabs')).toBe('gemini-live');
    expect(voiceEngine('realtime', 'elevenlabs', 'openai')).toBe('openai-realtime');
    expect(voiceEngine('stt-llm-tts', 'elevenlabs')).toBe('elevenlabs');
    expect(voiceEngine('stt-llm-tts', 'cartesia')).toBe('cartesia');
    expect(voiceEngine('stt-llm-tts', 'deepgram')).toBe('deepgram');
    expect(voiceEngine('stt-llm-tts', 'openai')).toBe('openai-tts');
    expect(voiceEngine('stt-llm-tts', 'gemini')).toBe('gemini-tts');
  });

  it('gives each character a voice on every engine, with a sample wherever one can be made', () => {
    for (const p of VOICE_PERSONAS) {
      for (const engine of VOICE_ENGINES) {
        const voices = personaVoices(p, engine);
        expect(voices.length, `${p.id} on ${engine}`).toBeGreaterThan(0);
        for (const voice of voices) {
          // A realtime voice only exists live: there is no file to play.
          const url = voiceSampleUrl(p, engine, voice);
          if (engine === 'openai-realtime') {
            expect(url).toBeNull();
            continue;
          }
          const file = resolve(__dirname, '../../public', url!.slice(1));
          expect(existsSync(file), file).toBe(true);
        }
      }
    }
    expect(voiceLabel('aura-2-nestor-es')).toBe('Néstor');
    expect(activePersona('marin', VOICE_PERSONAS[1].style)?.id).toBe('friday');
  });

  it('recognises a character by its direction, whichever candidate voice is used', () => {
    const friday = VOICE_PERSONAS[1];
    expect(activePersona('Kore', friday.style)?.id).toBe('friday');
    expect(activePersona('Kore', '')).toBeNull();
  });

  it('directs both voices as the Tony Stark AIs: deeper Jarvis, higher Friday', () => {
    const [jarvis, friday] = VOICE_PERSONAS;
    expect([jarvis.voice, friday.voice]).toEqual(['Charon', 'Aoede']);
    expect(jarvis.style).toMatch(/JARVIS.*Tony Stark/);
    expect(jarvis.style).toMatch(/grave/);
    expect(friday.style).toMatch(/FRIDAY.*Tony Stark/);
    expect(friday.style).toMatch(/agudo.*angelical/);
    // Voice-design services refuse named characters; the traits carry it there.
    expect(jarvis.designPrompt + friday.designPrompt).not.toMatch(/JARVIS|FRIDAY|Stark/);
  });

  it('upgrades a style saved with an earlier wording, and leaves custom ones alone', () => {
    const [jarvis] = VOICE_PERSONAS;
    expect(upgradeStyle(jarvis.legacyStyles[0])).toBe(jarvis.style);
    expect(upgradeStyle('Mi dirección propia')).toBe('Mi dirección propia');
  });

  it('asks the voice catalogue for Gemini by the name it knows', () => {
    expect(catalogProvider('google')).toBe('gemini');
    expect(catalogProvider('openai')).toBe('openai');
  });
});

describe('voice personas section', () => {
  beforeEach(async () => {
    localStorage.clear();
    await setLocale('es');
  });

  it('starts as Jarvis on Gemini TTS and switches to Friday on both engines', async () => {
    const wrapper = mountWithPinia(VoicePersonas, { global: { plugins: [i18n] } });
    const store = useVoiceStore();
    expect(store.pipelineMode).toBe('stt-llm-tts');
    expect(store.tts).toMatchObject({ provider: 'gemini', voice: 'Charon' });
    expect(activePersona(store.tts.voice, store.tts.style ?? '')?.id).toBe('jarvis');

    // One voice on: Friday is off, with only a deliberate switch to offer.
    const fridayCard = () => wrapper.findAll('.persona')[1];
    expect(fridayCard().classes()).toContain('off');
    expect(fridayCard().findAll('.voice-chip')).toHaveLength(0);
    const use = fridayCard()
      .findAll('button')
      .find((b) => b.text() === 'Cambiar a Friday');
    await use!.trigger('click');
    expect(wrapper.findAll('.persona')[0].classes()).toContain('off');

    // The engine is the user's choice: applying a character does not change it.
    expect(store.pipelineMode).toBe('stt-llm-tts');
    const friday = { voice: 'Aoede', style: VOICE_PERSONAS[1].style };
    expect(store.tts).toMatchObject({ provider: 'gemini', ...friday });
    expect(store.realtime).toMatchObject({ provider: 'google', ...friday });
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe(
      VOICE_PERSONAS[1].style,
    );
  });

  it('switches engine keeping the character, and back to Gemini TTS with the fast ear', async () => {
    const wrapper = mountWithPinia(VoicePersonas, { global: { plugins: [i18n] } });
    const store = useVoiceStore();
    const button = (label: string) =>
      wrapper.findAll('.engine-btn').find((b) => b.text().startsWith(label))!;

    await button('Gemini Live').trigger('click');
    expect(store.pipelineMode).toBe('realtime');
    expect(store.realtime).toMatchObject({ voice: 'Charon', style: VOICE_PERSONAS[0].style });

    store.updateSTT({ provider: 'deepgram', model: 'nova-2' });
    await button('Gemini TTS').trigger('click');
    expect(store.pipelineMode).toBe('stt-llm-tts');
    // Deepgram listens on every standard engine: Gemini took 1.24 s to transcribe.
    expect(store.stt).toMatchObject({ provider: 'deepgram', model: 'nova-3', language: 'es' });
    expect(store.llm).toMatchObject({ provider: 'google', model: 'gemini-3.5-flash' });
    expect(store.tts).toMatchObject({ provider: 'gemini', voice: 'Charon' });
  });

  it("switches to ElevenLabs with the character's voice there, keeping its Gemini voice", async () => {
    const wrapper = mountWithPinia(VoicePersonas, { global: { plugins: [i18n] } });
    const store = useVoiceStore();
    const button = (label: string) =>
      wrapper.findAll('.engine-btn').find((b) => b.text().startsWith(label))!;

    await button('ElevenLabs').trigger('click');
    expect(store.pipelineMode).toBe('stt-llm-tts');
    expect(store.tts).toMatchObject({
      provider: 'elevenlabs',
      model: 'eleven_flash_v2_5',
      voice: JARVIS_ELEVENLABS_VOICE,
      style: VOICE_PERSONAS[0].style,
    });
    expect(store.realtime).toMatchObject({ provider: 'google', voice: 'Charon' });
    expect(wrapper.findAll('.persona')[0].classes()).toContain('active');
    expect(wrapper.find('.pick').text()).toBe('George');

    // Friday on ElevenLabs speaks with her own voice there.
    const switchTo = wrapper
      .findAll('.persona')[1]
      .findAll('button')
      .find((b) => b.text() === 'Cambiar a Friday');
    await switchTo!.trigger('click');
    expect(store.tts).toMatchObject({ provider: 'elevenlabs', voice: 'cgSgspJ2msm6clMCkdW9' });
    expect(store.realtime.voice).toBe('Aoede');

    // And back on Gemini TTS she keeps her Gemini voice.
    await button('Gemini TTS').trigger('click');
    expect(store.tts).toMatchObject({ provider: 'gemini', voice: 'Aoede' });
  });

  it('puts the character on Cartesia, Deepgram, OpenAI TTS and OpenAI Realtime', async () => {
    const wrapper = mountWithPinia(VoicePersonas, { global: { plugins: [i18n] } });
    const store = useVoiceStore();
    const button = (label: string) =>
      wrapper.findAll('.engine-btn').find((b) => b.text().startsWith(label))!;

    await button('Cartesia').trigger('click');
    expect(store.tts).toMatchObject({
      provider: 'cartesia',
      model: 'sonic-3',
      voice: '13ff5deb-2591-42ad-a356-63a04e524411',
    });
    await button('Deepgram').trigger('click');
    // A Deepgram Aura voice is a model.
    expect(store.tts).toMatchObject({ provider: 'deepgram', model: 'aura-2-nestor-es' });
    await button('OpenAI TTS').trigger('click');
    expect(store.tts).toMatchObject({
      provider: 'openai',
      model: 'tts-1',
      voice: 'onyx',
    });
    expect(wrapper.findAll('.persona')[0].classes()).toContain('active');

    await button('OpenAI Realtime').trigger('click');
    expect(store.pipelineMode).toBe('realtime');
    expect(store.realtime).toMatchObject({
      provider: 'openai',
      model: 'gpt-realtime',
      voice: 'cedar',
      style: VOICE_PERSONAS[0].style,
    });
    // The realtime engines see: the camera toggles show up.
    expect(wrapper.find('.vision').exists()).toBe(true);

    // Back to Gemini Live, the Gemini voice and model come back too.
    await button('Gemini Live').trigger('click');
    expect(store.realtime).toMatchObject({ provider: 'google', voice: 'Charon' });
    expect(store.realtime.model).toContain('live');
  });

  it('picks an ElevenLabs alternative and plays its sample', async () => {
    const play = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal(
      'Audio',
      vi.fn(function (this: Record<string, unknown>, src: string) {
        Object.assign(this, { src, play, pause: vi.fn() });
      }),
    );
    const wrapper = mountWithPinia(VoicePersonas, { global: { plugins: [i18n] } });
    const store = useVoiceStore();
    await wrapper
      .findAll('.engine-btn')
      .find((b) => b.text().startsWith('ElevenLabs'))!
      .trigger('click');
    store.updateTTS({ style: '' });
    store.updateRealtime({ style: '' });
    await wrapper.vm.$nextTick();
    const jarvis = wrapper.findAll('.persona')[0];
    expect(jarvis.findAll('.pick').map((b) => b.text())).toEqual([
      'George ★',
      'Roger',
      'Daniel',
      'Brian',
    ]);
    await jarvis.findAll('.play')[1]!.trigger('click');
    expect(vi.mocked(globalThis.Audio).mock.calls[0][0]).toBe(
      '/voices/jarvis-elevenlabs-roger.wav',
    );
    await jarvis.findAll('.pick')[1]!.trigger('click');
    expect(store.tts.voice).toBe('CwhRBWXzGAHq8TQ4Fs17');
    expect(store.realtime.voice).toBe('Charon');
    vi.unstubAllGlobals();
  });

  it('will not switch to an engine whose key the agent lacks', async () => {
    const wrapper = mountWithPinia(VoicePersonas, { global: { plugins: [i18n] } });
    const store = useVoiceStore();
    store.brainStatus = {
      ...(store.brainStatus ?? {}),
      voiceKeys: { tts: { elevenlabs: false, gemini: true } },
    } as typeof store.brainStatus;
    await wrapper.vm.$nextTick();
    const eleven = wrapper.findAll('.engine-btn').find((b) => b.text().startsWith('ElevenLabs'))!;
    expect(eleven.attributes('disabled')).toBeDefined();
    await eleven.trigger('click');
    expect(store.tts.provider).toBe('gemini');
  });

  it('shows the alternatives only when no voice is on, and picks one with its direction', async () => {
    const wrapper = mountWithPinia(VoicePersonas, { global: { plugins: [i18n] } });
    const store = useVoiceStore();
    // Locked on Jarvis: one voice shown, no alternatives to call.
    expect(
      wrapper
        .findAll('.persona')[0]
        .findAll('.pick')
        .map((b) => b.text()),
    ).toEqual(['Charon']);
    store.updateTTS({ style: '' });
    store.updateRealtime({ style: '' });
    await wrapper.vm.$nextTick();
    const orus = wrapper.findAll('.pick').find((b) => b.text() === 'Orus');
    await orus!.trigger('click');
    expect(store.tts.voice).toBe('Orus');
    expect(store.realtime.voice).toBe('Orus');
    expect(store.tts.style).toBe(VOICE_PERSONAS[0].style);
  });

  it('plays a sample and stops it on a second click', async () => {
    const play = vi.fn().mockResolvedValue(undefined);
    const pause = vi.fn();
    vi.stubGlobal(
      'Audio',
      vi.fn(function (this: Record<string, unknown>, src: string) {
        Object.assign(this, { src, play, pause });
      }),
    );
    const wrapper = mountWithPinia(VoicePersonas, { global: { plugins: [i18n] } });
    const button = wrapper.find('.play');
    await button.trigger('click');
    expect(play).toHaveBeenCalledOnce();
    expect(vi.mocked(globalThis.Audio).mock.calls[0][0]).toBe('/voices/jarvis-charon.wav');
    await button.trigger('click');
    expect(pause).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('the ear a saved kwami loads with', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('moves the old default, Gemini transcribe-live, to the fast Deepgram ear', () => {
    const store = useVoiceStore();
    store.applySnapshot({
      stt: { provider: 'gemini', model: 'gemini-3.5-transcribe-live', language: 'es' },
    });
    expect(store.stt).toMatchObject({ provider: 'deepgram', model: 'nova-3', language: 'es' });
  });

  it('keeps an ear the user picked', () => {
    const store = useVoiceStore();
    store.applySnapshot({
      stt: { provider: 'assemblyai', model: 'universal-streaming-multilingual' },
    });
    expect(store.stt).toMatchObject({ provider: 'assemblyai' });
  });
});
