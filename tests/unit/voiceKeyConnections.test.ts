/**
 * Connecting a voice-only account. A key must reach the API and go no further, and
 * the section must not offer what the deployment cannot store.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { mountWithPinia } from '../helpers/mount';
import { i18n, setLocale } from '../../src/i18n';
import VoiceKeyConnections from '../../src/components/panels/settings/models/VoiceKeyConnections.vue';
import { useProviderConnections } from '../../src/composables/useProviderConnections';
import { api } from '../../src/lib/apiClient';

enableAutoUnmount(afterEach);

const global = { global: { plugins: [i18n] } };

beforeEach(() => setLocale('es'));
afterEach(() => {
  useProviderConnections().connections.value = null;
  vi.restoreAllMocks();
});

describe('VoiceKeyConnections', () => {
  it('stays hidden where keys cannot be stored', () => {
    useProviderConnections().connections.value = { enabled: false, connected: {} };
    const wrapper = mountWithPinia(VoiceKeyConnections, global);
    expect(wrapper.text()).not.toContain('Deepgram');
  });

  it('sends the key to the API for that provider and forgets it', async () => {
    useProviderConnections().connections.value = { enabled: true, connected: {} };
    const put = vi.spyOn(api, 'put').mockResolvedValue({} as never);
    vi.spyOn(api, 'get').mockResolvedValue({
      enabled: true,
      connected: { deepgram: { hint: 'abcd' } },
    } as never);
    const wrapper = mountWithPinia(VoiceKeyConnections, global);

    await wrapper.findAll('button.link')[0].trigger('click');
    await wrapper.find('input.key').setValue('dg-key-long-enough');
    const save = wrapper.findAll('button').find((b) => b.text() === i18n.global.t('mind.saveKey'));
    await save?.trigger('click');
    await flushPromises();

    expect(put).toHaveBeenCalledWith('/providers/deepgram/key', { key: 'dg-key-long-enough' });
    expect(wrapper.find('input.key').exists()).toBe(false);
    expect(wrapper.text()).toContain('abcd');
  });
});
