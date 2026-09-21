<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  value: number; // 0-100 percentage
  label?: string;
  icon?: string;
  color?: 'default' | 'green' | 'yellow' | 'red' | 'cyan' | 'purple' | 'blue' | 'orange';
  autoColor?: boolean; // Enable value-based coloring (default: false)
}>();

const barColor = computed(() => {
  // If explicit color is provided, use it
  if (props.color) return props.color;

  // If autoColor is enabled, use value-based coloring
  if (props.autoColor) {
    if (props.value >= 70) return 'green';
    if (props.value >= 40) return 'yellow';
    return 'red';
  }

  // Default to cyan
  return 'cyan';
});
</script>

<template>
  <div class="range-bar">
    <div v-if="icon || label" class="range-label">
      <iconify-icon v-if="icon" :icon="icon"></iconify-icon>
      <span v-if="label">{{ label }}</span>
    </div>
    <div class="range-track">
      <div
        class="range-fill"
        :class="barColor"
        :style="{ width: `${Math.min(100, Math.max(0, value))}%` }"
      ></div>
    </div>
  </div>
</template>

<style scoped>
.range-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
}

.range-label {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 9px;
  color: var(--text-muted);
  min-width: 52px;
  flex-shrink: 0;
}

.range-label iconify-icon {
  font-size: 10px;
}

.range-track {
  flex: 1;
  height: 4px;
  background: var(--surface-2);
  border-radius: 2px;
  overflow: hidden;
}

.range-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.range-fill.default {
  background: var(--text-muted);
}

.range-fill.green {
  background: #4ade80;
}

.range-fill.yellow {
  background: #fbbf24;
}

.range-fill.red {
  background: #f87171;
}

.range-fill.cyan {
  background: var(--accent-primary, #00d9ff);
}

.range-fill.purple {
  background: #a855f7;
}

.range-fill.blue {
  background: #3b82f6;
}

.range-fill.orange {
  background: #f97316;
}
</style>
