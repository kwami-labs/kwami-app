<script setup lang="ts">
import { ref, onMounted, computed, watch, h, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { panelIcons } from '@/constants/panel-icons';
import { useToast, TYPE } from 'vue-toastification';
import { useKwami } from '@/composables/useKwami';
import { useAuthStore } from '@/stores/auth';
import { useVoiceStore } from '@/stores/voice';
import { storeToRefs } from 'pinia';
import PanelSection from '@/components/ui/PanelSection.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import BaseToggle from '@/components/ui/BaseToggle.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import PanelHeaderControls from '@/components/ui/PanelHeaderControls.vue';
import ReorganizePreview from '@/components/memory/ReorganizePreview.vue';
import { MemoryGraph } from '@/components/memory';
import { intlLocaleTag, getCurrentLocale } from '@/i18n';
import { translateApiUserMessage } from '@/utils/translateApiMessage';

const toast = useToast();
const { t } = useI18n();

const { memoryUserId, kwami, isConnected } = useKwami();
const authStore = useAuthStore();
const { memoryUI } = storeToRefs(useVoiceStore());

// API base URL derived from token endpoint
const apiBaseUrl = computed(() => {
  const tokenEndpoint = import.meta.env.VITE_LIVEKIT_TOKEN_ENDPOINT || '';
  return tokenEndpoint.replace(/\/token\/?$/, '') || 'http://localhost:8080';
});

// Per-kwami memory user id (each kwami has its own memory)
const userId = computed(() => memoryUserId.value);

// Loading states
const isLoading = ref(false);
const loadError = ref('');

// Tab state (persisted via store)
const activeTab = computed({
  get: () => memoryUI.value.activeTab,
  set: (v) => { memoryUI.value.activeTab = v; }
});

const contextSize = computed({
  get: () => memoryUI.value.contextSize,
  set: (v: 'lean' | 'balanced' | 'rich') => { memoryUI.value.contextSize = v; },
});

const includeFacts = computed({
  get: () => memoryUI.value.includeFacts ?? true,
  set: (v: boolean) => { memoryUI.value.includeFacts = v; },
});

const contextSizeOptions = computed(() => [
  { label: t('memory.contextSizeLean'), value: 'lean' },
  { label: t('memory.contextSizeBalanced'), value: 'balanced' },
  { label: t('memory.contextSizeRich'), value: 'rich' },
]);

function getMemoryRuntimeConfig(size: 'lean' | 'balanced' | 'rich', withFacts: boolean) {
  if (size === 'lean') {
    return {
      maxContextMessages: 4,
      includeFacts: withFacts,
      minFactRelevance: 0.7,
    };
  }
  if (size === 'rich') {
    return {
      maxContextMessages: 16,
      includeFacts: withFacts,
      minFactRelevance: 0.35,
    };
  }
  return {
    maxContextMessages: 10,
    includeFacts: withFacts,
    minFactRelevance: 0.5,
  };
}

function setContextSize(value: string | number) {
  const normalized = String(value) as 'lean' | 'balanced' | 'rich';
  if (normalized === 'lean' || normalized === 'balanced' || normalized === 'rich') {
    contextSize.value = normalized;
  }
}

// Memory data
interface Edge {
  uuid: string | null;
  fact: string | null;
  name: string | null;
  valid_at: string | null;
  invalid_at: string | null;
  created_at: string | null;
}

interface Node {
  uuid: string | null;
  name: string | null;
  summary: string | null;
  labels: string[];
  created_at: string | null;
}

interface Message {
  uuid: string | null;
  content: string | null;
  role: string | null;
  role_type: string | null;
  created_at: string | null;
  thread_id: string | null;
}

const edges = ref<Edge[]>([]);
const nodes = ref<Node[]>([]);
const messages = ref<Message[]>([]);
const sessionCount = ref(0);

// Pagination state
const PAGE_SIZE = 50;
const edgesTotal = ref(0);
const nodesTotal = ref(0);
const edgesHasMore = ref(false);
const nodesHasMore = ref(false);
const isLoadingMoreEdges = ref(false);
const isLoadingMoreNodes = ref(false);

// Graph modal state (shared so agent tools can open it)
const showGraphModal = computed({
  get: () => memoryUI.value.graphModalOpen,
  set: (v) => { memoryUI.value.graphModalOpen = Boolean(v); },
});

// Delete confirmation state
const showDeleteConfirm = ref(false);
const isDeleting = ref(false);
const deleteError = ref('');

// ============================================================================
// Editing state — Facts
// ============================================================================
const editingEdgeUuid = ref<string | null>(null);
const editEdgeData = ref({ fact: '' });
const savingEdge = ref(false);

function startEditEdge(edge: Edge) {
  editingEdgeUuid.value = edge.uuid;
  editEdgeData.value = { fact: edge.fact || '' };
  nextTick(() => {
    const input = document.querySelector('.edit-fact-input') as HTMLInputElement;
    input?.focus();
  });
}

function cancelEditEdge() {
  editingEdgeUuid.value = null;
  editEdgeData.value = { fact: '' };
}

async function saveEdge() {
  const uuid = editingEdgeUuid.value;
  if (!uuid || !userId.value) return;

  const newFact = editEdgeData.value.fact.trim();
  if (!newFact) return;

  // Find original to compare
  const edge = edges.value.find(e => e.uuid === uuid);
  if (!edge || edge.fact === newFact) {
    cancelEditEdge();
    return;
  }

  const oldFact = edge.fact;
  savingEdge.value = true;

  // Optimistic update
  edge.fact = newFact;
  cancelEditEdge();

  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${apiBaseUrl.value}/memory/${userId.value}/edge/${uuid}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ fact: newFact }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to update fact');
    }

    toast.success(t('memory.toastFactUpdated'), { timeout: 2000 });
  } catch (e) {
    // Revert
    edge.fact = oldFact;
    toast.error(
      t('memory.toastUpdateFailed', { message: translateApiUserMessage((e as Error).message, t) }),
    );
  } finally {
    savingEdge.value = false;
  }
}

// ============================================================================
// Editing state — Entities
// ============================================================================
const editingNodeUuid = ref<string | null>(null);
const editNodeData = ref({ name: '', summary: '', labels: [] as string[], newLabel: '' });
const savingNode = ref(false);

// Available entity types for the labels dropdown
const entityTypeNames = [
  'Preference', 'Person', 'Organization', 'Location', 'Event',
  'Project', 'Topic', 'Product', 'Skill', 'Goal', 'Procedure',
  'Pet', 'Activity', 'Attribute', 'Genre', 'Artist', 'Tool', 'Venue',
];

const entityTypeOptions = computed(() =>
  entityTypeNames
    .filter(et => !editNodeData.value.labels.includes(et))
    .map(et => ({ label: et, value: et }))
);

function startEditNode(node: Node) {
  editingNodeUuid.value = node.uuid;
  editNodeData.value = {
    name: node.name || '',
    summary: node.summary || '',
    labels: [...(node.labels || [])],
    newLabel: '',
  };
}

function cancelEditNode() {
  editingNodeUuid.value = null;
  editNodeData.value = { name: '', summary: '', labels: [], newLabel: '' };
}

function removeEditLabel(index: number) {
  editNodeData.value.labels.splice(index, 1);
}

function addEditLabel(label: string | number) {
  const val = String(label).trim();
  if (val && !editNodeData.value.labels.includes(val)) {
    editNodeData.value.labels.push(val);
  }
  editNodeData.value.newLabel = '';
}

async function saveNode() {
  const uuid = editingNodeUuid.value;
  if (!uuid || !userId.value) return;

  const newName = editNodeData.value.name.trim();
  if (!newName) return;

  const node = nodes.value.find(n => n.uuid === uuid);
  if (!node) { cancelEditNode(); return; }

  const oldName = node.name;
  const oldSummary = node.summary;
  const oldLabels = [...node.labels];
  savingNode.value = true;

  // Optimistic update
  node.name = newName;
  node.summary = editNodeData.value.summary.trim() || null;
  node.labels = [...editNodeData.value.labels];
  cancelEditNode();

  try {
    const headers = await getAuthHeaders();
    const body: Record<string, unknown> = { name: newName };
    if (editNodeData.value.summary.trim()) {
      body.summary = editNodeData.value.summary.trim();
    }
    if (editNodeData.value.labels.length > 0) {
      body.labels = editNodeData.value.labels;
    }

    const response = await fetch(`${apiBaseUrl.value}/memory/${userId.value}/node/${uuid}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to update entity');
    }

    toast.success(t('memory.toastEntityUpdated'), { timeout: 2000 });
  } catch (e) {
    // Revert
    node.name = oldName;
    node.summary = oldSummary;
    node.labels = oldLabels;
    toast.error(
      t('memory.toastUpdateFailed', { message: translateApiUserMessage((e as Error).message, t) }),
    );
  } finally {
    savingNode.value = false;
  }
}

// ============================================================================
// Graph Operations: Communities, Duplicates, Merge, Reorganize
// ============================================================================
interface CommunityMember { uuid: string; name: string; summary: string | null; labels: string[]; }
interface Community { id: number; label: string; members: CommunityMember[]; size: number; }
interface DuplicateNodeInfo { uuid: string; name: string; summary: string | null; labels: string[]; edge_count: number; }
interface DuplicatePair { score: number; keep: DuplicateNodeInfo; remove: DuplicateNodeInfo; }

const communities = ref<Community[]>([]);
const communitiesLoading = ref(false);

const duplicates = ref<DuplicatePair[]>([]);
const duplicatesLoading = ref(false);

const reorganizeRef = ref<InstanceType<typeof ReorganizePreview> | null>(null);

const mergingPair = ref<string | null>(null);

async function loadCommunities() {
  communitiesLoading.value = true;
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${apiBaseUrl.value}/memory/${userId.value}/communities`, { headers });
    if (response.ok) {
      const data = await response.json();
      communities.value = data.communities || [];
    }
  } catch (e) {
    console.warn('Failed to load communities:', e);
  } finally {
    communitiesLoading.value = false;
  }
}

async function loadDuplicates() {
  duplicatesLoading.value = true;
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${apiBaseUrl.value}/memory/${userId.value}/duplicates?threshold=75`, { headers });
    if (response.ok) {
      const data = await response.json();
      duplicates.value = data.duplicates || [];
    }
  } catch (e) {
    console.warn('Failed to load duplicates:', e);
  } finally {
    duplicatesLoading.value = false;
  }
}

async function mergePair(keepUuid: string, removeUuid: string) {
  mergingPair.value = `${keepUuid}-${removeUuid}`;
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${apiBaseUrl.value}/memory/${userId.value}/merge`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ keep_uuid: keepUuid, remove_uuid: removeUuid }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to merge');
    }
    const result = await response.json();
    toast.success(
      t('memory.mergeSuccess', { name: result.keep_name, edges: result.recreated_edges }),
      { timeout: 3000 },
    );
    // Remove the merged pair from the list
    duplicates.value = duplicates.value.filter(
      d => !(d.keep.uuid === keepUuid && d.remove.uuid === removeUuid)
    );
    // Refresh data
    loadMemoryData();
  } catch (e) {
    toast.error(
      t('memory.toastMergeFailed', { message: translateApiUserMessage((e as Error).message, t) }),
    );
  } finally {
    mergingPair.value = null;
  }
}

function onReorgDone() {
  loadMemoryData();
  loadCommunities();
  loadDuplicates();
}

// Format date with time (HH:mm:ss) in user's local time
function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const tag = intlLocaleTag(getCurrentLocale());
    const dateFormatted = date.toLocaleDateString(tag, {
      month: 'short',
      day: 'numeric',
    });
    const timeFormatted = date.toLocaleTimeString(tag, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    return `${dateFormatted} ${timeFormatted}`;
  } catch {
    return dateStr;
  }
}

// Get authorization headers for API calls
async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await authStore.getAccessToken();
  if (token) {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }
  return { 'Content-Type': 'application/json' };
}

// Fetch memory data from API with pagination (first page)
async function loadMemoryData() {
  if (!userId.value) return;
  
  console.log('Loading memory for user:', userId.value);
  isLoading.value = true;
  loadError.value = '';
  
  // Reset pagination state
  edges.value = [];
  nodes.value = [];
  messages.value = [];
  edgesTotal.value = 0;
  nodesTotal.value = 0;
  edgesHasMore.value = false;
  nodesHasMore.value = false;
  sessionCount.value = 0;
  
  try {
    const headers = await getAuthHeaders();
    
    // Fetch first page of edges/nodes + all messages in parallel
    const [edgesRes, nodesRes, messagesRes] = await Promise.all([
      fetch(`${apiBaseUrl.value}/memory/${userId.value}/edges?limit=${PAGE_SIZE}&offset=0`, { headers }),
      fetch(`${apiBaseUrl.value}/memory/${userId.value}/nodes?limit=${PAGE_SIZE}&offset=0`, { headers }),
      fetch(`${apiBaseUrl.value}/memory/${userId.value}/messages`, { headers }),
    ]);
    
    if (!edgesRes.ok || !nodesRes.ok || !messagesRes.ok) {
      throw new Error('Failed to load memory data');
    }
    
    const [edgesData, nodesData, messagesData] = await Promise.all([
      edgesRes.json(),
      nodesRes.json(),
      messagesRes.json(),
    ]);
    
    edges.value = edgesData.edges || [];
    edgesTotal.value = edgesData.total ?? edges.value.length;
    edgesHasMore.value = edgesData.has_more ?? false;
    
    nodes.value = nodesData.nodes || [];
    nodesTotal.value = nodesData.total ?? nodes.value.length;
    nodesHasMore.value = nodesData.has_more ?? false;
    
    messages.value = messagesData.messages || [];
    sessionCount.value = messagesData.session_count || 0;
    
    // Auto-load remaining pages in the background
    loadRemainingPages();
    
  } catch (e) {
    loadError.value = (e as Error).message;
    edges.value = [];
    nodes.value = [];
    messages.value = [];
    edgesTotal.value = 0;
    nodesTotal.value = 0;
    edgesHasMore.value = false;
    nodesHasMore.value = false;
    sessionCount.value = 0;
  } finally {
    isLoading.value = false;
  }
}

// Auto-load remaining pages in background after initial load
async function loadRemainingPages() {
  const promises: Promise<void>[] = [];
  if (edgesHasMore.value) promises.push(loadAllRemainingEdges());
  if (nodesHasMore.value) promises.push(loadAllRemainingNodes());
  await Promise.all(promises);
}

// Load all remaining edge pages in sequence
async function loadAllRemainingEdges() {
  while (edgesHasMore.value) {
    await loadMoreEdges();
  }
}

// Load all remaining node pages in sequence
async function loadAllRemainingNodes() {
  while (nodesHasMore.value) {
    await loadMoreNodes();
  }
}

// Load next page of edges
async function loadMoreEdges() {
  if (!userId.value || !edgesHasMore.value || isLoadingMoreEdges.value) return;
  
  isLoadingMoreEdges.value = true;
  try {
    const headers = await getAuthHeaders();
    const offset = edges.value.length;
    const res = await fetch(
      `${apiBaseUrl.value}/memory/${userId.value}/edges?limit=${PAGE_SIZE}&offset=${offset}`,
      { headers }
    );
    
    if (!res.ok) throw new Error('Failed to load more edges');
    
    const data = await res.json();
    edges.value.push(...(data.edges || []));
    edgesTotal.value = data.total ?? edges.value.length;
    edgesHasMore.value = data.has_more ?? false;
    
    console.log(`Loaded edges: ${edges.value.length}/${edgesTotal.value}`);
  } catch (e) {
    console.error('Failed to load more edges:', e);
    edgesHasMore.value = false;
  } finally {
    isLoadingMoreEdges.value = false;
  }
}

// Load next page of nodes
async function loadMoreNodes() {
  if (!userId.value || !nodesHasMore.value || isLoadingMoreNodes.value) return;
  
  isLoadingMoreNodes.value = true;
  try {
    const headers = await getAuthHeaders();
    const offset = nodes.value.length;
    const res = await fetch(
      `${apiBaseUrl.value}/memory/${userId.value}/nodes?limit=${PAGE_SIZE}&offset=${offset}`,
      { headers }
    );
    
    if (!res.ok) throw new Error('Failed to load more nodes');
    
    const data = await res.json();
    nodes.value.push(...(data.nodes || []));
    nodesTotal.value = data.total ?? nodes.value.length;
    nodesHasMore.value = data.has_more ?? false;
    
    console.log(`Loaded nodes: ${nodes.value.length}/${nodesTotal.value}`);
  } catch (e) {
    console.error('Failed to load more nodes:', e);
    nodesHasMore.value = false;
  } finally {
    isLoadingMoreNodes.value = false;
  }
}

async function deleteUserMemory() {
  if (!userId.value) return;
  
  isDeleting.value = true;
  deleteError.value = '';
  
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${apiBaseUrl.value}/memory/${userId.value}`, {
      method: 'DELETE',
      headers,
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.detail || 'Failed to delete memory');
    }
    
    if (result.success) {
      showDeleteConfirm.value = false;
      edges.value = [];
      nodes.value = [];
      messages.value = [];
      sessionCount.value = 0;
      edgesTotal.value = 0;
      nodesTotal.value = 0;
      edgesHasMore.value = false;
      nodesHasMore.value = false;
      const nThreads = Number(result.deleted_threads) || 0;
      toast.success(t('memory.toastMemoryDeleted', { n: nThreads }, nThreads));
    } else {
      throw new Error(result.errors?.join(', ') || 'Delete operation failed');
    }
  } catch (e) {
    deleteError.value = (e as Error).message;
  } finally {
    isDeleting.value = false;
  }
}

// Pending deletions for undo functionality
interface PendingDeletion {
  type: 'edge' | 'node';
  uuid: string;
  item: Edge | Node;
  index: number;
  timeoutId: ReturnType<typeof setTimeout>;
  toastId: string | number;
}
const pendingDeletions = ref<Map<string, PendingDeletion>>(new Map());

// Create undo toast content component
function createUndoToast(message: string, onUndo: () => void) {
  return h('div', { class: 'toast-undo-content' }, [
    h('span', message),
    h('button', {
      class: 'toast-undo-btn',
      onClick: (e: Event) => {
        e.stopPropagation();
        onUndo();
      }
    }, t('memory.undo'))
  ]);
}

// Delete a single edge (fact) with undo
const deletingEdge = ref<string | null>(null);

function deleteEdge(edgeUuid: string | null) {
  if (!edgeUuid || !userId.value) return;
  
  // Cancel any ongoing edit
  if (editingEdgeUuid.value === edgeUuid) cancelEditEdge();
  
  const index = edges.value.findIndex(e => e.uuid === edgeUuid);
  if (index === -1) return;
  
  const edge = edges.value[index]!;
  edges.value.splice(index, 1);
  
  const timeoutId = setTimeout(() => {
    performEdgeDeletion(edgeUuid);
  }, 5000);
  
  const toastId = toast(
    createUndoToast(t('memory.toastFactRemoved'), () => undoDeletion(edgeUuid)),
    {
      type: TYPE.INFO,
      timeout: 5000,
      closeOnClick: false,
      pauseOnHover: true,
      icon: false,
    }
  );
  
  pendingDeletions.value.set(edgeUuid, {
    type: 'edge',
    uuid: edgeUuid,
    item: edge,
    index,
    timeoutId,
    toastId,
  });
}

function undoDeletion(uuid: string) {
  const pending = pendingDeletions.value.get(uuid);
  if (!pending) return;
  
  clearTimeout(pending.timeoutId);
  toast.dismiss(pending.toastId);
  
  if (pending.type === 'edge') {
    const insertIndex = Math.min(pending.index, edges.value.length);
    edges.value.splice(insertIndex, 0, pending.item as Edge);
  } else {
    const insertIndex = Math.min(pending.index, nodes.value.length);
    nodes.value.splice(insertIndex, 0, pending.item as Node);
  }
  
  pendingDeletions.value.delete(uuid);
  toast.success(t('memory.toastRestored'), { timeout: 2000 });
}

async function performEdgeDeletion(edgeUuid: string) {
  const pending = pendingDeletions.value.get(edgeUuid);
  if (!pending) return;
  
  const savedPending = { ...pending };
  pendingDeletions.value.delete(edgeUuid);
  
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${apiBaseUrl.value}/memory/${userId.value}/edge/${edgeUuid}`, {
      method: 'DELETE',
      headers,
    });
    
    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.detail || 'Failed to delete fact');
    }
  } catch (e) {
    const insertIndex = Math.min(savedPending.index, edges.value.length);
    edges.value.splice(insertIndex, 0, savedPending.item as Edge);
    toast.error(
      t('memory.toastDeleteFailed', { message: translateApiUserMessage((e as Error).message, t) }),
    );
  }
}

// Delete a single node (entity) with undo
const deletingNode = ref<string | null>(null);

function deleteNode(nodeUuid: string | null) {
  if (!nodeUuid || !userId.value) return;
  
  // Cancel any ongoing edit
  if (editingNodeUuid.value === nodeUuid) cancelEditNode();
  
  const index = nodes.value.findIndex(n => n.uuid === nodeUuid);
  if (index === -1) return;
  
  const node = nodes.value[index]!;
  nodes.value.splice(index, 1);
  
  const timeoutId = setTimeout(() => {
    performNodeDeletion(nodeUuid);
  }, 5000);
  
  const toastId = toast(
    createUndoToast(t('memory.toastEntityRemoved'), () => undoDeletion(nodeUuid)),
    {
      type: TYPE.INFO,
      timeout: 5000,
      closeOnClick: false,
      pauseOnHover: true,
      icon: false,
    }
  );
  
  pendingDeletions.value.set(nodeUuid, {
    type: 'node',
    uuid: nodeUuid,
    item: node,
    index,
    timeoutId,
    toastId,
  });
}

async function performNodeDeletion(nodeUuid: string) {
  const pending = pendingDeletions.value.get(nodeUuid);
  if (!pending) return;
  
  const savedPending = { ...pending };
  pendingDeletions.value.delete(nodeUuid);
  
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${apiBaseUrl.value}/memory/${userId.value}/node/${nodeUuid}`, {
      method: 'DELETE',
      headers,
    });
    
    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.detail || 'Failed to delete entity');
    }
  } catch (e) {
    const insertIndex = Math.min(savedPending.index, nodes.value.length);
    nodes.value.splice(insertIndex, 0, savedPending.item as Node);
    toast.error(
      t('memory.toastDeleteFailed', { message: translateApiUserMessage((e as Error).message, t) }),
    );
  }
}

// Auto-load when user ID changes (from connection panel)
watch(
  () => userId.value,
  (newId, oldId) => {
    if (newId && newId !== oldId) {
      loadMemoryData();
    }
  }
);

watch(
  () => [contextSize.value, includeFacts.value] as const,
  ([size, withFacts]) => {
    if (!kwami.value || !isConnected.value) return;
    kwami.value.agent.syncConfigToBackend('memory', getMemoryRuntimeConfig(size, withFacts));
  },
);

onMounted(() => {
  if (userId.value) {
    loadMemoryData();
  }
});
</script>

<template>
  <div class="panel-inner">
    <div class="panel-header">
      <iconify-icon :icon="panelIcons.memory" class="panel-icon"></iconify-icon>
      <h2>{{ t('memory.title') }}</h2>
      <PanelHeaderControls />
    </div>

    <div class="panel-body">
     
      <!-- Memory Stats -->
      <PanelSection :title="t('memory.overview')">
        <div v-if="isLoading" class="loading-state">
          <iconify-icon icon="ph:spinner-gap-duotone" class="spin"></iconify-icon>
          {{ t('memory.loadingMemoryData') }}
        </div>
        <div v-else-if="loadError" class="error-state">
          <iconify-icon icon="ph:warning-duotone"></iconify-icon>
          {{ loadError }}
          <BaseButton size="sm" variant="secondary" @click="loadMemoryData">{{ t('memory.retry') }}</BaseButton>
        </div>
        <div v-else class="stats-grid">
          <div class="stat-card" :class="{ active: activeTab === 'facts' }" @click="activeTab = 'facts'">
            <div class="stat-value">{{ edgesTotal || edges.length }}</div>
            <div class="stat-label">{{ t('memory.facts') }}</div>
            <div v-if="isLoadingMoreEdges" class="stat-sub loading-sub">
              <iconify-icon icon="ph:spinner-gap-duotone" class="spin"></iconify-icon>
              {{ edges.length }}/{{ edgesTotal }}
            </div>
          </div>
          <div class="stat-card" :class="{ active: activeTab === 'entities' }" @click="activeTab = 'entities'">
            <div class="stat-value">{{ nodesTotal || nodes.length }}</div>
            <div class="stat-label">{{ t('memory.entities') }}</div>
            <div v-if="isLoadingMoreNodes" class="stat-sub loading-sub">
              <iconify-icon icon="ph:spinner-gap-duotone" class="spin"></iconify-icon>
              {{ nodes.length }}/{{ nodesTotal }}
            </div>
          </div>
          <div class="stat-card" :class="{ active: activeTab === 'messages' }" @click="activeTab = 'messages'">
            <div class="stat-value">{{ messages.length }}</div>
            <div class="stat-label">{{ t('memory.messages') }}</div>
            <div class="stat-sub">{{ sessionCount }} {{ sessionCount === 1 ? t('memory.session') : t('memory.sessions') }}</div>
          </div>
        </div>
      </PanelSection>

      <PanelSection :title="t('memory.contextRetrieval')">
        <div class="memory-context-settings">
          <BaseSelect
            :modelValue="contextSize"
            @update:modelValue="setContextSize"
            :options="contextSizeOptions"
            :placeholder="t('memory.contextSizePlaceholder')"
          />
          <BaseToggle
            v-model="includeFacts"
            :label="t('memory.includeFacts')"
            :description="t('memory.includeFactsHint')"
          />
          <p class="memory-context-hint">
            {{ t('memory.contextRetrievalHint') }}
          </p>
        </div>
      </PanelSection>

      <!-- Facts with Temporal Data -->
      <PanelSection v-if="activeTab === 'facts'" :title="t('memory.factsChronological')">
        <div v-if="isLoading" class="loading-state small">
          <iconify-icon icon="ph:spinner-gap-duotone" class="spin"></iconify-icon>
        </div>
        <div v-else-if="!edges.length" class="empty-state small">
          <iconify-icon icon="ph:lightbulb-duotone"></iconify-icon>
          {{ t('memory.noFactsLearned') }}
        </div>
        <div v-else class="facts-list">
          <div v-for="(edge, i) in edges" :key="edge.uuid || i" class="fact-item" :class="{ editing: editingEdgeUuid === edge.uuid }">
            <!-- Normal view -->
            <template v-if="editingEdgeUuid !== edge.uuid">
              <div class="fact-row">
                <div class="fact-content">
                  <iconify-icon 
                    :icon="edge.invalid_at ? 'ph:x-circle-duotone' : 'ph:check-circle-duotone'" 
                    :class="edge.invalid_at ? 'invalid' : 'valid'"
                  ></iconify-icon>
                  <span :class="{ 'strikethrough': edge.invalid_at }">{{ edge.fact }}</span>
                </div>
                <div class="item-actions">
                  <button 
                    class="action-btn edit-btn" 
                    @click="startEditEdge(edge)"
                    :title="t('memory.editFactTitle')"
                  >
                    <iconify-icon icon="ph:pencil-simple-duotone"></iconify-icon>
                  </button>
                  <button 
                    class="action-btn delete-btn" 
                    @click="deleteEdge(edge.uuid)"
                    :disabled="deletingEdge === edge.uuid"
                    :title="t('memory.deleteFactTitle')"
                  >
                    <iconify-icon :icon="deletingEdge === edge.uuid ? 'ph:spinner-gap-duotone' : 'ph:trash-simple-duotone'" :class="{ spin: deletingEdge === edge.uuid }"></iconify-icon>
                  </button>
                </div>
              </div>
              <div class="fact-meta">
                <span v-if="edge.valid_at" class="date valid">
                  <iconify-icon icon="ph:calendar-check-duotone"></iconify-icon>
                  {{ formatDateTime(edge.valid_at) }}
                </span>
                <span v-if="edge.invalid_at" class="date invalid">
                  <iconify-icon icon="ph:calendar-x-duotone"></iconify-icon>
                  {{ formatDateTime(edge.invalid_at) }}
                </span>
                <span v-if="!edge.valid_at && !edge.invalid_at && edge.created_at" class="date">
                  <iconify-icon icon="ph:clock-duotone"></iconify-icon>
                  {{ formatDateTime(edge.created_at) }}
                </span>
              </div>
            </template>
            <!-- Edit view -->
            <template v-else>
              <div class="edit-row">
                <input
                  v-model="editEdgeData.fact"
                  class="edit-fact-input"
                  :placeholder="t('memory.enterFact')"
                  @keydown.enter="saveEdge"
                  @keydown.escape="cancelEditEdge"
                />
                <div class="edit-actions">
                  <button class="action-btn save-btn" @click="saveEdge" :disabled="savingEdge" :title="t('memory.save')">
                    <iconify-icon :icon="savingEdge ? 'ph:spinner-gap-duotone' : 'ph:check-bold'" :class="{ spin: savingEdge }"></iconify-icon>
                  </button>
                  <button class="action-btn cancel-btn" @click="cancelEditEdge" :title="t('memory.cancel')">
                    <iconify-icon icon="ph:x-bold"></iconify-icon>
                  </button>
                </div>
              </div>
            </template>
          </div>
        </div>
        <!-- Lazy loading progress for facts -->
        <div v-if="isLoadingMoreEdges" class="load-more-bar">
          <iconify-icon icon="ph:spinner-gap-duotone" class="spin"></iconify-icon>
          <span>{{ t('memory.loadingFacts', { loaded: edges.length, total: edgesTotal }) }}</span>
        </div>
        <button 
          v-else-if="edgesHasMore" 
          class="load-more-btn" 
          @click="loadMoreEdges"
        >
          <iconify-icon icon="ph:arrow-down-duotone"></iconify-icon>
          {{ t('memory.loadMore', { loaded: edges.length, total: edgesTotal }) }}
        </button>
      </PanelSection>

      <!-- Entities with Summaries -->
      <PanelSection v-if="activeTab === 'entities'" :title="t('memory.entitiesWithSummaries')">
        <div v-if="isLoading" class="loading-state small">
          <iconify-icon icon="ph:spinner-gap-duotone" class="spin"></iconify-icon>
        </div>
        <div v-else-if="!nodes.length" class="empty-state small">
          <iconify-icon icon="ph:tag-duotone"></iconify-icon>
          {{ t('memory.noEntitiesDiscovered') }}
        </div>
        <div v-else class="entities-list">
          <div v-for="(node, i) in nodes" :key="node.uuid || i" class="entity-item" :class="{ editing: editingNodeUuid === node.uuid }">
            <!-- Normal view -->
            <template v-if="editingNodeUuid !== node.uuid">
              <div class="entity-row">
                <div class="entity-header">
                  <span class="entity-name">{{ node.name }}</span>
                  <span v-for="label in node.labels" :key="label" class="entity-label">{{ label }}</span>
                </div>
                <div class="item-actions">
                  <button 
                    class="action-btn edit-btn" 
                    @click="startEditNode(node)"
                    :title="t('memory.editEntityTitle')"
                  >
                    <iconify-icon icon="ph:pencil-simple-duotone"></iconify-icon>
                  </button>
                  <button 
                    class="action-btn delete-btn" 
                    @click="deleteNode(node.uuid)"
                    :disabled="deletingNode === node.uuid"
                    :title="t('memory.deleteEntityTitle')"
                  >
                    <iconify-icon :icon="deletingNode === node.uuid ? 'ph:spinner-gap-duotone' : 'ph:trash-simple-duotone'" :class="{ spin: deletingNode === node.uuid }"></iconify-icon>
                  </button>
                </div>
              </div>
              <p v-if="node.summary" class="entity-summary">{{ node.summary }}</p>
              <span v-if="node.created_at" class="entity-date">
                <iconify-icon icon="ph:clock-duotone"></iconify-icon>
                {{ formatDateTime(node.created_at) }}
              </span>
            </template>
            <!-- Edit view -->
            <template v-else>
              <div class="edit-entity-form">
                <div class="edit-field">
                  <label class="edit-label">{{ t('memory.name') }}</label>
                  <input
                    v-model="editNodeData.name"
                    class="edit-input"
                    :placeholder="t('memory.entityName')"
                    @keydown.escape="cancelEditNode"
                  />
                </div>
                <div class="edit-field">
                  <label class="edit-label">{{ t('memory.summary') }}</label>
                  <textarea
                    v-model="editNodeData.summary"
                    class="edit-textarea"
                    :placeholder="t('memory.summaryPlaceholder')"
                    rows="2"
                    @keydown.escape="cancelEditNode"
                  ></textarea>
                </div>
                <div class="edit-field">
                  <label class="edit-label">{{ t('memory.labels') }}</label>
                  <div class="edit-labels">
                    <span 
                      v-for="(label, li) in editNodeData.labels" 
                      :key="li" 
                      class="edit-label-chip"
                    >
                      {{ label }}
                      <button class="chip-remove" @click="removeEditLabel(li)">
                        <iconify-icon icon="ph:x-bold"></iconify-icon>
                      </button>
                    </span>
                    <div class="add-label-row">
                      <BaseSelect
                        :modelValue="editNodeData.newLabel"
                        @update:modelValue="addEditLabel"
                        :options="entityTypeOptions"
                        :placeholder="t('memory.addLabel')"
                      />
                    </div>
                  </div>
                </div>
                <div class="edit-actions-row">
                  <button class="action-btn save-btn" @click="saveNode" :disabled="savingNode">
                    <iconify-icon :icon="savingNode ? 'ph:spinner-gap-duotone' : 'ph:check-bold'" :class="{ spin: savingNode }"></iconify-icon>
                    {{ t('memory.save') }}
                  </button>
                  <button class="action-btn cancel-btn" @click="cancelEditNode">
                    <iconify-icon icon="ph:x-bold"></iconify-icon>
                    {{ t('memory.cancel') }}
                  </button>
                </div>
              </div>
            </template>
          </div>
        </div>
        <!-- Lazy loading progress for entities -->
        <div v-if="isLoadingMoreNodes" class="load-more-bar">
          <iconify-icon icon="ph:spinner-gap-duotone" class="spin"></iconify-icon>
          <span>{{ t('memory.loadingEntities', { loaded: nodes.length, total: nodesTotal }) }}</span>
        </div>
        <button 
          v-else-if="nodesHasMore" 
          class="load-more-btn" 
          @click="loadMoreNodes"
        >
          <iconify-icon icon="ph:arrow-down-duotone"></iconify-icon>
          {{ t('memory.loadMore', { loaded: nodes.length, total: nodesTotal }) }}
        </button>
      </PanelSection>

      <!-- Messages (Conversation History) -->
      <PanelSection v-if="activeTab === 'messages'" :title="t('memory.conversationHistory')">
        <div v-if="isLoading" class="loading-state small">
          <iconify-icon icon="ph:spinner-gap-duotone" class="spin"></iconify-icon>
        </div>
        <div v-else-if="!messages.length" class="empty-state small">
          <iconify-icon icon="ph:chat-circle-dots-duotone"></iconify-icon>
          {{ t('memory.noConversationHistory') }}
        </div>
        <div v-else class="messages-list">
          <div v-for="(msg, i) in messages" :key="i" class="message-item" :class="msg.role_type || msg.role">
            <div class="message-header">
              <span class="message-role">
                <iconify-icon :icon="msg.role_type === 'assistant' || msg.role === 'assistant' ? 'ph:robot-duotone' : 'ph:user-duotone'"></iconify-icon>
                {{ msg.role || msg.role_type || t('memory.unknown') }}
              </span>
              <span v-if="msg.created_at" class="message-date">{{ formatDateTime(msg.created_at) }}</span>
            </div>
            <p class="message-content">{{ msg.content }}</p>
          </div>
        </div>
      </PanelSection>

      <!-- Knowledge Graph -->
      <PanelSection :title="t('memory.knowledgeGraph')">
        <div class="graph-actions">
          <BaseButton
            variant="primary"
            size="sm"
            icon="ph:graph-duotone"
            @click="showGraphModal = true"
          >
            {{ t('memory.openGraphView') }}
          </BaseButton>
          <BaseButton
            variant="secondary"
            size="sm"
            icon="ph:arrows-clockwise-duotone"
            @click="loadMemoryData"
            :disabled="isLoading"
          >
            {{ t('memory.refresh') }}
          </BaseButton>
        </div>
      </PanelSection>
      
      <!-- Graph Modal -->
      <Teleport to="body">
        <Transition name="modal">
          <div v-if="showGraphModal" class="graph-modal-overlay" @click.self="showGraphModal = false">
            <div class="graph-modal">
              <div class="graph-modal-header">
                <h2><iconify-icon icon="ph:graph-duotone"></iconify-icon> {{ t('memory.graphModalTitle') }}</h2>
                <button class="close-btn" @click="showGraphModal = false">
                  <iconify-icon icon="ph:x"></iconify-icon>
                </button>
              </div>
              <div class="graph-modal-body">
                <MemoryGraph 
                  :userId="userId" 
                  :apiBaseUrl="apiBaseUrl"
                />
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>

      <!-- Graph Operations -->
      <PanelSection :title="t('memory.graphOps')">
        <!-- Reorganize -->
        <div class="graph-ops-section">
          <div class="graph-ops-row">
            <div class="graph-ops-info">
              <h4><iconify-icon icon="ph:broom-duotone"></iconify-icon> {{ t('memoryOps.reorganizeTitle') }}</h4>
              <p>{{ t('memoryOps.reorganizeDesc') }}</p>
            </div>
            <BaseButton
              variant="primary"
              size="sm"
              icon="ph:broom-duotone"
              :loading="reorganizeRef?.loading || reorganizeRef?.applying"
              :disabled="reorganizeRef?.loading || reorganizeRef?.applying"
              @click="reorganizeRef?.fetchPreview()"
            >
              {{
                reorganizeRef?.loading
                  ? t('memoryGraph.scanning')
                  : reorganizeRef?.applying
                    ? t('memoryGraph.applying')
                    : t('memoryGraph.reorganize')
              }}
            </BaseButton>
          </div>
        </div>

        <!-- Duplicate Detection -->
        <div class="graph-ops-section">
          <div class="graph-ops-row">
            <div class="graph-ops-info">
              <h4><iconify-icon icon="ph:copy-duotone"></iconify-icon> {{ t('memoryOps.duplicatesTitle') }}</h4>
              <p>{{ t('memoryOps.duplicatesDesc') }}</p>
            </div>
            <BaseButton
              variant="secondary"
              size="sm"
              icon="ph:magnifying-glass-duotone"
              :loading="duplicatesLoading"
              :disabled="duplicatesLoading"
              @click="loadDuplicates"
            >
              {{ t('memoryOps.scan') }}
            </BaseButton>
          </div>
          <div v-if="duplicatesLoading" class="loading-state small">
            <iconify-icon icon="ph:spinner-gap-duotone" class="spin"></iconify-icon>
          </div>
          <div v-else-if="duplicates.length === 0 && !duplicatesLoading" class="empty-state small">
            <iconify-icon icon="ph:check-circle-duotone"></iconify-icon>
            {{ t('memoryOps.noDuplicates') }}
          </div>
          <div v-else class="duplicates-list">
            <div v-for="dup in duplicates" :key="`${dup.keep.uuid}-${dup.remove.uuid}`" class="dup-item">
              <div class="dup-header">
                <span class="dup-score">{{ dup.score }}%</span>
                <span class="dup-match">{{ t('memoryOps.match') }}</span>
              </div>
              <div class="dup-nodes">
                <div class="dup-node keep">
                  <iconify-icon icon="ph:check-circle-duotone" class="keep-icon"></iconify-icon>
                  <div>
                    <span class="dup-name">{{ dup.keep.name }}</span>
                    <span class="dup-edges">{{ dup.keep.edge_count }} {{ t('memoryOps.edges') }}</span>
                  </div>
                </div>
                <iconify-icon icon="ph:arrows-merge-duotone" class="merge-arrow"></iconify-icon>
                <div class="dup-node remove">
                  <iconify-icon icon="ph:x-circle-duotone" class="remove-icon"></iconify-icon>
                  <div>
                    <span class="dup-name">{{ dup.remove.name }}</span>
                    <span class="dup-edges">{{ dup.remove.edge_count }} {{ t('memoryOps.edges') }}</span>
                  </div>
                </div>
              </div>
              <BaseButton
                variant="accent"
                size="sm"
                icon="ph:git-merge-duotone"
                :loading="mergingPair === `${dup.keep.uuid}-${dup.remove.uuid}`"
                :disabled="mergingPair !== null"
                @click="mergePair(dup.keep.uuid, dup.remove.uuid)"
                block
              >
                {{ t('memoryOps.merge') }}
              </BaseButton>
            </div>
          </div>
        </div>

        <!-- Communities -->
        <div class="graph-ops-section">
          <div class="graph-ops-row">
            <div class="graph-ops-info">
              <h4><iconify-icon icon="ph:circles-three-plus-duotone"></iconify-icon> {{ t('memoryOps.communitiesTitle') }}</h4>
              <p>{{ t('memoryOps.communitiesDesc') }}</p>
            </div>
            <BaseButton
              variant="secondary"
              size="sm"
              icon="ph:graph-duotone"
              :loading="communitiesLoading"
              :disabled="communitiesLoading"
              @click="loadCommunities"
            >
              {{ t('memoryOps.detect') }}
            </BaseButton>
          </div>
          <div v-if="communitiesLoading" class="loading-state small">
            <iconify-icon icon="ph:spinner-gap-duotone" class="spin"></iconify-icon>
          </div>
          <div v-else-if="communities.length === 0 && !communitiesLoading" class="empty-state small">
            <iconify-icon icon="ph:circles-three-plus-duotone"></iconify-icon>
            {{ t('memoryOps.communitiesEmpty') }}
          </div>
          <div v-else class="communities-list">
            <div v-for="comm in communities" :key="comm.id" class="community-item">
              <div class="community-header">
                <span class="community-id">{{ comm.members.slice(0, 2).map(m => m.name).join(' & ') }}</span>
                <span class="community-size">{{
                  t('memoryOps.communityNodes', { n: comm.size }, comm.size)
                }}</span>
              </div>
              <div class="community-members">
                <span v-for="m in comm.members.slice(0, 6)" :key="m.uuid" class="member-chip">
                  {{ m.name }}
                </span>
                <span v-if="comm.members.length > 6" class="member-more">
                  {{ t('memoryOps.moreMembers', { n: comm.members.length - 6 }) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </PanelSection>

      <!-- Danger Zone -->
      <PanelSection :title="t('memoryOps.dangerZone')">
        <div class="danger-zone">
          <h4><iconify-icon icon="ph:warning-duotone"></iconify-icon> {{ t('memoryOps.destructiveTitle') }}</h4>
          <p>{{ t('memoryOps.destructiveDesc') }}</p>
          <BaseButton 
            variant="danger" 
            icon="ph:trash-simple-duotone" 
            @click="showDeleteConfirm = true"
          >
            {{ t('memoryOps.deleteAllMemory') }}
          </BaseButton>
        </div>
      </PanelSection>
      
      <!-- Reorganize Preview -->
      <ReorganizePreview
        ref="reorganizeRef"
        :userId="userId"
        :apiBaseUrl="apiBaseUrl"
        @done="onReorgDone"
      />

      <!-- Delete Confirmation -->
      <ConfirmDialog
        :open="showDeleteConfirm"
        :title="t('memoryOps.deleteDialogTitle')"
        icon="ph:warning-duotone"
        :confirmLabel="t('memoryOps.deleteForever')"
        confirmIcon="ph:trash-simple-duotone"
        confirmVariant="danger"
        :loading="isDeleting"
        @confirm="deleteUserMemory"
        @cancel="showDeleteConfirm = false"
      >
        <p>{{ t('memoryOps.deleteIntro') }}</p>
        <code>{{ userId }}</code>
        <p class="warning-text">
          <strong>{{ t('memory.deleteCannotUndo') }}</strong>
          {{ t('memory.deleteDetails') }}
        </p>
        <div v-if="deleteError" class="delete-error">
          <iconify-icon icon="ph:x-circle-duotone"></iconify-icon>
          {{ deleteError }}
        </div>
      </ConfirmDialog>
    </div>
  </div>
</template>

<style scoped>
.memory-context-settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.memory-context-hint {
  font-size: 10px;
  color: var(--text-muted);
  margin: 0;
  line-height: 1.45;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.stat-card {
  background: var(--surface-2);
  border-radius: 8px;
  padding: 12px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
}
.stat-card:hover {
  background: var(--surface-3);
}
.stat-card.active {
  border-color: var(--accent-primary);
  background: rgba(var(--accent-primary-rgb), 0.1);
}
.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--accent-primary);
  line-height: 1;
}
.stat-label {
  font-size: 11px;
  color: var(--text-tertiary);
  margin-top: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.stat-sub {
  font-size: 9px;
  color: var(--text-tertiary);
  margin-top: 2px;
  opacity: 0.7;
}
.stat-sub.loading-sub {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: var(--accent-primary);
  opacity: 1;
}
.stat-sub.loading-sub iconify-icon {
  font-size: 10px;
}

/* Load More */
.load-more-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px;
  font-size: 12px;
  color: var(--text-muted);
  background: var(--surface-1);
  border-radius: var(--radius-sm);
  margin-top: 8px;
}
.load-more-bar iconify-icon {
  font-size: 14px;
  color: var(--accent-primary);
}
.load-more-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 10px;
  margin-top: 8px;
  font-size: 12px;
  font-family: inherit;
  font-weight: 500;
  color: var(--accent-primary);
  background: var(--surface-1);
  border: 1px dashed var(--glass-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s ease;
}
.load-more-btn:hover {
  background: var(--surface-2);
  border-color: var(--accent-primary);
}
.load-more-btn iconify-icon {
  font-size: 14px;
}

/* Loading / Empty / Error States */
.loading-state,
.empty-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px;
  color: var(--text-tertiary);
  font-size: 13px;
  text-align: center;
}
.loading-state.small,
.empty-state.small {
  padding: 12px;
  font-size: 12px;
}
.loading-state iconify-icon,
.empty-state iconify-icon,
.error-state iconify-icon {
  font-size: 24px;
}
.error-state {
  color: var(--accent-error);
}
.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  100% { transform: rotate(360deg); }
}

/* Item action buttons (edit + delete) */
.item-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}
.action-btn {
  background: transparent;
  border: none;
  padding: 4px 6px;
  border-radius: 4px;
  color: var(--text-tertiary);
  cursor: pointer;
  opacity: 0;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
}
.action-btn iconify-icon {
  font-size: 14px;
}
.action-btn.edit-btn:hover {
  background: rgba(var(--accent-primary-rgb), 0.15);
  color: var(--accent-primary);
}
.action-btn.delete-btn:hover {
  background: var(--error-glow, rgba(239, 68, 68, 0.15));
  color: var(--accent-error, var(--error));
}
.action-btn.save-btn {
  opacity: 1;
  color: var(--accent-success, var(--accent-primary));
}
.action-btn.save-btn:hover {
  background: var(--accent-glow);
}
.action-btn.cancel-btn {
  opacity: 1;
  color: var(--text-tertiary);
}
.action-btn.cancel-btn:hover {
  background: var(--surface-3);
  color: var(--text-secondary);
}
.action-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5 !important;
}

/* Facts List */
.facts-list {
  max-height: 300px;
  overflow-y: auto;
}
.fact-item {
  padding: 10px 12px;
  border-bottom: 1px solid var(--glass-border);
  transition: background 0.2s;
}
.fact-item:last-child {
  border-bottom: none;
}
.fact-item:hover .action-btn {
  opacity: 1;
}
.fact-item.editing {
  background: rgba(var(--accent-primary-rgb), 0.05);
  border-radius: 6px;
}
.fact-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.fact-content {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.4;
  flex: 1;
}
.fact-content iconify-icon {
  font-size: 14px;
  flex-shrink: 0;
  margin-top: 2px;
}
.fact-content iconify-icon.valid {
  color: var(--accent-success);
}
.fact-content iconify-icon.invalid {
  color: var(--accent-error);
}
.fact-content .strikethrough {
  text-decoration: line-through;
  opacity: 0.6;
}
.fact-meta {
  display: flex;
  gap: 12px;
  margin-top: 6px;
  padding-left: 22px;
}
.fact-meta .date {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--text-tertiary);
}
.fact-meta .date.valid iconify-icon {
  color: var(--accent-success);
}
.fact-meta .date.invalid iconify-icon {
  color: var(--accent-error);
}

/* Fact inline edit */
.edit-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.edit-fact-input {
  flex: 1;
  background: var(--surface-1);
  border: 1px solid var(--accent-primary);
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 12px;
  color: var(--text-primary);
  outline: none;
  font-family: inherit;
}
.edit-fact-input:focus {
  box-shadow: 0 0 0 2px rgba(var(--accent-primary-rgb), 0.2);
}
.edit-actions {
  display: flex;
  gap: 2px;
}

/* Entities List */
.entities-list {
  max-height: 400px;
  overflow-y: auto;
}
.entity-item {
  padding: 12px;
  background: var(--surface-2);
  border-radius: 8px;
  margin-bottom: 8px;
  transition: background 0.2s;
}
.entity-item:last-child {
  margin-bottom: 0;
}
.entity-item:hover .action-btn {
  opacity: 1;
}
.entity-item.editing {
  background: rgba(var(--accent-primary-rgb), 0.08);
  border: 1px solid rgba(var(--accent-primary-rgb), 0.2);
}
.entity-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.entity-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  flex: 1;
}
.entity-name {
  font-weight: 600;
  font-size: 13px;
  color: var(--text-primary);
}
.entity-label {
  font-size: 10px;
  padding: 2px 6px;
  background: var(--accent-primary);
  color: var(--surface-0);
  border-radius: 4px;
  text-transform: uppercase;
}
.entity-summary {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.4;
}
.entity-date {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--text-tertiary);
  margin-top: 8px;
}

/* Entity edit form */
.edit-entity-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.edit-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.edit-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-tertiary);
  font-weight: 600;
}
.edit-input {
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 13px;
  color: var(--text-primary);
  outline: none;
  font-family: inherit;
  font-weight: 600;
}
.edit-input:focus {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 2px rgba(var(--accent-primary-rgb), 0.2);
}
.edit-textarea {
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 12px;
  color: var(--text-primary);
  outline: none;
  font-family: inherit;
  resize: vertical;
  min-height: 40px;
}
.edit-textarea:focus {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 2px rgba(var(--accent-primary-rgb), 0.2);
}
.edit-labels {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.edit-label-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  padding: 3px 8px;
  background: var(--accent-primary);
  color: var(--surface-0);
  border-radius: 4px;
  text-transform: uppercase;
}
.chip-remove {
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 0;
  display: flex;
  opacity: 0.7;
}
.chip-remove:hover {
  opacity: 1;
}
.chip-remove iconify-icon {
  font-size: 10px;
}
.add-label-row {
  display: flex;
  min-width: 120px;
}
.edit-actions-row {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding-top: 4px;
  border-top: 1px solid var(--glass-border);
}
.edit-actions-row .action-btn {
  opacity: 1;
  padding: 6px 12px;
  border-radius: 6px;
  font-weight: 500;
}
.edit-actions-row .save-btn {
  background: var(--accent-glow);
  color: var(--accent-primary);
}
.edit-actions-row .save-btn:hover {
  background: var(--surface-3);
}
.edit-actions-row .cancel-btn {
  background: var(--surface-3);
}

/* Messages List */
.messages-list {
  max-height: 300px;
  overflow-y: auto;
}
.message-item {
  padding: 10px 12px;
  border-left: 3px solid var(--glass-border);
  margin-bottom: 8px;
  background: var(--surface-1);
  border-radius: 0 6px 6px 0;
}
.message-item.user, .message-item.human {
  border-left-color: var(--accent-primary);
}
.message-item.assistant, .message-item.ai {
  border-left-color: var(--accent-secondary);
}
.message-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.message-role {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: capitalize;
}
.message-content {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.4;
}
.message-date {
  font-size: 10px;
  color: var(--text-tertiary);
}

/* Graph Actions */
.graph-actions {
  display: flex;
  gap: 8px;
}

/* Graph Modal */
.graph-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, var(--glass-opacity, 0.85));
  backdrop-filter: blur(var(--glass-blur, 12px));
  -webkit-backdrop-filter: blur(var(--glass-blur, 12px));
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.graph-modal {
  width: 100%;
  max-width: 1200px;
  height: 90vh;
  background: var(--glass-bg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--glass-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: var(--glass-shadow);
}
.graph-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--glass-border);
  background: var(--glass-highlight);
}
.graph-modal-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 10px;
}
.graph-modal-header h2 iconify-icon {
  color: var(--accent-primary);
}
.close-btn {
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: 8px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
}
.close-btn:hover {
  background: var(--surface-2);
  color: var(--text-primary);
}
.graph-modal-body {
  flex: 1;
  padding: 20px;
  overflow: auto;
  background: var(--surface-0);
}

/* Modal animations */
.modal-enter-active {
  animation: modal-in var(--duration-normal, 0.3s) cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-leave-active {
  animation: modal-out var(--duration-fast, 0.2s) cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-enter-active .graph-modal {
  animation: modal-content-in var(--duration-normal, 0.3s) cubic-bezier(0.34, 1.56, 0.64, 1);
}

.modal-leave-active .graph-modal {
  animation: modal-content-out var(--duration-fast, 0.2s) cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes modal-in {
  from {
    opacity: 0;
    backdrop-filter: blur(0);
  }
  to {
    opacity: 1;
    backdrop-filter: blur(var(--glass-blur, 12px));
  }
}

@keyframes modal-out {
  from {
    opacity: 1;
    backdrop-filter: blur(var(--glass-blur, 12px));
  }
  to {
    opacity: 0;
    backdrop-filter: blur(0);
  }
}

@keyframes modal-content-in {
  from {
    opacity: 0;
    transform: scale(0.92) translateY(20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes modal-content-out {
  from {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
  to {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }
}



/* Danger Zone */
.danger-zone {
  padding: 16px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
}
.danger-zone h4 {
  margin: 0 0 8px 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--accent-error);
  display: flex;
  align-items: center;
  gap: 6px;
}
.danger-zone p {
  margin: 0 0 12px 0;
  font-size: 12px;
  color: var(--text-tertiary);
  line-height: 1.4;
}

/* Delete error (inside ConfirmDialog slot) */
.delete-error {
  margin-top: 12px;
  padding: 10px 12px;
  background: var(--error-glow, rgba(239, 68, 68, 0.15));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--error, var(--accent-error));
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Graph Operations */
.graph-ops-section {
  padding: 12px 0;
  border-bottom: 1px solid var(--glass-border);
}
.graph-ops-section:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.graph-ops-section:first-child {
  padding-top: 0;
}
.graph-ops-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}
.graph-ops-row h4 {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 6px;
}
.graph-ops-row h4 iconify-icon {
  font-size: 16px;
  color: var(--accent-secondary);
}
.graph-ops-info {
  flex: 1;
}
.graph-ops-info h4 {
  margin: 0 0 4px 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 6px;
}
.graph-ops-info h4 iconify-icon {
  font-size: 16px;
  color: var(--accent-secondary);
}
.graph-ops-info p {
  margin: 0;
  font-size: 11px;
  color: var(--text-tertiary);
  line-height: 1.4;
}

/* Reorganize report */
.reorg-report {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 8px;
  padding: 10px 12px;
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
}
.reorg-stat {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-secondary);
}
.reorg-stat iconify-icon {
  font-size: 14px;
  color: var(--accent-primary);
}

/* Duplicates */
.duplicates-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
}
.dup-item {
  padding: 10px 12px;
  background: var(--surface-1);
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
  transition: border-color var(--duration-fast) ease;
}
.dup-item:hover {
  border-color: var(--surface-3);
}
.dup-header {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 8px;
}
.dup-score {
  font-size: 16px;
  font-weight: 700;
  color: var(--accent-primary);
}
.dup-match {
  font-size: 10px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.dup-nodes {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.dup-node {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  background: var(--surface-2);
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  min-width: 0;
  transition: border-color var(--duration-fast) ease;
}
.dup-node.keep {
  border-color: rgba(var(--accent-primary-rgb), 0.15);
}
.dup-name {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary);
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dup-edges {
  font-size: 9px;
  color: var(--text-muted);
}
.keep-icon {
  color: var(--accent-success, var(--accent-primary));
  font-size: 14px;
  flex-shrink: 0;
}
.remove-icon {
  color: var(--accent-error, var(--text-muted));
  font-size: 14px;
  flex-shrink: 0;
}
.merge-arrow {
  color: var(--text-muted);
  font-size: 16px;
  flex-shrink: 0;
}

/* Communities */
.communities-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 250px;
  overflow-y: auto;
}
.community-item {
  padding: 10px 12px;
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  transition: border-color var(--duration-fast) ease;
}
.community-item:hover {
  border-color: var(--surface-3);
}
.community-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.community-id {
  font-size: 11px;
  font-weight: 700;
  color: var(--accent-secondary);
  padding: 2px 8px;
  background: var(--accent-glow);
  border-radius: var(--radius-sm);
}
.community-size {
  font-size: 10px;
  color: var(--text-muted);
}
.community-members {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.member-chip {
  font-size: 10px;
  padding: 3px 10px;
  background: var(--surface-2);
  color: var(--text-secondary);
  border-radius: 12px;
  border: 1px solid var(--glass-border);
  white-space: nowrap;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: all var(--duration-fast) ease;
}
.member-chip:hover {
  background: var(--surface-3);
  color: var(--text-primary);
}
.member-more {
  font-size: 10px;
  padding: 3px 10px;
  color: var(--text-muted);
  font-style: italic;
}
</style>
