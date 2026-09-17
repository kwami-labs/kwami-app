<script setup lang="ts">
import { ref, computed, onUnmounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useKwami } from '@/composables/useKwami';
import RecordControl from './RecordControl.vue';

const { isConnected, connect, disconnect } = useKwami();
const { t } = useI18n();

// Loading state
const isLoading = ref(false);

// Session duration
const sessionStartTime = ref<number | null>(null);
const sessionDuration = ref('0:00');
let durationInterval: ReturnType<typeof setInterval> | null = null;

// Computed
const buttonIcon = computed(() => {
  if (isLoading.value) return 'ph:circle-notch-bold';
  return isConnected.value ? 'ph:stop-fill' : 'ph:play-fill';
});

const buttonTitle = computed(() => {
  if (isLoading.value) return t('controlBar.connecting');
  return isConnected.value ? t('controlBar.endConversation') : t('controlBar.startConversation');
});

function updateDuration() {
  if (!sessionStartTime.value) return;
  const elapsed = Math.floor((Date.now() - sessionStartTime.value) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  sessionDuration.value = `${mins}:${secs.toString().padStart(2, '0')}`;
}

async function handleToggle() {
  if (isLoading.value) return;
  
  isLoading.value = true;
  try {
    if (isConnected.value) {
      await disconnect();
      if (durationInterval) {
        clearInterval(durationInterval);
        durationInterval = null;
      }
      sessionStartTime.value = null;
      sessionDuration.value = '0:00';
    } else {
      await connect();
      sessionStartTime.value = Date.now();
      durationInterval = setInterval(updateDuration, 1000);
    }
  } catch (err) {
    console.error('Connection error:', err);
  } finally {
    isLoading.value = false;
  }
}

// Watch for external disconnection
watch(isConnected, (connected) => {
  if (!connected && durationInterval) {
    clearInterval(durationInterval);
    durationInterval = null;
    sessionStartTime.value = null;
    sessionDuration.value = '0:00';
  }
});

onUnmounted(() => {
  if (durationInterval) clearInterval(durationInterval);
});
</script>

<template>
  <div class="control-bar">
    <!-- Record control -->
    <RecordControl />

    <!-- Duration badge (only when connected) -->
    <transition name="fade">
      <span v-if="isConnected" class="duration-badge">
        {{ sessionDuration }}
      </span>
    </transition>

    <!-- Main control button -->
    <button
      class="control-btn"
      :class="{ connected: isConnected, loading: isLoading }"
      :disabled="isLoading"
      :title="buttonTitle"
      @click="handleToggle"
    >
      <iconify-icon :icon="buttonIcon" :class="{ spin: isLoading }"></iconify-icon>
    </button>
  </div>
</template>

<style scoped>
.control-bar {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* Duration Badge */
.duration-badge {
  font-size: 11px;
  font-weight: 600;
  font-family: 'JetBrains Mono', monospace;
  color: var(--text-secondary);
  padding: 6px 10px;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: 20px;
}

/* Main Button */
.control-btn {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  
  /* Default state (disconnected) - accent glow */
  background: linear-gradient(135deg, var(--accent-primary) 0%, #0099cc 100%);
  box-shadow: 
    0 4px 20px rgba(0, 217, 255, 0.4),
    0 0 0 0 rgba(0, 217, 255, 0);
}

.control-btn iconify-icon {
  font-size: 22px;
  color: white;
  transition: transform 0.2s ease;
}

.control-btn:hover:not(:disabled) {
  transform: scale(1.08);
  box-shadow: 
    0 6px 28px rgba(0, 217, 255, 0.5),
    0 0 0 4px rgba(0, 217, 255, 0.15);
}

.control-btn:active:not(:disabled) {
  transform: scale(0.95);
}

/* Connected state - red/stop */
.control-btn.connected {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  box-shadow: 
    0 4px 20px rgba(239, 68, 68, 0.4),
    0 0 0 0 rgba(239, 68, 68, 0);
}

.control-btn.connected:hover:not(:disabled) {
  box-shadow: 
    0 6px 28px rgba(239, 68, 68, 0.5),
    0 0 0 4px rgba(239, 68, 68, 0.15);
}

/* Loading state */
.control-btn.loading {
  background: linear-gradient(135deg, #64748b 0%, #475569 100%);
  box-shadow: 0 4px 16px rgba(100, 116, 139, 0.3);
  cursor: wait;
}

.control-btn:disabled {
  cursor: wait;
}

/* Spinning icon */
.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateX(8px);
}

</style>
