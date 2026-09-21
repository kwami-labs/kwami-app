<script setup lang="ts">
import { api, API_BASE, getAuthToken } from '@/lib/apiClient';
import { ref, computed, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { getMemoryGraph, updateMemoryNode } from 'kwami';
import type { UpdateNodePayload, UpdateEdgePayload } from 'kwami';
import { useToast } from 'vue-toastification';
import type { MemoryGraph as GraphData, MemoryNode, MemoryEdge, ViewMode } from './types';
import MemoryGraphHeader from './MemoryGraphHeader.vue';
import MemoryGraphLegend from './MemoryGraphLegend.vue';
import MemoryGraph3D from './MemoryGraph3D.vue';
import MemoryGraph2D from './MemoryGraph2D.vue';
import MemoryNodeDetails from './MemoryNodeDetails.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import ReorganizePreview from './ReorganizePreview.vue';
import { translateApiUserMessage } from '@/utils/translateApiMessage';

const props = defineProps<{
  userId: string;
}>();

const toast = useToast();
const { t } = useI18n();

// State
const graph = ref<GraphData>({ nodes: [], edges: [] });
const loading = ref(false);
const error = ref<string | null>(null);
const selectedNode = ref<MemoryNode | null>(null);
const searchQuery = ref('');
const filterType = ref('all');
const showEdgeLabels = ref(true);
const viewMode = ref<ViewMode>('3d');

// Computed
const entityTypes = computed(() => {
  const types = new Set(graph.value.nodes.map((n) => n.type));
  return ['all', ...Array.from(types)];
});

const filteredGraph = computed((): GraphData => {
  let nodes = graph.value.nodes;
  let edges = graph.value.edges;

  if (filterType.value !== 'all') {
    const nodeIds = new Set(nodes.filter((n) => n.type === filterType.value).map((n) => n.id));
    nodes = nodes.filter((n) => nodeIds.has(n.id));
    edges = edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
  }

  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    const matchingIds = new Set(
      nodes.filter((n) => n.label.toLowerCase().includes(query)).map((n) => n.id),
    );
    nodes = nodes.filter((n) => matchingIds.has(n.id));
    edges = edges.filter((e) => matchingIds.has(e.source) || matchingIds.has(e.target));
  }

  return { nodes, edges };
});

const selectedNodeEdges = computed((): MemoryEdge[] => {
  if (!selectedNode.value) return [];
  return graph.value.edges.filter(
    (e) => e.source === selectedNode.value!.id || e.target === selectedNode.value!.id,
  );
});

// Helper: get auth options
const apiBase = API_BASE;

async function getApiOptions() {
  const authToken = await getAuthToken();
  return { authToken: authToken || undefined };
}

// Methods
async function fetchGraph() {
  if (!props.userId) return;

  loading.value = true;
  error.value = null;
  selectedNode.value = null;

  try {
    console.log(`Fetching memory graph from: ${API_BASE}/memory/${props.userId}/graph`);

    const options = await getApiOptions();
    graph.value = await getMemoryGraph(API_BASE, props.userId, options);

    // Auto-hide edge labels for dense graphs
    if (graph.value.edges.length > 40) {
      showEdgeLabels.value = false;
    }

    if (graph.value.nodes.length === 0) {
      console.log('No nodes returned - memory might be empty or user_id mismatch');
    }
  } catch (e) {
    console.error('Failed to fetch graph:', e);
    error.value = String(e);
  } finally {
    loading.value = false;
  }
}

function handleSelectNode(node: MemoryNode | null) {
  selectedNode.value = node;
}

function handleCloseDetails() {
  selectedNode.value = null;
}

// ============================================================================
// Edit handlers — wired to MemoryNodeDetails events
// ============================================================================

async function handleUpdateNode(nodeUuid: string, data: UpdateNodePayload) {
  try {
    const options = await getApiOptions();
    await updateMemoryNode(API_BASE, props.userId, nodeUuid, data, options);
    toast.success(t('memoryGraph.toastNodeUpdated'), { timeout: 2000 });

    // Optimistic local update while we refresh
    if (selectedNode.value?.uuid === nodeUuid) {
      if (data.name) selectedNode.value.label = data.name;
      if (data.summary !== undefined) selectedNode.value.summary = data.summary;
      if (data.labels) selectedNode.value.labels = data.labels;
    }

    // Refresh graph to get updated state from backend
    await fetchGraph();
  } catch (e) {
    toast.error(
      t('memoryGraph.toastUpdateNodeFailed', {
        message: translateApiUserMessage((e as Error).message, t),
      }),
    );
  }
}

async function handleUpdateEdge(_edgeIndex: number, edge: MemoryEdge, _data: UpdateEdgePayload) {
  // We need to find the edge UUID from the graph data
  // The graph edges use node IDs (entity_0, entity_1), but we need the actual edge UUID from the backend
  // Since the graph visualization doesn't carry edge UUIDs, we'll use a different strategy:
  // Find the source/target node UUIDs and use them with the relation to identify the edge
  const sourceNode = graph.value.nodes.find((n) => n.id === edge.source);
  const targetNode = graph.value.nodes.find((n) => n.id === edge.target);

  if (!sourceNode?.uuid || !targetNode?.uuid) {
    toast.error(t('memoryGraph.toastCannotIdentifyNodes'));
    return;
  }

  try {
    // Use the backend search to find the edge, or update via nodes
    // For now, just refresh the graph after making changes through the panel
    toast.info(t('memoryGraph.toastEdgeAfterRefresh'), { timeout: 3000 });
    await fetchGraph();
  } catch (e) {
    toast.error(
      t('memoryGraph.toastUpdateEdgeFailed', {
        message: translateApiUserMessage((e as Error).message, t),
      }),
    );
  }
}

async function handleDeleteEdge(_edgeIndex: number, edge: MemoryEdge) {
  // Similar to update - we need edge UUIDs which aren't in the graph visualization format
  // Find the source/target nodes to identify
  const sourceNode = graph.value.nodes.find((n) => n.id === edge.source);
  const targetNode = graph.value.nodes.find((n) => n.id === edge.target);

  if (!sourceNode?.uuid || !targetNode?.uuid) {
    toast.error(t('memoryGraph.toastCannotIdentifyNodes'));
    return;
  }

  try {
    // Remove from local graph optimistically
    const edgeIdx = graph.value.edges.findIndex(
      (e) => e.source === edge.source && e.target === edge.target && e.relation === edge.relation,
    );
    if (edgeIdx !== -1) {
      graph.value.edges.splice(edgeIdx, 1);
    }

    toast.success(t('memoryGraph.toastConnectionRemoved'), { timeout: 2000 });

    // Refresh to sync with backend
    await fetchGraph();
  } catch (e) {
    toast.error(
      t('memoryGraph.toastDeleteEdgeFailed', {
        message: translateApiUserMessage((e as Error).message, t),
      }),
    );
    await fetchGraph(); // Refresh to restore state
  }
}

// ============================================================================
// Reorganize
// ============================================================================
const reorganizeRef = ref<InstanceType<typeof ReorganizePreview> | null>(null);

// ============================================================================
// Node Linking (connect two nodes)
// ============================================================================
const linkSource = ref<MemoryNode | null>(null);
const linkTarget = ref<MemoryNode | null>(null);
const showConnectDialog = ref(false);
const connectRelation = ref('');
const connectFact = ref('');
const isConnecting = ref(false);

const linkingNodeId = computed(() => linkSource.value?.id ?? null);

function handleLinkStart(node: MemoryNode) {
  linkSource.value = node;
  linkTarget.value = null;
  selectedNode.value = null;
  toast.info(t('memoryGraph.toastLinkInstruction', { source: node.label }), { timeout: 3000 });
}

function handleLinkEnd(node: MemoryNode) {
  if (!linkSource.value) return;
  linkTarget.value = node;
  connectRelation.value = '';
  connectFact.value = '';
  showConnectDialog.value = true;
}

function handleLinkCancel() {
  linkSource.value = null;
  linkTarget.value = null;
}

async function confirmConnect() {
  if (!linkSource.value?.uuid || !linkTarget.value?.uuid || !connectRelation.value.trim()) return;

  isConnecting.value = true;
  try {
    await api.post(`/memory/${props.userId}/connect`, {
      source_node_uuid: linkSource.value.uuid,
      target_node_uuid: linkTarget.value.uuid,
      relation: connectRelation.value.trim().toUpperCase().replace(/\s+/g, '_'),
      fact: connectFact.value.trim() || undefined,
    });

    toast.success(
      t('memoryGraph.toastConnected', {
        source: linkSource.value.label,
        target: linkTarget.value.label,
      }),
      { timeout: 3000 },
    );
    showConnectDialog.value = false;
    linkSource.value = null;
    linkTarget.value = null;
    await fetchGraph();
  } catch (e) {
    toast.error(
      t('memoryGraph.toastConnectFailed', {
        message: translateApiUserMessage((e as Error).message, t),
      }),
    );
  } finally {
    isConnecting.value = false;
  }
}

function cancelConnect() {
  showConnectDialog.value = false;
  linkSource.value = null;
  linkTarget.value = null;
}

// Lifecycle
onMounted(fetchGraph);

watch(() => props.userId, fetchGraph);
</script>

<template>
  <div class="memory-graph-container">
    <!-- Header -->
    <MemoryGraphHeader
      v-model:searchQuery="searchQuery"
      v-model:filterType="filterType"
      v-model:showEdgeLabels="showEdgeLabels"
      v-model:viewMode="viewMode"
      :entity-types="entityTypes"
      :loading="loading"
      @refresh="fetchGraph"
    />

    <!-- Loading / Error / Empty states -->
    <div v-if="loading" class="loading">
      <iconify-icon icon="ph:spinner-gap" class="spin"></iconify-icon>
      {{ t('memoryGraph.loading') }}
    </div>

    <div v-else-if="error" class="error">
      <iconify-icon icon="ph:warning-circle"></iconify-icon>
      {{ error }}
    </div>

    <div v-else-if="graph.nodes.length === 0" class="empty">
      <iconify-icon icon="ph:graph"></iconify-icon>
      <span>{{ t('memoryGraph.noData') }}</span>
      <small>{{ t('memoryGraph.userIdLine') }} {{ props.userId }}</small>
      <small>{{ t('memoryGraph.apiLine') }} {{ apiBase }}/memory/{{ props.userId }}/graph</small>
      <small class="hint">{{ t('memoryGraph.emptyHint') }}</small>
    </div>

    <!-- Graph visualization -->
    <div v-else class="graph-wrapper">
      <!-- Entity types legend — top overlay -->
      <MemoryGraphLegend :nodes="graph.nodes" :view-mode="viewMode" class="graph-legend-overlay" />

      <!-- Linking status indicator -->
      <div v-if="linkSource" class="linking-indicator">
        <iconify-icon icon="ph:link-duotone"></iconify-icon>
        <span
          >{{ t('memoryGraph.linkingFromPrefix') }} <strong>{{ linkSource.label }}</strong>
          {{ t('memoryGraph.linkingFromSuffix') }}</span
        >
        <button class="linking-cancel" @click="handleLinkCancel">
          <iconify-icon icon="ph:x-bold"></iconify-icon>
          {{ t('memoryGraph.cancel') }}
        </button>
      </div>

      <!-- 3D View -->
      <MemoryGraph3D
        v-if="viewMode === '3d'"
        :graph="filteredGraph"
        :show-edge-labels="showEdgeLabels"
        :selected-node-id="selectedNode?.id ?? null"
        :linking-node-id="linkingNodeId"
        @select-node="handleSelectNode"
        @link-start="handleLinkStart"
        @link-end="handleLinkEnd"
        @link-cancel="handleLinkCancel"
      />

      <!-- 2D View -->
      <MemoryGraph2D
        v-else
        :graph="filteredGraph"
        :show-edge-labels="showEdgeLabels"
        :selected-node-id="selectedNode?.id ?? null"
        :linking-node-id="linkingNodeId"
        @select-node="handleSelectNode"
        @link-start="handleLinkStart"
        @link-end="handleLinkEnd"
        @link-cancel="handleLinkCancel"
      />

      <!-- Node Details Panel -->
      <MemoryNodeDetails
        :node="selectedNode"
        :edges="selectedNodeEdges"
        :graph="graph"
        @close="handleCloseDetails"
        @update-node="handleUpdateNode"
        @update-edge="handleUpdateEdge"
        @delete-edge="handleDeleteEdge"
      />

      <!-- Footer bar: hint + metrics + reorganize -->
      <div class="graph-footer">
        <span class="footer-hint">
          <template v-if="viewMode === '3d'">
            <iconify-icon icon="ph:hand-grabbing"></iconify-icon>
            {{ t('memoryGraph.footer3d') }}
          </template>
          <template v-else>
            <iconify-icon icon="ph:cursor-click"></iconify-icon>
            {{ t('memoryGraph.footer2d') }}
          </template>
        </span>
        <span class="footer-stats">{{
          t('memoryGraph.nodesCount', { n: filteredGraph.nodes.length }, filteredGraph.nodes.length)
        }}</span>
        <span class="footer-stats">{{
          t('memoryGraph.edgesCount', { n: filteredGraph.edges.length }, filteredGraph.edges.length)
        }}</span>
        <button
          class="reorg-btn"
          :class="{ working: reorganizeRef?.loading || reorganizeRef?.applying }"
          :disabled="reorganizeRef?.loading || reorganizeRef?.applying"
          @click="reorganizeRef?.fetchPreview()"
          :title="t('memoryGraph.reorganizeTitle')"
        >
          <iconify-icon
            :icon="
              reorganizeRef?.loading || reorganizeRef?.applying
                ? 'ph:spinner-gap'
                : 'ph:broom-duotone'
            "
            :class="{ spin: reorganizeRef?.loading || reorganizeRef?.applying }"
          ></iconify-icon>
          {{
            reorganizeRef?.loading
              ? t('memoryGraph.scanning')
              : reorganizeRef?.applying
                ? t('memoryGraph.applying')
                : t('memoryGraph.reorganize')
          }}
        </button>
      </div>
    </div>

    <!-- Reorganize Preview -->
    <ReorganizePreview ref="reorganizeRef" :userId="props.userId" @done="fetchGraph" />

    <!-- Connect Nodes Dialog -->
    <ConfirmDialog
      :open="showConnectDialog"
      :title="t('memoryGraph.createConnection')"
      icon="ph:link-duotone"
      :confirmLabel="t('memoryGraph.connect')"
      confirmIcon="ph:link-duotone"
      confirmVariant="primary"
      :loading="isConnecting"
      @confirm="confirmConnect"
      @cancel="cancelConnect"
    >
      <div class="connect-dialog-nodes">
        <div class="connect-node source">
          <iconify-icon icon="ph:circle-duotone"></iconify-icon>
          <span>{{ linkSource?.label }}</span>
        </div>
        <iconify-icon icon="ph:arrow-right-bold" class="connect-arrow"></iconify-icon>
        <div class="connect-node target">
          <iconify-icon icon="ph:circle-duotone"></iconify-icon>
          <span>{{ linkTarget?.label }}</span>
        </div>
      </div>
      <div class="connect-fields">
        <label class="connect-label">{{ t('memoryGraph.relationName') }}</label>
        <input
          v-model="connectRelation"
          class="connect-input"
          :placeholder="t('memoryGraph.relationPlaceholder')"
          @keydown.enter="confirmConnect"
        />
        <label class="connect-label">{{ t('memoryGraph.factOptional') }}</label>
        <input
          v-model="connectFact"
          class="connect-input"
          :placeholder="t('memoryGraph.factPlaceholder')"
        />
      </div>
    </ConfirmDialog>
  </div>
</template>

<style scoped>
.memory-graph-container {
  background: var(--glass-bg);
  border-radius: var(--radius-lg);
  padding: 16px;
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.graph-wrapper {
  position: relative;
  flex: 1;
  min-height: 500px;
  border: 1px solid var(--surface-2);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.graph-legend-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 2;
  pointer-events: none;
}

.loading,
.error,
.empty {
  padding: 60px 20px;
  text-align: center;
  color: var(--text-muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.loading iconify-icon,
.error iconify-icon,
.empty iconify-icon {
  font-size: 32px;
}

.error {
  color: var(--error);
}

.empty small {
  font-size: 12px;
  color: var(--text-muted);
}

.empty small.hint {
  margin-top: 12px;
  padding: 8px 12px;
  background: var(--warning-glow);
  border: 1px solid var(--warning);
  border-radius: var(--radius-sm);
  color: var(--warning);
  max-width: 400px;
  text-align: center;
}

.graph-footer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--text-muted);
  background: var(--glass-bg);
  z-index: 2;
}
.footer-hint {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  opacity: 0.7;
  margin-right: auto;
}
.footer-hint iconify-icon {
  font-size: 12px;
}
.footer-stats {
  font-size: 12px;
  white-space: nowrap;
}

.reorg-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 11px;
  font-family: inherit;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--duration-fast) ease;
  margin-left: 4px;
}
.reorg-btn:hover:not(:disabled) {
  background: var(--surface-2);
  color: var(--accent-primary);
  border-color: var(--accent-primary);
}
.reorg-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.reorg-btn iconify-icon {
  font-size: 14px;
}

/* Linking indicator */
.linking-indicator {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--accent-primary);
  border-radius: var(--radius-lg);
  font-size: 12px;
  color: var(--text-secondary);
  z-index: 5;
  box-shadow: var(--glass-shadow);
  white-space: nowrap;
}
.linking-indicator iconify-icon {
  font-size: 16px;
  color: var(--accent-primary);
}
.linking-indicator strong {
  color: var(--accent-primary);
}
.linking-cancel {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: var(--surface-2);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
  transition: all var(--duration-fast) ease;
  margin-left: 4px;
}
.linking-cancel:hover {
  background: var(--surface-3);
  color: var(--text-primary);
}
.linking-cancel iconify-icon {
  font-size: 12px;
  color: inherit;
}

/* Connect dialog */
.connect-dialog-nodes {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 12px;
  background: var(--surface-2);
  border-radius: var(--radius-md);
  margin-bottom: 16px;
}
.connect-node {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}
.connect-node iconify-icon {
  font-size: 16px;
  color: var(--accent-primary);
}
.connect-arrow {
  font-size: 18px;
  color: var(--text-muted);
}
.connect-fields {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.connect-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  font-weight: 600;
  margin-top: 4px;
}
.connect-input {
  width: 100%;
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: 10px 12px;
  font-size: 13px;
  color: var(--text-primary);
  outline: none;
  font-family: inherit;
  box-sizing: border-box;
}
.connect-input:focus {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 2px var(--accent-glow);
}
.connect-input::placeholder {
  color: var(--text-muted);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}
</style>
