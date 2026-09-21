<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ViewportRegion } from '@/composables/useRecording';

interface Props {
  aspectRatio: number;
  formatLabel: string;
}
const props = defineProps<Props>();
const emit = defineEmits<{ confirm: [ViewportRegion]; cancel: [] }>();
const { t } = useI18n();

// Selection in viewport CSS pixels (same coordinate space as getBoundingClientRect)
const sel = ref({ x: 0, y: 0, w: 0, h: 0 });
const vw = ref(window.innerWidth);
const vh = ref(window.innerHeight);

type Corner = 'nw' | 'ne' | 'sw' | 'se';
interface DragState {
  type: 'move' | Corner;
  startX: number;
  startY: number;
  startSel: typeof sel.value;
}
let drag: DragState | null = null;
const isDragging = ref(false);

function initSel() {
  const ar = props.aspectRatio;
  let w = vw.value * 0.72;
  let h = w / ar;
  if (h > vh.value * 0.78) {
    h = vh.value * 0.78;
    w = h * ar;
  }
  sel.value = {
    x: Math.round((vw.value - w) / 2),
    y: Math.round((vh.value - h) / 2),
    w: Math.round(w),
    h: Math.round(h),
  };
}

// ── 4 dim panels that blur/darken everything OUTSIDE the selection ──
const panelTop = computed(() => ({
  top: '0',
  left: '0',
  right: '0',
  height: `${sel.value.y}px`,
}));
const panelBottom = computed(() => ({
  left: '0',
  right: '0',
  top: `${sel.value.y + sel.value.h}px`,
  bottom: '0',
}));
const panelLeft = computed(() => ({
  top: `${sel.value.y}px`,
  left: '0',
  width: `${sel.value.x}px`,
  height: `${sel.value.h}px`,
}));
const panelRight = computed(() => ({
  top: `${sel.value.y}px`,
  left: `${sel.value.x + sel.value.w}px`,
  right: '0',
  height: `${sel.value.h}px`,
}));

const selStyle = computed(() => ({
  left: `${sel.value.x}px`,
  top: `${sel.value.y}px`,
  width: `${sel.value.w}px`,
  height: `${sel.value.h}px`,
  cursor: drag?.type === 'move' && isDragging.value ? 'grabbing' : 'grab',
}));

const pxInfo = computed(() => `${Math.round(sel.value.w)} × ${Math.round(sel.value.h)}`);

// ── Mouse events ──────────────────────────────────────────────

function onBoxDown(e: MouseEvent) {
  e.preventDefault();
  drag = { type: 'move', startX: e.clientX, startY: e.clientY, startSel: { ...sel.value } };
  isDragging.value = true;
}

function onCornerDown(e: MouseEvent, corner: Corner) {
  e.preventDefault();
  e.stopPropagation();
  drag = { type: corner, startX: e.clientX, startY: e.clientY, startSel: { ...sel.value } };
  isDragging.value = true;
}

function onMouseMove(e: MouseEvent) {
  if (!drag) return;
  const dx = e.clientX - drag.startX;
  const s = drag.startSel;
  const ar = props.aspectRatio;
  const MIN = 80;

  if (drag.type === 'move') {
    sel.value = {
      ...s,
      x: Math.max(0, Math.min(vw.value - s.w, s.x + (e.clientX - drag.startX))),
      y: Math.max(0, Math.min(vh.value - s.h, s.y + (e.clientY - drag.startY))),
    };
    return;
  }

  let { x: nx, y: ny, w: nw, h: nh } = s;

  if (drag.type === 'se') {
    nw = Math.max(MIN, s.w + dx);
    nh = nw / ar;
    if (s.x + nw > vw.value) {
      nw = vw.value - s.x;
      nh = nw / ar;
    }
    if (s.y + nh > vh.value) {
      nh = vh.value - s.y;
      nw = nh * ar;
    }
  } else if (drag.type === 'sw') {
    nw = Math.max(MIN, s.w - dx);
    nh = nw / ar;
    nx = s.x + s.w - nw;
    if (nx < 0) {
      nx = 0;
      nw = s.x + s.w;
      nh = nw / ar;
    }
    if (s.y + nh > vh.value) {
      nh = vh.value - s.y;
      nw = nh * ar;
      nx = s.x + s.w - nw;
    }
  } else if (drag.type === 'ne') {
    nw = Math.max(MIN, s.w + dx);
    nh = nw / ar;
    ny = s.y + s.h - nh;
    if (s.x + nw > vw.value) {
      nw = vw.value - s.x;
      nh = nw / ar;
      ny = s.y + s.h - nh;
    }
    if (ny < 0) {
      ny = 0;
      nh = s.y + s.h;
      nw = nh * ar;
    }
  } else if (drag.type === 'nw') {
    nw = Math.max(MIN, s.w - dx);
    nh = nw / ar;
    nx = s.x + s.w - nw;
    ny = s.y + s.h - nh;
    if (nx < 0) {
      nx = 0;
      nw = s.x + s.w;
      nh = nw / ar;
      ny = s.y + s.h - nh;
    }
    if (ny < 0) {
      ny = 0;
      nh = s.y + s.h;
      nw = nh * ar;
      nx = s.x + s.w - nw;
    }
  }

  sel.value = { x: nx, y: ny, w: nw, h: nh };
}

function onMouseUp() {
  drag = null;
  isDragging.value = false;
}

function onResize() {
  const oldW = vw.value;
  const oldH = vh.value;
  vw.value = window.innerWidth;
  vh.value = window.innerHeight;
  if (!oldW || !oldH) return;
  sel.value = {
    x: (sel.value.x / oldW) * vw.value,
    y: (sel.value.y / oldH) * vh.value,
    w: (sel.value.w / oldW) * vw.value,
    h: (sel.value.h / oldH) * vh.value,
  };
}

function confirm() {
  emit('confirm', { x: sel.value.x, y: sel.value.y, width: sel.value.w, height: sel.value.h });
}

onMounted(() => {
  initSel();
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('resize', onResize);
});

onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', onMouseUp);
  window.removeEventListener('resize', onResize);
});
</script>

<template>
  <div class="picker-root" :class="{ dragging: isDragging }">
    <!-- 4 panels that blur/darken the area OUTSIDE the selection.
         The gap between them = the selection = unblurred app UI showing through. -->
    <div class="dim-panel" :style="panelTop"></div>
    <div class="dim-panel" :style="panelBottom"></div>
    <div class="dim-panel" :style="panelLeft"></div>
    <div class="dim-panel" :style="panelRight"></div>

    <!-- Selection box (transparent center — the real canvas shows through) -->
    <div class="sel-box" :style="selStyle" @mousedown="onBoxDown">
      <!-- Rule-of-thirds guide lines -->
      <div class="grid-h" style="top: 33.33%"></div>
      <div class="grid-h" style="top: 66.66%"></div>
      <div class="grid-v" style="left: 33.33%"></div>
      <div class="grid-v" style="left: 66.66%"></div>

      <!-- Corner handles -->
      <div class="handle nw" @mousedown.stop="onCornerDown($event, 'nw')"></div>
      <div class="handle ne" @mousedown.stop="onCornerDown($event, 'ne')"></div>
      <div class="handle sw" @mousedown.stop="onCornerDown($event, 'sw')"></div>
      <div class="handle se" @mousedown.stop="onCornerDown($event, 'se')"></div>

      <!-- Info badge above the box -->
      <div class="sel-info">
        <iconify-icon icon="ph:crop-bold"></iconify-icon>
        <span>{{ formatLabel }}</span>
        <span class="sep">·</span>
        <span class="px-label">{{ pxInfo }} px</span>
      </div>
    </div>

    <!-- Bottom action bar -->
    <div class="picker-bar">
      <span class="picker-hint">
        <iconify-icon icon="ph:arrows-out-bold"></iconify-icon>
        {{ t('recording.dragResizeMove') }}
      </span>
      <div class="picker-actions">
        <button class="btn-cancel" @click="$emit('cancel')">{{ t('recording.cancel') }}</button>
        <button class="btn-record" @click="confirm">
          <iconify-icon icon="ph:record-fill"></iconify-icon>
          <span>{{ t('recording.startRecording') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.picker-root {
  position: fixed;
  inset: 0;
  z-index: 99998;
  /* no background — transparent so the app shows through the selection gap */
}

.picker-root.dragging {
  cursor: grabbing;
}

/* ── Dim panels ────────────────────────────────────────────── */
.dim-panel {
  position: fixed;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(10px) saturate(0.6);
  -webkit-backdrop-filter: blur(10px) saturate(0.6);
}

/* ── Selection box ──────────────────────────────────────────── */
.sel-box {
  position: fixed;
  box-sizing: border-box;
  border: 1.5px solid rgba(255, 255, 255, 0.8);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.35),
    inset 0 0 0 1px rgba(0, 0, 0, 0.15);
  pointer-events: all;
}

/* Rule-of-thirds lines */
.grid-h,
.grid-v {
  position: absolute;
  background: rgba(255, 255, 255, 0.18);
  pointer-events: none;
}
.grid-h {
  left: 0;
  right: 0;
  height: 1px;
}
.grid-v {
  top: 0;
  bottom: 0;
  width: 1px;
}

/* Corner handles */
.handle {
  position: absolute;
  width: 14px;
  height: 14px;
  background: white;
  border: 2px solid rgba(0, 0, 0, 0.35);
  border-radius: 2px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
  pointer-events: all;
}
.handle.nw {
  top: -7px;
  left: -7px;
  cursor: nw-resize;
}
.handle.ne {
  top: -7px;
  right: -7px;
  cursor: ne-resize;
}
.handle.sw {
  bottom: -7px;
  left: -7px;
  cursor: sw-resize;
}
.handle.se {
  bottom: -7px;
  right: -7px;
  cursor: se-resize;
}

/* Info badge */
.sel-info {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 20px;
  backdrop-filter: blur(8px);
  white-space: nowrap;
  pointer-events: none;
  font-size: 12px;
  color: #fff;
}
.sel-info iconify-icon {
  font-size: 13px;
  color: var(--accent-primary, #00d9ff);
}
.sel-info .sep {
  color: rgba(255, 255, 255, 0.3);
}
.sel-info .px-label {
  font-family: 'JetBrains Mono', monospace;
  color: rgba(255, 255, 255, 0.55);
  font-size: 11px;
}

/* ── Bottom bar ─────────────────────────────────────────────── */
.picker-bar {
  position: fixed;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 99999;
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 10px 16px;
  background: rgba(0, 0, 0, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 40px;
  backdrop-filter: blur(12px);
  white-space: nowrap;
}

.picker-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}
.picker-hint iconify-icon {
  font-size: 14px;
}

.picker-actions {
  display: flex;
  gap: 8px;
}

.btn-cancel,
.btn-record {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.btn-cancel {
  background: transparent;
  border-color: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.6);
}
.btn-cancel:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.btn-record {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: #fff;
  box-shadow: 0 4px 16px rgba(239, 68, 68, 0.4);
}
.btn-record:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 24px rgba(239, 68, 68, 0.5);
}
.btn-record iconify-icon {
  font-size: 13px;
}
</style>
