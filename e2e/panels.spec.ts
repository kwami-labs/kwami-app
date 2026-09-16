import { test, expect, gotoApp, seedUi, WELCOME_MS } from './fixtures';

const READY = { timeout: WELCOME_MS + 10_000 };

/**
 * Each panel is asserted to actually mount and render its own chrome, with no
 * uncaught page errors. These are smoke-level on purpose: the panels are being
 * refactored, so anything asserting on internal wiring would churn. What they do
 * catch is a panel that throws on mount — which is how the ToolsPanel shadowed-`t`
 * and SoulPanel ReferenceError bugs manifested.
 */

const SETTINGS_PANELS = [
  'avatar', 'scene', 'audio', 'voice', 'enhancements',
  'soul', 'tools', 'info', 'account', 'theme', 'models', 'credits',
  // memory, metrics and communications were missing from this list. memory in
  // particular used to resolve its API base from VITE_LIVEKIT_TOKEN_ENDPOINT
  // rather than VITE_API_URL, so it talked to a different host than every other
  // panel — exactly the kind of thing a mount smoke plus the un-stubbed-host
  // guard in fixtures.ts is meant to surface.
  'memory', 'metrics', 'communications',
] as const;

const APP_PANELS = ['contacts', 'email', 'wallet', 'calendar', 'phone', 'whatsapp', 'sms', 'history'] as const;

test.describe('settings panels mount cleanly', () => {
  for (const panel of SETTINGS_PANELS) {
    test(`${panel}`, async ({ app: page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));

      await seedUi(page, { mode: 'settings', panel });
      await gotoApp(page);

      await expect(page.locator('.control-bar-container')).toBeVisible(READY);
      await expect(page.locator('.sidebar')).not.toHaveClass(/collapsed/);
      // the panel body rendered something
      await expect(page.locator('.sidebar')).not.toBeEmpty();

      expect(errors, `${panel} threw on mount`).toEqual([]);
    });
  }
});

test.describe('app panels mount cleanly', () => {
  for (const panel of APP_PANELS) {
    test(`${panel}`, async ({ app: page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));

      await seedUi(page, { mode: 'apps', panel });
      await gotoApp(page);

      await expect(page.locator('.control-bar-container')).toBeVisible(READY);
      await expect(page.locator('.sidebar')).not.toBeEmpty();

      expect(errors, `${panel} threw on mount`).toEqual([]);
    });
  }
});

test.describe('panel switching does not leak errors', () => {
  test('cycles every settings panel by shortcut without throwing', async ({ app: page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await gotoApp(page);
    await expect(page.locator('.control-bar-container')).toBeVisible(READY);

    for (const key of ['1', '2', '3', '4', '5', '6', '7', '8', '9']) {
      await page.keyboard.press(key);
      await page.waitForTimeout(150);
    }

    expect(errors).toEqual([]);
  });
});
