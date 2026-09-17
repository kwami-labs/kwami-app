<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useKwami } from '@/composables/useKwami';
import BaseToggle from '@/components/ui/BaseToggle.vue';
import PanelSection from '@/components/ui/PanelSection.vue';

const { kwami } = useKwami();
const { t } = useI18n();
const visualizerCanvas = ref<HTMLCanvasElement | null>(null);
const enabled = ref(true);
let animationFrameId: number | null = null;

function getAudio() {
  return kwami.value?.avatar.getAudio();
}

function drawVisualizer() {
  if (!visualizerCanvas.value) return;
  const audio = getAudio();

  if (!enabled.value || !audio) {
    animationFrameId = requestAnimationFrame(drawVisualizer);
    return;
  }

  const ctx = visualizerCanvas.value.getContext('2d');
  if (!ctx) return;

  const frequencyData = audio.getFrequencyData();
  const width = visualizerCanvas.value.width;
  const height = visualizerCanvas.value.height;

  ctx.clearRect(0, 0, width, height);
  // transparent background handled by CSS

  if (frequencyData.length === 0) {
    animationFrameId = requestAnimationFrame(drawVisualizer);
    return;
  }

  const barCount = 32;
  const barWidth = width / barCount - 2;
  const step = Math.floor(frequencyData.length / barCount);

  for (let i = 0; i < barCount; i++) {
    const val = frequencyData[i * step];
    const value = (val !== undefined ? val : 0) / 255;
    const barHeight = value * height * 0.9;

    const hue = 260 + (i / barCount) * 60;
    ctx.fillStyle = `hsla(${hue}, 70%, 60%, ${0.5 + value * 0.5})`;

    const x = i * (barWidth + 2);
    const y = height - barHeight;

    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, barHeight, 2);
    ctx.fill();
  }

  animationFrameId = requestAnimationFrame(drawVisualizer);
}

onMounted(() => {
  animationFrameId = requestAnimationFrame(drawVisualizer);
});

onUnmounted(() => {
  if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
});
</script>

<template>
  <PanelSection :title="t('audioPanel.visualizer')">
    <div class="visualizer-container">
      <canvas
        ref="visualizerCanvas"
        width="280"
        height="60"
        :style="{ opacity: enabled ? 1 : 0.3 }"
      ></canvas>
    </div>
    <div style="margin-top: 8px">
      <BaseToggle :label="t('audioPanel.enableVisualizer')" v-model="enabled" />
    </div>
  </PanelSection>
</template>

<style scoped>
.visualizer-container {
  background: var(--surface-1);
  border-radius: 10px;
  padding: 8px;
  margin-bottom: 10px;
}

canvas {
  width: 100%;
  height: 60px;
  border-radius: 6px;
  transition: opacity 0.3s ease;
}
</style>
