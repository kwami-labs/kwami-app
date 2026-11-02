/**
 * The Models panel's engine choice, rendered: three pipelines, and on Live + TTS
 * only the Live models that answer in text can be picked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, ref } from 'vue';
import { enableAutoUnmount } from '@vue/test-utils';
import { mountWithPinia, flushPromises } from '../helpers/mount';
import { i18n, setLocale } from '../../src/i18n';
import PipelineSelector from '../../src/components/panels/settings/models/PipelineSelector.vue';
import RealtimeTab from '../../src/components/panels/settings/models/tabs/RealtimeTab.vue';
import { useVoiceStore } from '../../src/stores/voice';

vi.mock('@/composables/useModelsApi', () => ({
  useModelsApi: () => ({
    fetchRealtimeModels: async () => null,
    realtimeModels: computed(() => ({
      plugins: {
        google: ['gemini-3.1-flash-live-preview', 'gemini-3.8-live'],
        openai: ['gpt-realtime', 'gpt-realtime-mini'],
      },
    })),
    isLoading: ref(false),
  }),
}));

enableAutoUnmount(afterEach);

describe('engine choice', () => {
  beforeEach(async () => {
    localStorage.clear();
    await setLocale('es');
  });

  it('offers standard, Live and Live + TTS, and can grey out the last', async () => {
    const wrapper = mountWithPinia(PipelineSelector, {
      props: { modelValue: 'hybrid', hybridDisabled: false },
      global: { plugins: [i18n] },
    });
    const buttons = wrapper.findAll('button');

    expect(buttons.map((b) => b.find('.pipeline-name').text())).toEqual([
      'Estándar',
      'Live',
      'Live + TTS',
    ]);
    expect(buttons[2]!.classes()).toContain('active');

    await wrapper.setProps({ hybridDisabled: true });
    expect(wrapper.findAll('button')[2]!.attributes('disabled')).toBeDefined();
  });

  it('on Live + TTS, Gemini Live is own-voice only and OpenAI Realtime can be picked', async () => {
    const wrapper = mountWithPinia(RealtimeTab, { global: { plugins: [i18n] } });
    const store = useVoiceStore();
    store.setPipelineMode('hybrid');
    store.modelsUI.realtimeExpandedProvider = 'rt-google';
    await flushPromises();

    const cards = () => wrapper.findAll('.realtime-model-card');
    const card = (id: string) => cards().find((c) => c.find('.model-id').text() === id)!;

    expect(card('gemini-3.8-live').attributes('disabled')).toBeDefined();
    expect(card('gemini-3.8-live').text()).toContain('Solo voz propia');
    expect(card('gpt-realtime-mini').attributes('disabled')).toBeUndefined();

    await card('gpt-realtime-mini').trigger('click');
    expect(store.realtime.model).toBe('gpt-realtime-mini');
    expect(store.pipelineMode).toBe('hybrid');

    await card('gemini-3.8-live').trigger('click');
    expect(store.realtime.model).toBe('gpt-realtime-mini');
  });

  it('on Live, every model with its key can be picked', async () => {
    const wrapper = mountWithPinia(RealtimeTab, { global: { plugins: [i18n] } });
    const store = useVoiceStore();
    store.setPipelineMode('realtime');
    await flushPromises();

    const gemini = wrapper
      .findAll('.realtime-model-card')
      .find((c) => c.find('.model-id').text() === 'gemini-3.8-live')!;
    expect(gemini.attributes('disabled')).toBeUndefined();
    expect(gemini.text()).not.toContain('Solo voz propia');
  });
});
