import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, expect, gotoApp, seedUi, WELCOME_MS } from './fixtures';
import type { Page } from '@playwright/test';

const READY = { timeout: WELCOME_MS + 10_000 };

/**
 * The crate's files are megabytes each, so every track is served as one second
 * of silence instead.
 *
 * It has to be a real, decodable mp3: an empty body makes the element raise
 * `error`, and the controller answers that by skipping to another record —
 * which is right in production and makes any assertion about *which* track is
 * on flake here.
 */
const SILENCE = readFileSync(fileURLToPath(new URL('./fixtures/silence.mp3', import.meta.url)));

async function stubTrackFiles(page: Page) {
  await page.route('**/audio/tour/*.mp3', (route) =>
    route.fulfill({ status: 200, contentType: 'audio/mpeg', body: SILENCE }),
  );
}

/**
 * One walk rather than four tests: booting this screen costs the welcome hold
 * plus a WebGL avatar, and the suite is already contended enough that the
 * keyboard specs flake under it.
 */
test.describe('login soundtrack', () => {
  test('plays, credits and changes the record without blowing the stack', async ({
    signedOut: page,
  }) => {
    // The welcome hold plus a WebGL avatar plus four interactions runs close to
    // the default budget on its own, and over it when the suite is contended.
    test.slow();

    const errors: string[] = [];
    const requested: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (r) => {
      if (r.url().includes('/audio/tour/')) requested.push(r.url());
    });
    await stubTrackFiles(page);
    await gotoApp(page);

    const toggle = page.locator('.soundtrack-pill button').first();
    await expect(toggle).toBeVisible(READY);
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    // Nothing on the deck yet: no track line, no skip button, and — the point
    // of loading lazily — not one byte of the crate fetched.
    await expect(page.locator('.soundtrack-pill .pill-track')).toHaveCount(0);
    expect(requested, 'a track was fetched before play was pressed').toEqual([]);

    // A visitor's first ever press always draws Posterity out of the crate.
    await toggle.click();
    await expect(page.locator('.soundtrack-pill .pill-title')).toHaveText('Posterity');
    await expect(page.locator('.soundtrack-pill .pill-artist')).toHaveText('Ludwig Göransson');
    await expect(page.locator('.soundtrack-pill a')).toHaveAttribute(
      'href',
      'https://www.youtube.com/watch?v=ZE5zXLOyEOQ',
    );

    await page.locator('.soundtrack-pill button').nth(1).click();
    await expect(page.locator('.soundtrack-pill .pill-title')).not.toHaveText('Posterity');

    /**
     * Regression: `proxyClickToCanvas` forwarded a bubbling click onto the
     * canvas, which reached the same window listener again and recursed until
     * the stack blew. Every click on this screen raised a RangeError — the pill
     * is simply the first control here anyone clicks on purpose.
     */
    await page.mouse.click(1180, 90);
    expect(errors).toEqual([]);
  });
});

test.describe('audio panel soundtrack', () => {
  test('plays the same crate from settings', async ({ app: page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await stubTrackFiles(page);
    await seedUi(page, { mode: 'settings', panel: 'audio' });
    await gotoApp(page);

    const crate = page.locator('.transport-btn--crate');
    await expect(crate).toBeVisible(READY);

    await crate.click();
    // The title switches from the empty-state copy to "Title · Artist".
    await expect(page.locator('.player-title')).toContainText('·');

    expect(errors).toEqual([]);
  });
});
