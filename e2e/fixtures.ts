import { test as base, type Page } from '@playwright/test';

/**
 * E2E fixtures.
 *
 * Everything the app talks to is intercepted here, so the suite needs no live
 * Supabase project and no running backend — only `bun run dev --mode test`.
 */

// Matches VITE_SUPABASE_URL in .env.test; supabase-js derives its storage key
// from the project ref in that host.
const SUPABASE_HOST = 'https://test.supabase.co';
const SUPABASE_STORAGE_KEY = 'sb-test-auth-token';

export const TEST_USER = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'e2e@kwami.test',
};

export const TEST_KWAMI = {
  id: '00000000-0000-4000-8000-0000000000k1'.replace('k', 'a'),
  name: 'Test Kwami',
};

function session() {
  return {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    token_type: 'bearer',
    // far future, so supabase-js never tries to refresh mid-test
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    expires_in: 60 * 60 * 24,
    user: {
      id: TEST_USER.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: TEST_USER.email,
      app_metadata: { provider: 'email' },
      user_metadata: {},
      created_at: new Date().toISOString(),
    },
  };
}

/** Intercepts Supabase auth + REST. `authenticated: false` yields a signed-out app. */
export async function stubSupabase(page: Page, { authenticated = true } = {}) {
  await page.route(`${SUPABASE_HOST}/auth/v1/**`, async (route) => {
    if (!authenticated) return route.fulfill({ status: 401, json: { message: 'not authenticated' } });
    return route.fulfill({ status: 200, json: session() });
  });

  // user_kwamis / user_app_settings
  await page.route(`${SUPABASE_HOST}/rest/v1/user_kwamis**`, (route) =>
    route.fulfill({
      status: 200,
      json: authenticated
        ? [{ id: TEST_KWAMI.id, user_id: TEST_USER.id, name: TEST_KWAMI.name, config: {}, created_at: new Date().toISOString() }]
        : [],
    }),
  );
  await page.route(`${SUPABASE_HOST}/rest/v1/user_app_settings**`, (route) =>
    route.fulfill({ status: 200, json: [{ user_id: TEST_USER.id, locale: 'en' }] }),
  );
  await page.route(`${SUPABASE_HOST}/rest/v1/**`, (route) => route.fulfill({ status: 200, json: [] }));

  if (authenticated) {
    await page.addInitScript(
      ([key, value]) => window.localStorage.setItem(key as string, value as string),
      [SUPABASE_STORAGE_KEY, JSON.stringify(session())] as const,
    );
  }
}

/** Intercepts the Kwami backend. Every route returns an empty-but-valid shape. */
export async function stubApi(page: Page) {
  await page.route('**/localhost:8080/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    const json = (body: unknown) => route.fulfill({ status: 200, json: body });

    if (path.startsWith('/credits/balance')) return json({ balance: 1000, currency: 'credits' });
    if (path.startsWith('/credits/packs')) return json({ packs: [] });
    if (path.startsWith('/credits/')) return json({ transactions: [], usage: [] });
    if (path.startsWith('/models/')) return json({ models: [], plugins: [] });
    if (path.startsWith('/voices/')) return json({ voices: [] });
    if (path.startsWith('/languages')) return json({ languages: [] });
    if (path.startsWith('/channels/')) return json({ channels: [], numbers: [] });
    if (path.startsWith('/email/unread-counts')) return json({ counts: {} });
    if (path.startsWith('/email/inbox')) return json({ messages: [], total: 0 });
    if (path.startsWith('/email/')) return json({ ok: true });
    if (path.startsWith('/calendar/')) return json({ events: [] });
    if (path.startsWith('/contacts')) return json({ contacts: [] });
    if (path.startsWith('/wallets/')) return json({ wallet: null });
    if (path.startsWith('/memory/')) return json({ items: [], has_more: false });
    if (path.startsWith('/token')) return json({ token: 'livekit-test-token' });

    return json({});
  });
}

/**
 * Marks the run as e2e and silences the welcome chime.
 *
 * Deliberately does NOT replace window.WebSocket: Vite's HMR client uses one,
 * and stubbing it stalls the page `load` event so every `page.goto` times out.
 * LiveKit only dials on an explicit connect action, which no spec triggers.
 */
export async function stubKwamiRuntime(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).__KWAMI_E2E__ = true;
    // The welcome sound 404s and autoplay is blocked headless; keep logs clean.
    window.HTMLMediaElement.prototype.play = () => Promise.resolve();
  });
}

/**
 * Navigates to the app.
 *
 * Uses `domcontentloaded`, not the default `load`: the avatar canvas keeps
 * fetching textures and media after first paint, so `load` can outlast the
 * test timeout even on a healthy page.
 */
export async function gotoApp(page: Page, path = '/') {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
}

/** Reload with the same `domcontentloaded` rule as gotoApp — the default
 * `load` can outlast the test timeout while the canvas is still fetching. */
export async function reloadApp(page: Page) {
  await page.reload({ waitUntil: 'domcontentloaded' });
}

export const test = base.extend<{ signedOut: Page; app: Page }>({
  /** App with all network stubbed but no session. */
  signedOut: async ({ page }, use) => {
    await stubSupabase(page, { authenticated: false });
    await stubApi(page);
    await stubKwamiRuntime(page);
    await use(page);
  },

  /** App with a seeded session, ready at the workspace. */
  app: async ({ page }, use) => {
    await stubSupabase(page, { authenticated: true });
    await stubApi(page);
    await stubKwamiRuntime(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';

/**
 * Seeds the UI store's persisted state before the app boots, so a spec can land
 * directly on a panel instead of driving the sidebar to get there.
 *
 * `mode` picks the sidebar's panel set: 'settings' or 'apps'.
 */
export async function seedUi(page: Page, { mode = 'settings', panel }: { mode?: 'settings' | 'apps'; panel: string }) {
  await page.addInitScript(
    ([m, p]) => {
      window.localStorage.setItem('kwami-sidebar-mode', m as string);
      window.localStorage.setItem('kwami-active-panel', p as string);
      window.localStorage.setItem('kwami-panel-open', 'true');
    },
    [mode, panel] as const,
  );
}

/** AuthGuard holds the welcome rings for MIN_WELCOME_MS (3500ms) before resolving. */
export const WELCOME_MS = 3500;
