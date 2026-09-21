<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';

export type ColorPickerVariant = 'preview' | 'inline';
export type ColorPickerMode = 'square' | 'wheel';
export type ColorFormat = 'hex' | 'rgb' | 'hsl';

const props = withDefaults(
  defineProps<{
    label?: string;
    modelValue: string;
    disabled?: boolean;
    variant?: ColorPickerVariant;
    defaultMode?: ColorPickerMode;
  }>(),
  {
    variant: 'preview',
    defaultMode: 'square',
  },
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

// State
const isHovered = ref(false);
const isPopoverOpen = ref(false);
const pickerRef = ref<HTMLElement | null>(null);
const popoverRef = ref<HTMLElement | null>(null);
const gradientRef = ref<HTMLCanvasElement | null>(null);
const hueRef = ref<HTMLCanvasElement | null>(null);
const wheelRef = ref<HTMLCanvasElement | null>(null);

// Popover position
const popoverPosition = ref({ top: 0, left: 0 });

// Picker mode (square or wheel)
const pickerMode = ref<ColorPickerMode>(props.defaultMode);

// Color format
const colorFormat = ref<ColorFormat>('hex');

// Color state (HSL for wheel mode, HSV for square mode - we'll use HSL internally)
const hue = ref(0);
const saturation = ref(100);
const lightness = ref(50);
const hexInput = ref('');

// Convert hex to HSL
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { h: 0, s: 100, l: 50 };

  const r = parseInt(result[1] ?? '0', 16) / 255;
  const g = parseInt(result[2] ?? '0', 16) / 255;
  const b = parseInt(result[3] ?? '0', 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = (((g - b) / d + (g < b ? 6 : 0)) / 6) * 360;
        break;
      case g:
        h = (((b - r) / d + 2) / 6) * 360;
        break;
      case b:
        h = (((r - g) / d + 4) / 6) * 360;
        break;
    }
  }

  return { h, s: s * 100, l: l * 100 };
}

// Convert HSL to hex
function hslToHex(h: number, s: number, l: number): string {
  s = s / 100;
  l = l / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0,
    g = 0,
    b = 0;

  if (h >= 0 && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h >= 60 && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h >= 180 && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h >= 240 && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }

  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Convert HSL to RGB
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  s = s / 100;
  l = l / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0,
    g = 0,
    b = 0;

  if (h >= 0 && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h >= 60 && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h >= 180 && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h >= 240 && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

// Current color
const currentColor = computed(() => hslToHex(hue.value, saturation.value, lightness.value));

// Glow effect color
const glowColor = computed(() => props.modelValue + '40');

// Get color string in current format
function getColorString(): string {
  const hex = hslToHex(hue.value, saturation.value, lightness.value);
  switch (colorFormat.value) {
    case 'hex':
      return hex.toUpperCase();
    case 'rgb':
      const rgb = hslToRgb(hue.value, saturation.value, lightness.value);
      return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    case 'hsl':
      return `hsl(${Math.round(hue.value)}, ${Math.round(saturation.value)}%, ${Math.round(lightness.value)}%)`;
  }
}

// ========================================
// Square Mode Drawing
// ========================================
function drawSquareGradient() {
  const canvas = gradientRef.value;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;

  // Draw hue base color
  ctx.fillStyle = `hsl(${hue.value}, 100%, 50%)`;
  ctx.fillRect(0, 0, width, height);

  // Draw white gradient (left to right)
  const whiteGradient = ctx.createLinearGradient(0, 0, width, 0);
  whiteGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  whiteGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = whiteGradient;
  ctx.fillRect(0, 0, width, height);

  // Draw black gradient (top to bottom)
  const blackGradient = ctx.createLinearGradient(0, 0, 0, height);
  blackGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  blackGradient.addColorStop(1, 'rgba(0, 0, 0, 1)');
  ctx.fillStyle = blackGradient;
  ctx.fillRect(0, 0, width, height);
}

function drawHueSlider() {
  const canvas = hueRef.value;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;

  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  for (let i = 0; i <= 360; i += 60) {
    gradient.addColorStop(i / 360, `hsl(${i}, 100%, 50%)`);
  }

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

// ========================================
// Wheel Mode Drawing
// ========================================
function drawWheel() {
  const canvas = wheelRef.value;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = Math.min(centerX, centerY) - 5;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw color wheel with radial gradient for each hue slice
  for (let angle = 0; angle < 360; angle++) {
    const startAngle = ((angle - 1) * Math.PI) / 180;
    const endAngle = ((angle + 1) * Math.PI) / 180;

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.closePath();

    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    gradient.addColorStop(0, `hsl(${angle}, 0%, ${lightness.value}%)`);
    gradient.addColorStop(1, `hsl(${angle}, 100%, ${lightness.value}%)`);

    ctx.fillStyle = gradient;
    ctx.fill();
  }
}

// ========================================
// Interaction Handlers
// ========================================

// Square mode: gradient interaction
function handleSquareGradientInteraction(e: MouseEvent | TouchEvent) {
  const canvas = gradientRef.value;
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const clientX = 'touches' in e ? (e.touches[0]?.clientX ?? 0) : e.clientX;
  const clientY = 'touches' in e ? (e.touches[0]?.clientY ?? 0) : e.clientY;

  const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

  // In square mode: x = saturation, y = brightness (inverse lightness)
  saturation.value = x * 100;
  lightness.value = 50 - y * 50; // Map y to lightness range

  updateColor();
}

// Square mode: hue slider interaction
function handleHueSliderInteraction(e: MouseEvent | TouchEvent) {
  const canvas = hueRef.value;
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const clientX = 'touches' in e ? (e.touches[0]?.clientX ?? 0) : e.clientX;

  const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  hue.value = x * 360;

  drawSquareGradient();
  updateColor();
}

// Wheel mode: wheel interaction
function handleWheelInteraction(e: MouseEvent | TouchEvent) {
  const canvas = wheelRef.value;
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const clientX = 'touches' in e ? (e.touches[0]?.clientX ?? 0) : e.clientX;
  const clientY = 'touches' in e ? (e.touches[0]?.clientY ?? 0) : e.clientY;

  const x = (clientX - rect.left) * scaleX;
  const y = (clientY - rect.top) * scaleY;

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = Math.min(centerX, centerY) - 5;

  const dx = x - centerX;
  const dy = y - centerY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance <= radius) {
    let h = Math.atan2(dy, dx) * (180 / Math.PI);
    if (h < 0) h += 360;

    hue.value = h;
    saturation.value = Math.min((distance / radius) * 100, 100);

    updateColor();
  }
}

// Wheel mode: brightness slider interaction (canvas-based)
function handleBrightnessInteraction(e: MouseEvent | TouchEvent) {
  const container = (e.target as HTMLElement).closest('.brightness-container');
  if (!container) return;

  const rect = container.getBoundingClientRect();
  const clientX = 'touches' in e ? (e.touches[0]?.clientX ?? 0) : e.clientX;

  const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  lightness.value = x * 100;

  drawWheel();
  updateColor();
}

// Dragging state
let isDragging = false;
let dragTarget: 'gradient' | 'hue' | 'wheel' | 'brightness' | null = null;

function startDrag(
  e: MouseEvent | TouchEvent,
  target: 'gradient' | 'hue' | 'wheel' | 'brightness',
) {
  isDragging = true;
  dragTarget = target;

  if (target === 'gradient') handleSquareGradientInteraction(e);
  else if (target === 'hue') handleHueSliderInteraction(e);
  else if (target === 'wheel') handleWheelInteraction(e);
  else if (target === 'brightness') handleBrightnessInteraction(e);

  const moveHandler = (e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    if (dragTarget === 'gradient') handleSquareGradientInteraction(e);
    else if (dragTarget === 'hue') handleHueSliderInteraction(e);
    else if (dragTarget === 'wheel') handleWheelInteraction(e);
    else if (dragTarget === 'brightness') handleBrightnessInteraction(e);
  };

  const upHandler = () => {
    isDragging = false;
    dragTarget = null;
    document.removeEventListener('mousemove', moveHandler);
    document.removeEventListener('mouseup', upHandler);
    document.removeEventListener('touchmove', moveHandler);
    document.removeEventListener('touchend', upHandler);
  };

  document.addEventListener('mousemove', moveHandler);
  document.addEventListener('mouseup', upHandler);
  document.addEventListener('touchmove', moveHandler);
  document.addEventListener('touchend', upHandler);
}

// Update color
function updateColor() {
  const newColor = currentColor.value;
  hexInput.value = getColorString();
  emit('update:modelValue', newColor);
}

// Handle hex/color input
function handleColorInput(e: Event) {
  let val = (e.target as HTMLInputElement).value.trim();
  hexInput.value = val;

  // Try to parse as hex
  if (/^#?[0-9A-Fa-f]{6}$/.test(val.replace('#', ''))) {
    if (!val.startsWith('#')) val = '#' + val;
    const hsl = hexToHsl(val);
    hue.value = hsl.h;
    saturation.value = hsl.s;
    lightness.value = hsl.l;
    redrawCanvases();
    emit('update:modelValue', val);
  }
}

// Cycle color format
function cycleFormat() {
  const formats: ColorFormat[] = ['hex', 'rgb', 'hsl'];
  const idx = formats.indexOf(colorFormat.value);
  const nextFormat = formats[(idx + 1) % formats.length];
  if (nextFormat) colorFormat.value = nextFormat;
  hexInput.value = getColorString();
}

// Switch picker mode
function switchMode(mode: ColorPickerMode) {
  pickerMode.value = mode;
  nextTick(() => redrawCanvases());
}

// Redraw all canvases for current mode
function redrawCanvases() {
  if (pickerMode.value === 'square') {
    drawSquareGradient();
    drawHueSlider();
  } else {
    drawWheel();
  }
}

// Cursor positions
const squareCursorStyle = computed(() => ({
  left: `${saturation.value}%`,
  top: `${((50 - lightness.value) / 50) * 100}%`,
}));

const hueCursorStyle = computed(() => ({
  left: `${(hue.value / 360) * 100}%`,
}));

const wheelCursorStyle = computed(() => {
  if (!wheelRef.value) return { left: '50%', top: '50%' };

  const canvas = wheelRef.value;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = Math.min(centerX, centerY) - 5;

  const angle = hue.value * (Math.PI / 180);
  const distance = (saturation.value / 100) * radius;

  const scale = canvas.getBoundingClientRect().width / canvas.width;
  const x = centerX + Math.cos(angle) * distance;
  const y = centerY + Math.sin(angle) * distance;

  return {
    left: `${x * scale}px`,
    top: `${y * scale}px`,
  };
});

const brightnessCursorStyle = computed(() => ({
  left: `${lightness.value}%`,
}));

// Calculate popover position
function updatePopoverPosition() {
  if (!pickerRef.value) return;

  const rect = pickerRef.value.getBoundingClientRect();
  const popoverWidth = 232;
  const popoverHeight = 300;
  const gap = 8;

  let top = rect.bottom + gap;
  let left = rect.left;

  if (top + popoverHeight > window.innerHeight) {
    top = rect.top - popoverHeight - gap;
  }
  if (left + popoverWidth > window.innerWidth) {
    left = window.innerWidth - popoverWidth - 8;
  }
  if (left < 8) left = 8;

  popoverPosition.value = { top, left };
}

// Toggle popover
function togglePopover() {
  if (props.disabled) return;
  isPopoverOpen.value = !isPopoverOpen.value;

  if (isPopoverOpen.value) {
    const hsl = hexToHsl(props.modelValue);
    hue.value = hsl.h;
    saturation.value = hsl.s;
    lightness.value = hsl.l;
    hexInput.value = getColorString();

    updatePopoverPosition();
    nextTick(() => redrawCanvases());
  }
}

function closePopover() {
  isPopoverOpen.value = false;
}

function handleClickOutside(e: MouseEvent) {
  const target = e.target as Node;
  if (!pickerRef.value?.contains(target) && !popoverRef.value?.contains(target)) {
    closePopover();
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') closePopover();
}

function handleScroll() {
  if (isPopoverOpen.value) closePopover();
}

watch(
  () => props.modelValue,
  (newVal) => {
    if (!isPopoverOpen.value) {
      hexInput.value = newVal.toUpperCase();
    }
  },
);

onMounted(() => {
  hexInput.value = props.modelValue.toUpperCase();
  document.addEventListener('mousedown', handleClickOutside);
  document.addEventListener('keydown', handleKeydown);
  window.addEventListener('scroll', handleScroll, true);
});

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside);
  document.removeEventListener('keydown', handleKeydown);
  window.removeEventListener('scroll', handleScroll, true);
});
</script>

<template>
  <!-- Preview Variant -->
  <div
    v-if="variant === 'preview'"
    ref="pickerRef"
    class="color-picker-wrapper"
    :class="{ disabled, hovered: isHovered }"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <label v-if="label" class="color-label">{{ label }}</label>
    <div class="color-input-wrapper" @click="togglePopover">
      <div
        class="color-preview"
        :style="{
          background: modelValue,
          boxShadow: isHovered ? `0 4px 20px ${glowColor}` : `0 2px 8px rgba(0,0,0,0.3)`,
        }"
      ></div>
      <div class="color-value">{{ modelValue.toUpperCase() }}</div>
    </div>
  </div>

  <!-- Inline Variant -->
  <div v-else ref="pickerRef" class="color-picker-inline" :class="{ disabled }">
    <label v-if="label" class="inline-label">{{ label }}</label>
    <div class="inline-input-wrapper" @click="togglePopover">
      <div class="inline-color-swatch" :style="{ background: modelValue }"></div>
      <span class="inline-color-value">{{ modelValue.toUpperCase() }}</span>
    </div>
  </div>

  <!-- Teleported Popover -->
  <Teleport to="body">
    <Transition name="popover">
      <div
        v-if="isPopoverOpen"
        ref="popoverRef"
        class="color-popover"
        :style="{ top: `${popoverPosition.top}px`, left: `${popoverPosition.left}px` }"
      >
        <!-- Mode Switcher -->
        <div class="mode-switcher">
          <button
            class="mode-btn"
            :class="{ active: pickerMode === 'square' }"
            @click="switchMode('square')"
            title="Square picker"
          >
            <iconify-icon icon="ph:square-duotone"></iconify-icon>
          </button>
          <button
            class="mode-btn"
            :class="{ active: pickerMode === 'wheel' }"
            @click="switchMode('wheel')"
            title="Wheel picker"
          >
            <iconify-icon icon="ph:circle-duotone"></iconify-icon>
          </button>
        </div>

        <!-- Square Mode -->
        <template v-if="pickerMode === 'square'">
          <div class="gradient-container">
            <canvas
              ref="gradientRef"
              class="gradient-canvas"
              width="200"
              height="150"
              @mousedown="startDrag($event, 'gradient')"
              @touchstart.prevent="startDrag($event, 'gradient')"
            ></canvas>
            <div class="gradient-cursor" :style="squareCursorStyle"></div>
          </div>

          <div class="hue-container">
            <canvas
              ref="hueRef"
              class="hue-canvas"
              width="200"
              height="14"
              @mousedown="startDrag($event, 'hue')"
              @touchstart.prevent="startDrag($event, 'hue')"
            ></canvas>
            <div class="hue-cursor" :style="hueCursorStyle"></div>
          </div>
        </template>

        <!-- Wheel Mode -->
        <template v-else>
          <div class="wheel-container">
            <canvas
              ref="wheelRef"
              class="wheel-canvas"
              width="200"
              height="200"
              @mousedown="startDrag($event, 'wheel')"
              @touchstart.prevent="startDrag($event, 'wheel')"
            ></canvas>
            <div
              class="wheel-cursor"
              :style="wheelCursorStyle"
              :class="{ visible: saturation > 0 }"
            ></div>
          </div>

          <div class="brightness-container">
            <div
              class="brightness-canvas"
              @mousedown="startDrag($event, 'brightness')"
              @touchstart.prevent="startDrag($event, 'brightness')"
            ></div>
            <div class="brightness-cursor" :style="brightnessCursorStyle"></div>
          </div>
        </template>

        <!-- Value Row -->
        <div class="value-row">
          <div class="color-comparison">
            <div class="comparison-swatch current" :style="{ background: modelValue }"></div>
            <div class="comparison-swatch new" :style="{ background: currentColor }"></div>
          </div>
          <button class="format-toggle" @click="cycleFormat">
            {{ colorFormat.toUpperCase() }}
          </button>
          <input
            type="text"
            class="color-input"
            :value="hexInput"
            @input="handleColorInput"
            @blur="hexInput = getColorString()"
            spellcheck="false"
          />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Preview Variant */
.color-picker-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  position: relative;
}

.color-picker-wrapper.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.color-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  transition: color var(--duration-fast) ease;
}

.color-picker-wrapper.hovered .color-label {
  color: var(--text-secondary);
}

.color-input-wrapper {
  position: relative;
  width: 100%;
  cursor: pointer;
}

.color-preview {
  width: 100%;
  height: 44px;
  border-radius: var(--radius-md);
  transition: all var(--duration-normal) var(--ease-out);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.color-picker-wrapper.hovered .color-preview {
  transform: translateY(-2px);
}

.color-value {
  position: absolute;
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 9px;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 500;
  color: white;
  background: rgba(0, 0, 0, 0.5);
  padding: 2px 6px;
  border-radius: 4px;
  opacity: 0;
  transition: opacity var(--duration-fast) ease;
  pointer-events: none;
  backdrop-filter: blur(4px);
}

.color-picker-wrapper.hovered .color-value {
  opacity: 1;
}

/* Inline Variant */
.color-picker-inline {
  display: flex;
  flex-direction: column;
  gap: 6px;
  position: relative;
}

.color-picker-inline.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.inline-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
}

.inline-input-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: var(--surface-1);
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
}

.inline-input-wrapper:hover {
  background: var(--surface-2);
  border-color: var(--accent-primary);
}

.inline-color-swatch {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
}

.inline-color-value {
  font-size: 11px;
  font-family: 'JetBrains Mono', monospace;
  color: var(--text-muted);
}
</style>

<style>
/* Popover (Global for Teleport) - above modals (z-index 10000) */
.color-popover {
  position: fixed;
  z-index: 10001;
  padding: 12px;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--glass-shadow);
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 224px;
}

/* Mode Switcher */
.color-popover .mode-switcher {
  display: flex;
  gap: 4px;
  padding: 3px;
  background: var(--surface-1);
  border-radius: var(--radius-sm);
}

.color-popover .mode-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  background: transparent;
  border: none;
  border-radius: calc(var(--radius-sm) - 2px);
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
}

.color-popover .mode-btn:hover {
  color: var(--text-primary);
}

.color-popover .mode-btn.active {
  background: var(--surface-3);
  color: var(--accent-primary);
}

.color-popover .mode-btn iconify-icon {
  font-size: 16px;
}

/* Square Mode */
.color-popover .gradient-container {
  position: relative;
  width: 100%;
  height: 150px;
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.color-popover .gradient-canvas {
  width: 100%;
  height: 100%;
  cursor: crosshair;
  display: block;
}

.color-popover .gradient-cursor {
  position: absolute;
  width: 14px;
  height: 14px;
  border: 2px solid white;
  border-radius: 50%;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.5);
  pointer-events: none;
  transform: translate(-50%, -50%);
}

.color-popover .hue-container {
  position: relative;
  width: 100%;
  height: 14px;
  border-radius: 7px;
  overflow: hidden;
}

.color-popover .hue-canvas {
  width: 100%;
  height: 100%;
  cursor: pointer;
  display: block;
  border-radius: 7px;
}

.color-popover .hue-cursor {
  position: absolute;
  top: 50%;
  width: 6px;
  height: 18px;
  background: white;
  border-radius: 3px;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.5);
  pointer-events: none;
  transform: translate(-50%, -50%);
}

/* Wheel Mode */
.color-popover .wheel-container {
  position: relative;
  width: 200px;
  height: 200px;
  margin: 0 auto;
  border-radius: 50%;
  overflow: hidden;
  box-shadow: inset 0 0 0 1px var(--glass-border);
}

.color-popover .wheel-canvas {
  width: 100%;
  height: 100%;
  cursor: crosshair;
  display: block;
}

.color-popover .wheel-cursor {
  position: absolute;
  width: 14px;
  height: 14px;
  border: 2px solid white;
  border-radius: 50%;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.5);
  pointer-events: none;
  transform: translate(-50%, -50%);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.color-popover .wheel-cursor.visible {
  opacity: 1;
}

.color-popover .brightness-container {
  position: relative;
  width: 100%;
  height: 14px;
  border-radius: 7px;
  overflow: hidden;
}

.color-popover .brightness-canvas {
  width: 100%;
  height: 100%;
  cursor: pointer;
  display: block;
  border-radius: 7px;
  background: linear-gradient(to right, #000000, #ffffff);
}

.color-popover .brightness-cursor {
  position: absolute;
  top: 50%;
  width: 6px;
  height: 18px;
  background: white;
  border-radius: 3px;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.5);
  pointer-events: none;
  transform: translate(-50%, -50%);
}

/* Value Row */
.color-popover .value-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.color-popover .color-comparison {
  display: flex;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--glass-border);
}

.color-popover .comparison-swatch {
  width: 18px;
  height: 22px;
}

.color-popover .comparison-swatch.current {
  opacity: 0.6;
}

.color-popover .format-toggle {
  padding: 4px 6px;
  background: var(--surface-2);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-size: 9px;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--duration-fast) ease;
  flex-shrink: 0;
}

.color-popover .format-toggle:hover {
  color: var(--accent-primary);
  border-color: var(--accent-primary);
}

.color-popover .color-input {
  flex: 1;
  min-width: 0;
  height: 26px;
  padding: 0 8px;
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 10px;
  font-family: 'JetBrains Mono', monospace;
  outline: none;
  transition: all var(--duration-fast) ease;
}

.color-popover .color-input:focus {
  border-color: var(--accent-primary);
  background: var(--surface-2);
}

/* Popover Transition */
.popover-enter-active,
.popover-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.popover-enter-from,
.popover-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
