<script setup lang="ts">
import { reactive, computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { panelIcons } from '@/constants/panel-icons';
import { useKwami } from '@/composables/useKwami';
import { useMetricsState } from '@/composables/useMetricsState';
import PanelSection from '@/components/ui/PanelSection.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import PanelHeaderControls from '@/components/ui/PanelHeaderControls.vue';
import { useThemeStore } from '@/stores/theme';
import type { VoicePipelineConfig } from 'kwami';

const { kwami } = useKwami();
const { t } = useI18n();
const themeStore = useThemeStore();
const isRightSidebar = computed(() => themeStore.sidebarPosition === 'right');
const {
  latency,
  stats,
  isLive,
  latencyHistory,
  resetMetrics,
} = useMetricsState();

// Config display state (derived from kwami, re-synced on mount)
const config = reactive({
  vad: 'SILERO',
  stt: { provider: 'DEEPGRAM', model: 'NOVA-3' },
  llm: { provider: 'OPENAI', model: 'GPT-4.1-MINI' },
  tts: { provider: 'OPENAI', model: 'TTS-1', voice: '—' },
  enhancements: { turnDetection: true, noiseCancellation: true },
});

function updateConfig(newConfig?: VoicePipelineConfig) {
  if (!newConfig && kwami.value) {
    newConfig = kwami.value.agent.getConfig().livekit?.voice;
  }
  if (!newConfig) return;

  config.vad = newConfig.vad?.provider?.toUpperCase() || 'SILERO';
  config.stt.provider = newConfig.stt?.provider?.toUpperCase() || 'DEEPGRAM';
  config.stt.model = newConfig.stt?.model?.toUpperCase() || 'NOVA-3';
  config.llm.provider = newConfig.llm?.provider?.toUpperCase() || 'OPENAI';
  config.llm.model = newConfig.llm?.model?.toUpperCase() || 'GPT-4.1-MINI';
  config.tts.provider = newConfig.tts?.provider?.toUpperCase() || 'OPENAI';
  config.tts.model = newConfig.tts?.model?.toUpperCase() || 'TTS-1';
  config.tts.voice = newConfig.tts?.voice?.substring(0, 8) || '—';
  config.enhancements.turnDetection = newConfig.enhancements?.turnDetection?.enabled ?? true;
  config.enhancements.noiseCancellation =
    newConfig.enhancements?.noiseCancellation?.enabled ?? true;
}

function exportMetrics() {
  const data = {
    timestamp: new Date().toISOString(),
    config: config,
    latency: latency,
    stats: stats,
    history: latencyHistory.value,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kwami-metrics-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Config change listeners (panel-local since config is derived display state)
const onConfigChanged = () => updateConfig();

onMounted(() => {
  if (kwami.value) {
    updateConfig();
    isLive.value = kwami.value.isConnected();
  }
  window.addEventListener('kwami:voiceConfigChanged', onConfigChanged);
  window.addEventListener('kwami:enhancementsChanged', onConfigChanged);
});

onUnmounted(() => {
  window.removeEventListener('kwami:voiceConfigChanged', onConfigChanged);
  window.removeEventListener('kwami:enhancementsChanged', onConfigChanged);
});
</script>

<template>
  <div class="panel-inner">
    <div class="panel-header">
      <iconify-icon :icon="panelIcons.metrics" class="panel-icon"></iconify-icon>
      <h2>{{ t('metrics.title') }}</h2>
      <template v-if="isRightSidebar">
        <PanelHeaderControls :show-divider="true" />
        <span class="status-pill" :class="{ active: isLive }">
          <span class="pulse-dot"></span>
          {{ isLive ? t('metrics.live') : t('metrics.waiting') }}
        </span>
      </template>
      <template v-else>
        <span class="status-pill" :class="{ active: isLive }">
          <span class="pulse-dot"></span>
          {{ isLive ? t('metrics.live') : t('metrics.waiting') }}
        </span>
        <PanelHeaderControls :show-divider="true" />
      </template>
    </div>

    <div class="panel-body">
      <!-- Config -->
      <PanelSection :title="t('metrics.agentConfig')" icon="ph:gear-duotone" collapsible>
        <div class="config-summary">
          <div class="config-row">
            <span class="label">VAD</span> <span class="val">{{ config.vad }}</span>
          </div>
          <div class="config-row">
            <span class="label">STT</span> <span class="val">{{ config.stt.provider }}</span>
          </div>
          <div class="config-row sub">
            <span class="label">{{ t('metrics.model') }}</span> <span class="val normal">{{ config.stt.model }}</span>
          </div>
          <div class="config-row">
            <span class="label">LLM</span> <span class="val">{{ config.llm.provider }}</span>
          </div>
          <div class="config-row sub">
            <span class="label">{{ t('metrics.model') }}</span> <span class="val normal">{{ config.llm.model }}</span>
          </div>
          <div class="config-row">
            <span class="label">TTS</span> <span class="val">{{ config.tts.provider }}</span>
          </div>
          <div class="config-row sub">
            <span class="label">{{ t('metrics.model') }}</span> <span class="val normal">{{ config.tts.model }}</span>
          </div>
          <div class="config-row sub">
            <span class="label">{{ t('metrics.voice') }}</span> <span class="val normal">{{ config.tts.voice }}</span>
          </div>
        </div>
      </PanelSection>

      <!-- Enhancements -->
      <PanelSection :title="t('metrics.enhancements')" icon="ph:sliders-duotone" collapsible>
        <div class="config-summary">
          <div class="config-row">
            <span class="label">{{ t('metrics.turnDetection') }}</span>
            <span class="val" :class="config.enhancements.turnDetection ? 'ok' : 'no'">{{
              config.enhancements.turnDetection ? t('metrics.on') : t('metrics.off')
            }}</span>
          </div>
          <div class="config-row">
            <span class="label">{{ t('metrics.noiseCancellation') }}</span>
            <span class="val" :class="config.enhancements.noiseCancellation ? 'ok' : 'no'">{{
              config.enhancements.noiseCancellation ? t('metrics.on') : t('metrics.off')
            }}</span>
          </div>
        </div>
      </PanelSection>

      <!-- Latency -->
      <PanelSection :title="t('metrics.latency')" icon="ph:timer-duotone">
        <div class="latency-grid">
          <div class="lat-item">
            <span class="lat-label">STT</span>
            <span class="lat-value">{{ latency.stt }}</span>
          </div>
          <div class="lat-item">
            <span class="lat-label">EOT</span>
            <span class="lat-value">{{ latency.eot }}</span>
          </div>
          <div class="lat-item">
            <span class="lat-label">LLM</span>
            <span class="lat-value">{{ latency.llm }}</span>
          </div>
          <div class="lat-item">
            <span class="lat-label">TTS</span>
            <span class="lat-value">{{ latency.tts }}</span>
          </div>
          <div class="lat-item overall">
            <span class="lat-label">{{ t('metrics.overall') }}</span>
            <span class="lat-value">{{ latency.overall }}</span>
          </div>
        </div>
      </PanelSection>

      <!-- Stats -->
      <PanelSection :title="t('metrics.sessionStats')" icon="ph:activity-duotone">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">{{ stats.turns }}</div>
            <div class="stat-label">{{ t('metrics.turns') }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ stats.interruptions }}</div>
            <div class="stat-label">{{ t('metrics.interruptions') }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ stats.agentTime }}</div>
            <div class="stat-label">{{ t('metrics.agentTime') }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ stats.userTime }}</div>
            <div class="stat-label">{{ t('metrics.userTime') }}</div>
          </div>
        </div>
      </PanelSection>

      <!-- Chart (Simple history bars) -->
      <PanelSection :title="t('metrics.latencyHistory')" icon="ph:chart-bar-duotone" collapsible>
        <div class="chart-container">
          <div v-if="latencyHistory.length === 0" class="chart-empty">
            <iconify-icon icon="ph:chart-bar-duotone"></iconify-icon>
            {{ t('metrics.noDataYet') }}
          </div>
          <div v-else class="chart-bars">
            <div
              v-for="(val, i) in latencyHistory"
              :key="i"
              class="chart-bar"
              :style="{ height: Math.min(100, (val / 5000) * 100) + '%' }"
              :title="`${Math.round(val)}ms`"
            ></div>
          </div>
        </div>
      </PanelSection>

      <!-- Actions -->
      <PanelSection :title="t('metrics.actions')" icon="ph:wrench-duotone">
        <div class="action-buttons">
          <BaseButton 
            variant="secondary" 
            size="sm" 
            icon="ph:arrow-counter-clockwise-duotone"
            @click="resetMetrics"
          >
            {{ t('metrics.resetMetrics') }}
          </BaseButton>
          <BaseButton 
            variant="secondary" 
            size="sm" 
            icon="ph:export-duotone"
            @click="exportMetrics"
          >
            {{ t('metrics.exportJson') }}
          </BaseButton>
        </div>
      </PanelSection>
    </div>
  </div>
</template>

<style scoped>
/* Status Pill */
.status-pill {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 600;
  padding: 5px 12px;
  background: var(--surface-2);
  border-radius: 100px;
  color: var(--text-muted);
  transition: all var(--duration-normal) ease;
}

.status-pill.active {
  color: var(--success);
  background: var(--success-glow);
}

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.status-pill.active .pulse-dot {
  animation: pulse 1.5s infinite;
  box-shadow: 0 0 8px currentColor;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.9); }
}

/* Config Summary */
.config-summary {
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: var(--surface-1);
  padding: 12px;
  border-radius: var(--radius-md);
}

.config-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  font-size: 12px;
  border-bottom: 1px solid var(--glass-border);
}

.config-row:last-child {
  border-bottom: none;
}

.config-row.sub {
  padding-left: 16px;
  border-bottom: none;
  padding-top: 2px;
  padding-bottom: 2px;
}

.config-row.sub .label {
  font-size: 11px;
  opacity: 0.7;
}

.label {
  color: var(--text-secondary);
  font-weight: 500;
}

.val {
  color: var(--accent-secondary);
  font-weight: 600;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
}

.val.normal {
  color: var(--text-muted);
  font-weight: 400;
}

.val.ok {
  color: var(--success);
}

.val.no {
  color: var(--text-muted);
  opacity: 0.6;
}

/* Latency Grid */
.latency-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.lat-item {
  background: var(--surface-2);
  padding: 12px;
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  transition: all var(--duration-fast) ease;
}

.lat-item:hover {
  background: var(--surface-3);
}

.lat-label {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
}

.lat-value {
  font-size: 16px;
  font-weight: 600;
  font-family: 'JetBrains Mono', monospace;
  color: var(--text-primary);
}

.lat-item.overall {
  grid-column: span 2;
  background: linear-gradient(135deg, rgba(0, 217, 255, 0.08), rgba(168, 85, 247, 0.08));
  border: 1px solid var(--glass-border);
}

.lat-item.overall .lat-value {
  color: var(--accent-primary);
  font-size: 20px;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.stat-card {
  background: var(--surface-2);
  border-radius: var(--radius-md);
  padding: 14px 12px;
  text-align: center;
  transition: all var(--duration-fast) ease;
}

.stat-card:hover {
  background: var(--surface-3);
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--accent-primary);
  line-height: 1;
  font-family: 'JetBrains Mono', monospace;
}

.stat-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  margin-top: 6px;
}

/* Chart Container */
.chart-container {
  height: 100px;
  background: var(--surface-1);
  border-radius: var(--radius-md);
  display: flex;
  align-items: flex-end;
  padding: 12px;
  gap: 4px;
}

.chart-empty {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
}

.chart-empty iconify-icon {
  font-size: 24px;
  opacity: 0.5;
}

.chart-bars {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: flex-end;
  gap: 4px;
}

.chart-bar {
  flex: 1;
  background: linear-gradient(to top, var(--accent-primary), var(--accent-secondary));
  opacity: 0.8;
  min-height: 4px;
  transition: all var(--duration-normal) var(--ease-out);
  border-radius: 3px 3px 0 0;
  cursor: pointer;
}

.chart-bar:hover {
  opacity: 1;
  transform: scaleY(1.05);
  box-shadow: 0 0 12px var(--accent-glow);
}

/* Action Buttons */
.action-buttons {
  display: flex;
  gap: 8px;
}

.action-buttons > * {
  flex: 1;
}
</style>
