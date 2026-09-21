<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { MemoryNode, ViewMode } from './types';
import { getNodeColorHex } from './utils';

const { t } = useI18n();

defineProps<{
  nodes: MemoryNode[];
  viewMode: ViewMode;
}>();

const uniqueTypes = (nodes: MemoryNode[]) => {
  return [...new Set(nodes.map((n) => n.type))];
};
</script>

<template>
  <div class="type-legend" v-if="nodes.length > 0">
    <span class="legend-label">{{ t('memoryGraph.legendEntityTypes') }}</span>
    <div class="legend-items">
      <span v-for="type in uniqueTypes(nodes)" :key="type" class="legend-item">
        <span class="legend-dot" :style="{ background: getNodeColorHex(type) }"></span>
        {{ type }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.type-legend {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: var(--glass-bg);
  flex-wrap: wrap;
}

.legend-label {
  font-size: 11px;
  color: var(--accent-primary);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.legend-items {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  flex: 1;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
</style>
