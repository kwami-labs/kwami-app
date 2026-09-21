<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{
  modelValue: string | number;
  label?: string;
  icon?: string;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  block?: boolean;
  mono?: boolean;
  /** Forwarded to the inner <input>: the wrapper div is this component's root,
   *  so a fallthrough attribute would land there instead of on the field. */
  name?: string;
  autocomplete?: string;
  inputmode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
  maxlength?: number | string;
}>();

const emit = defineEmits(['update:modelValue', 'focus', 'blur']);

const isFocused = ref(false);

const inputType = computed(() => props.type || 'text');

function onInput(e: Event) {
  const target = e.target as HTMLInputElement;
  emit('update:modelValue', target.value);
}

function onFocus(e: FocusEvent) {
  isFocused.value = true;
  emit('focus', e);
}

function onBlur(e: FocusEvent) {
  isFocused.value = false;
  emit('blur', e);
}
</script>

<template>
  <div
    class="base-input"
    :class="{
      block,
      'has-error': !!error,
      focused: isFocused,
      disabled,
      mono,
    }"
  >
    <label v-if="label" class="label">
      <iconify-icon v-if="icon" :icon="icon"></iconify-icon>
      {{ label }}
    </label>

    <div class="input-wrapper">
      <input
        :type="inputType"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :name="name"
        :autocomplete="autocomplete"
        :inputmode="inputmode"
        :maxlength="maxlength"
        :class="{ mono }"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
      />
      <div class="input-border"></div>
      <div class="input-glow"></div>
    </div>

    <Transition name="error">
      <span v-if="error" class="error-msg">
        <iconify-icon icon="ph:warning-circle-fill"></iconify-icon>
        {{ error }}
      </span>
    </Transition>
  </div>
</template>

<style scoped>
.base-input {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.base-input:last-child {
  margin-bottom: 0;
}

.base-input.block {
  width: 100%;
}

.base-input.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
  transition: color var(--duration-fast) ease;
}

.base-input.focused .label {
  color: var(--text-primary);
}

.label iconify-icon {
  font-size: 14px;
  color: var(--text-muted);
  transition: color var(--duration-fast) ease;
}

.base-input.focused .label iconify-icon {
  color: var(--accent-primary);
}

/* Input wrapper for effects */
.input-wrapper {
  position: relative;
  border-radius: var(--radius-md);
}

.input-border {
  position: absolute;
  inset: 0;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  pointer-events: none;
  transition: border-color var(--duration-fast) ease;
}

.input-glow {
  position: absolute;
  inset: -1px;
  border-radius: var(--radius-md);
  opacity: 0;
  background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
  filter: blur(8px);
  transition: opacity var(--duration-normal) ease;
  pointer-events: none;
  z-index: -1;
}

.base-input.focused .input-border {
  border-color: var(--accent-primary);
}

.base-input.focused .input-glow {
  opacity: 0.15;
}

input {
  width: 100%;
  padding: 10px 14px;
  background: var(--surface-1);
  border: none;
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  transition: background var(--duration-fast) ease;
}

input.mono {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  letter-spacing: -0.3px;
}

input:focus {
  outline: none;
  background: var(--surface-2);
}

input::placeholder {
  color: var(--text-muted);
}

input:disabled {
  cursor: not-allowed;
}

/* Error state */
.base-input.has-error .input-border {
  border-color: var(--error);
}

.base-input.has-error .input-glow {
  background: var(--error);
  opacity: 0.1;
}

.error-msg {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--error);
}

.error-msg iconify-icon {
  font-size: 14px;
}

/* Error animation */
.error-enter-active {
  animation: errorIn 0.2s ease;
}

.error-leave-active {
  animation: errorOut 0.15s ease;
}

@keyframes errorIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes errorOut {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-4px);
  }
}
</style>
