import type { Page, Route } from '@playwright/test';
import { test, expect, gotoApp, seedUi, WELCOME_MS } from './fixtures';

/**
 * The memory panel against an API that answers the way kwami-lk-api does now:
 * the whole graph by cursor (Zep pages are 50 long, and the panel used to stop
 * at the first), conversations as sessions with a transcript and a summary each,
 * and a status that explains an empty memory.
 *
 * Registered after the shared stubs, so these routes win for /memory/*.
 * Service workers are blocked: requests a worker makes never reach page.route.
 */

const READY = { timeout: WELCOME_MS + 10_000 };
/** Any memory id: the kwami may not be loaded yet when the panel first asks. */
const MEMORY_PATH = /^\/memory\/kwami_[^/]+/;

const FACTS = 130;

function factsPage(cursor: string | null) {
  const start = cursor ? Number(cursor.split('-')[1]) + 1 : 0;
  const count = Math.min(100, FACTS - start);
  const more = start + count < FACTS;
  return {
    edges: Array.from({ length: count }, (_, i) => ({
      uuid: `e-${start + i}`,
      fact: `Fact number ${start + i}`,
      name: 'RELATES_TO',
      valid_at: null,
      invalid_at: null,
      created_at: '2026-11-05T18:00:00Z',
    })),
    total: more ? start + count + 1 : FACTS,
    total_is_exact: !more,
    has_more: more,
    next_cursor: more ? `e-${start + count - 1}` : null,
  };
}

const SESSIONS = [
  {
    thread_id: 't-today',
    created_at: '2026-11-06T09:00:00Z',
    started_at: '2026-11-06T09:00:02Z',
    ended_at: '2026-11-06T09:12:00Z',
    message_count: 4,
    preview: 'Remind me to call the dentist tomorrow at nine',
    empty: false,
  },
  {
    thread_id: 't-yesterday',
    created_at: '2026-11-05T18:00:00Z',
    started_at: '2026-11-05T18:00:05Z',
    ended_at: '2026-11-05T18:40:00Z',
    message_count: 22,
    preview: 'Let us review the Nvidia position',
    empty: false,
  },
];

async function stubMemory(page: Page, { empty = false } = {}) {
  await page.route('**/memory/**', async (route: Route) => {
    const url = new URL(route.request().url());
    if (url.port !== '8080') return route.fallback();
    const path = url.pathname.replace(MEMORY_PATH, '');
    const json = (body: unknown) => route.fulfill({ status: 200, json: body });

    if (path === '/edges')
      return json(empty ? factsPageEmpty() : factsPage(url.searchParams.get('cursor')));
    if (path === '/nodes')
      return json({
        nodes: empty
          ? []
          : [
              {
                uuid: 'n-1',
                name: 'Dentist call',
                summary: 'Tomorrow at nine.',
                labels: ['Task'],
                degree: 2,
              },
              {
                uuid: 'n-2',
                name: 'Nvidia',
                summary: 'A holding under review.',
                labels: ['Asset'],
                degree: 3,
              },
            ],
        total: empty ? 0 : 2,
        has_more: false,
        next_cursor: null,
      });
    if (path === '/status')
      return json({
        configured: true,
        user_exists: !empty,
        created_at: null,
        thread_count: empty ? 0 : 2,
        last_session_at: empty ? null : '2026-11-06T09:00:00Z',
      });
    if (path === '/sessions') return json({ sessions: empty ? [] : SESSIONS, next_offset: null });
    if (path === '/sessions/t-today/messages')
      return json({
        messages: [
          {
            uuid: 'm-1',
            role: 'user',
            name: null,
            content: 'Remind me to call the dentist tomorrow at nine',
            created_at: '2026-11-06T09:00:02Z',
          },
          {
            uuid: 'm-2',
            role: 'assistant',
            name: 'Jarvis',
            content: 'Noted, sir.',
            created_at: '2026-11-06T09:00:05Z',
          },
        ],
        total: 2,
        has_more: false,
        page: 1,
      });
    if (path === '/sessions/t-today/summary')
      return json({ summary: 'The user set a reminder to call the dentist.' });
    return json({});
  });
}

function factsPageEmpty() {
  return { edges: [], total: 0, total_is_exact: true, has_more: false, next_cursor: null };
}

test.use({ serviceWorkers: 'block' });

test.describe('memory panel', () => {
  test('shows every fact, and conversations whole', async ({ app: page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await stubMemory(page);
    await seedUi(page, { mode: 'settings', panel: 'memory' });
    await gotoApp(page);

    const panel = page.locator('.sidebar');
    await expect(panel.locator('.stat-card').first()).toContainText(String(FACTS), READY);
    const conversations = panel.locator('.stat-card', { hasText: 'Chats' });
    await expect(conversations).toContainText('2');

    await conversations.click();
    const first = panel.locator('.session-card').first();
    await expect(first).toContainText('Remind me to call the dentist tomorrow at nine');
    await expect(first).toContainText('4 messages');
    await expect(first).toContainText('12 min');

    await first.locator('button.session-head').click();
    await expect(first.locator('.session-summary')).toContainText('reminder to call the dentist');
    await expect(first.locator('.line')).toHaveCount(2);
    await expect(first.locator('.line').nth(1)).toContainText('Jarvis');

    await page.screenshot({ path: 'test-results/memory-panel.png', fullPage: false });
    expect(errors).toEqual([]);
  });

  test('explains a memory that has never stored a conversation', async ({ app: page }) => {
    await stubMemory(page, { empty: true });
    await seedUi(page, { mode: 'settings', panel: 'memory' });
    await gotoApp(page);

    await expect(page.locator('.memory-status-note')).toContainText(
      'has not stored a conversation yet',
      READY,
    );
  });
});
