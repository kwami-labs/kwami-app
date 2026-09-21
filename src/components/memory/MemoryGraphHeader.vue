<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { ViewMode } from './types';

const { t } = useI18n();

defineProps<{
  searchQuery: string;
  filterType: string;
  entityTypes: string[];
  showEdgeLabels: boolean;
  viewMode: ViewMode;
  loading: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:searchQuery', value: string): void;
  (e: 'update:filterType', value: string): void;
  (e: 'update:showEdgeLabels', value: boolean): void;
  (e: 'update:viewMode', value: ViewMode): void;
  (e: 'refresh'): void;
}>();
</script>

<template>
  <div class="graph-header">
    <div class="search-box">
      <iconify-icon icon="ph:magnifying-glass"></iconify-icon>
      <input
        :value="searchQuery"
        @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
        type="text"
        :placeholder="t('memoryGraph.searchPlaceholder')"
        class="search-input"
      />
    </div>

    <select
      :value="filterType"
      @change="emit('update:filterType', ($event.target as HTMLSelectElement).value)"
      class="type-filter"
    >
      <option v-for="etype in entityTypes" :key="etype" :value="etype">
        {{
          etype === 'all'
            ? t('memoryGraph.filterAll')
            : etype.charAt(0).toUpperCase() + etype.slice(1)
        }}
      </option>
    </select>

    <!-- View Mode Toggle -->
    <div class="view-toggle">
      <button
        class="view-btn"
        :class="{ active: viewMode === '3d' }"
        @click="emit('update:viewMode', '3d')"
        :title="t('memoryGraph.view3d')"
      >
        <iconify-icon icon="ph:cube"></iconify-icon>
        3D
      </button>
      <button
        class="view-btn"
        :class="{ active: viewMode === '2d' }"
        @click="emit('update:viewMode', '2d')"
        :title="t('memoryGraph.view2d')"
      >
        <iconify-icon icon="ph:graph"></iconify-icon>
        2D
      </button>
    </div>

    <button
      class="toggle-btn"
      :class="{ active: showEdgeLabels }"
      @click="emit('update:showEdgeLabels', !showEdgeLabels)"
      :title="t('memoryGraph.toggleEdgeLabels')"
    >
      <iconify-icon icon="ph:text-aa"></iconify-icon>
    </button>

    <button class="refresh-btn" @click="emit('refresh')" :disabled="loading">
      <iconify-icon
        :icon="loading ? 'ph:spinner-gap' : 'ph:arrows-clockwise'"
        :class="{ spin: loading }"
      />
    </button>
  </div>
</template>

<style scoped>
.graph-header {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}

.search-box {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: 8px 12px;
  color: var(--text-secondary);
}

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 13px;
}

.search-input::placeholder {
  color: var(--text-muted);
}

.type-filter {
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: 8px 12px;
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
}

.type-filter option {
  background: var(--glass-bg);
}

.view-toggle {
  display: flex;
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.view-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
  transition: all var(--duration-fast) ease;
}

.view-btn:hover {
  color: var(--text-secondary);
  background: var(--surface-2);
}

.view-btn.active {
  color: var(--accent-primary);
  background: var(--accent-glow);
}

.view-btn:first-child {
  border-right: 1px solid var(--glass-border);
}

.refresh-btn,
.toggle-btn {
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: 8px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
}

.refresh-btn:hover,
.toggle-btn:hover {
  background: var(--surface-2);
  color: var(--text-primary);
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toggle-btn.active {
  background: var(--accent-glow);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
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
