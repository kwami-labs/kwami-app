<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';

export interface WelcomeRingsProps {
  /** Number of ring ellipses (default 120) */
  ringCount?: number;
  /** Base radius as a fraction of min(viewport width, height). Default 0.12 */
  baseRadiusRatio?: number;
  /** Stroke width for rings (px). Default 2 */
  ringStrokeWidth?: number;
  /** Duration (seconds) for a full pulse cycle. Default 6 */
  cycleSeconds?: number;
  /** Per-ring pulse amplitude (px multiplier). Default 4 */
  ringPulsePxPerIndex?: number;
  /** Rotation speed (degrees per second). Default 360 */
  rotationDegreesPerSecond?: number;
  /** Animate the gradient vector. Default true */
  animateGradient?: boolean;
  /** Palette for ring stroke colors */
  colors?: string[];
  /** Whether to include the centered wordmark. Default true */
  includeWordmark?: boolean;
  /** Container z-index */
  zIndex?: string | number;
  /** Opacity (0-1) */
  opacity?: number;
  /** Whether animation is running */
  running?: boolean;
}

const props = withDefaults(defineProps<WelcomeRingsProps>(), {
  ringCount: 120,
  baseRadiusRatio: 0.12,
  ringStrokeWidth: 2,
  cycleSeconds: 6,
  ringPulsePxPerIndex: 4,
  rotationDegreesPerSecond: 360,
  animateGradient: true,
  colors: () => ['#359EEE', '#FFC43D', '#EF476F', '#03CEA4'],
  includeWordmark: true,
  zIndex: '100',
  opacity: 1,
  running: true,
});

// KWAMI wordmark path (centered version)
const WORDMARK_PATH =
  'M 200.8 70 L 200.8 67.1 L 240.2 67.1 L 240.2 7.2 L 217.7 55.4 L 195.2 7.1 L 195.2 70.1 L 192.2 70 L 192.2 0 L 195.2 0 L 217.7 48.3 L 240.2 0.1 L 243.2 0 L 243.2 70.1 L 200.8 70 Z M 121.7 3.1 L 59.1 3.1 L 59.1 0.1 L 126 0.1 L 100.5 70.2 L 87.5 34.6 L 74.6 70.2 L 49.1 0.1 L 52.3 0.1 L 74.6 61.4 L 87.5 25.8 L 100.5 61.4 L 121.7 3.1 Z M 139.4 70.1 L 139.4 67.1 L 176.2 67.1 L 155 8.8 L 132.7 70.1 L 129.5 70.1 L 155 0 L 180.5 70.1 L 139.4 70.1 Z M 39.8 0.1 L 44.1 0.1 L 10.5 33.5 L 47.3 70.1 L 43 70.1 L 6.2 33.5 L 39.8 0.1 Z M 0 0.1 L 3 0.1 L 3 70.1 L 0 70.1 L 0 0.1 Z M 266 0.1 L 266 70.1 L 263 70.1 L 263 0.1 L 266 0.1 Z';

// Gradient base coordinates
const GRADIENT_BASE = { x1: 213.98, y1: 290, x2: 179.72, y2: 320 };

// const containerRef = ref<HTMLDivElement | null>(null);
const svgRef = ref<SVGSVGElement | null>(null);
const ringsGroupRef = ref<SVGGElement | null>(null);
const wordmarkRef = ref<SVGPathElement | null>(null);

// Gradient coordinates (reactive for animation)
const gradientX1 = ref(GRADIENT_BASE.x1);
const gradientX2 = ref(GRADIENT_BASE.x2);

// State
let rafId: number | null = null;
let startTs: number | null = null;
let cx = 0;
let cy = 0;
let baseRadius = 0;

// Ring elements (created dynamically)
const ellipseRefs: SVGEllipseElement[] = [];

// Color interpolation utilities
function parseHex(input: string): { r: number; g: number; b: number } | null {
  const hex = input.trim();
  if (!hex.startsWith('#')) return null;
  const raw = hex.slice(1);

  if (raw.length === 3) {
    const r = parseInt((raw[0] || '0') + (raw[0] || '0'), 16);
    const g = parseInt((raw[1] || '0') + (raw[1] || '0'), 16);
    const b = parseInt((raw[2] || '0') + (raw[2] || '0'), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
    return { r, g, b };
  }

  if (raw.length === 6) {
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
    return { r, g, b };
  }

  return null;
}

function rgbToHex(rgb: { r: number; g: number; b: number }): string {
  const to = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  return `#${to(rgb.r)}${to(rgb.g)}${to(rgb.b)}`;
}

function interpolatePalette(palette: string[], t: number): string {
  if (!palette.length) return '#000000';
  if (palette.length === 1) return palette[0]!;

  const clamped = Math.max(0, Math.min(1, t));
  const scaled = clamped * (palette.length - 1);
  const idx = Math.floor(scaled);
  const frac = scaled - idx;

  const a = palette[idx] || '#000000';
  const b = palette[Math.min(idx + 1, palette.length - 1)] || '#000000';

  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return frac < 0.5 ? a : b;

  return rgbToHex({
    r: Math.round(ca.r + (cb.r - ca.r) * frac),
    g: Math.round(ca.g + (cb.g - ca.g) * frac),
    b: Math.round(ca.b + (cb.b - ca.b) * frac),
  });
}

function resizeSvg() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (vw <= 0 || vh <= 0) return;
  if (!svgRef.value) return;

  svgRef.value.setAttribute('viewBox', `0 0 ${vw} ${vh}`);

  cx = vw / 2;
  cy = vh / 2;
  baseRadius = Math.min(vw, vh) * props.baseRadiusRatio;

  // Update all ellipses
  for (let i = 0; i < ellipseRefs.length; i++) {
    const count = i + 1;
    const e = ellipseRefs[i]!;
    e.setAttribute('cx', String(cx));
    e.setAttribute('cy', String(cy));
    e.setAttribute('rx', String(baseRadius));
    e.setAttribute('ry', String(baseRadius));

    const t = count / ellipseRefs.length;
    e.style.opacity = String(1 - t);
    e.setAttribute('stroke', interpolatePalette(props.colors, t));
  }

  // Update wordmark transform
  if (wordmarkRef.value && props.includeWordmark) {
    const textScale = Math.min(vw, vh) / 500;
    wordmarkRef.value.setAttribute(
      'transform',
      `translate(${cx - 133 * textScale}, ${cy - 35 * textScale}) scale(${textScale})`,
    );
  }
}

function tick(ts: number) {
  if (!props.running) {
    rafId = null;
    return;
  }

  if (startTs === null) startTs = ts;

  const elapsed = (ts - startTs) / 1000;
  const phase = (elapsed % props.cycleSeconds) / props.cycleSeconds; // 0..1

  // Pulse in [0..1] using cosine
  const pulse = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);

  // Animate rings expansion
  for (let i = 0; i < ellipseRefs.length; i++) {
    const count = i + 1;
    const e = ellipseRefs[i]!;
    const delta = pulse * count * props.ringPulsePxPerIndex;
    e.setAttribute('rx', String(baseRadius + delta));
    e.setAttribute('ry', String(baseRadius + delta));
  }

  // Rotate the whole ring group around the center
  if (props.rotationDegreesPerSecond !== 0 && ringsGroupRef.value) {
    const angle = elapsed * props.rotationDegreesPerSecond;
    ringsGroupRef.value.setAttribute('transform', `rotate(${angle} ${cx} ${cy})`);
  }

  // Animate gradient vector
  if (props.animateGradient) {
    const shift = pulse;
    gradientX1.value = GRADIENT_BASE.x1 + 380 * shift;
    gradientX2.value = GRADIENT_BASE.x2 + 300 * shift;
  }

  rafId = requestAnimationFrame(tick);
}

function startAnimation() {
  if (rafId !== null) return;
  startTs = null;
  rafId = requestAnimationFrame(tick);
}

function stopAnimation() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  startTs = null;
}

function createEllipses() {
  if (!ringsGroupRef.value) return;

  // Clear existing
  ellipseRefs.length = 0;
  ringsGroupRef.value.innerHTML = '';

  // Create new ellipses
  for (let i = 0; i < props.ringCount; i++) {
    const e = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    e.classList.add('kwami-welcome-ring');
    e.setAttribute('fill', 'none');
    e.setAttribute('stroke-width', String(props.ringStrokeWidth));
    ellipseRefs.push(e);
    ringsGroupRef.value.appendChild(e);
  }

  // Apply initial sizing
  resizeSvg();
}

onMounted(() => {
  createEllipses();
  window.addEventListener('resize', resizeSvg, { passive: true });

  if (props.running) {
    startAnimation();
  }
});

onUnmounted(() => {
  stopAnimation();
  window.removeEventListener('resize', resizeSvg);
});

watch(
  () => props.running,
  (running) => {
    if (running) {
      startAnimation();
    } else {
      stopAnimation();
    }
  },
);

watch(
  () => props.ringCount,
  () => {
    createEllipses();
  },
);

const gradientId = `kwami-welcome-grad-${Math.random().toString(36).slice(2, 8)}`;
</script>

<template>
  <div
    class="kwami-welcome-rings"
    :style="{
      zIndex: zIndex,
      opacity: opacity,
    }"
  >
    <svg ref="svgRef" preserveAspectRatio="xMidYMid slice" class="rings-svg">
      <defs>
        <linearGradient
          :id="gradientId"
          :x1="gradientX1"
          :y1="GRADIENT_BASE.y1"
          :x2="gradientX2"
          :y2="GRADIENT_BASE.y2"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stop-color="#000" stop-opacity="0" />
          <stop offset=".15" stop-color="#EF476F" stop-opacity="1" />
          <stop offset=".4" stop-color="#359EEE" stop-opacity="1" />
          <stop offset=".6" stop-color="#03CEA4" stop-opacity="1" />
          <stop offset=".78" stop-color="#FFC43D" stop-opacity="1" />
          <stop offset="1" stop-color="#000" stop-opacity="0" />
        </linearGradient>
      </defs>

      <!-- Rings group with rotation -->
      <g ref="ringsGroupRef" id="kwami-welcome-rings-group"></g>

      <!-- Wordmark -->
      <path
        v-if="includeWordmark"
        ref="wordmarkRef"
        id="kwami-welcome-wordmark"
        opacity="0.95"
        :d="WORDMARK_PATH"
        :stroke="`url(#${gradientId})`"
        stroke-linecap="round"
        stroke-miterlimit="100"
        stroke-width="2"
        fill="none"
      />
    </svg>
  </div>
</template>

<style scoped>
.kwami-welcome-rings {
  position: fixed;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.rings-svg {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
