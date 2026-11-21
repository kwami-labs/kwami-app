/**
 * How the brain pays (2026-11-17): the user's choice of the Claude plan or the API key,
 * which first or only one, obeyed by the agent, and the panel that shows what the next
 * piece of Claude work would use and what is left of the plan.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';
import { enableAutoUnmount } from '@vue/test-utils';
import {
  applyBillingChange,
  brainPayload,
  defaultBrain,
  modelReach,
  modelUsable,
  normalizeBrain,
  parseBrainStatus,
  rosterModel,
  type BrainStatus,
} from '@/lib/brain';
import { useVoiceStore } from '@/stores/voice';
import { useBrainSync } from '@/composables/useBrainSync';
import { i18n, setLocale } from '@/i18n';
import { mountWithPinia } from '../helpers/mount';
import BrainBillingCard from '@/components/panels/settings/models/BrainBillingCard.vue';
import BrainModelCard from '@/components/panels/settings/models/BrainModelCard.vue';
import BrainSettings from '@/components/panels/settings/models/BrainSettings.vue';

const info = vi.fn();
vi.mock('vue-toastification', () => ({
  useToast: () => ({ info, success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
}));

enableAutoUnmount(afterEach);

const global = { global: { plugins: [i18n] } };
const opus = rosterModel('o', 'Opus', 'anthropic', 'claude-opus-5-5', 'expert');
const gemini = rosterModel('g', 'Gemini', 'google', 'gemini-3.5-flash', 'search');
const inTwoHours = () => new Date(Date.now() + 2 * 3600_000).toISOString();

function report(billing: Record<string, unknown> | undefined, account = {}) {
  return parseBrainStatus({
    type: 'brain_status',
    providers: { anthropic: true, google: true },
    apiKeys: { anthropic: true, google: true },
    account: { pcOnline: true, loggedIn: true, ...account },
    voiceProviders: {},
    spend: {},
    tasks: [],
    ...(billing ? { billing } : {}),
  }) as BrainStatus;
}

function plan(extra: Record<string, unknown> = {}) {
  return {
    out: false,
    until: null,
    status: '',
    window: '',
    utilization: null,
    resetsAt: null,
    seenAt: null,
    ...extra,
  };
}

beforeEach(async () => {
  localStorage.clear();
  info.mockClear();
  await setLocale('es');
});

describe('the choice', () => {
  it('is the plan first by default, kept when saved, and travels to the agent', () => {
    expect(defaultBrain().billing).toBe('account_first');
    expect(normalizeBrain({ billing: 'api_only' }).billing).toBe('api_only');
    expect(normalizeBrain({ billing: 'gratis' }).billing).toBe('account_first');
    expect(normalizeBrain({}).billing).toBe('account_first');
    expect(brainPayload({ ...defaultBrain(), billing: 'api_first' }).billing).toBe('api_first');
  });

  it('"only" decides for every model, "first" leaves a model its own way', () => {
    const byKey = { ...opus, access: 'api' as const };
    const byPlan = { ...opus, access: 'account' as const };
    expect(modelReach(byKey, 'account_only')).toBe('account');
    expect(modelReach(byPlan, 'api_only')).toBe('api');
    expect(modelReach(byKey, 'account_first')).toBe('api');
    expect(modelReach(opus, 'api_first')).toBe('api_first');
  });

  it('judges a model by the choice and by whether the plan has room', () => {
    const out = report(undefined, { usable: false });
    expect(modelUsable(opus, out, 'account_only')).toBe(false);
    expect(modelUsable(opus, out, 'account_first')).toBe(true); // the key takes over
    expect(modelUsable(gemini, out, 'account_only')).toBe(false);
    expect(modelUsable(gemini, null, 'account_only')).toBe(false);
    expect(modelUsable(gemini, out, 'account_first')).toBe(true);
    const room = report(undefined, { usable: true });
    expect(modelUsable(opus, room, 'account_only')).toBe(true);
    // An older agent says nothing of room: signed in is all there is.
    expect(modelUsable(opus, report(undefined), 'account_only')).toBe(true);
  });

  it('reads what the agent says, and nothing else', () => {
    const status = report({
      mode: 'account_first',
      now: 'api',
      why: 'Tu plan de Claude está agotado hasta las 15:00.',
      apiKey: true,
      plan: { out: true, until: 'x', status: 'rejected', utilization: 7, window: 'five_hour' },
      otherProvidersPaid: true,
    });
    expect(status.billing?.now).toBe('api');
    expect(status.billing?.plan.utilization).toBe(1);
    expect(status.billing?.plan.resetsAt).toBeNull();
    const odd = report({ mode: 'x', now: 'y', why: 3, plan: 'no', otherProvidersPaid: false });
    expect(odd.billing).toMatchObject({ mode: 'account_first', now: 'none', why: '' });
    expect(odd.billing?.otherProvidersPaid).toBe(false);
    expect(report(undefined).billing).toBeUndefined();
    expect(report(undefined, { usable: true }).account?.usable).toBe(true);
  });

  it('takes a change by voice only when it is one', () => {
    const brain = defaultBrain();
    expect(applyBillingChange(brain, { type: 'brain_billing', billing: 'api_only' })?.billing).toBe(
      'api_only',
    );
    expect(applyBillingChange(brain, { type: 'brain_billing', billing: 'gratis' })).toBeNull();
    expect(applyBillingChange(brain, { type: 'brain_instructions' })).toBeNull();
    expect(applyBillingChange(brain, null)).toBeNull();
  });
});

describe('the card', () => {
  it('offers the four ways and saves the one clicked', async () => {
    const card = mountWithPinia(BrainBillingCard, global);
    const store = useVoiceStore();
    expect(card.findAll('[role="radio"]')).toHaveLength(4);
    expect(card.get('[data-test="billing-account_first"]').attributes('aria-checked')).toBe('true');
    await card.get('[data-test="billing-account_only"]').trigger('click');
    expect(store.brain.billing).toBe('account_only');
    await card.get('[data-test="billing-account_only"]').trigger('click');
    expect(store.brain.billing).toBe('account_only');
    // No agent yet: it says how to find out.
    expect(card.get('[data-test="billing-now"]').text()).toContain('inicia una llamada');
  });

  it('says what Claude works on now, and why when it is not the first choice', async () => {
    const card = mountWithPinia(BrainBillingCard, global);
    const store = useVoiceStore();
    store.brainStatus = report({
      mode: 'account_first',
      now: 'api',
      why: 'Tu plan de Claude está agotado hasta las 15:00.',
      apiKey: true,
      plan: plan({ out: true, until: inTwoHours(), status: 'rejected' }),
      otherProvidersPaid: true,
    });
    await nextTick();
    const now = card.get('[data-test="billing-now"]');
    expect(now.classes()).toContain('api');
    expect(now.text()).toContain('la clave de API');
    expect(now.text()).toContain('agotado hasta las 15:00');
    expect(card.get('[data-test="billing-plan"]').text()).toMatch(/Plan agotado hasta las \d/);
    expect(card.get('[data-test="billing-key"]').text()).toContain('conectada');
    expect(card.find('[data-test="billing-others"]').exists()).toBe(false);
    expect(card.find('.meter .fill.full').exists()).toBe(true);

    // A click the agent has not answered yet is on its way, not contradicted.
    await card.get('[data-test="billing-api_only"]').trigger('click');
    expect(card.get('[data-test="billing-now"]').text()).toContain('aplicando');
  });

  it('shows how much of the plan is used, and when it renews', async () => {
    const card = mountWithPinia(BrainBillingCard, global);
    const store = useVoiceStore();
    const say = async (extra: Record<string, unknown>, more: Record<string, unknown> = {}) => {
      store.brainStatus = report({
        mode: 'account_first',
        now: 'account',
        why: '',
        apiKey: false,
        plan: plan(extra),
        ...more,
      });
      await nextTick();
      return card.get('[data-test="billing-plan"]').text();
    };
    expect(await say({ utilization: 0.72, window: 'five_hour', resetsAt: inTwoHours() })).toMatch(
      /72 % usado de la ventana de 5 horas; se renueva a las \d/,
    );
    const later = new Date(Date.now() + 3 * 86400_000).toISOString();
    expect(await say({ out: true, until: later })).toMatch(
      /^Plan agotado hasta el [a-zé]+ a las \d/,
    );
    expect(await say({ utilization: 0.5, window: 'seven_day', resetsAt: later })).toMatch(
      /semanal; se renueva el [a-zé]+ a las \d/,
    );
    expect(await say({ utilization: 0.1, window: 'mystery' })).toBe(
      'Plan: 10 % usado de la ventana de uso.',
    );
    expect(await say({ utilization: 0.1, window: '', resetsAt: 'not a date' })).toBe(
      'Plan: 10 % usado de la ventana de uso.',
    );
    expect(await say({ status: 'allowed' })).toBe('Plan con margen.');
    // What Claude Code gives while there is room: the window and when it renews.
    expect(await say({ status: 'allowed', window: 'five_hour', resetsAt: inTwoHours() })).toMatch(
      /^Plan con margen; la ventana de 5 horas se renueva a las \d/,
    );
    expect(await say({ status: 'allowed_warning', window: 'seven_day' })).toBe(
      'Plan cerca del límite de la ventana semanal.',
    );
    expect(
      await say({ status: 'allowed_warning', window: 'seven_day', resetsAt: inTwoHours() }),
    ).toMatch(/^Plan cerca del límite de la ventana semanal; se renueva a las \d/);
    expect(await say({})).toContain('aún no ha dicho');
    expect(await say({ out: true })).toBe('Plan agotado.');
    expect(card.get('[data-test="billing-key"]').text()).toContain('no hay');
    expect(card.find('.meter').exists()).toBe(true);
    await say({}, { now: 'none', why: 'No hay clave de API de Anthropic.' });
    expect(card.find('.meter').exists()).toBe(false);
    expect(card.get('[data-test="billing-now"]').classes()).toContain('none');
  });

  it('says when the report is from an earlier call, not now', async () => {
    const card = mountWithPinia(BrainBillingCard, global);
    const store = useVoiceStore();
    const billing = {
      mode: 'account_first',
      now: 'account',
      why: '',
      apiKey: true,
      plan: plan(),
      otherProvidersPaid: true,
    };
    store.brainStatus = report(billing);
    await nextTick();
    expect(card.find('[data-test="billing-age"]').exists()).toBe(false);
    store.brainStatus = { ...report(billing), receivedAt: Date.now() - 10 * 60_000 };
    await nextTick();
    expect(card.get('[data-test="billing-age"]').text()).toMatch(/última llamada, (a las|el) /);
  });

  it('says what the plan only turns off', async () => {
    const card = mountWithPinia(BrainBillingCard, global);
    const store = useVoiceStore();
    store.brain = { ...store.brain, billing: 'account_only' };
    store.brainStatus = report({
      mode: 'account_only',
      now: 'account',
      why: '',
      apiKey: true,
      plan: plan(),
      otherProvidersPaid: false,
    });
    await nextTick();
    expect(card.get('[data-test="billing-others"]').text()).toContain('Gemini, GPT, Grok');
    expect(card.get('[data-test="billing-now"]').text()).toContain('tu suscripción');
  });

  it('sits in the Models panel, under the Claude account', () => {
    const panel = mountWithPinia(BrainSettings, global);
    expect(panel.find('[data-test="brain-billing"]').exists()).toBe(true);
  });
});

describe('a model under the choice', () => {
  it('cannot be set its own way while "only" decides, and says why it is off', async () => {
    const card = mountWithPinia(BrainModelCard, {
      ...global,
      props: { model: opus, first: false },
    });
    const store = useVoiceStore();
    store.brain = { ...store.brain, billing: 'account_only' };
    await nextTick();
    expect(card.find('.segment').attributes('disabled')).toBeDefined();
    expect(card.text()).toContain('«Solo suscripción», arriba, decide');

    store.brain = { ...store.brain, billing: 'api_only' };
    await nextTick();
    expect(card.text()).toContain('«Solo API», arriba, decide');
  });

  it('a paid searcher is off with the plan only, and says why', async () => {
    const searcher = mountWithPinia(BrainModelCard, {
      ...global,
      props: { model: gemini, first: false },
    });
    const store = useVoiceStore();
    store.brain = { ...store.brain, billing: 'account_only' };
    store.brainStatus = report(undefined);
    await nextTick();
    expect(searcher.text()).toContain('solo con la suscripción');
  });

  it('a plan-only model needs the PC with room on the plan', async () => {
    const model = { ...opus, access: 'account' as const };
    const card = mountWithPinia(BrainModelCard, { ...global, props: { model, first: false } });
    const store = useVoiceStore();
    store.brainStatus = report(undefined, { usable: false });
    await nextTick();
    expect(card.text()).toContain('con plan disponible');
  });
});

describe('a change by voice', () => {
  function mountSync() {
    const Host = defineComponent({
      setup() {
        useBrainSync(ref(null), ref(false));
        return () => h('div');
      },
    });
    return mountWithPinia(Host, global);
  }

  it('is saved and said, once', () => {
    mountSync();
    const store = useVoiceStore();
    const says = (detail: unknown) =>
      window.dispatchEvent(new CustomEvent('kwami:agent_message', { detail }));
    says({ type: 'brain_billing', billing: 'account_only' });
    expect(store.brain.billing).toBe('account_only');
    expect(info).toHaveBeenLastCalledWith('Cómo paga el cerebro, cambiado por voz y guardado.');
    // The same again, or nonsense: nothing changes, nothing said.
    says({ type: 'brain_billing', billing: 'account_only' });
    says({ type: 'brain_billing', billing: 'gratis' });
    expect(info).toHaveBeenCalledTimes(1);
  });
});
