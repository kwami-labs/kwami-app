/**
 * The brain config: what the Models panel stores and sends to the agent.
 *
 * What matters: old saves and bad entries never break the panel, the payload
 * keeps the field names the agent's parser reads, the agent's status report
 * reaches the store, and the routing table matches the agent's router.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useVoiceStore } from '@/stores/voice';
import {
  JARVIS_VOICE,
  automaticDirector,
  MODEL_SUGGESTIONS,
  brainPayload,
  defaultBrain,
  modelUsable,
  normalizeBrain,
  parseBrainStatus,
  roleFor,
} from '@/lib/brain';

describe('the director', () => {
  it('is the expert when the user chose none, as the agent picks it', () => {
    const models = defaultBrain().models;
    expect(automaticDirector(models)?.model).toBe('claude-opus-5-5');
    const noExpert = models.filter((m) => !m.roles.includes('expert'));
    expect(automaticDirector(noExpert)?.model).toBe('claude-sonnet-5-5');
    expect(automaticDirector([])).toBeUndefined();
  });

  it('can be told not to hand out the work, and the agent is told so', () => {
    expect(normalizeBrain({}).orchestrate).toBe(true);
    const off = normalizeBrain({ orchestrate: false });
    expect(off.orchestrate).toBe(false);
    expect(brainPayload(off).orchestrate).toBe(false);
  });
});

describe('brain config', () => {
  it('defaults to the Jarvis roster with Anthropic as the brain', () => {
    const brain = defaultBrain();
    expect(brain.models.map((m) => [m.model, m.role])).toEqual([
      ['claude-haiku-5-5', 'fast'],
      ['claude-sonnet-5-5', 'standard'],
      ['claude-opus-5-5', 'expert'],
      ['gemini-3.5-flash', 'search'],
      ['claude-sonnet-5-5', 'code'],
    ]);
    expect(brain.splitTasks).toBe(true);
    expect(brain.orchestrate).toBe(true);
    expect(brain.budgetPolicy).toBe('stop');
    expect(brain.monthlyBudgetUsd).toBe(150);
  });

  it('drops bad models and fills missing fields from the defaults', () => {
    const brain = normalizeBrain({
      council: 'research',
      models: [
        { provider: 'openai', model: 'gpt-5.2', role: 'expert', council: true },
        { provider: 'nope', model: 'x', role: 'fast' },
        { provider: 'google', model: '', role: 'fast' },
      ],
    });
    expect(brain.models).toHaveLength(1);
    expect(brain.models[0]).toMatchObject({ id: 'gpt-5.2', council: true, enabled: true });
    expect(brain.council).toBe('research');
    expect(brain.executor.permissions).toBe('full_no_push');
  });

  it('treats a save from before the brain existed as the defaults', () => {
    expect(normalizeBrain(undefined)).toEqual(defaultBrain());
    expect(normalizeBrain({ monthlyBudgetUsd: 50, budgetPolicy: 'inform' })).toMatchObject({
      monthlyBudgetUsd: 150,
      budgetPolicy: 'stop',
    });
    expect(normalizeBrain({ monthlyBudgetUsd: 40, budgetPolicy: 'inform' })).toMatchObject({
      monthlyBudgetUsd: 40,
      budgetPolicy: 'inform',
    });
  });

  it('routes like the agent: Opus most, Sonnet writes and reads, Haiku lookups', () => {
    expect(roleFor('question', 'simple')).toBe('fast');
    expect(roleFor('question', 'normal')).toBe('expert');
    expect(roleFor('research', 'simple')).toBe('search');
    expect(roleFor('research', 'normal')).toBe('expert');
    expect(roleFor('analysis', 'normal')).toBe('expert');
    expect(roleFor('analysis', 'hard')).toBe('expert');
    for (const difficulty of ['simple', 'normal', 'hard'] as const) {
      expect(roleFor('writing', difficulty)).toBe('standard');
      expect(roleFor('reading', difficulty)).toBe('standard');
    }
    expect(roleFor('code', 'simple')).toBe('code');
  });

  it('never suggests Fable', () => {
    const all = Object.values(MODEL_SUGGESTIONS).flat();
    expect(all.some((s) => s.model.includes('fable'))).toBe(false);
  });

  it('marks a model unusable only when the agent reported its key missing', () => {
    const gpt = { ...defaultBrain().models[1], provider: 'openai' as const };
    expect(modelUsable(gpt, null)).toBe(true);
    const status = parseBrainStatus({ type: 'brain_status', providers: { openai: false } });
    expect(modelUsable(gpt, status)).toBe(false);
  });
});

describe('voice store', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('starts on the Jarvis voice and persists the brain with the kwami', () => {
    const store = useVoiceStore();
    expect(store.realtime).toMatchObject(JARVIS_VOICE);
    store.brain = { ...store.brain, monthlyBudgetUsd: 80 };
    expect(store.getSnapshot().brain).toEqual(brainPayload(store.brain));
  });

  it('keeps the agent status out of the kwami snapshot', () => {
    const store = useVoiceStore();
    store.applyBrainStatus({
      type: 'brain_status',
      providers: { anthropic: true },
      voiceProviders: { google: true, openai: false },
      spend: { month: '2026-10', usd: 1.5 },
      tasks: [],
    });
    expect(store.brainStatus?.spend.usd).toBe(1.5);
    expect(store.brainStatus?.voiceProviders.openai).toBe(false);
    expect('brainStatus' in store.getSnapshot()).toBe(false);
    // Ignores anything that is not a brain status.
    store.applyBrainStatus({ type: 'other' });
    expect(store.brainStatus?.spend.usd).toBe(1.5);
  });
});
