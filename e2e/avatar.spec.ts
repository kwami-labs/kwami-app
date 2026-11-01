import { test, expect, gotoApp, WELCOME_MS } from './fixtures';

const READY = { timeout: WELCOME_MS + 10_000 };

/**
 * The avatar is the product, and until these specs nothing checked that it
 * actually starts: every other spec passes with a black canvas.
 *
 * That gap is how kwami.io came to show no avatar at all in a Chrome with
 * graphics acceleration switched off, with no error anywhere -- production
 * strips console output, and `new Kwami()` threw from inside Three.js.
 */
test.describe('avatar', () => {
  test('starts and draws into a sized WebGL canvas', async ({ app: page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await gotoApp(page);
    await expect(page.locator('.control-bar-container')).toBeVisible(READY);

    // useKwami exposes the instance only once `new Kwami()` has returned.
    await expect.poll(() => page.evaluate(() => Boolean(window.kwami)), READY).toBe(true);

    // A canvas nobody drew into keeps the HTML default of 300x150. Three.js
    // resizes its drawing buffer to the element on the first render.
    await expect
      .poll(() =>
        page.evaluate(() => {
          const canvas = document.querySelector<HTMLCanvasElement>('#kwami-canvas');
          return canvas ? canvas.width > 300 && canvas.height > 150 : false;
        }),
      )
      .toBe(true);

    await expect(page.getByTestId('avatar-unavailable')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('says why when the browser gives no WebGL, and the app still works', async ({
    app: page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    // What Chrome does with graphics acceleration off: every WebGL request
    // returns null, on every page.
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        type: string,
        ...rest: unknown[]
      ) {
        if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
        return (original as (...a: unknown[]) => unknown).call(this, type, ...rest);
      } as typeof HTMLCanvasElement.prototype.getContext;
    });

    await gotoApp(page);
    await expect(page.locator('.control-bar-container')).toBeVisible(READY);

    const notice = page.getByTestId('avatar-unavailable');
    await expect(notice).toBeVisible(READY);
    await expect(notice).toContainText('graphics acceleration');

    // The rest of the workspace is untouched.
    await expect(page.locator('.sidebar')).toBeVisible(READY);
    expect(errors).toEqual([]);
  });
});
