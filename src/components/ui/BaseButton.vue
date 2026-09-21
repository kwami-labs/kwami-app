<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  icon?: string;
  iconRight?: string;
  disabled?: boolean;
  loading?: boolean;
  block?: boolean;
}>();

const emit = defineEmits(['click']);

const classes = computed(() => {
  return [
    'base-btn',
    `variant-${props.variant || 'secondary'}`,
    `size-${props.size || 'md'}`,
    {
      block: props.block,
      loading: props.loading,
      'icon-only': props.icon && !props.iconRight && !slots.default,
    },
  ];
});

// Check if default slot has content
import { useSlots } from 'vue';
const slots = useSlots();
</script>

<template>
  <button :class="classes" :disabled="disabled || loading" @click="emit('click', $event)">
    <span class="btn-content">
      <iconify-icon v-if="loading" icon="ph:spinner-gap-bold" class="spin"></iconify-icon>
      <iconify-icon v-else-if="icon" :icon="icon" class="btn-icon"></iconify-icon>
      <span v-if="$slots.default" class="btn-text"><slot></slot></span>
      <iconify-icon
        v-if="iconRight && !loading"
        :icon="iconRight"
        class="btn-icon-right"
      ></iconify-icon>
    </span>
    <span class="btn-glow"></span>
  </button>
</template>

<style scoped>
.base-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-in-out);
  border: 1px solid transparent;
  overflow: hidden;
  white-space: nowrap;
}

.base-btn.block {
  width: 100%;
}

.btn-content {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  z-index: 1;
}

.btn-glow {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity var(--duration-normal) ease;
}

/* Sizes */
.size-sm {
  padding: 8px 14px;
  font-size: 11px;
  border-radius: var(--radius-sm);
}

.size-sm .btn-icon,
.size-sm .btn-icon-right {
  font-size: 14px;
}

.size-md {
  padding: 10px 18px;
  font-size: 12px;
}

.size-md .btn-icon,
.size-md .btn-icon-right {
  font-size: 16px;
}

.size-lg {
  padding: 14px 24px;
  font-size: 14px;
  border-radius: var(--radius-lg);
}

.size-lg .btn-icon,
.size-lg .btn-icon-right {
  font-size: 18px;
}

/* Icon only buttons */
.icon-only.size-sm {
  padding: 8px;
  width: 32px;
  height: 32px;
}

.icon-only.size-md {
  padding: 10px;
  width: 40px;
  height: 40px;
}

.icon-only.size-lg {
  padding: 12px;
  width: 48px;
  height: 48px;
}

/* Variants */
.variant-primary {
  background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
  color: white;
  border: none;
  box-shadow: 0 4px 16px var(--accent-glow);
}

.variant-primary .btn-glow {
  background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
  filter: blur(16px);
}

.variant-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px var(--accent-glow);
}

.variant-primary:hover:not(:disabled) .btn-glow {
  opacity: 0.5;
}

.variant-primary:active:not(:disabled) {
  transform: translateY(0);
}

.variant-secondary {
  background: var(--surface-2);
  color: var(--text-secondary);
  border-color: var(--glass-border);
}

.variant-secondary:hover:not(:disabled) {
  background: var(--surface-3);
  color: var(--text-primary);
  border-color: var(--surface-4);
  transform: translateY(-1px);
}

.variant-accent {
  background: var(--accent-glow);
  color: var(--accent-primary);
  border-color: color-mix(in srgb, var(--accent-secondary) 25%, transparent);
}

.variant-accent:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent-secondary) 20%, transparent);
  border-color: var(--accent-secondary);
  transform: translateY(-1px);
}

.variant-danger {
  background: var(--surface-2);
  color: var(--error);
  border-color: var(--glass-border);
}

.variant-danger:hover:not(:disabled) {
  background: var(--error-glow);
  border-color: rgba(248, 113, 113, 0.3);
}

.variant-ghost {
  background: transparent;
  color: var(--text-secondary);
}

.variant-ghost:hover:not(:disabled) {
  background: var(--surface-2);
  color: var(--text-primary);
}

/* States */
.base-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none !important;
}

.base-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--accent-glow);
}

/* Loading state */
.loading {
  pointer-events: none;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
