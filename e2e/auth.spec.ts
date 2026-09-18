import { test, expect, gotoApp, stubApi, stubKwamiRuntime, TEST_USER, WELCOME_MS } from './fixtures';

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

/**
 * Opens the login panel and waits for it to be genuinely usable.
 *
 * Two waits, both load-bearing. The CTA only reacts once AuthGuard has released
 * the welcome rings, hence the wordmark. And `login-entry--open` lands ~230ms
 * before the panel's max-height transition starts, a window in which the form is
 * laid out below the fold inside a still-zero-height scroll container — visible
 * to a locator, but not yet clickable. Waiting for the last control in the form
 * to be fully in the viewport is what says the panel has settled.
 */
async function openLoginPanel(page: import('@playwright/test').Page) {
  await expect(page.locator('.title-main')).toBeVisible({ timeout: WELCOME_MS + 5_000 });
  await page.locator('.login-cta').click();
  await expect(page.locator('.login-entry')).toHaveClass(/login-entry--open/);
  await expect(page.locator('.email-auth__switch-btn')).toBeInViewport({ ratio: 1 });
}

test.describe('email and password', () => {
  test('offers the form alongside the OAuth buttons', async ({ signedOut: page }) => {
    await gotoApp(page);
    await openLoginPanel(page);

    await expect(page.locator('form.email-auth')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    // Sign-in mode: no confirmation field until the user switches.
    await expect(page.locator('input[name="confirmPassword"]')).toHaveCount(0);
  });

  test('switches to sign up and back', async ({ signedOut: page }) => {
    await gotoApp(page);
    await openLoginPanel(page);

    await page.locator('.email-auth__switch-btn').click();
    await expect(page.locator('input[name="confirmPassword"]')).toBeVisible();

    await page.locator('.email-auth__switch-btn').click();
    await expect(page.locator('input[name="confirmPassword"]')).toHaveCount(0);
  });

  test('rejects a malformed address without hitting the network', async ({ signedOut: page }) => {
    await gotoApp(page);
    await openLoginPanel(page);

    let tokenCalls = 0;
    await page.route('**/auth/v1/token**', (route) => {
      tokenCalls += 1;
      return route.fulfill({ status: 400, json: { message: 'should not be reached' } });
    });

    await page.locator('input[name="email"]').fill('not-an-email');
    await page.locator('input[name="password"]').fill('hunter2');
    await page.locator('form.email-auth button[type="submit"]').click();

    await expect(page.locator('.email-auth__error')).toHaveText('Enter a valid email address');
    expect(tokenCalls).toBe(0);
  });

  test('surfaces bad credentials as a sign-up suggestion', async ({ signedOut: page }) => {
    await page.route('**/auth/v1/token**', (route) =>
      route.fulfill({
        status: 400,
        json: { code: 'invalid_credentials', error_code: 'invalid_credentials', message: 'Invalid login credentials' },
      }),
    );

    await gotoApp(page);
    await openLoginPanel(page);

    await page.locator('input[name="email"]').fill('nobody@kwami.test');
    await page.locator('input[name="password"]').fill('wrong-password');
    await page.locator('form.email-auth button[type="submit"]').click();

    await expect(page.locator('.email-auth__error')).toContainText('Invalid credentials');
    // Still signed out.
    await expect(page.locator('.title-main')).toBeVisible();
  });

  test('signs in and dismisses the auth overlay', async ({ signedOut: page }) => {
    await page.route('**/auth/v1/token**', (route) =>
      route.fulfill({
        status: 200,
        json: {
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          token_type: 'bearer',
          expires_in: 86_400,
          expires_at: Math.floor(Date.now() / 1000) + 86_400,
          user: {
            id: TEST_USER.id,
            aud: 'authenticated',
            role: 'authenticated',
            email: TEST_USER.email,
            app_metadata: { provider: 'email' },
            user_metadata: {},
            created_at: new Date().toISOString(),
          },
        },
      }),
    );

    await gotoApp(page);
    await openLoginPanel(page);

    await page.locator('input[name="email"]').fill(TEST_USER.email);
    await page.locator('input[name="password"]').fill('hunter2');
    await page.locator('form.email-auth button[type="submit"]').click();

    await expect(page.locator('.title-main')).toHaveCount(0, { timeout: 15_000 });
  });
});

test.describe('phantom wallet', () => {
  test('offers Phantom on the web3 tab', async ({ signedOut: page }) => {
    await gotoApp(page);
    await openLoginPanel(page);

    await page.getByRole('tab', { name: 'Web3' }).click();

    await expect(page.getByRole('button', { name: /Continue with Phantom/i })).toBeVisible();
  });

  test('opens the download page when the extension is not installed', async ({ signedOut: page }) => {
    // Context-level so it also catches the pop-up, which is a separate Page and
    // would otherwise escape this page's routes and hit the real web store.
    await page.context().route('https://chromewebstore.google.com/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Phantom</title>' }),
    );

    await gotoApp(page);
    await openLoginPanel(page);
    await page.getByRole('tab', { name: 'Web3' }).click();

    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.getByRole('button', { name: /Continue with Phantom/i }).click(),
    ]);

    expect(popup.url()).toBe(
      'https://chromewebstore.google.com/detail/phantom/bfnaelmomeimhlpmgjnjophhpkkoljpa',
    );
    await popup.close();

    // And the in-page fallback, for when a pop-up blocker wins.
    await expect(page.locator('.provider-error')).toContainText('Phantom is not installed');
    await expect(page.locator('.provider-install')).toHaveAttribute(
      'href',
      'https://chromewebstore.google.com/detail/phantom/bfnaelmomeimhlpmgjnjophhpkkoljpa',
    );
  });

  test('uses the Phantom-namespaced provider over a foreign window.solana', async ({ signedOut: page }) => {
    // Another Solana wallet claimed window.solana first — the case that made
    // `window.solana.isPhantom` the wrong detector.
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).solana = { isPhantom: false, connect: () => Promise.resolve({}) };
      (window as unknown as Record<string, unknown>).phantom = {
        solana: {
          isPhantom: true,
          connect: () => Promise.resolve({}),
          // Signal the call rather than completing a real SIWS handshake.
          signIn: () => {
            (window as unknown as Record<string, unknown>).__PHANTOM_SIGNIN__ = true;
            return Promise.reject(new Error('user rejected'));
          },
        },
      };
    });

    await gotoApp(page);
    await openLoginPanel(page);

    await page.getByRole('tab', { name: 'Web3' }).click();
    await page.getByRole('button', { name: /Continue with Phantom/i }).click();

    await expect
      .poll(() => page.evaluate(() => (window as unknown as Record<string, unknown>).__PHANTOM_SIGNIN__))
      .toBe(true);
  });
});
