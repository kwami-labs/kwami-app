<script setup lang="ts">
defineProps<{
  modelValue: boolean;
  label?: string;
  description?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}>();

const emit = defineEmits(['update:modelValue']);
</script>

<template>
  <label
    class="toggle-wrapper"
    :class="{ disabled, active: modelValue, [`size-${size || 'md'}`]: true }"
  >
    <input
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      @change="emit('update:modelValue', !modelValue)"
    />

    <div class="toggle-switch">
      <div class="toggle-track">
        <div class="toggle-glow"></div>
      </div>
      <div class="toggle-thumb">
        <div class="thumb-inner"></div>
      </div>
    </div>

    <div v-if="label || description" class="toggle-content">
      <span v-if="label" class="toggle-label">{{ label }}</span>
      <span v-if="description" class="toggle-description">{{ description }}</span>
    </div>
  </label>
</template>

<style scoped>
.toggle-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  user-select: none;
}

.toggle-wrapper.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.toggle-wrapper input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

/* Switch base */
.toggle-switch {
  position: relative;
  flex-shrink: 0;
}

/* Medium size (default) */
.size-md .toggle-switch {
  width: 36px;
  height: 20px;
}

.size-sm .toggle-switch {
  width: 28px;
  height: 16px;
}

.toggle-track {
  position: absolute;
  inset: 0;
  background: var(--surface-2);
  border: 1px solid var(--glass-border);
  border-radius: 100px;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.toggle-glow {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
  opacity: 0;
  transition: opacity 0.25s ease;
}

.toggle-wrapper.active .toggle-track {
  border-color: var(--accent-primary);
}

.toggle-wrapper.active .toggle-glow {
  opacity: 1;
}

/* Thumb */
.toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  border-radius: 50%;
  background: var(--text-muted);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.size-md .toggle-thumb {
  width: 16px;
  height: 16px;
}

.size-sm .toggle-thumb {
  width: 12px;
  height: 12px;
}

.thumb-inner {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--surface-1);
  opacity: 0;
  transform: scale(0);
  transition: all 0.2s ease;
}

.size-sm .thumb-inner {
  width: 6px;
  height: 6px;
}

.toggle-wrapper.active .toggle-thumb {
  background: white;
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.2),
    0 0 16px var(--accent-glow);
}

.size-md.active .toggle-thumb {
  left: 18px;
}

.size-sm.active .toggle-thumb {
  left: 14px;
}

.toggle-wrapper.active .thumb-inner {
  opacity: 1;
  transform: scale(1);
  background: var(--accent-primary);
}

/* Hover states */
.toggle-wrapper:hover:not(.disabled) .toggle-track {
  background: var(--surface-3);
}

.toggle-wrapper:hover:not(.disabled).active .toggle-thumb {
  box-shadow:
    0 2px 12px rgba(0, 0, 0, 0.25),
    0 0 24px var(--accent-glow);
}

/* Focus state */
.toggle-wrapper:focus-within .toggle-track {
  box-shadow: 0 0 0 3px var(--accent-glow);
}

/* Content */
.toggle-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.toggle-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  transition: color 0.2s ease;
}

.toggle-wrapper:hover:not(.disabled) .toggle-label {
  color: var(--text-primary);
}

.toggle-wrapper.active .toggle-label {
  color: var(--text-primary);
}

.toggle-description {
  font-size: 11px;
  color: var(--text-muted);
}
</style>
