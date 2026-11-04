import { readFile } from 'node:fs/promises';
import { test, expect, gotoApp, seedUi, WELCOME_MS } from './fixtures';

const READY = { timeout: WELCOME_MS + 10_000 };

test.describe('installing the app', () => {
  test('offers the PWA and the Windows app apart, and the Windows one downloads', async ({
    app: page,
  }) => {
    await seedUi(page, { mode: 'settings', panel: 'account' });
    await gotoApp(page);

    const pwa = page.getByTestId('pwa-card');
    const native = page.getByTestId('native-card');
    await expect(pwa).toContainText('JS · PWA', READY);
    await expect(native).toContainText('Rust · Tauri');
    await expect(pwa.getByTestId('pwa-download')).toBeVisible();

    const downloading = page.waitForEvent('download');
    await native.getByTestId('native-download').click();
    const download = await downloading;

    expect(download.suggestedFilename()).toBe('KWAMI-setup.exe');
    // A missing file would still "download": the server answers with the app's HTML.
    const file = await readFile(await download.path());
    expect(file.subarray(0, 2).toString()).toBe('MZ');
  });
});
