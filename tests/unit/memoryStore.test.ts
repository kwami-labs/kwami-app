/**
 * The memory panel's data: the whole graph, conversations kept whole, and why
 * a memory looks empty.
 *
 * The API used to answer every listing with Zep's first 50 records, so the panel
 * never showed more than 50 facts or entities; it now pages with a cursor. The
 * history was one flat stream of messages; it is now one entry per
 * conversation, with its transcript and summary loaded when it is opened. An
 * API that predates `/sessions` (404) still gets the flat list.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ApiError } from '@/lib/apiClient';
import { useMemoryStore } from '@/stores/memory';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() }));

vi.mock('@/lib/apiClient', async (original) => ({
  ...(await original<typeof import('@/lib/apiClient')>()),
  api,
}));

const BASE = '/memory/kwami_user-1_kwami-1';

function notFound(path: string) {
  return new ApiError({
    message: 'Not Found',
    status: 404,
    code: 'not_found',
    method: 'GET',
    url: path,
  });
}

type Routes = Record<string, (query: Record<string, unknown>) => unknown>;

function serve(routes: Routes) {
  api.get.mockImplementation(
    async (path: string, options?: { query?: Record<string, unknown> }) => {
      const route = routes[path.replace(BASE, '')];
      if (!route) throw notFound(path);
      const answer = route(options?.query ?? {});
      if (answer instanceof Error) throw answer;
      return answer;
    },
  );
}

const edge = (i: number) => ({ uuid: `e-${i}`, fact: `fact ${i}` });
const node = (i: number) => ({ uuid: `n-${i}`, name: `Node ${i}`, labels: [] });

/** A graph larger than one page, served the way the API pages it now. */
function pagedGraph(edges: number, nodes: number): Routes {
  const pageOf =
    <T>(key: string, make: (i: number) => T, total: number) =>
    (query: Record<string, unknown>) => {
      const start = query.cursor ? Number(String(query.cursor).split('-')[1]) + 1 : 0;
      const items = Array.from({ length: Math.min(100, total - start) }, (_, i) => make(start + i));
      const more = start + items.length < total;
      return {
        [key]: items,
        total: more ? start + items.length + 1 : total,
        has_more: more,
        next_cursor: more ? `${key[0]}-${start + items.length - 1}` : null,
      };
    };
  return {
    '/edges': pageOf('edges', edge, edges),
    '/nodes': pageOf('nodes', node, nodes),
    '/sessions': () => ({ sessions: [], next_offset: null }),
    '/status': () => ({
      configured: true,
      user_exists: true,
      created_at: null,
      thread_count: 0,
      last_session_at: null,
    }),
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  api.get.mockReset();
  // The auth store exposes the id as a computed over the session's user.
  useAuthStore().user = { id: 'user-1' } as never;
  useWorkspaceStore().activeWorkspaceId = 'kwami-1';
});

describe('the graph', () => {
  it('walks every page with the cursor the API returns', async () => {
    serve(pagedGraph(250, 120));
    const store = useMemoryStore();

    await store.load();

    expect(store.edges).toHaveLength(250);
    expect(store.nodes).toHaveLength(120);
    expect(store.edgesTotal).toBe(250);
    expect(store.nodesTotal).toBe(120);
    const edgeQueries = api.get.mock.calls
      .filter(([path]) => path === `${BASE}/edges`)
      .map(([, options]) => options.query);
    expect(edgeQueries).toEqual([
      { limit: 100, offset: 0 },
      { limit: 100, offset: 100, cursor: 'e-99' },
      { limit: 100, offset: 200, cursor: 'e-199' },
    ]);
  });

  it('falls back to offsets against an API without cursors', async () => {
    serve({
      ...pagedGraph(0, 0),
      '/edges': (query) =>
        query.offset === 0
          ? { edges: [edge(0)], total: 2, has_more: true }
          : { edges: [edge(1)], total: 2, has_more: false },
    });
    const store = useMemoryStore();

    await store.load();

    expect(store.edges.map((e) => e.uuid)).toEqual(['e-0', 'e-1']);
    const second = api.get.mock.calls.filter(([p]) => p === `${BASE}/edges`)[1]![1];
    expect(second.query).toEqual({ limit: 100, offset: 1 });
  });

  it('fails the load when the graph cannot be read, not when sessions cannot', async () => {
    serve({ ...pagedGraph(1, 1), '/sessions': () => new Error('sessions down') });
    const store = useMemoryStore();

    await store.load();

    expect(store.edges).toHaveLength(1);
    expect(store.sessionsError).toBe('sessions down');
  });

  it('surfaces a graph failure instead of showing zero', async () => {
    serve({ ...pagedGraph(1, 1), '/edges': () => new Error('Memory service unavailable') });
    const store = useMemoryStore();

    await expect(store.load()).rejects.toThrow('Memory service unavailable');
    expect(store.error).toBe('Memory service unavailable');
  });
});

describe('conversations', () => {
  const session = (id: string) => ({
    thread_id: id,
    created_at: '2026-11-05T18:00:00Z',
    started_at: '2026-11-05T18:00:05Z',
    ended_at: '2026-11-05T18:20:00Z',
    message_count: 12,
    preview: 'Ponme una alarma',
    empty: false,
  });

  it('lists them a page at a time', async () => {
    serve({
      ...pagedGraph(0, 0),
      '/sessions': (query) =>
        query.offset === 0
          ? { sessions: [session('t-2')], next_offset: 1 }
          : { sessions: [session('t-1')], next_offset: null },
    });
    const store = useMemoryStore();

    await store.load();
    expect(store.sessions.map((s) => s.thread_id)).toEqual(['t-2']);
    expect(store.sessionsNextOffset).toBe(1);

    await store.loadMoreSessions();
    expect(store.sessions.map((s) => s.thread_id)).toEqual(['t-2', 't-1']);
    expect(store.sessionsNextOffset).toBeNull();
    expect(store.conversationCount).toBe(2);

    await store.loadMoreSessions();
    expect(api.get.mock.calls.filter(([p]) => p === `${BASE}/sessions`)).toHaveLength(2);
  });

  it('falls back to the flat list against an API without /sessions', async () => {
    const routes = pagedGraph(0, 0);
    delete routes['/sessions'];
    serve({
      ...routes,
      '/messages': () => ({ messages: [{ uuid: 'm-1', content: 'hola' }], session_count: 3 }),
    });
    const store = useMemoryStore();

    await store.load();

    expect(store.sessionsSupported).toBe(false);
    expect(store.messages).toHaveLength(1);
    expect(store.conversationCount).toBe(3);

    await store.loadSessions(true);
    expect(api.get.mock.calls.filter(([p]) => p === `${BASE}/sessions`)).toHaveLength(1);
  });

  it('keeps a failing flat list as an error', async () => {
    const routes = pagedGraph(0, 0);
    delete routes['/sessions'];
    serve({ ...routes, '/messages': () => new Error('messages down') });
    const store = useMemoryStore();

    await store.load();

    expect(store.sessionsError).toBe('messages down');
  });

  it('opens a transcript once, and pages through a long one', async () => {
    serve({
      ...pagedGraph(0, 0),
      '/sessions/t%2F1/messages': (query) =>
        query.page === 1
          ? { messages: [{ uuid: 'm-1', content: 'hola' }], total: 2, has_more: true, page: 1 }
          : { messages: [{ uuid: 'm-2', content: 'adiós' }], total: 2, has_more: false, page: 2 },
    });
    const store = useMemoryStore();

    await store.loadTranscript('t/1');
    await store.loadTranscript('t/1');
    expect(store.transcripts['t/1']!.messages.map((m) => m.uuid)).toEqual(['m-1']);
    expect(store.transcripts['t/1']!.hasMore).toBe(true);

    await store.loadTranscript('t/1', true);
    await store.loadTranscript('t/1', true);
    expect(store.transcripts['t/1']!.messages.map((m) => m.uuid)).toEqual(['m-1', 'm-2']);
    expect(store.transcripts['t/1']!.total).toBe(2);
    expect(api.get.mock.calls.filter(([p]) => p.includes('/messages'))).toHaveLength(2);
  });

  it('keeps a transcript failure on the transcript', async () => {
    serve({ ...pagedGraph(0, 0), '/sessions/t-1/messages': () => new Error('zep down') });
    const store = useMemoryStore();

    await store.loadTranscript('t-1');

    expect(store.transcripts['t-1']!.error).toBe('zep down');
    expect(store.transcripts['t-1']!.loading).toBe(false);
  });

  it('loads a summary once, and treats a missing one as none', async () => {
    serve({
      ...pagedGraph(0, 0),
      '/sessions/t-1/summary': () => ({ summary: 'Hablaron del viaje.' }),
    });
    const store = useMemoryStore();

    await store.loadSummary('t-1');
    await store.loadSummary('t-1');
    await store.loadSummary('t-2');

    expect(store.transcripts['t-1']!.summary).toBe('Hablaron del viaje.');
    expect(store.transcripts['t-2']!.summary).toBeNull();
    expect(store.transcripts['t-2']!.summaryLoaded).toBe(true);
    expect(api.get.mock.calls.filter(([p]) => p.endsWith('/t-1/summary'))).toHaveLength(1);
  });

  it('drops a transcript that arrives after the kwami changed', async () => {
    let release!: (value: unknown) => void;
    api.get.mockImplementation(() => new Promise((resolve) => (release = resolve)));
    const store = useMemoryStore();

    const pending = store.loadTranscript('t-1');
    useWorkspaceStore().activeWorkspaceId = 'kwami-2';
    release({ messages: [{ uuid: 'm-1' }], total: 1 });
    await pending;

    expect(store.transcripts['t-1']!.messages).toEqual([]);
  });
});

describe('status', () => {
  it('is what the API says', async () => {
    serve({
      ...pagedGraph(0, 0),
      '/status': () => ({
        configured: true,
        user_exists: false,
        created_at: null,
        thread_count: 0,
        last_session_at: null,
      }),
    });
    const store = useMemoryStore();

    await store.load();

    expect(store.status?.user_exists).toBe(false);
  });

  it('is null against an API without it', async () => {
    const routes = pagedGraph(0, 0);
    delete routes['/status'];
    serve(routes);
    const store = useMemoryStore();

    await store.load();

    expect(store.status).toBeNull();
  });

  it('is cleared with everything else', async () => {
    serve(pagedGraph(1, 1));
    const store = useMemoryStore();
    await store.load();

    store.clear();

    expect(store.status).toBeNull();
    expect(store.sessions).toEqual([]);
    expect(store.edges).toEqual([]);
    expect(store.sessionsSupported).toBe(true);
  });
});
