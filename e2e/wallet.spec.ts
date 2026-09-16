import { test, expect, gotoApp, seedUi, WELCOME_MS } from './fixtures';

const READY = { timeout: WELCOME_MS + 10_000 };

/**
 * The backend defaults settings.wallet_enabled to APP_ENV != 'production', so in
 * production every wallet call returns 503. That is the path real traffic takes
 * today, and the panel used to render the raw FastAPI `detail` string for it.
 */
test.describe('wallet panel', () => {
  test('shows an unavailable state when the feature is disabled (503)', async ({ app: page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    // Registered after stubApi, so this wins for the wallet route.
    await page.route('**/localhost:8080/wallets/**', (route) =>
      route.fulfill({
        status: 503,
        json: { detail: 'Wallet feature is disabled (settings.wallet_enabled=False)' },
      }),
    );

    await seedUi(page, { mode: 'apps', panel: 'wallet' });
    await gotoApp(page);
    await expect(page.locator('.control-bar-container')).toBeVisible(READY);

    await expect(page.getByText('Wallet is not available in this environment.')).toBeVisible(READY);

    // The raw backend detail must never reach the user.
    await expect(page.locator('body')).not.toContainText('settings.wallet_enabled');
    await expect(page.locator('body')).not.toContainText('FastAPI');
    expect(errors).toEqual([]);
  });

  test('does not show the unavailable state on a healthy response', async ({ app: page }) => {
    await seedUi(page, { mode: 'apps', panel: 'wallet' });
    await gotoApp(page);
    await expect(page.locator('.control-bar-container')).toBeVisible(READY);
    await expect(page.locator('.sidebar')).not.toBeEmpty();

    await expect(page.getByText('Wallet is not available in this environment.')).toHaveCount(0);
  });

  test('surfaces a server error without leaking the raw detail', async ({ app: page }) => {
    await page.route('**/localhost:8080/wallets/**', (route) =>
      route.fulfill({ status: 500, json: { detail: 'Traceback: psycopg2.OperationalError' } }),
    );

    await seedUi(page, { mode: 'apps', panel: 'wallet' });
    await gotoApp(page);
    await expect(page.locator('.control-bar-container')).toBeVisible(READY);

    await expect(page.locator('body')).not.toContainText('psycopg2');
    await expect(page.locator('body')).not.toContainText('Traceback');
  });
});
