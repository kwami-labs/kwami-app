/**
 * Adding voices from ElevenLabs' library: offered only to an administrator on the live
 * list, each refusal explained, and a saved voice ready to use straight away.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { mountWithPinia } from '../helpers/mount';
import { i18n, setLocale } from '../../src/i18n';
import ModelVoicePicker from '../../src/components/panels/settings/models/ModelVoicePicker.vue';
import BaseSelect from '../../src/components/ui/BaseSelect.vue';
import { useVoiceStore } from '../../src/stores/voice';
import { ApiError, api } from '../../src/lib/apiClient';
import { useVoicesApi } from '../../src/composables/useVoicesApi';
import type { LibraryCapacity, LibraryVoice } from '../../src/composables/useVoiceLibrary';

enableAutoUnmount(afterEach);

const global = { global: { plugins: [i18n] } };

const voice = (id: string, extra: Partial<LibraryVoice> = {}): LibraryVoice => ({
  id,
  name: id,
  category: null,
  gender: 'female',
  language: 'es',
  description: 'Una voz',
  preview_url: `https://cdn.test/${id}.mp3`,
  owner_id: `owner-${id}`,
  full_name: `${id} - Una voz`,
  in_account: false,
  ...extra,
});

const ROOM: LibraryCapacity = {
  tier: 'creator',
  voice_slots_used: 12,
  voice_limit: 30,
  adds_used: 12,
  adds_limit: 95,
};

function refusal(status: number, code?: string) {
  return new ApiError({
    message: 'refused',
    status,
    code: 'http',
    body: code ? { error: { code } } : undefined,
    method: 'POST',
    url: '/voices/library',
  });
}

interface Setup {
  allowed?: boolean;
  capacity?: LibraryCapacity | null;
  access?: unknown;
  source?: string;
  page?: unknown;
}

async function mounted(
  { allowed = true, capacity = ROOM, access, source = 'live', page }: Setup = {},
  kind: 'tts' | 'realtime' = 'tts',
  provider = 'elevenlabs',
) {
  const get = vi.spyOn(api, 'get').mockImplementation(async (path: string) => {
    if (path === '/voices/library/access') {
      if (access instanceof Error) throw access;
      return access ?? { allowed, capacity };
    }
    if (path === '/voices/library') {
      if (page instanceof Error) throw page;
      return page ?? { voices: [voice('ana')], has_more: false, total: 1 };
    }
    return { provider: 'p', voices: [], source, count: 0 };
  });
  const post = vi.spyOn(api, 'post').mockResolvedValue({ id: 'saved' });
  const wrapper = mountWithPinia(ModelVoicePicker, { ...global, props: { kind } });
  const store = useVoiceStore();
  if (kind === 'tts') store.updateTTS({ provider, model: 'other', voice: '' } as never);
  await flushPromises();
  await wrapper.vm.$nextTick();
  await flushPromises();
  return { wrapper, store, get, post };
}

type Wrapper = Awaited<ReturnType<typeof mounted>>['wrapper'];

async function search(wrapper: Wrapper, text = '') {
  await wrapper.find('.library-search').setValue(text);
  await wrapper.find('.library-search').trigger('keydown.enter');
  await flushPromises();
}

function libraryCalls(get: ReturnType<typeof vi.spyOn>) {
  return get.mock.calls.filter((call) => call[0] === '/voices/library');
}

beforeEach(() => {
  setLocale('es');
  useVoicesApi().clearCache();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('who is offered the library', () => {
  it('an administrator, on the live ElevenLabs list', async () => {
    const { wrapper } = await mounted();
    expect(wrapper.find('.library summary').text()).toContain('biblioteca de ElevenLabs');
  });

  it('nobody else', async () => {
    const { wrapper } = await mounted({ allowed: false });
    expect(wrapper.find('.library').exists()).toBe(false);
  });

  it('nobody when the question fails', async () => {
    const { wrapper } = await mounted({ access: new Error('down') });
    expect(wrapper.find('.library').exists()).toBe(false);
  });

  it('not on the static list, where a saved voice would not show up', async () => {
    const { wrapper, get } = await mounted({ source: 'yaml' });
    expect(wrapper.find('.library').exists()).toBe(false);
    expect(get.mock.calls.some((call) => call[0] === '/voices/library/access')).toBe(false);
  });

  it('not for another provider, and it goes when the provider changes', async () => {
    const { wrapper, store } = await mounted();
    store.updateTTS({ provider: 'rime', model: 'other', voice: '' } as never);
    await flushPromises();
    await wrapper.vm.$nextTick();
    await flushPromises();
    expect(wrapper.find('.library').exists()).toBe(false);
  });
});

describe('how much room the plan has', () => {
  it('shows the slots, and that library voices do not use them', async () => {
    const { wrapper } = await mounted();
    const room = wrapper.find('.library-room').text();
    expect(room).toContain('12 de 30 huecos');
    expect(room).toContain('no los ocupan');
    expect(room).toContain('12 de 95');
    expect(room).not.toContain('seguramente rechazará');
  });

  it('warns when the plan has no additions left', async () => {
    const { wrapper } = await mounted({ capacity: { ...ROOM, adds_used: 95 } });
    expect(wrapper.find('.library-room .warn').text()).toContain('seguramente rechazará');
  });

  it('a plan without that limit shows no figure for it', async () => {
    const { wrapper } = await mounted({ capacity: { ...ROOM, adds_limit: null } });
    const room = wrapper.find('.library-room');
    expect(room.text()).not.toContain('Altas');
    expect(room.find('.warn').exists()).toBe(false);
  });

  it('warns about a free plan', async () => {
    const { wrapper } = await mounted({ capacity: { ...ROOM, tier: 'free' } });
    expect(wrapper.find('.library-room .warn').text()).toContain('plan gratuito');
  });

  it('says nothing when the plan cannot be read', async () => {
    const { wrapper } = await mounted({ capacity: null });
    expect(wrapper.find('.library-room').exists()).toBe(false);
  });
});

describe('searching', () => {
  it('asks only when told, with the filters, and lists what comes back', async () => {
    const { wrapper, get } = await mounted();
    await wrapper.find('.library-search').setValue('  madrid ');
    expect(libraryCalls(get)).toHaveLength(0);
    await wrapper.find('.library-search').trigger('keydown.enter');
    await flushPromises();
    expect(libraryCalls(get)[0][1]).toMatchObject({
      query: { search: 'madrid', language: 'es', gender: undefined, page: 0 },
    });
    expect(wrapper.find('.library-voices').text()).toContain('ana');
    expect(wrapper.find('.library .foot').text()).toContain('1 de 1');
  });

  it('a filter does not search by itself until there has been a search', async () => {
    const { wrapper, get } = await mounted();
    const [languages, genders] = wrapper.find('.library-filters').findAllComponents(BaseSelect);
    languages.vm.$emit('update:modelValue', 'all');
    await flushPromises();
    expect(libraryCalls(get)).toHaveLength(0);

    await search(wrapper);
    genders.vm.$emit('update:modelValue', 'female');
    await flushPromises();
    expect(libraryCalls(get).at(-1)![1]).toMatchObject({
      query: { language: undefined, gender: 'female', page: 0 },
    });
  });

  it('brings more on request, keeping what it had', async () => {
    const { wrapper, get } = await mounted({
      page: { voices: [voice('ana')], has_more: true, total: 2 },
    });
    await search(wrapper);
    get.mockResolvedValueOnce({ voices: [voice('eva')], has_more: false, total: 2 });
    await wrapper.find('.library .foot .link').trigger('click');
    await flushPromises();
    expect(libraryCalls(get).at(-1)![1]).toMatchObject({ query: { page: 1 } });
    expect(wrapper.findAll('.library-voices .row')).toHaveLength(2);
    expect(wrapper.find('.library .foot .link').exists()).toBe(false);
  });

  it('keeps what it had when asking for more fails', async () => {
    const { wrapper, get } = await mounted({
      page: { voices: [voice('ana')], has_more: true, total: 2 },
    });
    await search(wrapper);
    get.mockRejectedValueOnce(new Error('down'));
    await wrapper.find('.library .foot .link').trigger('click');
    await flushPromises();
    expect(wrapper.findAll('.library-voices .row')).toHaveLength(1);
    expect(wrapper.find('.library .foot .link').exists()).toBe(true);
    expect(wrapper.find('.library > .warn').text()).toContain('no ha respondido');
  });

  it('says so when nothing matches', async () => {
    const { wrapper } = await mounted({ page: { voices: [], has_more: false, total: 0 } });
    await search(wrapper, 'nadie');
    expect(wrapper.find('.library').text()).toContain('ninguna voz así');
  });

  it('explains a failed search and empties the list', async () => {
    const { wrapper } = await mounted({ page: refusal(502, 'voice_key_refused') });
    await search(wrapper);
    expect(wrapper.find('.library > .warn').text()).toContain('no tiene permiso');
    expect(wrapper.find('.library-voices').exists()).toBe(false);
  });

  it('an older answer does not overwrite a newer one', async () => {
    const { wrapper, get } = await mounted();
    let answerOld: (value: unknown) => void = () => {};
    get.mockImplementationOnce(() => new Promise((resolve) => (answerOld = resolve)) as never);
    await wrapper.find('.library-search').trigger('keydown.enter');
    get.mockResolvedValueOnce({ voices: [voice('nueva')], has_more: false, total: 1 });
    await wrapper.find('.library-search').trigger('keydown.enter');
    await flushPromises();
    answerOld({ voices: [voice('vieja')], has_more: false, total: 1 });
    await flushPromises();
    expect(wrapper.find('.library-voices').text()).toContain('nueva');
    expect(wrapper.find('.library-voices').text()).not.toContain('vieja');
  });
});

describe('listening before adding', () => {
  it('plays the sample the library publishes, without asking the API', async () => {
    const play = vi.fn().mockResolvedValue(undefined);
    const made: string[] = [];
    vi.stubGlobal(
      'Audio',
      class {
        play = play;
        pause = vi.fn();
        constructor(url: string) {
          made.push(url);
        }
      },
    );
    const { wrapper, get } = await mounted();
    await search(wrapper);
    const asked = get.mock.calls.length;
    await wrapper.find('.library-voices .play').trigger('click');
    await flushPromises();
    expect(made).toEqual(['https://cdn.test/ana.mp3']);
    expect(play).toHaveBeenCalled();
    expect(get.mock.calls.length).toBe(asked);
  });
});

describe('adding', () => {
  const addButton = (wrapper: Wrapper) => wrapper.find('.library-voices .library-action');

  it('saves it under its full name, lists it again and offers to use it', async () => {
    const { wrapper, get, post, store } = await mounted();
    await search(wrapper);
    expect(addButton(wrapper).text()).toBe('Añadir');
    const listed = () =>
      get.mock.calls.filter((c) => String(c[0]).startsWith('/voices/tts')).length;
    const before = listed();
    const access = () => get.mock.calls.filter((c) => c[0] === '/voices/library/access').length;
    const accessBefore = access();

    await addButton(wrapper).trigger('click');
    await flushPromises();

    expect(post).toHaveBeenCalledWith(
      '/voices/library/owner-ana/ana',
      { name: 'ana - Una voz' },
      { retry: false },
    );
    expect(listed()).toBeGreaterThan(before);
    expect(access()).toBe(accessBefore + 1);
    expect(wrapper.find('.library-voices').text()).toContain('En la cuenta');
    expect(addButton(wrapper).text()).toBe('Usar');

    await addButton(wrapper).trigger('click');
    expect(store.tts.voice).toBe('saved');
  });

  it('never offers to add a voice already in the account', async () => {
    const { wrapper, post } = await mounted({
      page: { voices: [voice('ana', { in_account: true })], has_more: false, total: 1 },
    });
    await search(wrapper);
    expect(addButton(wrapper).text()).toBe('Usar');
    await addButton(wrapper).trigger('click');
    expect(post).not.toHaveBeenCalled();
  });

  it.each([
    [409, 'voice_no_room', 'no tiene sitio para otra voz'],
    [409, 'voice_free_plan', 'plan gratuito'],
    [404, 'voice_withdrawn', 'ya no está en la biblioteca'],
    [502, 'voice_key_refused', 'no tiene permiso'],
    [503, 'voice_library_no_key', 'no tiene clave'],
    [429, undefined, 'Demasiadas seguidas'],
    [502, 'voice_library_failed', 'no ha respondido'],
    [500, undefined, 'no ha respondido'],
  ])('explains a refusal: %s %s', async (status, code, text) => {
    const { wrapper, post } = await mounted();
    await search(wrapper);
    post.mockRejectedValueOnce(refusal(status, code));
    await addButton(wrapper).trigger('click');
    await flushPromises();
    expect(wrapper.find('.library-voices .problem').text()).toContain(text);
    expect(addButton(wrapper).text()).toBe('Añadir');
  });

  it('explains a failure that is not the API answering', async () => {
    const { wrapper, post } = await mounted();
    await search(wrapper);
    post.mockRejectedValueOnce(new Error('down'));
    await addButton(wrapper).trigger('click');
    await flushPromises();
    expect(wrapper.find('.library-voices .problem').text()).toContain('no ha respondido');
  });
});
