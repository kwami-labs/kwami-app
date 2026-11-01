import { devices, type Page } from '@playwright/test';
import { test, expect, gotoApp, seedUi, WELCOME_MS } from './fixtures';

const READY = { timeout: WELCOME_MS + 10_000 };

/**
 * The workspace on a portrait phone.
 *
 * Laid out for desktop, an open panel was wider than a phone's screen and covered the
 * call button, and the nav rail was taller than the screen, so its last buttons could
 * not be reached at all. On a phone the rail is now a dock along the bottom and an open
 * panel is a sheet between the dock and the call controls (src/assets/main.css,
 * "PHONES"). These check that layout, panel by panel: nothing leaves the screen, the
 * call stays reachable, every panel is a tap away, and the sheet can be swiped shut.
 */
const { viewport, deviceScaleFactor, isMobile, hasTouch, userAgent } = devices['iPhone 14'];
test.use({ viewport, deviceScaleFactor, isMobile, hasTouch, userAgent });

const PANELS: Array<{ mode: 'settings' | 'apps'; panel: string }> = [
  { mode: 'settings', panel: 'avatar' },
  { mode: 'settings', panel: 'audio' },
  { mode: 'settings', panel: 'scene' },
  { mode: 'settings', panel: 'models' },
  { mode: 'settings', panel: 'voice' },
  { mode: 'settings', panel: 'memory' },
  { mode: 'apps', panel: 'contacts' },
  { mode: 'apps', panel: 'email' },
];

/** The call button is the topmost thing at its own centre. */
function callButtonIsReachable(page: Page) {
  return page.evaluate(() => {
    const call = document.querySelector<HTMLElement>('.control-bar .control-btn');
    const box = call?.getBoundingClientRect();
    const top = box
      ? document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
      : null;
    return Boolean(call && top && (call === top || call.contains(top)));
  });
}

/** Which mounted panel the store holds open, as persisted. */
function openPanel(page: Page) {
  return page.evaluate(() =>
    window.localStorage.getItem('kwami-panel-open') === 'true'
      ? window.localStorage.getItem('kwami-active-panel')
      : null,
  );
}

async function ready(page: Page) {
  await gotoApp(page);
  await expect(page.locator('.control-bar-container')).toBeVisible(READY);
  // Polled: the welcome rings sit over the whole screen for their first seconds.
  await expect.poll(() => callButtonIsReachable(page), READY).toBe(true);
}

for (const { mode, panel } of PANELS) {
  test(`the ${panel} panel fits a phone and leaves the call button reachable`, async ({
    app: page,
  }) => {
    await seedUi(page, { mode, panel });
    await ready(page);
    await expect(page.locator('.panel-column')).not.toBeEmpty(READY);

    const layout = await page.evaluate(() => {
      const vw = window.innerWidth;
      const sticksOut: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>('.sidebar *')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        // What is actually painted: a dock button scrolled past the edge is clipped by
        // the dock, so only the part inside every clipping ancestor counts.
        let left = r.left;
        let right = r.right;
        for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
          if (getComputedStyle(a).overflowX === 'visible') continue;
          const ar = a.getBoundingClientRect();
          left = Math.max(left, ar.left);
          right = Math.min(right, ar.right);
        }
        if (right <= left) continue;
        if (right > vw + 1 || left < -1)
          sticksOut.push(String(el.className).split(' ')[0] || el.tagName);
      }
      return {
        pageOverflow: document.documentElement.scrollWidth - vw,
        // MusicPlayer once compiled a rule onto <body> that padded the whole app by 10px.
        bodyPadding: getComputedStyle(document.body).padding,
        sticksOut: [...new Set(sticksOut)],
      };
    });

    expect(layout.pageOverflow).toBeLessThanOrEqual(0);
    expect(layout.bodyPadding).toBe('0px');
    expect(layout.sticksOut).toEqual([]);

    // The title stays on one line instead of wrapping into a column of letters.
    const title = page.locator('.panel-content-wrapper > .panel-inner > .panel-header h2');
    const box = await title.boundingBox();
    expect(box?.height ?? 0).toBeLessThan(30);
  });
}

test('the dock sits along the bottom, under the sheet', async ({ app: page }) => {
  await seedUi(page, { mode: 'settings', panel: 'avatar' });
  await ready(page);
  await expect(page.locator('.panel-column')).not.toBeEmpty(READY);

  const boxes = await page.evaluate(() => {
    const rect = (sel: string) => {
      const r = document.querySelector(sel)!.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    };
    return {
      vw: window.innerWidth,
      vh: window.innerHeight,
      dock: rect('.switcher-column'),
      sheet: rect('.panel-column'),
      controls: rect('.control-bar-container'),
    };
  });

  // Dock: the full width, at the bottom of the screen.
  expect(boxes.dock.bottom).toBeGreaterThan(boxes.vh - 60);
  expect(boxes.dock.right - boxes.dock.left).toBeGreaterThan(boxes.vw * 0.9);
  // Sheet: between the call controls and the dock, overlapping neither.
  expect(boxes.sheet.top).toBeGreaterThanOrEqual(boxes.controls.bottom);
  expect(boxes.sheet.bottom).toBeLessThanOrEqual(boxes.dock.top);
});

// The gesture tests below drive real input through a page rendering WebGL at the
// phone's 3x pixel ratio. Under parallel workers each dispatched event waits on a
// busy frame, and a dozen of them outlast the default 30s budget (measured: the
// timeout landed inside mouse.move, not on any assertion). test.slow() triples it.

test('every settings panel is a tap away in the dock', async ({ app: page }) => {
  test.slow();
  await seedUi(page, { mode: 'settings', panel: 'avatar' });
  await ready(page);
  // Start closed, so the first tap opens a panel rather than closing the seeded one.
  await page.locator('.panel-header-controls .close-btn').tap();
  await expect.poll(() => openPanel(page)).toBeNull();

  const buttons = page.locator('.nav-groups .nav-btn');
  const count = await buttons.count();
  // Fifteen buttons do not fit across a phone; the dock scrolls to the ones that don't.
  expect(count).toBeGreaterThan(10);

  const opened = new Set<string>();
  for (let i = 0; i < count; i++) {
    // tap() scrolls the dock to the button first, as a thumb would.
    await buttons.nth(i).tap();
    await expect.poll(() => openPanel(page)).not.toBeNull();
    const panel = await openPanel(page);
    expect(opened.has(panel!)).toBe(false);
    opened.add(panel!);
  }
  expect(opened.size).toBe(count);
});

test('the dock switches between settings and apps', async ({ app: page }) => {
  await seedUi(page, { mode: 'settings', panel: 'avatar' });
  await ready(page);

  await page.locator('.dock-mode-btn').tap();
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('kwami-sidebar-mode')))
    .toBe('apps');
  await expect(page.locator('.nav-groups .nav-btn').first()).toBeVisible();
});

test('dragging the sheet down closes the panel', async ({ app: page }) => {
  test.slow();
  await seedUi(page, { mode: 'settings', panel: 'avatar' });
  await ready(page);
  await expect(page.locator('.panel-column')).not.toBeEmpty(READY);
  expect(await openPanel(page)).toBe('avatar');

  const handle = await page.locator('.sheet-handle').boundingBox();
  expect(handle).not.toBeNull();
  const x = handle!.x + handle!.width / 2;
  const y = handle!.y + handle!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 120, { steps: 6 });
  await page.mouse.move(x, y + 320, { steps: 6 });
  await page.mouse.up();

  await expect.poll(() => openPanel(page)).toBeNull();
});

test('a short drag springs the sheet back open', async ({ app: page }) => {
  test.slow();
  await seedUi(page, { mode: 'settings', panel: 'avatar' });
  await ready(page);
  await expect(page.locator('.panel-column')).not.toBeEmpty(READY);

  const handle = await page.locator('.sheet-handle').boundingBox();
  const x = handle!.x + handle!.width / 2;
  const y = handle!.y + handle!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 40, { steps: 10 });
  await page.waitForTimeout(150); // a slow drag, not a flick
  await page.mouse.up();

  expect(await openPanel(page)).toBe('avatar');
  await expect
    .poll(() => page.locator('.panel-column').evaluate((el) => el.style.transform))
    .toBe('');
});

test('Back closes the open sheet instead of leaving the app', async ({ app: page }) => {
  test.slow();
  await seedUi(page, { mode: 'settings', panel: 'avatar' });
  await ready(page);
  expect(await openPanel(page)).toBe('avatar');
  const url = page.url();

  // Android's back button and Safari's edge swipe both land here.
  await page.goBack();
  await expect.poll(() => openPanel(page)).toBeNull();
  expect(page.url()).toBe(url);
  await expect(page.locator('.control-bar-container')).toBeVisible();

  // Reopened and closed by its own button, the sheet takes its history entry with it,
  // so the next Back is not spent on a sheet that is already gone.
  await page.locator('.nav-groups .nav-btn').first().tap();
  await expect.poll(() => openPanel(page)).not.toBeNull();
  await page.locator('.panel-header-controls .close-btn').tap();
  await expect.poll(() => openPanel(page)).toBeNull();
  await expect.poll(() => page.evaluate(() => Boolean(history.state?.kwamiPanelSheet))).toBe(false);
});

/**
 * Real touch input, through the DevTools protocol: Playwright's own touchscreen can
 * only tap. The SDK's blob spins on mouse events and toggles the conversation on
 * dblclick; utils/canvasTouchBridge.ts replays finger input as those.
 */
async function fingers(page: Page) {
  // One session for the whole gesture: the protocol tracks the touch per session.
  const cdp = await page.context().newCDPSession(page);
  // `at` stamps the event (seconds from the gesture's start). Without it each event
  // carries its dispatch time, and here, with WebGL rendered in software at a 3x
  // pixel ratio, every dispatch waits ~300ms on a frame: two taps arrived ~550ms
  // apart, slower than any double-tap, Chrome's own included.
  const t0 = Date.now() / 1000;
  return (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number, at?: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
      ...(at === undefined ? {} : { timestamp: t0 + at }),
    });
}

async function countCanvasMouseEvents(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __canvasEvents: Record<string, number> };
    w.__canvasEvents = { mousedown: 0, mousemove: 0, mouseup: 0, dblclick: 0 };
    const canvas = document.getElementById('kwami-canvas')!;
    for (const type of Object.keys(w.__canvasEvents)) {
      canvas.addEventListener(type, () => w.__canvasEvents[type]!++);
    }
  });
  return () =>
    page.evaluate(
      () => (window as unknown as { __canvasEvents: Record<string, number> }).__canvasEvents,
    );
}

async function closedWorkspace(page: Page) {
  await seedUi(page, { mode: 'settings', panel: 'avatar' });
  await page.addInitScript(() => window.localStorage.setItem('kwami-panel-open', 'false'));
  await ready(page);
}

test('a finger drag on the avatar reaches it as a mouse drag', async ({
  app: page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'touch input is sent over CDP, which is Chromium-only');
  test.slow();
  await closedWorkspace(page);
  const events = await countCanvasMouseEvents(page);
  const touch = await fingers(page);

  const { width, height } = page.viewportSize()!;
  const y = Math.round(height * 0.45);
  await touch('touchStart', width / 2 - 60, y);
  for (let i = 1; i <= 6; i++) await touch('touchMove', width / 2 - 60 + i * 20, y);
  await touch('touchEnd', width / 2 + 60, y);

  // Without the bridge a phone sends no mousemove during a drag, so the blob never
  // turned; and a pointercancel (no touch-action: none) would cut the drag short.
  await expect.poll(async () => (await events()).mouseup).toBeGreaterThanOrEqual(1);
  const counts = await events();
  expect(counts.mousemove).toBeGreaterThanOrEqual(5);
  expect(counts.mouseup).toBeGreaterThanOrEqual(1);
  expect(counts.dblclick).toBe(0);
});

test('a double-tap reaches the avatar as exactly one dblclick', async ({
  app: page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'touch input is sent over CDP, which is Chromium-only');
  test.slow();
  await closedWorkspace(page);
  const events = await countCanvasMouseEvents(page);
  const touch = await fingers(page);

  // Off the blob, near the left edge above the dock: on the blob a dblclick starts a
  // conversation, which would dial LiveKit.
  const dock = await page.locator('.switcher-column').boundingBox();
  const x = 10;
  const y = Math.round(dock!.y - 16);
  // Two 60ms taps, 180ms apart: a brisk real double-tap.
  for (let i = 0; i < 2; i++) {
    await touch('touchStart', x, y, i * 0.18);
    await touch('touchEnd', x, y, i * 0.18 + 0.06);
  }

  // Ours, and not also the browser's own: two would start and stop a conversation.
  await expect.poll(async () => (await events()).dblclick).toBe(1);
  await page.waitForTimeout(400);
  expect((await events()).dblclick).toBe(1);
});

/**
 * An iPhone with a notch and a home indicator. No test browser emulates
 * env(safe-area-inset-*), so the app reads the insets through --safe-* variables
 * (src/assets/variables.css) and this sets those to an iPhone 14's: 47px of status
 * bar and notch at the top, 34px of home indicator at the bottom.
 */
async function notched(page: Page) {
  await page.addInitScript(() => {
    // Init scripts run before the <html> element is parsed, so wait for it.
    document.addEventListener('DOMContentLoaded', () => {
      const root = document.documentElement;
      root.style.setProperty('--safe-top', '47px');
      root.style.setProperty('--safe-bottom', '34px');
    });
  });
}

test('nothing sits under the notch or the home indicator', async ({ app: page }) => {
  test.slow();
  await notched(page);
  await seedUi(page, { mode: 'settings', panel: 'avatar' });
  await ready(page);
  await expect(page.locator('.panel-column')).not.toBeEmpty(READY);

  const box = await page.evaluate(() => {
    const r = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
    return {
      vh: window.innerHeight,
      controls: r('.control-bar-container').top,
      chip: r('.mode-switch-container').top,
      sheetTop: r('.panel-column').top,
      dockBottom: r('.switcher-column').bottom,
    };
  });
  expect(box.controls).toBeGreaterThanOrEqual(47);
  expect(box.chip).toBeGreaterThanOrEqual(47);
  expect(box.sheetTop).toBeGreaterThanOrEqual(47 + 48);
  expect(box.dockBottom).toBeLessThanOrEqual(box.vh - 34);
});

test('the login screen keeps clear of the notch and the home indicator', async ({
  signedOut: page,
}) => {
  await notched(page);
  await gotoApp(page);
  const pill = page.locator('.soundtrack-pill');
  await expect(pill).toBeVisible(READY);

  const vh = page.viewportSize()!.height;
  for (const sel of ['.soundtrack-pill', '.prefs-pill', '.auth-footer']) {
    const b = await page.locator(sel).boundingBox();
    expect(b!.y + b!.height, sel).toBeLessThanOrEqual(vh - 34);
  }
});

test('text fields are 16px, so iOS Safari does not zoom into them', async ({ app: page }) => {
  await seedUi(page, { mode: 'apps', panel: 'contacts' });
  await ready(page);
  await expect(page.locator('.sidebar input').first()).toBeVisible(READY);

  // Safari zooms the page into a focused field under 16px and stays zoomed.
  const sizes = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLInputElement>('.sidebar input, .sidebar textarea')]
      .filter((el) => !['range', 'checkbox', 'radio', 'color', 'file'].includes(el.type))
      .map((el) => parseFloat(getComputedStyle(el).fontSize)),
  );
  expect(sizes.length).toBeGreaterThan(0);
  expect(Math.min(...sizes)).toBeGreaterThanOrEqual(16);
});
