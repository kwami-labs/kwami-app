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
 * Deliberately excluded: toasts, the undo machinery and optimistic updates all
 * stay in the component. No other store imports vue-toastification and this one
 * should not be the first.
 */
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { api, createRequestGuard, isAbortError } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';

const PAGE_SIZE = 100;

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
}

export interface MemoryMessage {
  uuid: string | null;
  content: string | null;
  role: string | null;
  role_type: string | null;
  created_at: string | null;
  thread_id: string | null;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
  _brand?: [K, T];
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
    () => edges.value.length === 0 && nodes.value.length === 0 && messages.value.length === 0,
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
  }

  /** First page of edges and nodes plus all messages, then the rest in the
   *  background. Awaited fully so callers can know when the graph is complete. */
  async function load(): Promise<void> {
    if (!memoryUserId.value) return;
    isLoading.value = true;
    error.value = null;
    const { signal, isCurrent } = guard.begin('load');

    try {
      const [edgesData, nodesData, messagesData] = await Promise.all([
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
        api.get<{ messages?: MemoryMessage[]; session_count?: number }>(`${base()}/messages`, {
          signal,
          timeoutMs: 30_000,
        }),
      ]);

      if (!isCurrent()) return;

      edges.value = edgesData.edges || [];
      edgesTotal.value = edgesData.total ?? edges.value.length;
      edgesHasMore.value = edgesData.has_more ?? false;

      nodes.value = nodesData.nodes || [];
      nodesTotal.value = nodesData.total ?? nodes.value.length;
      nodesHasMore.value = nodesData.has_more ?? false;

      messages.value = messagesData.messages || [];
      sessionCount.value = messagesData.session_count || 0;
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

  async function loadMoreEdges(): Promise<void> {
    if (!memoryUserId.value || !edgesHasMore.value || isLoadingMoreEdges.value) return;
    isLoadingMoreEdges.value = true;
    const { signal, isCurrent } = guard.begin('edges-page');
    try {
      const data = await api.get<PageResponse<'edges', MemoryEdge>>(`${base()}/edges`, {
        query: { limit: PAGE_SIZE, offset: edges.value.length },
        signal,
        timeoutMs: 30_000,
      });
      if (!isCurrent()) return;
      edges.value = [...edges.value, ...(data.edges || [])];
      edgesTotal.value = data.total ?? edges.value.length;
      edgesHasMore.value = data.has_more ?? false;
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
        query: { limit: PAGE_SIZE, offset: nodes.value.length },
        signal,
        timeoutMs: 30_000,
      });
      if (!isCurrent()) return;
      nodes.value = [...nodes.value, ...(data.nodes || [])];
      nodesTotal.value = data.total ?? nodes.value.length;
      nodesHasMore.value = data.has_more ?? false;
    } catch (e) {
      if (isAbortError(e)) return;
      nodesHasMore.value = false;
      console.warn('Failed to load more memory nodes:', e);
    } finally {
      isLoadingMoreNodes.value = false;
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
    load,
    loadMoreEdges,
    loadMoreNodes,
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
