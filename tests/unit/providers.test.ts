import { afterEach, describe, expect, it, vi } from 'vitest';

/** providers.ts reads VITE_AUTH_PROVIDERS at module load: stub, then import fresh. */
async function loadProviders(value: string) {
  vi.resetModules();
  vi.stubEnv('VITE_AUTH_PROVIDERS', value);
  return import('../../src/components/auth/providers');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('enabled sign-in providers', () => {
  it('offers google when the variable is empty', async () => {
    // `VITE_AUTH_PROVIDERS=` in .env, or an undefined CD variable, left the
    // login screen with no Google button.
    const { enabledWeb2Providers } = await loadProviders('');

    expect(enabledWeb2Providers.map((p) => p.id)).toEqual(['google']);
  });

  it('honours an explicit list', async () => {
    const { enabledWeb2Providers, enabledWeb3Providers } =
      await loadProviders(' GitHub , phantom ');

    expect(enabledWeb2Providers.map((p) => p.id)).toEqual(['github']);
    expect(enabledWeb3Providers.map((p) => p.id)).toEqual(['phantom']);
  });
});
