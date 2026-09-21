<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useCreditsStore } from '@/stores/credits';
import { useUIStore } from '@/stores/ui';

const creditsStore = useCreditsStore();
const uiStore = useUIStore();

onMounted(() => {
  creditsStore.loadBalance();
});

const displayBalance = computed(() => {
  const b = creditsStore.displayBalance;
  if (b >= 1000) return `${(b / 1000).toFixed(1)}k`;
  return b.toLocaleString();
});

const isLow = computed(() => creditsStore.displayBalance > 0 && creditsStore.displayBalance < 100);
const isEmpty = computed(() => !creditsStore.hasCredits);

function openEnergyPanel() {
  uiStore.setPanel('credits');
}
</script>

<template>
  <button
    class="energy-badge"
    :class="{ low: isLow, empty: isEmpty }"
    @click="openEnergyPanel"
    title="Kwami Energy"
  >
    <iconify-icon icon="ph:lightning-fill" class="badge-icon"></iconify-icon>
    <span class="badge-amount">{{ displayBalance }}</span>
  </button>
</template>

<style scoped>
.energy-badge {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px 6px 10px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.energy-badge:hover {
  background: var(--surface-2);
  color: var(--accent-primary);
  border-color: var(--accent-primary);
  transform: translateY(-1px);
}

.energy-badge.low {
  border-color: var(--warning-glow);
  color: var(--warning);
}

.energy-badge.low .badge-icon {
  animation: flicker 3s ease-in-out infinite;
}

.energy-badge.low:hover {
  border-color: var(--warning);
}

.energy-badge.empty {
  border-color: var(--error);
  color: var(--error);
  animation: pulse 2s ease-in-out infinite;
}

.badge-icon {
  font-size: 15px;
  color: var(--accent-primary);
}

.energy-badge.low .badge-icon {
  color: var(--warning);
}

.energy-badge.empty .badge-icon {
  color: var(--error);
}

.badge-amount {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

@keyframes flicker {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
  52% {
    opacity: 1;
  }
  54% {
    opacity: 0.5;
  }
  56% {
    opacity: 1;
  }
}
</style>
