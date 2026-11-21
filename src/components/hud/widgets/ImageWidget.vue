<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import HudWindow from '../HudWindow.vue';
import type { HudWidget } from '@/stores/hud';
import { hostOf } from '@/lib/hud/media';
import { openExternal } from '@/lib/hud/external';

/** A picture on Jarvis's screen: zoom with the wheel, drag to pan, rotate, mirror, save. */
const props = defineProps<{ widget: HudWidget; index: number }>();
const { t } = useI18n();

const code = computed(() => `IMG-${String(props.index + 1).padStart(2, '0')}`);
const scale = ref(1);
const rotation = ref(0);
const flipped = ref(false);
const offset = ref({ x: 0, y: 0 });
const size = ref('');

const transform = computed(
  () =>
    `translate(${offset.value.x}px, ${offset.value.y}px) scale(${scale.value}) rotate(${rotation.value}deg) scaleX(${flipped.value ? -1 : 1})`,
);

function zoomBy(factor: number) {
  scale.value = Math.min(12, Math.max(0.1, scale.value * factor));
}

function reset() {
  scale.value = 1;
  rotation.value = 0;
  flipped.value = false;
  offset.value = { x: 0, y: 0 };
}

function onWheel(e: WheelEvent) {
  e.preventDefault();
  zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12);
}

let drag: { x: number; y: number; ox: number; oy: number } | null = null;
function down(e: PointerEvent) {
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  drag = { x: e.clientX, y: e.clientY, ox: offset.value.x, oy: offset.value.y };
}
function move(e: PointerEvent) {
  if (!drag) return;
  offset.value = { x: drag.ox + e.clientX - drag.x, y: drag.oy + e.clientY - drag.y };
}
function up() {
  drag = null;
}

function onLoad(e: Event) {
  const img = e.target as HTMLImageElement;
  size.value = `${img.naturalWidth} × ${img.naturalHeight}`;
}

async function download() {
  const url = props.widget.url ?? '';
  try {
    const blob = await (await fetch(url)).blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = url.split('/').pop()?.split('?')[0] || 'imagen';
    a.setAttribute('data-hud-external', '');
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 3000);
  } catch {
    // The site does not let its pictures be fetched: open it outside instead.
    void openExternal(url);
  }
}
</script>

<template>
  <HudWindow :widget="widget" :code="code" icon="ph:image-duotone">
    <div class="image">
      <div class="hud-toolbar">
        <button
          type="button"
          class="hud-icon-btn"
          :title="t('hud.image.zoomOut')"
          @click="zoomBy(1 / 1.25)"
        >
          <iconify-icon icon="ph:magnifying-glass-minus"></iconify-icon>
        </button>
        <span class="pct">{{ Math.round(scale * 100) }}%</span>
        <button
          type="button"
          class="hud-icon-btn"
          :title="t('hud.image.zoomIn')"
          @click="zoomBy(1.25)"
        >
          <iconify-icon icon="ph:magnifying-glass-plus"></iconify-icon>
        </button>
        <button type="button" class="hud-icon-btn" :title="t('hud.image.reset')" @click="reset">
          <iconify-icon icon="ph:frame-corners"></iconify-icon>
        </button>
        <span class="hud-sep"></span>
        <button
          type="button"
          class="hud-icon-btn"
          :title="t('hud.image.rotate')"
          @click="rotation = (rotation + 90) % 360"
        >
          <iconify-icon icon="ph:arrow-clockwise"></iconify-icon>
        </button>
        <button
          type="button"
          class="hud-icon-btn"
          :class="{ 'is-on': flipped }"
          :title="t('hud.image.flip')"
          @click="flipped = !flipped"
        >
          <iconify-icon icon="ph:flip-horizontal"></iconify-icon>
        </button>
        <span class="spacer"></span>
        <button
          type="button"
          class="hud-icon-btn"
          :title="t('hud.image.download')"
          @click="download"
        >
          <iconify-icon icon="ph:download-simple"></iconify-icon>
        </button>
        <button
          type="button"
          class="hud-icon-btn"
          :title="t('hud.web.openOutside')"
          @click="openExternal(widget.url ?? '')"
        >
          <iconify-icon icon="ph:arrow-square-out"></iconify-icon>
        </button>
      </div>
      <div
        class="canvas"
        @wheel="onWheel"
        @pointerdown="down"
        @pointermove="move"
        @pointerup="up"
        @pointercancel="up"
        @dblclick="reset"
      >
        <img
          :src="widget.url"
          :alt="widget.title"
          :style="{ transform }"
          draggable="false"
          @load="onLoad"
        />
      </div>
    </div>
    <template #footer>
      <span>{{ hostOf(widget.url ?? '') }}</span>
      <span class="spacer"></span>
      <span>{{ size }}</span>
    </template>
  </HudWindow>
</template>

<style scoped>
.image {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.canvas {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  touch-action: none;
  background:
    linear-gradient(45deg, rgba(255, 255, 255, 0.03) 25%, transparent 25%) 0 0 / 20px 20px,
    linear-gradient(-45deg, rgba(255, 255, 255, 0.03) 25%, transparent 25%) 0 0 / 20px 20px,
    #04080c;
}
.canvas:active {
  cursor: grabbing;
}
.canvas img {
  max-width: 100%;
  max-height: 100%;
  transition: transform 0.12s ease-out;
  user-select: none;
}
.pct {
  min-width: 44px;
  text-align: center;
  font-family: var(--hud-mono);
  font-size: 11px;
  color: var(--hud-dim);
}
.spacer {
  flex: 1;
}
</style>
