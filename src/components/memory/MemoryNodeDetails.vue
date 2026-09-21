<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type {
  MemoryNode,
  MemoryEdge,
  MemoryGraph,
  UpdateNodePayload,
  UpdateEdgePayload,
} from './types';
import { getNodeColorHex, formatDate } from './utils';
import BaseSelect from '@/components/ui/BaseSelect.vue';

const { t } = useI18n();

const props = defineProps<{
  node: MemoryNode | null;
  edges: MemoryEdge[];
  graph: MemoryGraph;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'update-node', nodeUuid: string, data: UpdateNodePayload): void;
  (e: 'update-edge', edgeIndex: number, edge: MemoryEdge, data: UpdateEdgePayload): void;
  (e: 'delete-edge', edgeIndex: number, edge: MemoryEdge): void;
}>();

// Edit mode state
const isEditing = ref(false);
const editData = ref({
  name: '',
  summary: '',
  type: '',
  labels: [] as string[],
  newLabel: '',
});

// Edge editing
const editingEdgeIndex = ref<number | null>(null);
const editEdgeRelation = ref('');

const entityTypeKeys = [
  'user',
  'assistant',
  'person',
  'pet',
  'location',
  'place',
  'preference',
  'topic',
  'skill',
  'project',
  'organization',
  'product',
  'event',
  'activity',
  'goal',
  'procedure',
  'attribute',
  'genre',
  'artist',
  'fact',
  'tool',
  'venue',
  'entity',
] as const;

function titleCaseEntityKey(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

const entityTypeOptions = computed(() =>
  entityTypeKeys.map((key) => ({
    label: t(`memoryNode.entityTypes.${key}`),
    value: key,
  })),
);

const labelAddOptions = computed(() =>
  entityTypeKeys
    .filter((key) => !editData.value.labels.includes(titleCaseEntityKey(key)))
    .map((key) => ({
      label: t(`memoryNode.entityTypes.${key}`),
      value: titleCaseEntityKey(key),
    })),
);

function getConnectedNodeLabel(nodeId: string): string {
  const node = props.graph.nodes.find((n) => n.id === nodeId);
  return node?.label || nodeId;
}

function startEditing() {
  if (!props.node) return;
  isEditing.value = true;
  editData.value = {
    name: props.node.label || '',
    summary: props.node.summary || '',
    type: props.node.type || 'entity',
    labels: [...(props.node.labels || [])],
    newLabel: '',
  };
}

function cancelEditing() {
  isEditing.value = false;
  editingEdgeIndex.value = null;
}

function saveNode() {
  if (!props.node?.uuid) return;
  const payload: UpdateNodePayload = {};

  if (editData.value.name.trim() && editData.value.name !== props.node.label) {
    payload.name = editData.value.name.trim();
  }
  if (editData.value.summary !== (props.node.summary || '')) {
    payload.summary = editData.value.summary.trim();
  }
  if (JSON.stringify(editData.value.labels) !== JSON.stringify(props.node.labels || [])) {
    payload.labels = editData.value.labels;
  }

  // Only emit if there are changes
  if (Object.keys(payload).length > 0) {
    emit('update-node', props.node.uuid, payload);
  }

  isEditing.value = false;
}

function removeLabel(index: number) {
  editData.value.labels.splice(index, 1);
}

function addLabel(val: string | number) {
  const label = String(val).trim();
  if (label && !editData.value.labels.includes(label)) {
    editData.value.labels.push(label);
  }
  editData.value.newLabel = '';
}

// Edge editing
function startEditEdge(index: number) {
  editingEdgeIndex.value = index;
  editEdgeRelation.value = props.edges[index]?.relation || '';
}

function cancelEditEdge() {
  editingEdgeIndex.value = null;
  editEdgeRelation.value = '';
}

function saveEdge(index: number) {
  const edge = props.edges[index];
  if (!edge) return;

  const newRelation = editEdgeRelation.value.trim();
  if (newRelation && newRelation !== edge.relation) {
    emit('update-edge', index, edge, { name: newRelation });
  }

  editingEdgeIndex.value = null;
}

function handleDeleteEdge(index: number) {
  const edge = props.edges[index];
  if (edge) {
    emit('delete-edge', index, edge);
  }
}

// Reset editing state when node changes
watch(
  () => props.node,
  () => {
    isEditing.value = false;
    editingEdgeIndex.value = null;
  },
);
</script>

<template>
  <Transition name="slide">
    <div v-if="node" class="node-details-panel">
      <div class="panel-header">
        <h3 class="panel-title">{{ t('memoryNode.title') }}</h3>
        <span
          v-if="!isEditing"
          class="type-badge-header"
          :style="{ background: getNodeColorHex(node.type) }"
        >
          {{ node.type }}
        </span>
        <div class="header-actions">
          <button
            v-if="!isEditing"
            class="header-btn edit-btn"
            @click="startEditing"
            :title="t('memoryNode.editNode')"
          >
            <iconify-icon icon="ph:pencil-simple-duotone"></iconify-icon>
          </button>
          <button class="header-btn close-btn" @click="emit('close')">
            <iconify-icon icon="ph:x"></iconify-icon>
          </button>
        </div>
      </div>

      <div class="panel-content">
        <!-- ======== Read Mode ======== -->
        <template v-if="!isEditing">
          <!-- Name -->
          <div class="detail-section">
            <span class="detail-label">{{ t('memoryNode.nameColon') }}</span>
            <span class="detail-value name-value">{{ node.label }}</span>
          </div>

          <!-- UUID -->
          <div v-if="node.uuid" class="detail-section">
            <span class="detail-label">{{ t('memoryNode.uuid') }}</span>
            <span class="detail-value mono uuid-value">{{ node.uuid }}</span>
          </div>

          <!-- Created date -->
          <div v-if="node.created_at" class="detail-section">
            <span class="detail-label">{{ t('memoryNode.created') }}</span>
            <span class="detail-value">{{ formatDate(node.created_at) }}</span>
          </div>

          <!-- Summary -->
          <div v-if="node.summary" class="detail-section summary-section">
            <span class="detail-label">{{ t('memoryNode.summaryColon') }}</span>
            <p class="summary-text">{{ node.summary }}</p>
          </div>

          <!-- Labels -->
          <div v-if="node.labels && node.labels.length > 0" class="detail-section">
            <span class="detail-label">{{ t('memoryNode.labelsColon') }}</span>
            <div class="labels-container">
              <span v-for="label in node.labels" :key="label" class="label-badge">
                {{ label }}
              </span>
            </div>
          </div>

          <!-- Connections -->
          <div v-if="edges.length > 0" class="connections-section">
            <span class="section-title">
              <iconify-icon icon="ph:link"></iconify-icon>
              {{ t('memoryNode.connections', { count: edges.length }) }}
            </span>
            <div class="connections-list">
              <div v-for="(edge, idx) in edges" :key="idx" class="connection-item">
                <span class="connection-direction">
                  <template v-if="edge.source === node?.id">
                    <iconify-icon icon="ph:arrow-right"></iconify-icon>
                  </template>
                  <template v-else>
                    <iconify-icon icon="ph:arrow-left"></iconify-icon>
                  </template>
                </span>
                <span class="connection-relation">{{ edge.relation }}</span>
                <span class="connection-target">
                  {{
                    edge.source === node?.id
                      ? getConnectedNodeLabel(edge.target)
                      : getConnectedNodeLabel(edge.source)
                  }}
                </span>
              </div>
            </div>
          </div>

          <div v-else class="no-connections">
            <iconify-icon icon="ph:link-break"></iconify-icon>
            {{ t('memoryNode.noConnections') }}
          </div>
        </template>

        <!-- ======== Edit Mode ======== -->
        <template v-else>
          <!-- Name -->
          <div class="edit-field">
            <label class="edit-field-label">{{ t('memoryNode.name') }}</label>
            <input
              v-model="editData.name"
              class="edit-input"
              :placeholder="t('memoryNode.namePlaceholder')"
            />
          </div>

          <!-- Type -->
          <div class="edit-field">
            <BaseSelect
              v-model="editData.type"
              :options="entityTypeOptions"
              :label="t('memoryNode.type')"
              icon="ph:tag-duotone"
            />
          </div>

          <!-- Summary -->
          <div class="edit-field">
            <label class="edit-field-label">{{ t('memoryNode.summary') }}</label>
            <textarea
              v-model="editData.summary"
              class="edit-textarea"
              :placeholder="t('memoryNode.summaryPlaceholder')"
              rows="3"
            ></textarea>
          </div>

          <!-- Labels -->
          <div class="edit-field">
            <label class="edit-field-label">{{ t('memoryNode.labels') }}</label>
            <div class="edit-labels-wrap">
              <span v-for="(label, li) in editData.labels" :key="li" class="edit-chip">
                {{ label }}
                <button class="chip-x" @click="removeLabel(li)">
                  <iconify-icon icon="ph:x-bold"></iconify-icon>
                </button>
              </span>
              <div class="chip-add-wrap">
                <BaseSelect
                  :modelValue="editData.newLabel"
                  @update:modelValue="addLabel"
                  :options="labelAddOptions"
                  :placeholder="t('memoryNode.addLabel')"
                />
              </div>
            </div>
          </div>

          <!-- Connections (editable) -->
          <div v-if="edges.length > 0" class="connections-section">
            <span class="section-title">
              <iconify-icon icon="ph:link"></iconify-icon>
              {{ t('memoryNode.connections', { count: edges.length }) }}
            </span>
            <div class="connections-list">
              <div v-for="(edge, idx) in edges" :key="idx" class="connection-item editable">
                <template v-if="editingEdgeIndex !== idx">
                  <span class="connection-direction">
                    <template v-if="edge.source === node?.id">
                      <iconify-icon icon="ph:arrow-right"></iconify-icon>
                    </template>
                    <template v-else>
                      <iconify-icon icon="ph:arrow-left"></iconify-icon>
                    </template>
                  </span>
                  <span class="connection-relation">{{ edge.relation }}</span>
                  <span class="connection-target">
                    {{
                      edge.source === node?.id
                        ? getConnectedNodeLabel(edge.target)
                        : getConnectedNodeLabel(edge.source)
                    }}
                  </span>
                  <div class="connection-actions">
                    <button
                      class="conn-btn"
                      @click="startEditEdge(idx)"
                      :title="t('memoryNode.editRelation')"
                    >
                      <iconify-icon icon="ph:pencil-simple"></iconify-icon>
                    </button>
                    <button
                      class="conn-btn danger"
                      @click="handleDeleteEdge(idx)"
                      :title="t('memoryNode.deleteConnection')"
                    >
                      <iconify-icon icon="ph:trash-simple"></iconify-icon>
                    </button>
                  </div>
                </template>
                <template v-else>
                  <div class="edit-connection-row">
                    <input
                      v-model="editEdgeRelation"
                      class="edit-relation-input"
                      :placeholder="t('memoryNode.relationPlaceholder')"
                      @keydown.enter="saveEdge(idx)"
                      @keydown.escape="cancelEditEdge"
                    />
                    <button class="conn-btn save" @click="saveEdge(idx)">
                      <iconify-icon icon="ph:check-bold"></iconify-icon>
                    </button>
                    <button class="conn-btn" @click="cancelEditEdge">
                      <iconify-icon icon="ph:x-bold"></iconify-icon>
                    </button>
                  </div>
                </template>
              </div>
            </div>
          </div>

          <!-- Save / Cancel -->
          <div class="edit-footer">
            <button class="footer-btn save" @click="saveNode">
              <iconify-icon icon="ph:check-bold"></iconify-icon>
              {{ t('memoryNode.saveChanges') }}
            </button>
            <button class="footer-btn cancel" @click="cancelEditing">
              <iconify-icon icon="ph:x-bold"></iconify-icon>
              {{ t('memoryNode.cancel') }}
            </button>
          </div>
        </template>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.node-details-panel {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 340px;
  max-height: calc(100% - 60px);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: var(--glass-shadow);
  z-index: 10;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--glass-border);
  background: var(--glass-highlight);
}

.panel-title {
  flex: 1;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.type-badge-header {
  padding: 4px 12px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  text-transform: capitalize;
}

.header-actions {
  display: flex;
  gap: 4px;
}

.header-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 6px;
  border-radius: var(--radius-sm);
  transition: all var(--duration-fast) ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-btn:hover {
  background: var(--surface-2);
  color: var(--text-primary);
}

.header-btn.edit-btn:hover {
  color: var(--accent-primary);
}

.panel-content {
  padding: 18px;
  overflow-y: auto;
  flex: 1;
}

.detail-section {
  margin-bottom: 16px;
}

.detail-label {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.detail-value {
  font-size: 14px;
  color: var(--text-primary);
}

.detail-value.name-value {
  font-size: 15px;
  font-weight: 500;
}

.detail-value.mono {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--text-secondary);
}

.detail-value.uuid-value {
  word-break: break-all;
  line-height: 1.4;
}

.summary-section {
  padding-top: 12px;
  border-top: 1px solid var(--glass-border);
}

.summary-text {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 6px 0 0 0;
  padding: 12px;
  background: var(--surface-1);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--accent-primary);
}

.labels-container {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.label-badge {
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 500;
  background: var(--surface-2);
  color: var(--text-secondary);
  border: 1px solid var(--glass-border);
}

.connections-section {
  margin-top: 16px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--accent-primary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
}

.connections-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.connection-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--surface-1);
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
}

.connection-item.editable:hover .connection-actions {
  opacity: 1;
}

.connection-direction {
  color: var(--text-muted);
  font-size: 14px;
}

.connection-relation {
  font-size: 11px;
  color: var(--accent-primary);
  background: var(--accent-glow);
  padding: 2px 8px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.connection-target {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary);
  text-align: right;
}

.connection-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.2s;
}

.conn-btn {
  background: transparent;
  border: none;
  padding: 4px;
  border-radius: 4px;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  transition: all 0.15s;
}
.conn-btn:hover {
  background: var(--surface-2);
  color: var(--text-primary);
}
.conn-btn.danger:hover {
  background: rgba(239, 68, 68, 0.15);
  color: var(--accent-error, #ef4444);
}
.conn-btn.save {
  color: var(--accent-success, #22c55e);
}
.conn-btn.save:hover {
  background: rgba(34, 197, 94, 0.15);
}

.conn-btn iconify-icon {
  font-size: 13px;
}

.edit-connection-row {
  display: flex;
  gap: 6px;
  align-items: center;
  width: 100%;
}

.edit-relation-input {
  flex: 1;
  background: var(--surface-0);
  border: 1px solid var(--accent-primary);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 11px;
  color: var(--text-primary);
  outline: none;
  font-family: inherit;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.no-connections {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  color: var(--text-muted);
  font-size: 13px;
}

/* Edit mode fields */
.edit-field {
  margin-bottom: 14px;
}

.edit-field-label {
  display: block;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  margin-bottom: 6px;
  font-weight: 600;
}

.edit-input {
  width: 100%;
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: 8px 12px;
  font-size: 14px;
  color: var(--text-primary);
  outline: none;
  font-family: inherit;
  box-sizing: border-box;
}

.edit-input:focus,
.edit-textarea:focus {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 2px rgba(var(--accent-primary-rgb, 0, 217, 255), 0.15);
}

.edit-textarea {
  width: 100%;
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: 8px 12px;
  font-size: 13px;
  color: var(--text-primary);
  outline: none;
  font-family: inherit;
  resize: vertical;
  min-height: 50px;
  box-sizing: border-box;
}

.edit-labels-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.edit-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 4px 8px;
  background: var(--accent-primary);
  color: #fff;
  border-radius: 4px;
  text-transform: uppercase;
}

.chip-x {
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 0;
  display: flex;
  opacity: 0.7;
}
.chip-x:hover {
  opacity: 1;
}
.chip-x iconify-icon {
  font-size: 10px;
}

.chip-add-wrap {
  min-width: 110px;
}

/* Footer save/cancel */
.edit-footer {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--glass-border);
}

.footer-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px;
  border: none;
  border-radius: var(--radius-md);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}

.footer-btn.save {
  background: var(--accent-primary);
  color: #fff;
}
.footer-btn.save:hover {
  filter: brightness(1.1);
}

.footer-btn.cancel {
  background: var(--surface-2);
  color: var(--text-secondary);
  border: 1px solid var(--glass-border);
}
.footer-btn.cancel:hover {
  background: var(--surface-3);
  color: var(--text-primary);
}

.footer-btn iconify-icon {
  font-size: 14px;
}

/* Transitions */
.slide-enter-active,
.slide-leave-active {
  transition: all var(--duration-normal) ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
