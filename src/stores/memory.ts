/**
 * Memory graph data access.
 *
 * Extracted from MemoryPanel.vue, which held 13 inline fetch calls and was the
 * only app panel with no store. Two things made that worse than ordinary
 * duplication:
 *
 *  1. It derived its API base from VITE_LIVEKIT_TOKEN_ENDPOINT with '/token'
 *     stripped, not from VITE_API_URL. In a typical dev .env those differ, so
 *     the memory panel read and DELETED against production while every other
 *     panel talked to localhost. useKwamiActions already deleted memory
 *     against VITE_API_URL, so the two delete paths targeted different hosts
 *     and no configuration made both correct. This store uses the one shared
 *     API_BASE.
 *
 *  2. Background pagination was fire-and-forget and looped until has_more went
 *     false. Switching kwami cleared the arrays while the previous loop was
 *     still running, so the old kwami's pages appended into the new kwami's
 *     list. Every page now checks the request guard before writing.
 *
 * Paging follows the API's `next_cursor` when it sends one. The API used to
 * read a single Zep page -- 50 records at most, whatever was asked -- so the
 * panel never showed more than 50 facts or entities; it now walks the whole
 * graph, and a cursor costs one Zep call per page where an offset re-walks
 * everything before it.
 *
 * Conversations are kept as sessions (`/sessions`): one entry per conversation,
 * its transcript and Zep's summary loaded when it is opened. Against an API
 * that predates that route (404) the store falls back to the flat
 * `/messages` list.
 *
 * Deliberately excluded: toasts, the undo machinery and optimistic updates all
 * stay in the component. No other store imports vue-toastification and this one
 * should not be the first.
 */
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { ApiError, api, createRequestGuard, isAbortError } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';

const PAGE_SIZE = 100;
const SESSIONS_PAGE_SIZE = 20;
const TRANSCRIPT_PAGE_SIZE = 200;

export interface MemoryEdge {
  uuid: string | null;
  fact: string | null;
  name: string | null;
  valid_at: string | null;
  invalid_at: string | null;
  created_at: string | null;
}

export interface MemoryNodeRecord {
  uuid: string | null;
  name: string | null;
  summary: string | null;
  labels: string[];
  created_at: string | null;
  /** How many facts the entity takes part in, when the API reports it. */
  degree?: number | null;
}

export interface MemoryMessage {
  uuid: string | null;
  content: string | null;
  role: string | null;
  role_type: string | null;
  created_at: string | null;
  thread_id: string | null;
  /** Who said it (the user's name, the kwami's name), when known. */
  name?: string | null;
}

/** One conversation, as `GET /memory/{id}/sessions` lists it. */
export interface MemorySession {
  thread_id: string;
  created_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  message_count: number | null;
  preview: string | null;
  empty: boolean;
  /** Zep could not describe it this time; it still exists. */
  unavailable?: boolean;
}

/** What an empty panel needs in order to explain itself. */
export interface MemoryStatus {
  configured: boolean;
  user_exists: boolean;
  created_at: string | null;
  thread_count: number;
  last_session_at: string | null;
}

export interface SessionTranscript {
  messages: MemoryMessage[];
  total: number;
  hasMore: boolean;
  page: number;
  loading: boolean;
  error: string | null;
  summary: string | null;
  summaryLoaded: boolean;
}

export interface CommunityMember {
  uuid: string;
  name: string;
  summary: string | null;
  labels: string[];
}

export interface Community {
  id: number;
  label: string;
  members: CommunityMember[];
  size: number;
}

export interface DuplicateNodeInfo {
  uuid: string;
  name: string;
  summary: string | null;
  labels: string[];
  edge_count: number;
}

export interface DuplicatePair {
  score: number;
  keep: DuplicateNodeInfo;
  remove: DuplicateNodeInfo;
}

interface PageResponse<K extends string, T> {
  total?: number;
  has_more?: boolean;
  next_cursor?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
  _brand?: [K, T];
}

interface SessionsResponse {
  sessions?: MemorySession[];
  total_threads?: number;
  next_offset?: number | null;
}

interface TranscriptResponse {
  messages?: MemoryMessage[];
  total?: number;
  has_more?: boolean;
  page?: number;
}

function isNotFound(e: unknown): boolean {
  return e instanceof ApiError && e.status === 404;
}

function emptyTranscript(): SessionTranscript {
  return {
    messages: [],
    total: 0,
    hasMore: false,
    page: 0,
    loading: false,
    error: null,
    summary: null,
    summaryLoaded: false,
  };
}

export const useMemoryStore = defineStore('memory', () => {
  const edges = ref<MemoryEdge[]>([]);
  const nodes = ref<MemoryNodeRecord[]>([]);
  const messages = ref<MemoryMessage[]>([]);

  const edgesTotal = ref(0);
  const nodesTotal = ref(0);
  const sessionCount = ref(0);
  const edgesHasMore = ref(false);
  const nodesHasMore = ref(false);
  const edgesCursor = ref<string | null>(null);
  const nodesCursor = ref<string | null>(null);

  const sessions = ref<MemorySession[]>([]);
  const sessionsNextOffset = ref<number | null>(null);
  const sessionsLoading = ref(false);
  const sessionsError = ref<string | null>(null);
  /** False once the API answered 404 for `/sessions`: an older API. */
  const sessionsSupported = ref(true);
  const transcripts = ref<Record<string, SessionTranscript>>({});

  const status = ref<MemoryStatus | null>(null);

  const communities = ref<Community[]>([]);
  const duplicates = ref<DuplicatePair[]>([]);

  const isLoading = ref(false);
  const isLoadingMoreEdges = ref(false);
  const isLoadingMoreNodes = ref(false);
  const isMutating = ref(false);
  const isDeleting = ref(false);
  const communitiesLoading = ref(false);
  const duplicatesLoading = ref(false);
  const error = ref<string | null>(null);

  const guard = createRequestGuard();

  /**
   * Per-kwami memory id: kwami_<authUserId>_<activeKwamiId>.
   * Single definition; useKwami re-exports this rather than recomputing it.
   */
  const memoryUserId = computed(() => {
    const uid = useAuthStore().userId || 'anonymous';
    const kwamiId = useWorkspaceStore().activeWorkspaceId;
    return kwamiId ? `kwami_${uid}_${kwamiId}` : `kwami_${uid}`;
  });

  const isEmpty = computed(
    () =>
      edges.value.length === 0 &&
      nodes.value.length === 0 &&
      messages.value.length === 0 &&
      sessions.value.length === 0,
  );

  /** Conversations recorded, as far as the store knows. */
  const conversationCount = computed(() =>
    sessionsSupported.value ? sessions.value.length : sessionCount.value,
  );

  function base(): string {
    return `/memory/${memoryUserId.value}`;
  }

  function resetData() {
    edges.value = [];
    nodes.value = [];
    messages.value = [];
    edgesTotal.value = 0;
    nodesTotal.value = 0;
    sessionCount.value = 0;
    edgesHasMore.value = false;
    nodesHasMore.value = false;
    edgesCursor.value = null;
    nodesCursor.value = null;
    sessions.value = [];
    sessionsNextOffset.value = null;
    sessionsError.value = null;
    transcripts.value = {};
    status.value = null;
  }

  /** First page of edges and nodes, the sessions and the status, then the
   *  rest of the graph. Awaited fully so callers know when the graph is
   *  complete. Only the graph failing fails the load. */
  async function load(): Promise<void> {
    if (!memoryUserId.value) return;
    isLoading.value = true;
    error.value = null;
    const { signal, isCurrent } = guard.begin('load');

    try {
      const [edgesData, nodesData] = await Promise.all([
        api.get<PageResponse<'edges', MemoryEdge>>(`${base()}/edges`, {
          query: { limit: PAGE_SIZE, offset: 0 },
          signal,
          timeoutMs: 30_000,
        }),
        api.get<PageResponse<'nodes', MemoryNodeRecord>>(`${base()}/nodes`, {
          query: { limit: PAGE_SIZE, offset: 0 },
          signal,
          timeoutMs: 30_000,
        }),
        loadSessions(true),
        loadStatus(),
      ]);

      if (!isCurrent()) return;

      edges.value = edgesData.edges || [];
      edgesTotal.value = edgesData.total ?? edges.value.length;
      edgesHasMore.value = edgesData.has_more ?? false;
      edgesCursor.value = edgesData.next_cursor ?? null;

      nodes.value = nodesData.nodes || [];
      nodesTotal.value = nodesData.total ?? nodes.value.length;
      nodesHasMore.value = nodesData.has_more ?? false;
      nodesCursor.value = nodesData.next_cursor ?? null;
    } catch (e) {
      if (isAbortError(e) || !isCurrent()) return;
      error.value = e instanceof Error ? e.message : 'Failed to load memory data';
      resetData();
      throw e;
    } finally {
      if (isCurrent()) isLoading.value = false;
    }

    // Awaited, unlike the fire-and-forget original, and guard-checked per page.
    await loadAllRemaining(isCurrent);
  }

  async function loadAllRemaining(isCurrent: () => boolean): Promise<void> {
    await Promise.all([
      (async () => {
        while (edgesHasMore.value && isCurrent()) await loadMoreEdges();
      })(),
      (async () => {
        while (nodesHasMore.value && isCurrent()) await loadMoreNodes();
      })(),
    ]);
  }

  /** The next page: by cursor when the API gave one, else by offset. */
  function pageQuery(loaded: number, cursor: string | null) {
    return cursor
      ? { limit: PAGE_SIZE, offset: loaded, cursor }
      : { limit: PAGE_SIZE, offset: loaded };
  }

  async function loadMoreEdges(): Promise<void> {
    if (!memoryUserId.value || !edgesHasMore.value || isLoadingMoreEdges.value) return;
    isLoadingMoreEdges.value = true;
    const { signal, isCurrent } = guard.begin('edges-page');
    try {
      const data = await api.get<PageResponse<'edges', MemoryEdge>>(`${base()}/edges`, {
        query: pageQuery(edges.value.length, edgesCursor.value),
        signal,
        timeoutMs: 30_000,
      });
      if (!isCurrent()) return;
      edges.value = [...edges.value, ...(data.edges || [])];
      edgesTotal.value = data.total ?? edges.value.length;
      edgesHasMore.value = data.has_more ?? false;
      edgesCursor.value = data.next_cursor ?? null;
    } catch (e) {
      if (isAbortError(e)) return;
      edgesHasMore.value = false;
      console.warn('Failed to load more memory edges:', e);
    } finally {
      isLoadingMoreEdges.value = false;
    }
  }

  async function loadMoreNodes(): Promise<void> {
    if (!memoryUserId.value || !nodesHasMore.value || isLoadingMoreNodes.value) return;
    isLoadingMoreNodes.value = true;
    const { signal, isCurrent } = guard.begin('nodes-page');
    try {
      const data = await api.get<PageResponse<'nodes', MemoryNodeRecord>>(`${base()}/nodes`, {
        query: pageQuery(nodes.value.length, nodesCursor.value),
        signal,
        timeoutMs: 30_000,
      });
      if (!isCurrent()) return;
      nodes.value = [...nodes.value, ...(data.nodes || [])];
      nodesTotal.value = data.total ?? nodes.value.length;
      nodesHasMore.value = data.has_more ?? false;
      nodesCursor.value = data.next_cursor ?? null;
    } catch (e) {
      if (isAbortError(e)) return;
      nodesHasMore.value = false;
      console.warn('Failed to load more memory nodes:', e);
    } finally {
      isLoadingMoreNodes.value = false;
    }
  }

  /** The flat newest-first list, for an API without `/sessions`. */
  async function loadLegacyMessages(): Promise<void> {
    const { signal, isCurrent } = guard.begin('messages');
    try {
      const data = await api.get<{ messages?: MemoryMessage[]; session_count?: number }>(
        `${base()}/messages`,
        { signal, timeoutMs: 30_000 },
      );
      if (!isCurrent()) return;
      messages.value = data.messages || [];
      sessionCount.value = data.session_count || 0;
    } catch (e) {
      if (isAbortError(e)) return;
      sessionsError.value = e instanceof Error ? e.message : 'Failed to load conversations';
    }
  }

  /**
   * Conversations, newest first. `reset` starts over; otherwise the next page.
   * Never throws: a failure is kept in `sessionsError`, so it cannot take the
   * graph down with it.
   */
  async function loadSessions(reset = false): Promise<void> {
    if (!memoryUserId.value) return;
    if (!sessionsSupported.value) {
      if (reset) await loadLegacyMessages();
      return;
    }
    if (!reset && sessionsNextOffset.value === null) return;
    const offset = reset ? 0 : (sessionsNextOffset.value ?? 0);
    sessionsLoading.value = true;
    sessionsError.value = null;
    const { signal, isCurrent } = guard.begin('sessions');
    try {
      const data = await api.get<SessionsResponse>(`${base()}/sessions`, {
        query: { limit: SESSIONS_PAGE_SIZE, offset },
        signal,
        timeoutMs: 30_000,
      });
      if (!isCurrent()) return;
      const page = data.sessions || [];
      sessions.value = reset ? page : [...sessions.value, ...page];
      sessionsNextOffset.value = data.next_offset ?? null;
    } catch (e) {
      if (isAbortError(e) || !isCurrent()) return;
      if (isNotFound(e)) {
        sessionsSupported.value = false;
        await loadLegacyMessages();
        return;
      }
      sessionsError.value = e instanceof Error ? e.message : 'Failed to load conversations';
    } finally {
      if (isCurrent()) sessionsLoading.value = false;
    }
  }

  const loadMoreSessions = () => loadSessions(false);

  /** Never throws; an API without `/status` simply leaves it null. */
  async function loadStatus(): Promise<void> {
    if (!memoryUserId.value) return;
    const { signal, isCurrent } = guard.begin('status');
    try {
      const data = await api.get<MemoryStatus>(`${base()}/status`, {
        signal,
        timeoutMs: 15_000,
      });
      if (isCurrent()) status.value = data;
    } catch (e) {
      if (!isAbortError(e) && isCurrent()) status.value = null;
    }
  }

  function transcriptFor(threadId: string): SessionTranscript {
    if (!transcripts.value[threadId]) {
      transcripts.value = { ...transcripts.value, [threadId]: emptyTranscript() };
    }
    return transcripts.value[threadId]!;
  }

  /** One conversation's transcript: the first page, or the next one. */
  async function loadTranscript(threadId: string, more = false): Promise<void> {
    const entry = transcriptFor(threadId);
    if (entry.loading || (more && !entry.hasMore) || (!more && entry.page > 0)) return;
    const page = more ? entry.page + 1 : 1;
    entry.loading = true;
    entry.error = null;
    const owner = memoryUserId.value;
    try {
      const data = await api.get<TranscriptResponse>(
        `${base()}/sessions/${encodeURIComponent(threadId)}/messages`,
        { query: { limit: TRANSCRIPT_PAGE_SIZE, page }, timeoutMs: 30_000 },
      );
      if (owner !== memoryUserId.value) return;
      entry.messages = more ? [...entry.messages, ...(data.messages || [])] : data.messages || [];
      entry.total = data.total ?? entry.messages.length;
      entry.hasMore = data.has_more ?? false;
      entry.page = page;
    } catch (e) {
      entry.error = e instanceof Error ? e.message : 'Failed to load the conversation';
    } finally {
      entry.loading = false;
    }
  }

  /** Zep's running summary of one conversation; null until there is one. */
  async function loadSummary(threadId: string): Promise<void> {
    const entry = transcriptFor(threadId);
    if (entry.summaryLoaded) return;
    try {
      const data = await api.get<{ summary?: string | null }>(
        `${base()}/sessions/${encodeURIComponent(threadId)}/summary`,
        { timeoutMs: 30_000 },
      );
      entry.summary = data.summary ?? null;
    } catch {
      entry.summary = null;
    } finally {
      entry.summaryLoaded = true;
    }
  }

  async function updateEdge(uuid: string, patch: { fact: string }): Promise<void> {
    isMutating.value = true;
    try {
      await api.patch(`${base()}/edge/${uuid}`, patch);
    } finally {
      isMutating.value = false;
    }
  }

  async function updateNode(
    uuid: string,
    patch: { name?: string; summary?: string; labels?: string[] },
  ): Promise<void> {
    isMutating.value = true;
    try {
      await api.patch(`${base()}/node/${uuid}`, patch);
    } finally {
      isMutating.value = false;
    }
  }

  async function deleteEdge(uuid: string): Promise<void> {
    await api.del(`${base()}/edge/${uuid}`);
  }

  async function deleteNode(uuid: string): Promise<void> {
    await api.del(`${base()}/node/${uuid}`);
  }

  async function deleteAll(): Promise<{ deleted_threads?: number }> {
    isDeleting.value = true;
    try {
      const result = await api.del<{ deleted_threads?: number }>(base(), { timeoutMs: 60_000 });
      resetData();
      return result ?? {};
    } finally {
      isDeleting.value = false;
    }
  }

  /**
   * Throws rather than swallowing. The previous console.warn is why the panel
   * showed an empty "no duplicates" state when Zep is unconfigured and the
   * endpoint 503s — indistinguishable from a genuinely clean graph.
   */
  async function loadCommunities(): Promise<void> {
    communitiesLoading.value = true;
    try {
      const data = await api.get<{ communities?: Community[] }>(`${base()}/communities`, {
        timeoutMs: 60_000,
      });
      communities.value = data.communities || [];
    } finally {
      communitiesLoading.value = false;
    }
  }

  async function loadDuplicates(threshold = 75): Promise<void> {
    duplicatesLoading.value = true;
    try {
      const data = await api.get<{ duplicates?: DuplicatePair[] }>(`${base()}/duplicates`, {
        query: { threshold },
        timeoutMs: 60_000,
      });
      duplicates.value = data.duplicates || [];
    } finally {
      duplicatesLoading.value = false;
    }
  }

  async function mergeNodes(
    keepUuid: string,
    removeUuid: string,
  ): Promise<{ keep_name?: string; recreated_edges?: number }> {
    // Merging is destructive and not idempotent.
    return api.post<{ keep_name?: string; recreated_edges?: number }>(
      `${base()}/merge`,
      { keep_uuid: keepUuid, remove_uuid: removeUuid },
      { retry: false, timeoutMs: 60_000 },
    );
  }

  function clear() {
    guard.cancelAll();
    resetData();
    sessionsSupported.value = true;
    communities.value = [];
    duplicates.value = [];
    error.value = null;
  }

  return {
    edges,
    nodes,
    messages,
    edgesTotal,
    nodesTotal,
    sessionCount,
    edgesHasMore,
    nodesHasMore,
    sessions,
    sessionsNextOffset,
    sessionsLoading,
    sessionsError,
    sessionsSupported,
    transcripts,
    status,
    communities,
    duplicates,
    isLoading,
    isLoadingMoreEdges,
    isLoadingMoreNodes,
    isMutating,
    isDeleting,
    communitiesLoading,
    duplicatesLoading,
    error,
    memoryUserId,
    isEmpty,
    conversationCount,
    load,
    loadMoreEdges,
    loadMoreNodes,
    loadSessions,
    loadMoreSessions,
    loadStatus,
    loadTranscript,
    loadSummary,
    updateEdge,
    updateNode,
    deleteEdge,
    deleteNode,
    deleteAll,
    loadCommunities,
    loadDuplicates,
    mergeNodes,
    clear,
  };
});
