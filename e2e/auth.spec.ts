import { test, expect, gotoApp, stubApi, stubKwamiRuntime, WELCOME_MS } from './fixtures';

test.describe('unauthenticated', () => {
  test('shows the welcome layer, then the auth page', async ({ signedOut: page }) => {
    await gotoApp(page);

    // AuthGuard holds the rings for MIN_WELCOME_MS before revealing the overlay.
    await expect(page.locator('.welcome-layer')).toBeVisible();

    await expect(page.locator('.title-main')).toHaveText('KWAMI', { timeout: WELCOME_MS + 5_000 });
    await expect(page.locator('.welcome-layer')).toBeHidden();
  });

  test('renders the canvas behind the auth overlay and blocks interaction with it', async ({ signedOut: page }) => {
    await gotoApp(page);
    await expect(page.locator('.title-main')).toBeVisible({ timeout: WELCOME_MS + 5_000 });

    // The canvas always mounts (it backs the avatar), but must not be interactive
    // while signed out.
    await expect(page.locator('#kwami-canvas')).toBeAttached();
    await expect(page.locator('.app-content')).toHaveClass(/behind-auth/);
  });

  test('does not show the authenticated chrome', async ({ signedOut: page }) => {
    await gotoApp(page);
    await expect(page.locator('.title-main')).toBeVisible({ timeout: WELCOME_MS + 5_000 });

    await expect(page.locator('.control-bar-container')).toHaveCount(0);
  });
});

test.describe('auth bootstrap resilience', () => {
  /**
   * Regression for the splash-hang: auth.ts called
   * `supabase.auth.getSession().then(...)` with no `.catch()`, so a network
   * failure left `loading` true forever and the welcome rings never resolved.
   * The app must still reach a usable signed-out state.
   */
  test('recovers when the session lookup fails outright', async ({ page }) => {
    await stubApi(page);
    await stubKwamiRuntime(page);
    await page.route('https://test.supabase.co/auth/v1/**', (route) => route.abort('failed'));
    await page.route('https://test.supabase.co/rest/v1/**', (route) => route.abort('failed'));

    await gotoApp(page);

    await expect(page.locator('.title-main')).toHaveText('KWAMI', { timeout: WELCOME_MS + 10_000 });
    await expect(page.locator('.welcome-layer')).toBeHidden();
  });

  test('recovers when the session lookup returns a server error', async ({ page }) => {
    await stubApi(page);
    await stubKwamiRuntime(page);
    await page.route('https://test.supabase.co/auth/v1/**', (route) =>
      route.fulfill({ status: 500, json: { message: 'boom' } }),
    );

    await gotoApp(page);

    await expect(page.locator('.title-main')).toBeVisible({ timeout: WELCOME_MS + 10_000 });
  });
});

test.describe('authenticated', () => {
  test('skips the auth overlay and shows the app chrome', async ({ app: page }) => {
    await gotoApp(page);

    await expect(page.locator('.control-bar-container')).toBeVisible({ timeout: WELCOME_MS + 10_000 });
    await expect(page.locator('.title-main')).toHaveCount(0);
    await expect(page.locator('.app-content')).not.toHaveClass(/behind-auth/);
  });
});

test.describe('console hygiene', () => {
  test('boots without uncaught page errors', async ({ app: page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await gotoApp(page);
    await expect(page.locator('.control-bar-container')).toBeVisible({ timeout: WELCOME_MS + 10_000 });

    expect(errors).toEqual([]);
  });
});
