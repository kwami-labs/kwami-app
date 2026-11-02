/**
 * Choosing a voice per voice model: only what the model can speak with, every voice
 * findable, what the choice changes, and that each model keeps its own.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { mountWithPinia } from '../helpers/mount';
import { i18n, setLocale } from '../../src/i18n';
import ModelVoicePicker from '../../src/components/panels/settings/models/ModelVoicePicker.vue';
import { useVoiceStore } from '../../src/stores/voice';
import { ApiError, api } from '../../src/lib/apiClient';
import { useVoicesApi } from '../../src/composables/useVoicesApi';
import {
  canHear,
  favoriteKey,
  inPickingOrder,
  languagesOf,
  matchesLanguage,
  matchesSearch,
  modelVoiceKey,
  sameTtsModel,
  ttsVoicePatch,
  voiceAfterModelChange,
  voicesForModel,
  withCharacterVoices,
} from '../../src/lib/voiceChoice';
import type { Voice } from '../../src/composables/useVoicesApi';

enableAutoUnmount(afterEach);

const global = { global: { plugins: [i18n] } };
const v = (id: string, extra: Partial<Voice> = {}): Voice => ({
  id,
  name: id,
  category: null,
  gender: null,
  language: null,
  description: null,
  ...extra,
});

beforeEach(() => {
  setLocale('es');
  useVoicesApi().clearCache();
});
afterEach(() => vi.restoreAllMocks());

describe('which voices fit a model', () => {
  const openai = ['alloy', 'nova', 'marin', 'cedar', 'ballad', 'verse'].map((id) => v(id));

  it('keeps the newest OpenAI voices off tts-1', () => {
    const ids = (model: string) => voicesForModel('openai', model, openai).map((x) => x.id);
    expect(ids('tts-1')).toEqual(['alloy', 'nova']);
    expect(ids('openai/tts-1-hd')).toEqual(['alloy', 'nova']);
    expect(ids('gpt-4o-mini-tts')).toHaveLength(6);
  });

  it('splits Deepgram by family, a voice-as-model counting as its family', () => {
    const list = [v('asteria'), v('aura-2-nestor-es')];
    const ids = (model: string) => voicesForModel('deepgram', model, list).map((x) => x.id);
    expect(ids('aura-1')).toEqual(['asteria']);
    expect(ids('deepgram/aura-2')).toEqual(['aura-2-nestor-es']);
    expect(ids('aura-2-carina-es')).toEqual(['aura-2-nestor-es']);
  });

  it('gives Rime the model own voices, or all when it has no list for it', () => {
    const list = [v('luna', { category: 'arcana' }), v('abbie', { category: 'mistv2' })];
    expect(voicesForModel('rime', 'rime/arcana', list).map((x) => x.id)).toEqual(['luna']);
    expect(voicesForModel('rime', 'other', list)).toHaveLength(2);
  });

  it('leaves the rest alone', () => {
    expect(voicesForModel('cartesia', 'sonic-3', [v('a')])).toHaveLength(1);
  });
});

describe('the characters among the voices', () => {
  it('puts them first, with the suggested one marked', () => {
    const list = withCharacterVoices('tts', 'openai', [v('alloy'), v('onyx'), v('nova')], false);
    expect(list[0].character).toBe('Jarvis');
    expect(list[0].suggested).toBe(true);
    expect(list.at(-1)!.character).toBeUndefined();
    expect(new Set(list.map((x) => x.id)).size).toBe(list.length);
  });

  it('adds a designed voice to a static list', () => {
    const list = withCharacterVoices('tts', 'elevenlabs', [v('x')], false);
    expect(list.some((x) => x.name === 'Británico')).toBe(true);
    expect(list.find((x) => x.name === 'Británico')!.preview_url).toContain('/voices/jarvis-');
  });

  it('does not offer a designed voice the account does not have', () => {
    const list = withCharacterVoices('tts', 'elevenlabs', [v('x')], true);
    expect(list.some((x) => x.name === 'Británico')).toBe(false);
    expect(list.map((x) => x.id)).toEqual(['x']);
  });

  it('keeps the catalogue data when it lists the voice', () => {
    const list = withCharacterVoices(
      'tts',
      'elevenlabs',
      [v('WHOJDqzCafRk2dAUIxxB', { name: 'De la cuenta', preview_url: 'https://x/a.mp3' })],
      true,
    );
    expect(list[0]).toMatchObject({
      name: 'De la cuenta',
      preview_url: 'https://x/a.mp3',
      character: 'Jarvis',
    });
  });

  it('knows no characters on a provider with no engine', () => {
    expect(withCharacterVoices('tts', 'rime', [v('luna')], false)).toEqual([v('luna')]);
  });

  it('has them on both kinds of realtime model', () => {
    expect(withCharacterVoices('realtime', 'google', [], false)[0].id).toBe('Charon');
    expect(withCharacterVoices('realtime', 'openai', [], false).length).toBeGreaterThan(0);
  });
});

describe('finding a voice', () => {
  it('takes every region of a language, and untagged voices', () => {
    expect(matchesLanguage(v('a', { language: 'es-ES' }), 'es')).toBe(true);
    expect(matchesLanguage(v('a', { language: 'es-MX' }), 'es-ES')).toBe(false);
    expect(matchesLanguage(v('a', { language: 'multilingual' }), 'es')).toBe(true);
    expect(matchesLanguage(v('a'), 'es')).toBe(true);
    expect(matchesLanguage(v('a', { language: 'en' }), 'es')).toBe(false);
  });

  it('ignores accents and looks in the description', () => {
    expect(matchesSearch(v('x', { name: 'Álvaro' }), 'alvaro')).toBe(true);
    expect(matchesSearch(v('x', { description: 'Peninsular: calm' }), 'peninsular')).toBe(true);
    expect(matchesSearch(v('x'), 'zzz')).toBe(false);
    expect(matchesSearch(v('x'), '  ')).toBe(true);
  });

  it('lists a language before its regions', () => {
    expect(
      languagesOf([v('a', { language: 'es-MX' }), v('b', { language: 'multilingual' }), v('c')]),
    ).toEqual(['es', 'es-MX']);
  });
});

describe('what a choice changes', () => {
  it('moves Deepgram to the voice, and back to Aura 1 for its voices', () => {
    expect(ttsVoicePatch('deepgram', 'aura-2', 'aura-2-nestor-es')).toEqual({
      model: 'aura-2-nestor-es',
      voice: 'aura-2-nestor-es',
    });
    expect(ttsVoicePatch('deepgram', 'aura-2-nestor-es', 'asteria')).toEqual({
      model: 'aura-1',
      voice: 'asteria',
    });
    expect(ttsVoicePatch('deepgram', 'aura-1', 'asteria').model).toBe('aura-1');
    expect(ttsVoicePatch('cartesia', 'sonic-3', 'x').model).toBe('sonic-3');
  });

  it('still marks the Deepgram card when the model is one of its voices', () => {
    expect(sameTtsModel('deepgram', 'aura-2-nestor-es', 'deepgram/aura-2')).toBe(true);
    expect(sameTtsModel('deepgram', 'aura-2-nestor-es', 'deepgram/aura-1')).toBe(false);
    expect(sameTtsModel('openai', 'tts-1', 'openai/tts-1')).toBe(true);
    expect(sameTtsModel('openai', 'tts-1', 'tts-1-hd')).toBe(false);
  });

  it('gives a model the voice chosen for it before', () => {
    const remembered = { [modelVoiceKey('tts', 'openai', 'tts-1')]: 'onyx' };
    const current = { provider: 'cartesia', voice: 'uuid' };
    expect(voiceAfterModelChange(current, 'openai', 'openai/tts-1', remembered).voice).toBe('onyx');
  });

  it('keeps the voice on the same provider only if the new model takes it', () => {
    const current = { provider: 'openai', voice: 'marin' };
    expect(voiceAfterModelChange(current, 'openai', 'gpt-4o-mini-tts', {}).voice).toBe('marin');
    expect(voiceAfterModelChange(current, 'openai', 'tts-1', {}).voice).not.toBe('marin');
  });

  it('never carries a voice to another provider', () => {
    const current = { provider: 'openai', voice: 'onyx' };
    const next = voiceAfterModelChange(current, 'elevenlabs', 'eleven_flash_v2_5', {});
    expect(next.voice).toBe('WHOJDqzCafRk2dAUIxxB');
    expect(voiceAfterModelChange(current, 'rime', 'arcana', {}).voice).toBe('');
  });

  it('keeps one memory per Deepgram family', () => {
    expect(modelVoiceKey('tts', 'deepgram', 'aura-2-nestor-es')).toBe('tts:deepgram:aura-2');
    expect(modelVoiceKey('realtime', 'google', 'x')).toBe('realtime:google:x');
  });
});

describe('the picker', () => {
  const catalog = (voices: Voice[], source = 'yaml') =>
    vi.spyOn(api, 'get').mockResolvedValue({ provider: 'p', voices, source, count: voices.length });

  async function mounted(
    kind: 'tts' | 'realtime',
    set?: (s: ReturnType<typeof useVoiceStore>) => void,
  ) {
    const wrapper = mountWithPinia(ModelVoicePicker, { ...global, props: { kind } });
    const store = useVoiceStore();
    set?.(store);
    await flushPromises();
    await wrapper.vm.$nextTick();
    return { wrapper, store };
  }
  const onRime = (s: ReturnType<typeof useVoiceStore>) =>
    s.updateTTS({ provider: 'rime', model: 'other', voice: 'b' } as never);

  it('lists the voices of the provider and marks the one in use', async () => {
    catalog([v('a', { name: 'Ana' }), v('b', { name: 'Berta' })]);
    const { wrapper } = await mounted('tts', onRime);
    expect(wrapper.text()).toContain('En uso: Berta');
    const chosen = wrapper.findAll('.voice').filter((x) => x.classes('chosen'));
    expect(chosen.map((x) => x.text())).toEqual(['Berta']);
  });

  it('stores a choice for this model', async () => {
    catalog([v('a', { name: 'Ana' })]);
    const { wrapper, store } = await mounted('tts', onRime);
    await wrapper
      .findAll('.voice')
      .find((x) => x.text().includes('Ana'))!
      .trigger('click');
    expect(store.tts.voice).toBe('a');
    expect(store.modelsUI.voiceByModel['tts:rime:other']).toBe('a');
  });

  it('shows a long list by pages', async () => {
    catalog(Array.from({ length: 95 }, (_, i) => v(`id${i}`)));
    const { wrapper } = await mounted('tts', onRime);
    expect(wrapper.findAll('.voice')).toHaveLength(40);
    expect(wrapper.text()).toContain('40 de 95 voces');
    await wrapper
      .findAll('.link')
      .find((l) => l.text() === 'Ver más')!
      .trigger('click');
    expect(wrapper.findAll('.voice')).toHaveLength(80);
  });

  it('filters by gender and search, and can clear them', async () => {
    catalog([v('a', { name: 'Ana', gender: 'female' }), v('b', { name: 'Bruno', gender: 'male' })]);
    const { wrapper } = await mounted('tts', onRime);
    await wrapper
      .findAll('.segment')
      .find((s) => s.text() === 'Masculinas')!
      .trigger('click');
    expect(wrapper.findAll('.voice').map((x) => x.text())).toEqual([
      expect.stringContaining('Bruno'),
    ]);
    await wrapper.find('input[type="search"]').setValue('nadie');
    expect(wrapper.text()).toContain('Ninguna voz coincide');
    await wrapper
      .findAll('.link')
      .find((l) => l.text() === 'Quitar filtros')!
      .trigger('click');
    expect(wrapper.findAll('.voice')).toHaveLength(2);
  });

  it('starts on the language of the call where the provider has it', async () => {
    catalog([v('a', { language: 'es-ES' }), v('b', { language: 'en' })]);
    const { wrapper } = await mounted('tts', (s) => {
      onRime(s);
      s.updateSTT({ language: 'es' } as never);
    });
    expect(wrapper.findAll('.voice')).toHaveLength(1);
  });

  it('does not filter by language where voices speak them all', async () => {
    catalog([v('a', { language: 'en' })]);
    const { wrapper } = await mounted('tts', (s) => {
      s.updateTTS({ provider: 'openai', model: 'tts-1', voice: 'a' } as never);
      s.updateSTT({ language: 'es' } as never);
    });
    expect(wrapper.text()).toContain('hablan cualquier idioma');
    expect(wrapper.findAll('.voice').length).toBeGreaterThan(0);
  });

  it('takes any voice by its id', async () => {
    catalog([]);
    const { wrapper, store } = await mounted('tts', onRime);
    expect(wrapper.text()).toContain('no publica una lista');
    await wrapper.find('.custom input').setValue(' mi-voz ');
    await wrapper.find('.custom input').trigger('keydown.enter');
    expect(store.tts.voice).toBe('mi-voz');
  });

  it('chooses a realtime voice on the realtime model', async () => {
    catalog([v('Charon'), v('Puck', { name: 'Puck' })]);
    const { wrapper, store } = await mounted('realtime');
    await wrapper
      .findAll('.voice')
      .find((x) => x.text().includes('Puck'))!
      .trigger('click');
    expect(store.realtime.voice).toBe('Puck');
    expect(Object.keys(store.modelsUI.voiceByModel)[0]).toMatch(/^realtime:/);
  });

  it('lets a character voice be left for any other', async () => {
    catalog([v('a', { name: 'Ana' })]);
    const { wrapper, store } = await mounted('tts', (s) => {
      onRime(s);
      s.updateTTS({ style: 'Habla como alguien' } as never);
    });
    await wrapper
      .findAll('.voice')
      .find((x) => x.text().includes('Ana'))!
      .trigger('click');
    expect(store.tts.voice).toBe('a');
    expect(store.tts.style).toBe('Habla como alguien');
  });
});

describe('hearing a voice before choosing it', () => {
  const mounted = async (voices: Voice[], provider = 'rime') => {
    vi.spyOn(api, 'get').mockResolvedValue({
      provider: 'p',
      voices,
      source: 'yaml',
      count: voices.length,
    });
    const wrapper = mountWithPinia(ModelVoicePicker, { ...global, props: { kind: 'tts' } });
    const store = useVoiceStore();
    store.updateTTS({ provider, model: 'other', voice: '' } as never);
    await flushPromises();
    await wrapper.vm.$nextTick();
    await flushPromises();
    return { wrapper, store };
  };

  it('every voice of a provider the API can speak, and those with a sample of their own', () => {
    expect(canHear('cartesia', v('a'))).toBe(true);
    expect(canHear('openai', v('a'))).toBe(true);
    expect(canHear('deepgram', v('a', { preview_url: 'https://x/a.wav' }))).toBe(true);
    expect(canHear('google', v('a'))).toBe(false);
  });

  it('asks the API for a sample, once, in the language of the panel', async () => {
    const created = vi.fn(() => 'blob:sample');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: created }));
    const play = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal(
      'Audio',
      class {
        play = play;
        pause = vi.fn();
      },
    );
    const { wrapper } = await mounted([v('once-only', { name: 'Ana' })]);
    const get = vi.mocked(api.get);
    get.mockResolvedValue(new Blob(['x']));
    await wrapper.find('.play').trigger('click');
    await flushPromises();
    expect(get).toHaveBeenCalledWith(
      '/voices/preview',
      expect.objectContaining({
        query: { provider: 'rime', voice: 'once-only', lang: 'es' },
        parse: 'blob',
      }),
    );
    expect(play).toHaveBeenCalledTimes(1);
    get.mockClear();
    await wrapper.find('.play').trigger('click'); // stops it
    await wrapper.find('.play').trigger('click'); // plays it again
    await flushPromises();
    expect(get).not.toHaveBeenCalled();
    expect(created).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('says why when there is no sample', async () => {
    const { wrapper } = await mounted([v('no-key', { name: 'Ana' })]);
    vi.mocked(api.get).mockRejectedValue(
      new ApiError({
        status: 503,
        code: 'unavailable',
        message: 'x',
        method: 'GET',
        url: '/',
      } as never),
    );
    await wrapper.find('.play').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('conecta una clave');
    vi.mocked(api.get).mockRejectedValue(new Error('down'));
    await wrapper.find('.play').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('no se ha podido crear');
  });

  it('a voice with its own sample does not touch the API', async () => {
    const play = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal(
      'Audio',
      class {
        play = play;
        pause = vi.fn();
      },
    );
    const { wrapper } = await mounted([v('a', { preview_url: 'https://x/a.wav' })], 'deepgram');
    const get = vi.mocked(api.get);
    get.mockClear();
    await wrapper.find('.play').trigger('click');
    await flushPromises();
    expect(get).not.toHaveBeenCalled();
    expect(play).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('finding a voice again', () => {
  it('the one in use first, then the kept ones, the rest as they came', () => {
    const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    const order = inPickingOrder(list, 'c', (id) => id === 'd');
    expect(order.map((x) => x.id)).toEqual(['c', 'd', 'a', 'b']);
  });

  it('keeps a voice per provider, and lists only the kept ones when asked', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      provider: 'p',
      voices: [v('a', { name: 'Ana' }), v('b', { name: 'Berta' })],
      source: 'yaml',
      count: 2,
    });
    const wrapper = mountWithPinia(ModelVoicePicker, { ...global, props: { kind: 'tts' } });
    const store = useVoiceStore();
    store.updateTTS({ provider: 'rime', model: 'other', voice: '' } as never);
    await flushPromises();
    await wrapper.vm.$nextTick();
    await flushPromises();
    await wrapper.findAll('.star')[1].trigger('click');
    expect(store.modelsUI.favoriteVoices).toEqual([favoriteKey('rime', 'b')]);
    const saved = wrapper.findAll('.segment').find((x) => x.text() === 'Guardadas')!;
    await saved.trigger('click');
    expect(wrapper.findAll('.voice .name').map((x) => x.text())).toEqual(['Berta']);
    await wrapper.find('.star').trigger('click');
    expect(store.modelsUI.favoriteVoices).toEqual([]);
  });

  it('offers to try again when the list did not come', async () => {
    useVoicesApi().clearCache();
    const get = vi.spyOn(api, 'get').mockRejectedValue(new Error('down'));
    const wrapper = mountWithPinia(ModelVoicePicker, { ...global, props: { kind: 'tts' } });
    await flushPromises();
    expect(wrapper.text()).toContain('Reintentar');
    get.mockResolvedValue({
      provider: 'p',
      voices: [v('a', { name: 'Ana' })],
      source: 'yaml',
      count: 1,
    });
    await wrapper.find('.link').trigger('click');
    await flushPromises();
    expect(wrapper.text()).not.toContain('Reintentar');
  });
});
