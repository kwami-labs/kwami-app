import { test, expect, gotoApp, seedUi, WELCOME_MS } from './fixtures';

const READY = { timeout: WELCOME_MS + 10_000 };

test.describe('PWA install', () => {
  test('account settings shows a download button', async ({ app: page }) => {
    await seedUi(page, { mode: 'settings', panel: 'account' });
    await gotoApp(page);

    await expect(page.getByTestId('pwa-download')).toBeVisible(READY);
    await expect(page.getByTestId('pwa-download')).toContainText('Download app');
    await expect(page.getByText('Use as a native app')).toBeVisible();
  });
});
