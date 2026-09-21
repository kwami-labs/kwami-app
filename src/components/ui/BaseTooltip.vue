<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{
  text: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}>();

const isVisible = ref(false);
let showTimeout: ReturnType<typeof setTimeout> | null = null;

const tooltipPosition = computed(() => props.position || 'top');
const showDelay = computed(() => props.delay ?? 300);

function showTooltip() {
  showTimeout = setTimeout(() => {
    isVisible.value = true;
  }, showDelay.value);
}

function hideTooltip() {
  if (showTimeout) {
    clearTimeout(showTimeout);
    showTimeout = null;
  }
  isVisible.value = false;
}
</script>

<template>
  <div
    class="tooltip-wrapper"
    @mouseenter="showTooltip"
    @mouseleave="hideTooltip"
    @focus="showTooltip"
    @blur="hideTooltip"
  >
    <slot></slot>
    <Transition name="tooltip">
      <div v-if="isVisible && text" class="tooltip" :class="[`tooltip-${tooltipPosition}`]">
        <span class="tooltip-text">{{ text }}</span>
        <div class="tooltip-arrow"></div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.tooltip-wrapper {
  position: relative;
  display: contents;
}

/* Make slotted content the positioning anchor */
.tooltip-wrapper :slotted(*) {
  position: relative;
}

.tooltip {
  position: absolute;
  z-index: 9999;
  padding: 6px 10px;
  background: var(--glass-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  pointer-events: none;
  white-space: nowrap;
}

.tooltip-text {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.3;
}

.tooltip-arrow {
  position: absolute;
  width: 8px;
  height: 8px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  transform: rotate(45deg);
}

/* Position: Top (default) */
.tooltip-top {
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
}

.tooltip-top .tooltip-arrow {
  bottom: -5px;
  left: 50%;
  transform: translateX(-50%) rotate(45deg);
  border-top: none;
  border-left: none;
}

/* Position: Bottom */
.tooltip-bottom {
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
}

.tooltip-bottom .tooltip-arrow {
  top: -5px;
  left: 50%;
  transform: translateX(-50%) rotate(45deg);
  border-bottom: none;
  border-right: none;
}

/* Position: Left */
.tooltip-left {
  right: calc(100% + 8px);
  top: 50%;
  transform: translateY(-50%);
}

.tooltip-left .tooltip-arrow {
  right: -5px;
  top: 50%;
  transform: translateY(-50%) rotate(45deg);
  border-left: none;
  border-bottom: none;
}

/* Position: Right */
.tooltip-right {
  left: calc(100% + 8px);
  top: 50%;
  transform: translateY(-50%);
}

.tooltip-right .tooltip-arrow {
  left: -5px;
  top: 50%;
  transform: translateY(-50%) rotate(45deg);
  border-right: none;
  border-top: none;
}

/* Transition */
.tooltip-enter-active,
.tooltip-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.tooltip-enter-from,
.tooltip-leave-to {
  opacity: 0;
}

.tooltip-top.tooltip-enter-from,
.tooltip-top.tooltip-leave-to {
  transform: translateX(-50%) translateY(4px);
}

.tooltip-bottom.tooltip-enter-from,
.tooltip-bottom.tooltip-leave-to {
  transform: translateX(-50%) translateY(-4px);
}

.tooltip-left.tooltip-enter-from,
.tooltip-left.tooltip-leave-to {
  transform: translateY(-50%) translateX(4px);
}

.tooltip-right.tooltip-enter-from,
.tooltip-right.tooltip-leave-to {
  transform: translateY(-50%) translateX(-4px);
}
</style>
