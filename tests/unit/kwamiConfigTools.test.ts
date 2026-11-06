/**
 * The user's webhook tools travel with the kwami's config, like its theme.
 *
 * Unlike the theme, an absent `tools` key must clear them: tools carry URLs
 * the user pointed at their own services, and a kwami that never had any must
 * not keep calling the previous kwami's.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

// The config pulls in the avatar store, which reads preset data from the real
// package; only the runtime class needs the stub.
vi.mock('kwami', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const { Kwami, jarvisSdkStubs } = await import('../mocks/kwami');
  return { ...actual, Kwami, ...jarvisSdkStubs };
});
import { useKwamiConfigSync } from '@/composables/useKwamiConfigSync';
import { useUserToolsStore } from '@/stores/userTools';
import type { UserWebhookTool } from '@/lib/userTools';

const weather: UserWebhookTool = {
  name: 'get_weather',
  description: 'Weather now.',
  url: 'https://api.example.com/weather',
  method: 'GET',
  params: [{ name: 'city', type: 'string', required: true }],
};

beforeEach(() => setActivePinia(createPinia()));

describe('kwami config and user tools', () => {
  it('puts the tools in the saved config', () => {
    useUserToolsStore().save(weather);
    const config = useKwamiConfigSync().getConfig();
    expect(config.tools).toEqual({ webhooks: [weather] });
    // Plain JSON: the row is written as-is to user_kwamis.config.
    expect(JSON.parse(JSON.stringify(config.tools))).toEqual(config.tools);
  });

  it('restores them from a config', () => {
    useKwamiConfigSync().applyConfig({ tools: { webhooks: [weather] } });
    expect(useUserToolsStore().webhooks).toEqual([weather]);
  });

  it('clears them when the config has none', () => {
    const store = useUserToolsStore();
    store.save(weather);
    useKwamiConfigSync().applyConfig({ theme: { mode: 'dark' } });
    expect(store.webhooks).toEqual([]);
  });
});
