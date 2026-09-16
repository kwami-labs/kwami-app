import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * src/lib/env.ts resolves at module load, so each case needs a fresh module
 * registry: stub the vars, then dynamically import.
 */
async function loadEnv(vars: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) vi.stubEnv(k, '');
    else vi.stubEnv(k, v);
  }
  return import('../../src/lib/env');
}

const COMPLETE = {
  VITE_SUPABASE_URL: 'https://test.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  VITE_API_URL: 'https://api.example.test',
  VITE_LIVEKIT_URL: 'wss://livekit.example.test',
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('env validation', () => {
  it('is valid when the required vars are present', async () => {
    const { isEnvValid, missingEnvVars } = await loadEnv(COMPLETE);

    expect(isEnvValid).toBe(true);
    expect(missingEnvVars).toEqual([]);
  });

  it('reports each missing required var by name', async () => {
    const { isEnvValid, missingEnvVars } = await loadEnv({
      ...COMPLETE,
      VITE_SUPABASE_URL: undefined,
      VITE_SUPABASE_PUBLISHABLE_KEY: undefined,
    });

    expect(isEnvValid).toBe(false);
    expect([...missingEnvVars].sort()).toEqual(['VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_URL']);
  });

  it('treats a whitespace-only value as missing', async () => {
    const { isEnvValid, missingEnvVars } = await loadEnv({ ...COMPLETE, VITE_SUPABASE_URL: '   ' });

    expect(isEnvValid).toBe(false);
    expect(missingEnvVars).toContain('VITE_SUPABASE_URL');
  });

  it('trims surrounding whitespace off resolved values', async () => {
    const { env } = await loadEnv({ ...COMPLETE, VITE_API_URL: '  https://api.example.test  ' });

    expect(env.apiUrl).toBe('https://api.example.test');
  });

  it('defaults the API URL to localhost when unset', async () => {
    const { env, isEnvValid } = await loadEnv({ ...COMPLETE, VITE_API_URL: undefined });

    // Deliberately a default, not a failure: an unset API URL is normal in dev.
    expect(env.apiUrl).toBe('http://localhost:8080');
    expect(isEnvValid).toBe(true);
  });

  it('does not invent a default for the LiveKit URL', async () => {
    const { env } = await loadEnv({ ...COMPLETE, VITE_LIVEKIT_URL: undefined });

    expect(env.livekitUrl).toBe('');
  });

  it('exposes the supabase credentials verbatim', async () => {
    const { env } = await loadEnv(COMPLETE);

    expect(env.supabaseUrl).toBe('https://test.supabase.co');
    expect(env.supabasePublishableKey).toBe('sb_publishable_test');
  });
});
