import { statSync } from 'node:fs';
import { test, expect, gotoApp, WELCOME_MS } from './fixtures';

const READY = { timeout: WELCOME_MS + 10_000 };

/**
 * The login screen's record button, end to end in a real browser.
 *
 * Worth an e2e rather than only a unit test because the two things that can
 * actually go wrong here are the two things jsdom stubs away: whether this
 * browser can mux the container the button asks for, and whether the blob it
 * produces reaches the disk as a file with bytes in it.
 *
 * The display picker is native UI a test cannot answer, and headless Chromium
 * has no surface to share anyway, so `getDisplayMedia` is replaced with a
 * canvas stream. Everything downstream of it -- MediaRecorder, the container
 * negotiation, the blob, the download -- is the real path.
 */
test.describe('login screen recorder', () => {
  test('rolls from the pill and saves the clip when stopped', async ({ signedOut: page }) => {
    // The welcome hold plus a WebGL avatar plus a second of capture runs close
    // to the default budget on its own, and over it when the suite is contended.
    test.slow();

    await page.addInitScript(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 180;
      const ctx = canvas.getContext('2d')!;
      // A canvas that never changes emits no frames after the first, and a
      // recorder with no frames writes an empty file -- which would make the
      // size assertion below pass or fail for reasons unrelated to the button.
      setInterval(() => {
        ctx.fillStyle = `hsl(${(Date.now() / 10) % 360} 80% 50%)`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }, 50);
      const surface = canvas.captureStream(30);
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getDisplayMedia: async () => surface },
      });
    });

    await gotoApp(page);

    const record = page.locator('.pill-btn--record');
    await expect(record).toBeVisible(READY);

    await record.click();
    await expect(record).toHaveClass(/pill-btn--rolling/);
    // Wait out a tick of the timer so the take has frames in it.
    await expect(record).toContainText('0:01', { timeout: 5_000 });

    const saved = page.waitForEvent('download');
    await record.click();
    const file = await saved;

    // mp4 where the browser can mux it, webm where it cannot -- the point is
    // that the extension matches what was actually recorded.
    expect(file.suggestedFilename()).toMatch(/^kwami-screen-[\d-]+\.(mp4|webm)$/);
    const path = await file.path();
    expect(statSync(path).size).toBeGreaterThan(0);

    await expect(record).not.toHaveClass(/pill-btn--rolling/);
  });
});
