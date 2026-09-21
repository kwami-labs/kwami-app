<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  modelValue: string | number;
  options: Array<{ label: string; value: string | number; icon?: string }>;
  label?: string;
  icon?: string;
  placeholder?: string;
  disabled?: boolean;
  block?: boolean;
}>();

const emit = defineEmits(['update:modelValue']);
const { t } = useI18n();

const isOpen = ref(false);
const selectRef = ref<HTMLElement | null>(null);
const triggerRef = ref<HTMLElement | null>(null);
const highlightedIndex = ref(-1);
const dropdownPlacement = ref<'top' | 'bottom'>('bottom');

// Dropdown position (computed from trigger bounding rect)
const dropdownStyle = ref<Record<string, string>>({});

const selectedOption = computed(() => {
  return props.options.find((opt) => opt.value === props.modelValue);
});

function updateDropdownPosition() {
  if (!triggerRef.value) return;
  const rect = triggerRef.value.getBoundingClientRect();
  const gap = 6;
  const pad = 8;
  const maxH = 252;
  const estH = Math.min(props.options.length * 44 + 12, maxH);
  const spaceBelow = window.innerHeight - rect.bottom - pad;
  const spaceAbove = rect.top - pad;
  const openUp = spaceBelow < estH && spaceAbove > spaceBelow;

  dropdownPlacement.value = openUp ? 'top' : 'bottom';

  const leftClamped = Math.max(pad, Math.min(rect.left, window.innerWidth - rect.width - pad));

  if (openUp) {
    const bottomFromViewport = window.innerHeight - rect.top + gap;
    dropdownStyle.value = {
      position: 'fixed',
      bottom: `${bottomFromViewport}px`,
      top: 'auto',
      left: `${leftClamped}px`,
      width: `${rect.width}px`,
      maxHeight: `${Math.min(spaceAbove, maxH)}px`,
      zIndex: '10001',
      transformOrigin: 'bottom center',
    };
  } else {
    dropdownStyle.value = {
      position: 'fixed',
      top: `${rect.bottom + gap}px`,
      bottom: 'auto',
      left: `${leftClamped}px`,
      width: `${rect.width}px`,
      maxHeight: `${Math.min(spaceBelow, maxH)}px`,
      zIndex: '10001',
      transformOrigin: 'top center',
    };
  }
}

function toggle() {
  if (props.disabled) return;
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    highlightedIndex.value = props.options.findIndex((opt) => opt.value === props.modelValue);
    nextTick(updateDropdownPosition);
  }
}

function select(opt: { label: string; value: string | number }) {
  emit('update:modelValue', opt.value);
  isOpen.value = false;
}

function handleClickOutside(event: MouseEvent) {
  // Check if click is inside the trigger or the teleported dropdown
  const target = event.target as Node;
  if (selectRef.value?.contains(target)) return;
  // Also check if click is inside the teleported dropdown
  const dropdownEl = document.querySelector('.base-select-dropdown-portal');
  if (dropdownEl?.contains(target)) return;
  isOpen.value = false;
}

function handleKeydown(event: KeyboardEvent) {
  if (!isOpen.value) {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
      event.preventDefault();
      isOpen.value = true;
      highlightedIndex.value = Math.max(
        0,
        props.options.findIndex((opt) => opt.value === props.modelValue),
      );
      nextTick(updateDropdownPosition);
    }
    return;
  }

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      highlightedIndex.value = Math.min(highlightedIndex.value + 1, props.options.length - 1);
      break;
    case 'ArrowUp':
      event.preventDefault();
      highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0);
      break;
    case 'Enter':
    case ' ':
      event.preventDefault();
      const option = props.options[highlightedIndex.value];
      if (highlightedIndex.value >= 0 && option) {
        select(option);
      }
      break;
    case 'Escape':
      isOpen.value = false;
      break;
  }
}

// Close on scroll of any ancestor (position may shift)
function handleScroll() {
  if (isOpen.value) {
    updateDropdownPosition();
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside, true);
  document.addEventListener('scroll', handleScroll, true);
  window.addEventListener('resize', handleScroll);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside, true);
  document.removeEventListener('scroll', handleScroll, true);
  window.removeEventListener('resize', handleScroll);
});
</script>

<template>
  <div
    ref="selectRef"
    class="base-select"
    :class="{ disabled, open: isOpen, block }"
    @keydown="handleKeydown"
  >
    <label v-if="label" class="label">
      <iconify-icon v-if="icon" :icon="icon"></iconify-icon>
      {{ label }}
    </label>

    <button
      ref="triggerRef"
      type="button"
      class="select-trigger"
      :disabled="disabled"
      @click="toggle"
      :tabindex="disabled ? -1 : 0"
    >
      <span class="select-value" :class="{ placeholder: !selectedOption }">
        <iconify-icon
          v-if="selectedOption?.icon"
          :icon="selectedOption.icon"
          class="option-icon"
        ></iconify-icon>
        {{ selectedOption?.label || placeholder || t('ui.selectPlaceholder') }}
      </span>
      <iconify-icon icon="ph:caret-up-down-bold" class="caret"></iconify-icon>
    </button>

    <Teleport to="body">
      <Transition name="dropdown">
        <div
          v-if="isOpen"
          class="dropdown base-select-dropdown-portal"
          :style="dropdownStyle"
          :data-placement="dropdownPlacement"
        >
          <div class="dropdown-scroll">
            <button
              v-for="(opt, idx) in options"
              :key="opt.value"
              type="button"
              class="dropdown-option"
              :class="{
                selected: opt.value === modelValue,
                highlighted: idx === highlightedIndex,
              }"
              @click="select(opt)"
              @mouseenter="highlightedIndex = idx"
            >
              <iconify-icon v-if="opt.icon" :icon="opt.icon" class="option-icon"></iconify-icon>
              <span class="option-label">{{ opt.label }}</span>
              <iconify-icon
                v-if="opt.value === modelValue"
                icon="ph:check-bold"
                class="check-icon"
              ></iconify-icon>
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.base-select {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.base-select.block {
  width: 100%;
}

.base-select.disabled {
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
}

.label iconify-icon {
  font-size: 14px;
  color: var(--text-muted);
}

.select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  color: var(--text-primary);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.select-trigger:hover:not(:disabled) {
  background: var(--surface-2);
  border-color: var(--surface-3);
}

.select-trigger:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px var(--accent-glow);
}

.base-select.open .select-trigger {
  border-color: var(--accent-primary);
  background: var(--surface-2);
}

.select-value {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.select-value.placeholder {
  color: var(--text-muted);
}

.caret {
  font-size: 12px;
  color: var(--text-muted);
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.base-select.open .caret {
  color: var(--accent-primary);
}
</style>

<!-- Unscoped styles for the teleported dropdown -->
<style>
.base-select-dropdown-portal.dropdown {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset;
  overflow: hidden;
}

.base-select-dropdown-portal[data-placement='top'] {
  box-shadow:
    0 -12px 40px rgba(0, 0, 0, 0.28),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset;
}

.base-select-dropdown-portal .dropdown-scroll {
  max-height: 240px;
  overflow-y: auto;
  padding: 6px;
  scrollbar-width: thin;
  scrollbar-color: var(--surface-3) transparent;
}

.base-select-dropdown-portal .dropdown-scroll::-webkit-scrollbar {
  width: 4px;
}

.base-select-dropdown-portal .dropdown-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.base-select-dropdown-portal .dropdown-scroll::-webkit-scrollbar-thumb {
  background: var(--surface-3);
  border-radius: 2px;
}

.base-select-dropdown-portal .dropdown-option {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}

.base-select-dropdown-portal .dropdown-option:hover,
.base-select-dropdown-portal .dropdown-option.highlighted {
  background: var(--surface-2);
  color: var(--text-primary);
}

.base-select-dropdown-portal .dropdown-option.selected {
  color: var(--accent-primary);
  background: var(--accent-glow);
}

.base-select-dropdown-portal .dropdown-option.selected:hover,
.base-select-dropdown-portal .dropdown-option.selected.highlighted {
  background: var(--accent-glow);
}

.base-select-dropdown-portal .option-icon {
  font-size: 16px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.base-select-dropdown-portal .dropdown-option.selected .option-icon {
  color: var(--accent-primary);
}

.base-select-dropdown-portal .option-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.base-select-dropdown-portal .check-icon {
  font-size: 14px;
  color: var(--accent-primary);
  flex-shrink: 0;
}

/* Dropdown animation */
.dropdown-enter-active {
  animation: dropdownIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.dropdown-leave-active {
  animation: dropdownOut 0.15s ease-in;
}

.base-select-dropdown-portal[data-placement='top'].dropdown-enter-active {
  animation: dropdownInUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.base-select-dropdown-portal[data-placement='top'].dropdown-leave-active {
  animation: dropdownOutUp 0.15s ease-in;
}

@keyframes dropdownIn {
  from {
    opacity: 0;
    transform: translateY(-8px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes dropdownOut {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(-4px) scale(0.98);
  }
}

@keyframes dropdownInUp {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes dropdownOutUp {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(4px) scale(0.98);
  }
}
</style>
