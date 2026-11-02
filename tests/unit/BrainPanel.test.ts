/**
 * The brain sections of the Models panel, rendered.
 *
 * What matters: the flow names which model each role lands on and marks a
 * model whose key the agent reported missing; the roster edits reach the store
 * that `useBrainSync` sends to the agent.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { enableAutoUnmount } from '@vue/test-utils';
import { mountWithPinia } from '../helpers/mount';
import { i18n, setLocale } from '../../src/i18n';
import BrainFlow from '../../src/components/panels/settings/models/BrainFlow.vue';
import BrainSettings from '../../src/components/panels/settings/models/BrainSettings.vue';
import { useVoiceStore } from '../../src/stores/voice';
import { rosterModel } from '../../src/lib/brain';

enableAutoUnmount(afterEach);

const status = {
  type: 'brain_status',
  providers: { anthropic: true, google: true, openai: false, local: true },
  voiceProviders: { google: true, openai: false, aws: false },
  tavily: false,
  spend: { month: '2026-10', usd: 12.5, budgetUsd: 150 },
  tasks: [
    {
      id: 't1',
      title: 'Oro o bitcoin',
      kind: 'analysis',
      difficulty: 'hard',
      status: 'done',
      council: false,
      models: ['Gemini 3.5 Flash', 'Claude Opus 5.5'],
      costUsd: 0.08,
      startedAt: '',
      finishedAt: '',
      result: 'El oro.',
      steps: [
        { goal: 'precio del oro', difficulty: 'simple', model: 'Gemini 3.5 Flash', ok: true },
      ],
    },
  ],
};

describe('brain panel', () => {
  beforeEach(async () => {
    localStorage.clear();
    await setLocale('es');
  });

  it('shows who does what, and which models lack a key', () => {
    const wrapper = mountWithPinia(BrainFlow, { global: { plugins: [i18n] } });
    const store = useVoiceStore();
    store.brain = {
      ...store.brain,
      models: [
        ...store.brain.models,
        rosterModel('gpt', 'GPT-5.2', 'openai', 'gpt-5.2', 'expert', { council: true }),
      ],
    };
    store.applyBrainStatus(status);
    return wrapper.vm.$nextTick().then(() => {
      const text = wrapper.text();
      // Standard Gemini pipeline by default: the chain shows each stage.
      expect(text).toContain('TTS gemini · gemini-3.1-flash-tts-preview (Charon)');
      expect(text).toContain('LLM anthropic · claude-haiku-5-5');
      expect(text).toContain('Claude Haiku 5.5');
      expect(text).toContain('Claude Opus 5.5');
      expect(text).toContain('GPT-5.2 · sin clave');
      expect(text).toContain('Director');
    });
  });

  it('edits the roster in the store and shows spend and task steps', async () => {
    const wrapper = mountWithPinia(BrainSettings, { global: { plugins: [i18n] } });
    const store = useVoiceStore();
    store.applyBrainStatus(status);
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('12.50 $ / 150 $');
    expect(wrapper.text()).toContain('precio del oro');

    const haikuRow = wrapper.findAll('.model')[0];
    await haikuRow.find('.icon-btn.danger').trigger('click');
    expect(store.brain.models.some((m) => m.id === 'claude-haiku')).toBe(false);

    await wrapper.find('.row button').trigger('click'); // Añadir modelo
    const chip = wrapper.findAll('.chip').find((c) => c.text() === 'GPT-5.2');
    await chip!.trigger('click');
    const add = wrapper.findAll('button').find((b) => b.text() === 'Añadir');
    await add!.trigger('click');
    expect(store.brain.models.at(-1)).toMatchObject({
      provider: 'openai',
      model: 'gpt-5.2',
      role: 'expert',
    });
  });
});
