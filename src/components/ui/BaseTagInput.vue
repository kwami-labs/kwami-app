<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  label?: string;
  icon?: string;
  modelValue: string[];
  placeholder?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void;
}>();
const { t } = useI18n();

const newValue = ref('');
const isFocused = ref(false);

function addTag() {
  if (props.disabled || !newValue.value.trim()) return;
  const current = [...props.modelValue];
  if (!current.includes(newValue.value.trim())) {
    current.push(newValue.value.trim());
    emit('update:modelValue', current);
  }
  newValue.value = '';
}

function removeTag(tag: string) {
  if (props.disabled) return;
  emit(
    'update:modelValue',
    props.modelValue.filter((t) => t !== tag),
  );
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault();
    addTag();
  }
  if (e.key === 'Backspace' && !newValue.value && props.modelValue.length > 0) {
    const lastTag = props.modelValue[props.modelValue.length - 1];
    if (lastTag) removeTag(lastTag);
  }
}
</script>

<template>
  <div class="base-tag-input" :class="{ disabled, focused: isFocused }">
    <label v-if="label" class="label">
      <iconify-icon v-if="icon" :icon="icon"></iconify-icon>
      {{ label }}
    </label>

    <div class="input-container">
      <TransitionGroup name="tag" tag="div" class="tags-wrapper">
        <span v-for="tag in modelValue" :key="tag" class="tag">
          <span class="tag-text">{{ tag }}</span>
          <button
            type="button"
            class="remove-btn"
            @click.stop="removeTag(tag)"
            :disabled="disabled"
            tabindex="-1"
          >
            <iconify-icon icon="ph:x-bold"></iconify-icon>
          </button>
        </span>
      </TransitionGroup>

      <input
        type="text"
        v-model="newValue"
        :placeholder="modelValue.length === 0 ? placeholder || t('ui.addItemPlaceholder') : ''"
        :disabled="disabled"
        @keydown="handleKeydown"
        @focus="isFocused = true"
        @blur="isFocused = false"
      />
    </div>
  </div>
</template>

<style scoped>
.base-tag-input {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.base-tag-input.disabled {
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

.base-tag-input.focused .label {
  color: var(--text-primary);
}

.label iconify-icon {
  font-size: 14px;
  color: var(--text-muted);
  transition: color var(--duration-fast) ease;
}

.base-tag-input.focused .label iconify-icon {
  color: var(--accent-primary);
}

.input-container {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  transition: all var(--duration-fast) ease;
  min-height: 42px;
}

.base-tag-input.focused .input-container {
  border-color: var(--accent-primary);
  background: var(--surface-2);
  box-shadow: 0 0 0 3px var(--accent-glow);
}

.tags-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--accent-glow);
  border: 1px solid rgba(0, 217, 255, 0.2);
  border-radius: 100px;
  font-size: 11px;
  font-weight: 500;
  color: var(--accent-primary);
  transition: all var(--duration-fast) ease;
}

.tag:hover {
  background: rgba(0, 217, 255, 0.2);
}

.tag-text {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.remove-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  background: none;
  border: none;
  border-radius: 50%;
  color: var(--accent-primary);
  cursor: pointer;
  opacity: 0.7;
  transition: all var(--duration-fast) ease;
}

.remove-btn:hover:not(:disabled) {
  opacity: 1;
  background: rgba(0, 217, 255, 0.2);
}

.remove-btn iconify-icon {
  font-size: 10px;
}

input {
  flex: 1;
  min-width: 80px;
  background: transparent;
  border: none;
  padding: 0;
  color: var(--text-primary);
  font-size: 12px;
  font-family: inherit;
  outline: none;
}

input::placeholder {
  color: var(--text-muted);
}

/* Tag animations */
.tag-enter-active {
  animation: tagIn 0.2s var(--ease-out);
}

.tag-leave-active {
  animation: tagOut 0.15s ease-in;
  position: absolute;
}

.tag-move {
  transition: transform 0.2s var(--ease-out);
}

@keyframes tagIn {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes tagOut {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.8);
  }
}
</style>
