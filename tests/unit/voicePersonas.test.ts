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
import { mountWithPinia } from '../helpers/mount';
import { i18n, setLocale } from '../../src/i18n';
import VoicePersonas from '../../src/components/panels/settings/voice/VoicePersonas.vue';
import { useVoiceStore } from '../../src/stores/voice';
import {
  VOICE_PERSONAS,
  activePersona,
  catalogProvider,
  liveSampleUrl,
  sampleUrl,
  upgradeStyle,
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
    }
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

  it('switches engine keeping the character, and back to an all-Gemini pipeline', async () => {
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
    expect(store.stt.provider).toBe('gemini');
    expect(store.llm).toMatchObject({ provider: 'google', model: 'gemini-3.5-flash' });
    expect(store.tts).toMatchObject({ provider: 'gemini', voice: 'Charon' });
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
