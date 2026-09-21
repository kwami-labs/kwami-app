<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import type { MemoryNode, MemoryGraph, Position2D } from './types';
import { getNodeColorHex, calculate2DLayout, calculateNodeRadius, truncateText } from './utils';

const props = defineProps<{
  graph: MemoryGraph;
  showEdgeLabels: boolean;
  selectedNodeId: string | null;
  linkingNodeId: string | null;
}>();

const emit = defineEmits<{
  (e: 'select-node', node: MemoryNode | null): void;
  (e: 'link-start', node: MemoryNode): void;
  (e: 'link-end', node: MemoryNode): void;
  (e: 'link-cancel'): void;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const containerRef = ref<HTMLDivElement | null>(null);

let ctx: CanvasRenderingContext2D | null = null;
let positions = new Map<string, Position2D>();
let degrees = new Map<string, number>();
let animationId: number;

// Pan and zoom state
const transform = ref({
  x: 0,
  y: 0,
  scale: 1,
});

let isDragging = false;
let lastMousePos = { x: 0, y: 0 };
let hoveredNodeId: string | null = null;
let currentMouseCanvas: Position2D = { x: 0, y: 0 };

const canvasSize = ref({ width: 800, height: 600 });

// Get CSS variable value
function getCSSVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// Check if light mode
function isLightMode(): boolean {
  return document.documentElement.getAttribute('data-theme') === 'light';
}

// Get theme-aware canvas background
function getCanvasBg(): string {
  const opacity = parseFloat(getCSSVar('--glass-opacity')) || 0.88;
  if (isLightMode()) {
    const base = Math.round(245 * opacity + 255 * (1 - opacity));
    return `rgb(${base}, ${base}, ${base})`;
  } else {
    const base = Math.round(8 * opacity);
    return `rgb(${base}, ${base + 2}, ${base + 10})`;
  }
}

function initCanvas() {
  if (!canvasRef.value || !containerRef.value) return;

  const rect = containerRef.value.getBoundingClientRect();
  canvasSize.value = { width: rect.width, height: rect.height || 500 };

  canvasRef.value.width = canvasSize.value.width * window.devicePixelRatio;
  canvasRef.value.height = canvasSize.value.height * window.devicePixelRatio;
  canvasRef.value.style.width = `${canvasSize.value.width}px`;
  canvasRef.value.style.height = `${canvasSize.value.height}px`;

  ctx = canvasRef.value.getContext('2d');
  if (ctx) {
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }
}

function calculateLayout() {
  if (props.graph.nodes.length === 0) return;

  const result = calculate2DLayout(
    props.graph.nodes,
    props.graph.edges,
    canvasSize.value.width,
    canvasSize.value.height,
  );

  positions = result.positions;
  degrees = result.degrees;
}

function draw() {
  if (!ctx) return;
  const c = ctx;

  const { width, height } = canvasSize.value;
  const lightMode = isLightMode();

  // Get theme colors - use black text in light mode for readability
  const textColor = lightMode ? '#0f172a' : '#e2e8f0';
  const textMuted = lightMode ? '#334155' : '#94a3b8';
  const labelBg = lightMode ? 'rgba(255, 255, 255, 0.95)' : 'rgba(0, 0, 0, 0.8)';
  const textShadow = lightMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)';

  // Reduce edge opacity for dense graphs
  const nodeCount = props.graph.nodes.length;
  const edgeAlpha = nodeCount > 80 ? 0.15 : nodeCount > 50 ? 0.25 : nodeCount > 30 ? 0.35 : 0.6;
  const edgeColor = lightMode
    ? `rgba(71, 85, 105, ${edgeAlpha})`
    : `rgba(61, 74, 92, ${edgeAlpha})`;

  // Clear canvas with theme background
  c.fillStyle = getCanvasBg();
  c.fillRect(0, 0, width, height);

  // Apply transform
  c.save();
  c.translate(transform.value.x, transform.value.y);
  c.scale(transform.value.scale, transform.value.scale);

  const nodes = props.graph.nodes;
  const edges = props.graph.edges;

  // Get max degree for sizing
  let maxDegree = 1;
  degrees.forEach((d) => {
    if (d > maxDegree) maxDegree = d;
  });

  // Draw edges
  edges.forEach((edge) => {
    const startPos = positions.get(edge.source);
    const endPos = positions.get(edge.target);

    if (startPos && endPos) {
      // Calculate curve control point
      const midX = (startPos.x + endPos.x) / 2;
      const midY = (startPos.y + endPos.y) / 2;

      // Add perpendicular offset for curve
      const dx = endPos.x - startPos.x;
      const dy = endPos.y - startPos.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const perpX = (-dy / len) * 15;
      const perpY = (dx / len) * 15;

      const ctrlX = midX + perpX;
      const ctrlY = midY + perpY;

      // Draw edge
      c.beginPath();
      c.moveTo(startPos.x, startPos.y);
      c.quadraticCurveTo(ctrlX, ctrlY, endPos.x, endPos.y);
      c.strokeStyle = edgeColor;
      c.lineWidth = 1.5;
      c.stroke();

      // Draw edge label if enabled
      if (props.showEdgeLabels && transform.value.scale > 0.6) {
        const labelX = (startPos.x + 2 * ctrlX + endPos.x) / 4;
        const labelY = (startPos.y + 2 * ctrlY + endPos.y) / 4;

        const label = truncateText(edge.relation, 16);

        c.font = '500 10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        const textMetrics = c.measureText(label);
        const padding = 4;
        const bgWidth = textMetrics.width + padding * 2;
        const bgHeight = 14;

        // Draw background
        c.fillStyle = labelBg;
        roundRect(c, labelX - bgWidth / 2, labelY - bgHeight / 2, bgWidth, bgHeight, 3);
        c.fill();

        // Draw text
        c.fillStyle = textMuted;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(label, labelX, labelY);
      }
    }
  });

  // Draw nodes
  nodes.forEach((node) => {
    const pos = positions.get(node.id);
    if (!pos) return;

    const degree = degrees.get(node.id) || 1;
    const isUserNode = node.type === 'user' || node.id === 'user';
    const radius = calculateNodeRadius(degree, maxDegree, isUserNode, 8, 24);
    const isSelected = props.selectedNodeId === node.id;
    const isHovered = hoveredNodeId === node.id;

    const color = getNodeColorHex(node.type);

    // Draw glow
    const gradient = c.createRadialGradient(pos.x, pos.y, radius * 0.5, pos.x, pos.y, radius * 2);
    gradient.addColorStop(0, color + '40');
    gradient.addColorStop(1, 'transparent');
    c.fillStyle = gradient;
    c.beginPath();
    c.arc(pos.x, pos.y, radius * 2, 0, Math.PI * 2);
    c.fill();

    // Draw node
    c.beginPath();
    c.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    c.fillStyle = color;
    c.fill();

    // Draw border for selected/hovered
    if (isSelected || isHovered) {
      c.strokeStyle = isSelected ? '#fff' : 'rgba(255,255,255,0.5)';
      c.lineWidth = isSelected ? 3 : 2;
      c.stroke();
    }

    // Draw label
    const label = truncateText(node.label, degree > 3 ? 18 : 12);
    const fontSize = 11 + Math.floor((degree / maxDegree) * 3);

    c.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'top';

    // Text shadow
    c.fillStyle = textShadow;
    c.fillText(label, pos.x + 1, pos.y + radius + 6 + 1);

    // Text
    c.fillStyle = textColor;
    c.fillText(label, pos.x, pos.y + radius + 6);
  });

  // Draw link preview line when in linking mode
  if (props.linkingNodeId) {
    const sourcePos = positions.get(props.linkingNodeId);
    if (sourcePos) {
      const targetPos = currentMouseCanvas;

      // Snap to hovered node
      let snapPos = targetPos;
      if (hoveredNodeId && hoveredNodeId !== props.linkingNodeId) {
        const hp = positions.get(hoveredNodeId);
        if (hp) snapPos = hp;
      }

      c.beginPath();
      c.moveTo(sourcePos.x, sourcePos.y);
      c.lineTo(snapPos.x, snapPos.y);
      c.strokeStyle = '#00d9ff';
      c.lineWidth = 2;
      c.setLineDash([8, 5]);
      c.globalAlpha = 0.7;
      c.stroke();
      c.setLineDash([]);
      c.globalAlpha = 1.0;
    }

    // Draw highlight ring on source node
    const srcPos = positions.get(props.linkingNodeId);
    if (srcPos) {
      const srcNode = props.graph.nodes.find((n) => n.id === props.linkingNodeId);
      if (srcNode) {
        const deg = degrees.get(srcNode.id) || 1;
        const isUser = srcNode.type === 'user';
        const r = calculateNodeRadius(
          deg,
          Math.max(...Array.from(degrees.values()), 1),
          isUser,
          8,
          24,
        );
        c.beginPath();
        c.arc(srcPos.x, srcPos.y, r + 4, 0, Math.PI * 2);
        c.strokeStyle = '#00d9ff';
        c.lineWidth = 2.5;
        c.stroke();
      }
    }
  }

  ctx.restore();

  animationId = requestAnimationFrame(draw);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function screenToCanvas(screenX: number, screenY: number): Position2D {
  return {
    x: (screenX - transform.value.x) / transform.value.scale,
    y: (screenY - transform.value.y) / transform.value.scale,
  };
}

function findNodeAtPosition(canvasPos: Position2D): MemoryNode | null {
  let maxDegree = 1;
  degrees.forEach((d) => {
    if (d > maxDegree) maxDegree = d;
  });

  for (const node of props.graph.nodes) {
    const pos = positions.get(node.id);
    if (!pos) continue;

    const degree = degrees.get(node.id) || 1;
    const isUserNode = node.type === 'user' || node.id === 'user';
    const radius = calculateNodeRadius(degree, maxDegree, isUserNode, 8, 24);

    const dx = canvasPos.x - pos.x;
    const dy = canvasPos.y - pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= radius) {
      return node;
    }
  }

  return null;
}

function onMouseDown(e: MouseEvent) {
  isDragging = true;
  lastMousePos = { x: e.clientX, y: e.clientY };
}

function onMouseMove(e: MouseEvent) {
  const rect = canvasRef.value?.getBoundingClientRect();
  if (!rect) return;

  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  currentMouseCanvas = screenToCanvas(mouseX, mouseY);

  if (isDragging && !props.linkingNodeId) {
    const dx = e.clientX - lastMousePos.x;
    const dy = e.clientY - lastMousePos.y;
    transform.value.x += dx;
    transform.value.y += dy;
    lastMousePos = { x: e.clientX, y: e.clientY };
  } else {
    // Check for hover
    const node = findNodeAtPosition(currentMouseCanvas);
    hoveredNodeId = node?.id || null;

    if (canvasRef.value) {
      if (props.linkingNodeId) {
        canvasRef.value.style.cursor = node ? 'cell' : 'crosshair';
      } else {
        canvasRef.value.style.cursor = node ? 'pointer' : 'grab';
      }
    }
  }
}

function onMouseUp() {
  isDragging = false;
}

function onClick(e: MouseEvent) {
  const rect = canvasRef.value?.getBoundingClientRect();
  if (!rect) return;

  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  const canvasPos = screenToCanvas(mouseX, mouseY);
  const node = findNodeAtPosition(canvasPos);

  // If in linking mode, complete the link
  if (props.linkingNodeId) {
    if (node && node.id !== props.linkingNodeId) {
      emit('link-end', node);
    } else if (!node) {
      emit('link-cancel');
    }
    return;
  }

  emit('select-node', node);
}

function onDoubleClick(e: MouseEvent) {
  const rect = canvasRef.value?.getBoundingClientRect();
  if (!rect) return;

  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  const canvasPos = screenToCanvas(mouseX, mouseY);
  const node = findNodeAtPosition(canvasPos);

  if (node) {
    emit('link-start', node);
  }
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.linkingNodeId) {
    emit('link-cancel');
  }
}

function onWheel(e: WheelEvent) {
  e.preventDefault();

  const rect = canvasRef.value?.getBoundingClientRect();
  if (!rect) return;

  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
  const newScale = Math.max(0.2, Math.min(3, transform.value.scale * zoomFactor));

  // Zoom toward mouse position
  const scaleDiff = newScale - transform.value.scale;
  transform.value.x -= (mouseX * scaleDiff) / transform.value.scale;
  transform.value.y -= (mouseY * scaleDiff) / transform.value.scale;
  transform.value.scale = newScale;
}

function onResize() {
  initCanvas();
  calculateLayout();
}

function rebuild() {
  initCanvas();
  calculateLayout();

  // Auto-fit: zoom out for dense graphs so everything is visible
  const n = props.graph.nodes.length;
  if (n > 40) {
    // Scale factor matches the layout expansion
    const layoutScale = 1 + Math.log10(n / 15) * 0.65;
    const fitZoom = Math.max(0.4, 1 / layoutScale);
    // Center the zoom on the canvas center
    const cx = canvasSize.value.width / 2;
    const cy = canvasSize.value.height / 2;
    const offsetX = cx - cx * fitZoom;
    const offsetY = cy - cy * fitZoom;
    transform.value = { x: offsetX, y: offsetY, scale: fitZoom };
  } else {
    transform.value = { x: 0, y: 0, scale: 1 };
  }
}

onMounted(() => {
  rebuild();
  draw();
  window.addEventListener('resize', onResize);
  window.addEventListener('keydown', onKeyDown);
});

watch(() => props.graph, rebuild, { deep: true });

onUnmounted(() => {
  if (animationId) cancelAnimationFrame(animationId);
  window.removeEventListener('resize', onResize);
  window.removeEventListener('keydown', onKeyDown);
});
</script>

<template>
  <div ref="containerRef" class="graph-2d-container">
    <canvas
      ref="canvasRef"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="onMouseUp"
      @click="onClick"
      @dblclick="onDoubleClick"
      @wheel="onWheel"
    />
  </div>
</template>

<style scoped>
.graph-2d-container {
  width: 100%;
  height: 100%;
  min-height: 500px;
  overflow: hidden;
}

.graph-2d-container canvas {
  display: block;
  cursor: grab;
}

.graph-2d-container canvas:active {
  cursor: grabbing;
}
</style>
