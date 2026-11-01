import { devices } from '@playwright/test';
import { test, expect, gotoApp, seedUi, WELCOME_MS } from './fixtures';

const READY = { timeout: WELCOME_MS + 10_000 };

/**
 * The workspace on a phone.
 *
 * Laid out for desktop, an open panel was wider than a phone's screen: its right side
 * (header buttons, cards, the Activate button) was cut off, and it covered the energy
 * badge and the call button, so a call could not be started with a panel open. These
 * check, panel by panel, that nothing leaves the screen and the call stays reachable.
 */
const { viewport, deviceScaleFactor, isMobile, hasTouch, userAgent } = devices['iPhone 14'];
test.use({ viewport, deviceScaleFactor, isMobile, hasTouch, userAgent });

const PANELS: Array<{ mode: 'settings' | 'apps'; panel: string }> = [
  { mode: 'settings', panel: 'avatar' },
  { mode: 'settings', panel: 'scene' },
  { mode: 'settings', panel: 'models' },
  { mode: 'settings', panel: 'voice' },
  { mode: 'settings', panel: 'memory' },
  { mode: 'apps', panel: 'contacts' },
  { mode: 'apps', panel: 'email' },
];

for (const { mode, panel } of PANELS) {
  test(`the ${panel} panel fits a phone and leaves the call button reachable`, async ({
    app: page,
  }) => {
    await seedUi(page, { mode, panel });
    await gotoApp(page);
    await expect(page.locator('.control-bar-container')).toBeVisible(READY);
    await expect(page.locator('.panel-column')).not.toBeEmpty(READY);

    // The call button is the topmost thing at its own centre. Polled: the welcome rings
    // sit over the whole screen for their first seconds, as they should.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const call = document.querySelector<HTMLElement>('.control-bar .control-btn');
            const box = call?.getBoundingClientRect();
            const top = box
              ? document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
              : null;
            return Boolean(call && top && (call === top || call.contains(top)));
          }),
        READY,
      )
      .toBe(true);

    const layout = await page.evaluate(() => {
      const vw = window.innerWidth;
      const sticksOut: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>('.sidebar *')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.right > vw + 1 && r.left < vw)
          sticksOut.push(String(el.className).split(' ')[0] || el.tagName);
      }
      return {
        pageOverflow: document.documentElement.scrollWidth - vw,
        sticksOut: [...new Set(sticksOut)],
      };
    });

    expect(layout.pageOverflow).toBeLessThanOrEqual(0);
    expect(layout.sticksOut).toEqual([]);
  });
}
