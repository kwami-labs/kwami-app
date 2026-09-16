import { test, expect, gotoApp, reloadApp, WELCOME_MS } from './fixtures';

const READY = { timeout: WELCOME_MS + 10_000 };

test.beforeEach(async ({ app: page }) => {
  await gotoApp(page);
  await expect(page.locator('.control-bar-container')).toBeVisible(READY);
  // Panels are lazy-loaded, so the control bar can paint before the sidebar —
  // and usePanelShortcuts' keydown listener — is mounted. Pressing a key before
  // then silently does nothing, which is what made these specs flaky.
  await expect(page.locator('.sidebar')).toBeVisible(READY);
  await expect(page.locator('.sidebar')).not.toBeEmpty();
});

test.describe('panel navigation', () => {
  test('opens the avatar panel by default', async ({ app: page }) => {
    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.locator('.sidebar')).not.toHaveClass(/collapsed/);
  });

  test('number keys switch settings panels', async ({ app: page }) => {
    // SETTINGS_PANEL_KEYS: 1 avatar, 2 scene, 3 audio, ...
    await page.keyboard.press('2');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('kwami-active-panel'))).toBe('scene');

    await page.keyboard.press('3');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('kwami-active-panel'))).toBe('audio');

    await page.keyboard.press('1');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('kwami-active-panel'))).toBe('avatar');
  });

  /**
   * Regression: `p` was handled in BOTH App.vue and usePanelShortcuts, so the
   * two handlers toggled on the same keydown and cancelled each other out —
   * the panel never moved. One press must produce exactly one toggle.
   */
  test('p toggles the panel exactly once per press', async ({ app: page }) => {
    const sidebar = page.locator('.sidebar');
    await expect(sidebar).not.toHaveClass(/collapsed/);

    await page.keyboard.press('p');
    await expect(sidebar).toHaveClass(/collapsed/);

    await page.keyboard.press('p');
    await expect(sidebar).not.toHaveClass(/collapsed/);
  });

  test('ignores shortcuts while typing in a field', async ({ app: page }) => {
    await page.keyboard.press('2');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('kwami-active-panel'))).toBe('scene');

    const field = page.locator('input[type="text"], input:not([type]), textarea').first();
    if (await field.count()) {
      await field.click();
      await field.type('123');
      // still on scene: the keystrokes went to the input, not the shortcut handler
      await expect.poll(() => page.evaluate(() => localStorage.getItem('kwami-active-panel'))).toBe('scene');
    }
  });
});

test.describe('persistence', () => {
  test('restores the active panel across a reload', async ({ app: page }) => {
    await page.keyboard.press('3');
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('kwami-active-panel')), { timeout: 10_000 })
      .toBe('audio');

    await reloadApp(page);
    await expect(page.locator('.control-bar-container')).toBeVisible(READY);

    await expect.poll(() => page.evaluate(() => localStorage.getItem('kwami-active-panel'))).toBe('audio');
  });

  test('persists the theme across a reload', async ({ app: page }) => {
    const before = await page.evaluate(() => localStorage.getItem('kwami-theme'));
    expect(before).not.toBeNull();

    await reloadApp(page);
    await expect(page.locator('.control-bar-container')).toBeVisible(READY);

    const after = await page.evaluate(() => localStorage.getItem('kwami-theme'));
    expect(after).toEqual(before);
  });
});

test.describe('shell', () => {
  test('mounts the avatar canvas', async ({ app: page }) => {
    await expect(page.locator('#kwami-canvas')).toBeAttached();
  });

  test('renders the energy badge and control bar', async ({ app: page }) => {
    await expect(page.locator('.control-bar-container')).toBeVisible();
  });
});
