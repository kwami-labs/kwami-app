<script setup lang="ts">
import { computed, ref } from 'vue';

const props = withDefaults(
  defineProps<{
    modelValue: number;
    label?: string;
    description?: string;
    icon?: string;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    inline?: boolean;
    hideValue?: boolean;
    editValue?: boolean;
  }>(),
  {
    editValue: true,
  },
);

const emit = defineEmits(['update:modelValue']);

const isDragging = ref(false);
const isEditing = ref(false);
const editInputValue = ref('');

const minVal = computed(() => props.min ?? 0);
const maxVal = computed(() => props.max ?? 100);
const stepVal = computed(() => props.step ?? 1);

const displayValue = computed(() => {
  const step = stepVal.value;
  if (step < 0.01) return props.modelValue.toFixed(3);
  if (step < 0.1) return props.modelValue.toFixed(2);
  if (step < 1) return props.modelValue.toFixed(1);
  return props.modelValue.toString();
});

const fillPercent = computed(() => {
  const range = maxVal.value - minVal.value;
  if (range === 0) return 0;
  // Clamp fill percent between 0 and 100 for visual display
  const percent = ((props.modelValue - minVal.value) / range) * 100;
  return Math.max(0, Math.min(100, percent));
});

const trackStyle = computed(() => ({
  '--fill-percent': `${fillPercent.value}%`,
}));

function onInput(e: Event) {
  const target = e.target as HTMLInputElement;
  emit('update:modelValue', parseFloat(target.value));
}

function onMouseDown() {
  isDragging.value = true;
}

function onMouseUp() {
  isDragging.value = false;
}

function startEditing() {
  if (!props.editValue) return;
  isEditing.value = true;
  editInputValue.value = displayValue.value;
}

function finishEditing() {
  isEditing.value = false;
  const parsed = parseFloat(editInputValue.value);
  if (!isNaN(parsed)) {
    emit('update:modelValue', parsed);
  }
}

function onEditKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    finishEditing();
  } else if (e.key === 'Escape') {
    isEditing.value = false;
  }
}
</script>

<template>
  <div class="slider-control" :class="{ inline, dragging: isDragging }">
    <div v-if="label" class="slider-header">
      <label class="slider-label">
        <iconify-icon v-if="icon" :icon="icon"></iconify-icon>
        {{ label }}
        <span v-if="description" class="slider-description">{{ description }}</span>
      </label>
      <template v-if="hideValue !== true">
        <input
          v-if="isEditing"
          v-model="editInputValue"
          type="text"
          class="slider-value-input"
          @blur="finishEditing"
          @keydown="onEditKeydown"
          ref="editInput"
          autofocus
        />
        <span v-else class="slider-value" :class="{ editable: editValue }" @click="startEditing">
          {{ displayValue }}<span v-if="unit" class="slider-unit">{{ unit }}</span>
        </span>
      </template>
    </div>

    <div class="slider-track-wrapper" :style="trackStyle">
      <div class="slider-track">
        <div class="slider-fill"></div>
      </div>
      <input
        ref="sliderRef"
        type="range"
        :min="minVal"
        :max="maxVal"
        :step="stepVal"
        :value="modelValue"
        @input="onInput"
        @mousedown="onMouseDown"
        @mouseup="onMouseUp"
        @touchstart="onMouseDown"
        @touchend="onMouseUp"
      />
    </div>
  </div>
</template>

<style scoped>
.slider-control {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.slider-control.inline {
  flex-direction: row;
  align-items: center;
  gap: 12px;
}

.slider-control.inline .slider-header {
  flex-shrink: 0;
  min-width: 80px;
}

.slider-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.slider-label {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
  transition: color 0.2s ease;
}

.slider-description {
  display: block;
  width: 100%;
  font-size: 9px;
  font-weight: 400;
  color: var(--text-tertiary);
  line-height: 1.3;
  margin-top: -2px;
}

.slider-control:hover .slider-label {
  color: var(--text-primary);
}

.slider-label iconify-icon {
  font-size: 14px;
  color: var(--text-muted);
}

.slider-value {
  font-size: 11px;
  font-family: 'JetBrains Mono', 'SF Mono', monospace;
  font-weight: 500;
  color: var(--accent-primary);
  background: var(--accent-glow);
  padding: 2px 8px;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.slider-value.editable {
  cursor: pointer;
}

.slider-value.editable:hover {
  background: var(--accent-primary);
  color: white;
}

.slider-value-input {
  font-size: 11px;
  font-family: 'JetBrains Mono', 'SF Mono', monospace;
  font-weight: 500;
  color: var(--accent-primary);
  background: var(--surface-2);
  border: 1px solid var(--accent-primary);
  padding: 2px 6px;
  border-radius: 6px;
  width: 60px;
  text-align: center;
  outline: none;
}

.slider-value-input:focus {
  box-shadow: 0 0 0 2px var(--accent-glow);
}

.slider-control.dragging .slider-value {
  background: var(--accent-primary);
  color: white;
  transform: scale(1.05);
}

.slider-unit {
  opacity: 0.7;
  margin-left: 1px;
}

/* Track wrapper */
.slider-track-wrapper {
  position: relative;
  flex: 1;
  height: 24px;
  display: flex;
  align-items: center;
}

.slider-track {
  position: absolute;
  inset: 0;
  top: 50%;
  transform: translateY(-50%);
  height: 6px;
  background: var(--surface-2);
  border-radius: 100px;
  overflow: hidden;
}

.slider-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: var(--fill-percent);
  background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));
  border-radius: 100px;
  transition: width 0.05s ease;
}

.slider-control.dragging .slider-fill {
  box-shadow: 0 0 12px var(--accent-glow);
}

/* Range input */
input[type='range'] {
  position: relative;
  width: 100%;
  height: 24px;
  background: transparent;
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
  z-index: 1;
}

input[type='range']:focus {
  outline: none;
}

/* Webkit thumb */
input[type='range']::-webkit-slider-thumb {
  appearance: none;
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  background: white;
  border: none;
  border-radius: 50%;
  cursor: grab;
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow:
    0 2px 6px rgba(0, 0, 0, 0.2),
    0 0 0 3px var(--accent-glow);
}

input[type='range']::-webkit-slider-thumb:hover {
  transform: scale(1.15);
  box-shadow:
    0 3px 10px rgba(0, 0, 0, 0.25),
    0 0 0 4px var(--accent-glow),
    0 0 20px var(--accent-glow);
}

input[type='range']:active::-webkit-slider-thumb {
  cursor: grabbing;
  transform: scale(1.1);
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.3),
    0 0 0 5px var(--accent-glow),
    0 0 24px var(--accent-glow);
}

/* Firefox thumb */
input[type='range']::-moz-range-thumb {
  width: 18px;
  height: 18px;
  background: white;
  border: none;
  border-radius: 50%;
  cursor: grab;
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow:
    0 2px 6px rgba(0, 0, 0, 0.2),
    0 0 0 3px var(--accent-glow);
}

input[type='range']::-moz-range-thumb:hover {
  transform: scale(1.15);
  box-shadow:
    0 3px 10px rgba(0, 0, 0, 0.25),
    0 0 0 4px var(--accent-glow),
    0 0 20px var(--accent-glow);
}

input[type='range']:active::-moz-range-thumb {
  cursor: grabbing;
}

/* Firefox track (hide default) */
input[type='range']::-moz-range-track {
  background: transparent;
  height: 6px;
}
</style>
