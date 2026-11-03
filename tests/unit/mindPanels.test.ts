/**
 * The mind: several jobs per model, a brief for each, the Claude account, the
 * connected accounts, and who thinks on a call.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { mountWithPinia } from '../helpers/mount';
import { i18n, setLocale } from '../../src/i18n';
import BrainModelCard from '../../src/components/panels/settings/models/BrainModelCard.vue';
import ClaudeAccountCard from '../../src/components/panels/settings/models/ClaudeAccountCard.vue';
import MindDirector from '../../src/components/panels/settings/models/MindDirector.vue';
import ModelConnections from '../../src/components/panels/settings/models/ModelConnections.vue';
import VoiceThinking from '../../src/components/panels/settings/voice/VoiceThinking.vue';
import { useVoiceStore } from '../../src/stores/voice';
import { useAuthStore } from '../../src/stores/auth';
import { useProviderConnections } from '../../src/composables/useProviderConnections';
import {
  PROVIDER_ROLES,
  modelUsable,
  normalizeBrain,
  parseBrainStatus,
  roleFor,
  rosterModel,
  type BrainStatus,
} from '../../src/lib/brain';
import { ApiError, api } from '../../src/lib/apiClient';

enableAutoUnmount(afterEach);

const global = { global: { plugins: [i18n] } };

beforeEach(() => setLocale('es'));
afterEach(() => vi.restoreAllMocks());

function raw(extra: Record<string, unknown> = {}) {
  return {
    type: 'brain_status',
    providers: { anthropic: true, openai: false },
    apiKeys: { anthropic: false, openai: false },
    account: { pcOnline: true, loggedIn: true },
    voiceProviders: { llm: { anthropic: true } },
    spend: {},
    tasks: [],
    ...extra,
  };
}
const status = (extra: Record<string, unknown> = {}) => parseBrainStatus(raw(extra)) as BrainStatus;

describe('the model of the brain', () => {
  it('reads an old save with one role, and drops jobs the provider cannot do', () => {
    const brain = normalizeBrain({
      models: [
        { provider: 'openai', model: 'gpt-5.2', role: 'expert' },
        { provider: 'groq', model: 'l', role: 'search' },
        { provider: 'xai', model: 'g', role: 'search', roles: ['x_search', 'code', 3] },
        { provider: 'mistral', model: 'none' },
      ],
    });
    expect(brain.models.map((m) => m.roles)).toEqual([
      ['expert'],
      ['fast'],
      ['x_search', 'search'],
    ]);
    expect(brain.models[0]).toMatchObject({ access: 'auto', instructions: '' });
    expect(brain.relay).toBe('everything');
  });

  it('caps a brief, and keeps a chosen director and relay', () => {
    const brain = normalizeBrain({
      director: 'x',
      relay: 'work_only',
      instructions: 'a'.repeat(3000),
      models: [],
    });
    expect(brain).toMatchObject({ director: 'x', relay: 'work_only' });
    expect(brain.instructions).toHaveLength(2000);
  });

  it('only Grok has X, and X goes to it whatever the difficulty', () => {
    const withX = Object.entries(PROVIDER_ROLES).filter(([, r]) => r.includes('x_search'));
    expect(withX.map(([p]) => p)).toEqual(['xai']);
    expect(roleFor('x_search', 'hard')).toBe('x_search');
  });

  it.each([
    ['auto', true],
    ['account', true],
    ['api', false],
  ] as const)('Claude on %s with the account and no key: usable %s', (access, expected) => {
    const model = rosterModel('c', 'C', 'anthropic', 'm', 'fast', { access });
    expect(modelUsable(model, status())).toBe(expected);
  });

  it('account only stops when the PC is gone, even with a key', () => {
    const off = status({
      apiKeys: { anthropic: true },
      account: { pcOnline: false, loggedIn: false },
    });
    expect(
      modelUsable(rosterModel('c', 'C', 'anthropic', 'm', 'fast', { access: 'account' }), off),
    ).toBe(false);
    expect(modelUsable(rosterModel('c', 'C', 'anthropic', 'm', 'fast'), off)).toBe(true);
  });

  it('an older agent that reports no account is judged by its providers', () => {
    const old = parseBrainStatus({
      type: 'brain_status',
      providers: { anthropic: false },
    }) as BrainStatus;
    expect(modelUsable(rosterModel('c', 'C', 'anthropic', 'm', 'fast'), old)).toBe(false);
    expect(old.account).toBeUndefined();
  });
});

describe('the card of one model', () => {
  const opus = rosterModel('o', 'Opus', 'anthropic', 'claude-opus-5-5', 'expert');

  it('offers only what its provider has', async () => {
    const claude = mountWithPinia(BrainModelCard, {
      ...global,
      props: { model: opus, first: false },
    });
    expect(claude.text()).toContain('Primero la cuenta');
    expect(claude.text()).toContain('Buscar en la web');
    expect(claude.text()).not.toContain('Buscar en X');

    const grok = mountWithPinia(BrainModelCard, {
      ...global,
      props: { model: rosterModel('g', 'Grok', 'xai', 'grok-4.7', 'x_search'), first: false },
    });
    expect(grok.text()).toContain('Buscar en X');
    expect(grok.text()).not.toContain('Primero la cuenta');

    const groq = mountWithPinia(BrainModelCard, {
      ...global,
      props: { model: rosterModel('l', 'L', 'groq', 'l', 'fast'), first: false },
    });
    expect(groq.text()).not.toContain('Buscar en la web');
  });

  it('adds and removes jobs, but never the last one', async () => {
    const wrapper = mountWithPinia(BrainModelCard, {
      ...global,
      props: { model: opus, first: false },
    });
    const chip = (text: string) => wrapper.findAll('.chip').find((c) => c.text() === text)!;
    await chip('Normal').trigger('click');
    expect(wrapper.emitted('change')!.at(-1)![0]).toEqual({
      roles: ['expert', 'standard'],
      role: 'expert',
    });
    const before = wrapper.emitted('change')!.length;
    await chip('Experto').trigger('click');
    expect(wrapper.emitted('change')!.length).toBe(before);
  });

  it('sets the way to reach it and its brief', async () => {
    const wrapper = mountWithPinia(BrainModelCard, {
      ...global,
      props: { model: opus, first: false },
    });
    await wrapper
      .findAll('.segment')
      .find((s) => s.text() === 'Solo API')!
      .trigger('click');
    expect(wrapper.emitted('change')!.at(-1)![0]).toEqual({ access: 'api' });
    await wrapper.find('textarea').setValue('Sé escéptico');
    expect(wrapper.emitted('change')!.at(-1)![0]).toEqual({ instructions: 'Sé escéptico' });
  });

  it('switched off it shows nothing to set, and says what a model on is missing', async () => {
    const off = mountWithPinia(BrainModelCard, {
      ...global,
      props: { model: { ...opus, enabled: false }, first: false },
    });
    expect(off.find('.chips').exists()).toBe(false);

    const wrapper = mountWithPinia(BrainModelCard, {
      ...global,
      props: { model: { ...opus, access: 'api' }, first: false },
    });
    useVoiceStore().applyBrainStatus(raw());
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('necesita ANTHROPIC_API_KEY');
  });
});

describe('the Claude account card', () => {
  it.each([
    [{ account: { pcOnline: true, loggedIn: true } }, 'Conectada', false],
    [{ account: { pcOnline: true, loggedIn: false } }, 'no tiene sesión', true],
    [{ account: { pcOnline: false, loggedIn: false } }, 'no está conectado', true],
  ])('%o says %s', async (extra, text, shows) => {
    const wrapper = mountWithPinia(ClaudeAccountCard, global);
    useVoiceStore().applyBrainStatus(raw(extra));
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain(text);
    expect(wrapper.text().includes('--login')).toBe(shows);
  });

  it('never asks for anything to be typed', () => {
    const wrapper = mountWithPinia(ClaudeAccountCard, global);
    expect(wrapper.find('input').exists()).toBe(false);
    expect(wrapper.find('textarea').exists()).toBe(false);
  });

  it('copies the commands with the user in them', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    const wrapper = mountWithPinia(ClaudeAccountCard, global);
    const auth = useAuthStore();
    Object.defineProperty(auth, 'userId', { value: 'u-1', configurable: true });
    await wrapper.findAll('.command')[0].trigger('click');
    expect(writeText).toHaveBeenCalledWith('scripts\\brain-worker.cmd --login');
    await flushPromises();
    expect(wrapper.text()).toContain('Copiado');
    vi.unstubAllGlobals();
  });
});

describe('the director', () => {
  it('lists the models that think, and falls back when the chosen one is gone', async () => {
    const wrapper = mountWithPinia(MindDirector, global);
    const store = useVoiceStore();
    expect(wrapper.text()).toContain('Automático (Claude Sonnet 5.5)');
    store.brain = { ...store.brain, director: 'gone' };
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('Automático');
    await wrapper.find('textarea').setValue('Siempre en euros');
    expect(store.brain.instructions).toBe('Siempre en euros');
  });
});

describe('the connected accounts', () => {
  function mountSignedIn() {
    const wrapper = mountWithPinia(ModelConnections, global);
    return wrapper;
  }

  beforeEach(() => {
    vi.spyOn(api, 'get').mockResolvedValue({
      enabled: true,
      providers: [],
      connected: { xai: { hint: '7890' } },
    });
  });

  async function ready() {
    const wrapper = mountSignedIn();
    const auth = useAuthStore();
    Object.defineProperty(auth, 'userId', { value: 'u-1', configurable: true });
    const { useProviderConnections } = await import('../../src/composables/useProviderConnections');
    await useProviderConnections().refresh();
    await flushPromises();
    return wrapper;
  }

  const row = (wrapper: ReturnType<typeof mountSignedIn>, name: string) =>
    wrapper.findAll('.provider').find((p) => p.text().includes(name))!;

  it('shows how each provider is reached, and only the end of a key', async () => {
    const wrapper = await ready();
    useVoiceStore().applyBrainStatus(
      raw({ apiKeys: { google: true }, providers: { google: true } }),
    );
    await flushPromises();
    expect(row(wrapper, 'xAI').text()).toContain('tu clave ···7890');
    expect(row(wrapper, 'Google').text()).toContain('clave del servidor');
    expect(row(wrapper, 'Anthropic').text()).toContain('tu cuenta');
    expect(row(wrapper, 'Groq').text()).toContain('sin conectar');
  });

  it('checks a key, and offers its models once connected', async () => {
    const put = vi.spyOn(api, 'put').mockResolvedValue({ hint: '1234' });
    const wrapper = await ready();
    const groq = row(wrapper, 'Groq');
    await groq
      .findAll('.link')
      .find((l) => l.text() === 'Conectar')!
      .trigger('click');
    const input = row(wrapper, 'Groq').find('input');
    expect(input.attributes('type')).toBe('password');
    await input.setValue('gsk_secret');
    await row(wrapper, 'Groq')
      .findAll('button')
      .find((b) => b.text().includes('Comprobar'))!
      .trigger('click');
    await flushPromises();
    expect(put).toHaveBeenCalledWith('/providers/groq/key', { key: 'gsk_secret' });
    expect(wrapper.emitted('add')![0]).toEqual(['groq']);
  });

  it('says when a key is refused, and clears it', async () => {
    vi.spyOn(api, 'put').mockRejectedValue(
      Object.assign(Object.create(ApiError.prototype), { status: 400 }),
    );
    const wrapper = await ready();
    await row(wrapper, 'Groq')
      .findAll('.link')
      .find((l) => l.text() === 'Conectar')!
      .trigger('click');
    const input = row(wrapper, 'Groq').find('input');
    await input.setValue('bad-key-value');
    await row(wrapper, 'Groq')
      .findAll('button')
      .find((b) => b.text().includes('Comprobar'))!
      .trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('rechazado');
    expect((row(wrapper, 'Groq').find('input').element as HTMLInputElement).value).toBe('');
    expect(wrapper.emitted('add')).toBeUndefined();
  });

  it('disconnects through the API, and the provider is free again', async () => {
    const del = vi.spyOn(api, 'del').mockResolvedValue({ ok: true });
    const wrapper = await ready();
    vi.spyOn(api, 'get').mockResolvedValue({ enabled: true, providers: [], connected: {} });
    await row(wrapper, 'xAI')
      .findAll('.link')
      .find((l) => l.text() === 'Desconectar')!
      .trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();
    expect(del).toHaveBeenCalledWith('/providers/xai');
    expect(row(wrapper, 'xAI').text()).toContain('sin conectar');
  });

  it('says so when the server cannot be reached', async () => {
    vi.spyOn(api, 'get').mockRejectedValue(new Error('down'));
    const wrapper = mountWithPinia(ModelConnections, {
      ...global,
      initialState: { auth: { user: { id: 'u-1' } } },
    });
    await flushPromises();
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('El servidor no responde');
  });

  it('says so when a button fails, instead of failing in silence', async () => {
    vi.spyOn(api, 'post').mockRejectedValue(new Error('503'));
    const wrapper = await ready();
    await row(wrapper, 'OpenRouter')
      .findAll('.link')
      .find((l) => l.text() === 'Conectar')!
      .trigger('click');
    await row(wrapper, 'OpenRouter')
      .findAll('button')
      .find((b) => b.text().includes('Entrar'))!
      .trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('No se ha podido guardar');
  });

  it('OpenRouter signs in on its own site, with nothing to paste', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ url: 'https://openrouter.ai/auth?x' });
    const opened = vi.spyOn(window, 'open').mockReturnValue(null);
    const wrapper = await ready();
    await row(wrapper, 'OpenRouter')
      .findAll('.link')
      .find((l) => l.text() === 'Conectar')!
      .trigger('click');
    expect(row(wrapper, 'OpenRouter').find('input').exists()).toBe(false);
    await row(wrapper, 'OpenRouter')
      .findAll('button')
      .find((b) => b.text().includes('Entrar'))!
      .trigger('click');
    await flushPromises();
    expect(post).toHaveBeenCalledWith('/providers/openrouter/connect');
    expect(opened).toHaveBeenCalledWith('https://openrouter.ai/auth?x', '_blank', 'noopener');
  });

  it('a key is never kept in the store that is saved and sent', async () => {
    vi.spyOn(api, 'put').mockResolvedValue({ hint: '1234' });
    const wrapper = await ready();
    await row(wrapper, 'Groq')
      .findAll('.link')
      .find((l) => l.text() === 'Conectar')!
      .trigger('click');
    await row(wrapper, 'Groq').find('input').setValue('gsk_secret');
    expect(JSON.stringify(useVoiceStore().brain)).not.toContain('gsk_secret');
  });
});

describe('who thinks on a call', () => {
  const mode = (wrapper: ReturnType<typeof mountWithPinia>, text: string) =>
    wrapper.findAll('.mode').find((m) => m.text().includes(text))!;

  it('starts with Claude thinking and the voice repeating', () => {
    const wrapper = mountWithPinia(VoiceThinking, global);
    expect(mode(wrapper, 'la voz repite').attributes('aria-checked')).toBe('true');
    expect(wrapper.text()).toContain('Claude Sonnet 5.5');
  });

  it('Claude answering directly moves the call to Claude on the standard pipeline', async () => {
    const wrapper = mountWithPinia(VoiceThinking, global);
    const store = useVoiceStore();
    await mode(wrapper, 'responde directamente').trigger('click');
    expect(store.brain.relay).toBe('work_only');
    expect(store.pipelineMode).toBe('stt-llm-tts');
    expect(store.llm).toMatchObject({ provider: 'anthropic', model: 'claude-haiku-5-5' });
    expect(mode(wrapper, 'responde directamente').attributes('aria-checked')).toBe('true');
  });

  it('warns when Claude cannot answer directly', async () => {
    const wrapper = mountWithPinia(VoiceThinking, global);
    const store = useVoiceStore();
    store.applyBrainStatus(raw({ voiceProviders: { llm: { anthropic: false } } }));
    await mode(wrapper, 'responde directamente').trigger('click');
    expect(wrapper.text()).toContain('no tiene clave de API');
  });

  it('the voice answering takes Claude off the voice, and back is one click', async () => {
    const wrapper = mountWithPinia(VoiceThinking, global);
    const store = useVoiceStore();
    await mode(wrapper, 'responde directamente').trigger('click');
    await mode(wrapper, 'también responde').trigger('click');
    expect(store.brain.relay).toBe('work_only');
    expect(store.llm.provider).toBe('google');
    await mode(wrapper, 'la voz repite').trigger('click');
    expect(store.brain.relay).toBe('everything');
  });
});

describe('checking the connections', () => {
  const connected = () =>
    vi.spyOn(api, 'get').mockResolvedValue({
      enabled: true,
      providers: [],
      connected: { xai: { hint: '7890' } },
    });
  const button = (w: ReturnType<typeof mountWithPinia>, text: string) =>
    w.findAll('button').find((b) => b.text() === text);

  it.each([
    [{ ok: true }, 'acepta esta clave'],
    [{ ok: false }, 'ya no acepta'],
  ])('says what the provider answers of a connected key', async (answer, expected) => {
    connected();
    await useProviderConnections().refresh();
    const wrapper = mountWithPinia(ModelConnections, global);
    await flushPromises();
    const post = vi.spyOn(api, 'post').mockResolvedValue(answer);
    await button(wrapper, 'Comprobar')!.trigger('click');
    await flushPromises();
    expect(post).toHaveBeenCalledWith('/providers/xai/check');
    expect(wrapper.text()).toContain(expected);
  });

  it('a silent provider says nothing of the key', async () => {
    connected();
    await useProviderConnections().refresh();
    const wrapper = mountWithPinia(ModelConnections, global);
    await flushPromises();
    vi.spyOn(api, 'post').mockRejectedValue(new Error('down'));
    await button(wrapper, 'Comprobar')!.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('no se ha podido comprobar');
  });

  it('shows which voice engines the agent can use, once it has said', async () => {
    connected();
    const wrapper = mountWithPinia(ModelConnections, global);
    const store = useVoiceStore();
    expect(wrapper.find('.engines').exists()).toBe(false);
    store.brainStatus = {
      ...store.brainStatus,
      voiceKeys: { tts: { cartesia: false, elevenlabs: true }, stt: {}, llm: {}, realtime: {} },
    } as never;
    await flushPromises();
    const on = wrapper.findAll('.engine.on').map((e) => e.text());
    expect(on).toContain('elevenlabs');
    expect(on).not.toContain('cartesia');
  });
});
