/**
 * Instructions changed by voice (`brain_instructions` from the agent) land in
 * the Models panel and are saved; each task shows which models received them.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { defineComponent, h, ref } from 'vue';
import { enableAutoUnmount } from '@vue/test-utils';
import { applyInstructionsChange, defaultBrain, MAX_INSTRUCTIONS } from '@/lib/brain';
import { useVoiceStore } from '@/stores/voice';
import { useBrainSync } from '@/composables/useBrainSync';
import { i18n, setLocale } from '@/i18n';
import { mountWithPinia } from '../helpers/mount';
import BrainSettings from '@/components/panels/settings/models/BrainSettings.vue';

const info = vi.fn();
vi.mock('vue-toastification', () => ({
  useToast: () => ({ info, success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
}));

enableAutoUnmount(afterEach);

describe('applyInstructionsChange', () => {
  const brain = defaultBrain();
  const opus = brain.models.find((m) => m.id === 'claude-opus')!;

  it('changes one model and names it', () => {
    const change = applyInstructionsChange(brain, {
      type: 'brain_instructions',
      target: 'claude-opus',
      instructions: 'Solo dinero.',
    });
    expect(change?.label).toBe(opus.label);
    expect(change?.config.models.find((m) => m.id === 'claude-opus')?.instructions).toBe(
      'Solo dinero.',
    );
    // The rest of the roster and the original config are untouched.
    expect(change?.config.models.filter((m) => m.instructions)).toHaveLength(1);
    expect(opus.instructions).toBe('');
  });

  it('changes the whole brain with an empty label', () => {
    const change = applyInstructionsChange(brain, {
      type: 'brain_instructions',
      target: 'brain',
      instructions: 'En euros.',
    });
    expect(change).toMatchObject({ label: '', config: { instructions: 'En euros.' } });
  });

  it('caps the text like the panel does', () => {
    const change = applyInstructionsChange(brain, {
      type: 'brain_instructions',
      target: 'brain',
      instructions: 'a'.repeat(MAX_INSTRUCTIONS + 50),
    });
    expect(change?.config.instructions).toHaveLength(MAX_INSTRUCTIONS);
  });

  it('ignores other messages and unknown models', () => {
    expect(applyInstructionsChange(brain, null)).toBeNull();
    expect(applyInstructionsChange(brain, 'x')).toBeNull();
    expect(applyInstructionsChange(brain, { type: 'brain_status' })).toBeNull();
    expect(
      applyInstructionsChange(brain, {
        type: 'brain_instructions',
        target: 'brain',
        instructions: 3,
      }),
    ).toBeNull();
    expect(
      applyInstructionsChange(brain, {
        type: 'brain_instructions',
        target: 'gpt-9',
        instructions: 'x',
      }),
    ).toBeNull();
  });

  it('uses the model name when a model has no label', () => {
    const unlabeled = {
      ...brain,
      models: brain.models.map((m) => (m.id === 'claude-opus' ? { ...m, label: '' } : m)),
    };
    const change = applyInstructionsChange(unlabeled, {
      type: 'brain_instructions',
      target: 'claude-opus',
      instructions: 'x',
    });
    expect(change?.label).toBe(opus.model);
  });
});

describe('voice store', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('applies and returns who changed, or null', () => {
    const store = useVoiceStore();
    expect(
      store.applyBrainInstructions({
        type: 'brain_instructions',
        target: 'brain',
        instructions: 'Breve.',
      }),
    ).toBe('');
    expect(store.brain.instructions).toBe('Breve.');
    expect(store.applyBrainInstructions({ type: 'nope' })).toBeNull();
  });
});

describe('useBrainSync', () => {
  beforeEach(async () => {
    localStorage.clear();
    info.mockClear();
    await setLocale('es');
  });

  function mountSync() {
    const Host = defineComponent({
      setup() {
        useBrainSync(ref(null), ref(false));
        return () => h('div');
      },
    });
    return mountWithPinia(Host, { global: { plugins: [i18n] } });
  }

  function agentSays(detail: unknown) {
    window.dispatchEvent(new CustomEvent('kwami:agent_message', { detail }));
  }

  it('saves instructions changed by voice and says so', () => {
    mountSync();
    const store = useVoiceStore();
    const opus = store.brain.models.find((m) => m.id === 'claude-opus')!;

    agentSays({ type: 'brain_instructions', target: 'claude-opus', instructions: 'Solo dinero.' });
    expect(store.brain.models.find((m) => m.id === 'claude-opus')?.instructions).toBe(
      'Solo dinero.',
    );
    expect(info).toHaveBeenLastCalledWith(
      `Instrucciones de ${opus.label} cambiadas por voz y guardadas.`,
    );

    agentSays({ type: 'brain_instructions', target: 'brain', instructions: 'En euros.' });
    expect(store.brain.instructions).toBe('En euros.');
    expect(info).toHaveBeenLastCalledWith(
      'Instrucciones de todo el cerebro cambiadas por voz y guardadas.',
    );
  });

  it('stays quiet on a change it cannot apply', () => {
    mountSync();
    agentSays({ type: 'brain_instructions', target: 'gpt-9', instructions: 'x' });
    expect(info).not.toHaveBeenCalled();
  });
});

describe('task list', () => {
  beforeEach(async () => {
    localStorage.clear();
    await setLocale('es');
  });

  const task = {
    id: 't1',
    title: 'Oro',
    kind: 'analysis',
    difficulty: 'hard',
    status: 'done',
    council: false,
    models: ['Claude Opus 5.5'],
    costUsd: 0.01,
    startedAt: '',
    finishedAt: '',
  };

  function statusWith(tasks: unknown[]) {
    return {
      type: 'brain_status',
      providers: {},
      voiceProviders: {},
      tavily: false,
      spend: { month: '2026-11', usd: 0, budgetUsd: 150 },
      tasks,
    };
  }

  it('shows which models got the instructions', async () => {
    const wrapper = mountWithPinia(BrainSettings, { global: { plugins: [i18n] } });
    useVoiceStore().applyBrainStatus(statusWith([{ ...task, briefed: ['Claude Opus 5.5'] }]));
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[data-testid="task-briefed"]').text()).toContain(
      'Tus instrucciones llegaron a: Claude Opus 5.5',
    );
  });

  it('says nothing when none did, or the agent is older', async () => {
    const wrapper = mountWithPinia(BrainSettings, { global: { plugins: [i18n] } });
    useVoiceStore().applyBrainStatus(statusWith([task, { ...task, id: 't2', briefed: [] }]));
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="task-briefed"]').exists()).toBe(false);
  });
});
