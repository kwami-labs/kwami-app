<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { panelIcons } from '@/constants/panel-icons';
import { useKwami } from '@/composables/useKwami';
import PanelHeaderControls from '@/components/ui/PanelHeaderControls.vue';

import { Kwami } from 'kwami';

const { kwami } = useKwami();
const { t } = useI18n();

// State
const currentState = ref('idle');
const isConnected = ref(false);
const fps = ref(0);
const version = ref('v0.0.0'); // Default

// FPS Counter
let frames = 0;
let lastTime = performance.now();
let rafId: number;

function updateFPS() {
  frames++;
  const now = performance.now();
  if (now - lastTime >= 1000) {
    fps.value = Math.round((frames * 1000) / (now - lastTime));
    frames = 0;
    lastTime = now;
  }
  rafId = requestAnimationFrame(updateFPS);
}

function updateState() {
  if (kwami.value) {
    currentState.value = kwami.value.getState();
    isConnected.value = kwami.value.isConnected();
  }
}

// Debug Actions
function logState() {
  if (!kwami.value) return;
  const blob = kwami.value.avatar.getBlob();
  console.group('🎮 Kwami Full State');
  console.log('State:', kwami.value.getState());
  console.log('Connected:', kwami.value.isConnected());
  if (blob) {
    console.group('Avatar');
    console.log('Colors:', blob.getColors());
    console.log('Spikes:', blob.getSpikes());
    console.log('Rotation:', blob.getRotation());
    console.log('Scale:', blob.getScale());
    console.log('Skin:', blob.getCurrentSkinType());
    console.groupEnd();
  }
  console.group('Soul');
  console.log('Name:', kwami.value.soul.getName());
  console.log('Config:', kwami.value.soul.getConfig());
  console.groupEnd();
  console.group('Agent');
  console.log('Config:', kwami.value.agent.getConfig());
  console.groupEnd();
  console.group('Memory');
  console.log('Initialized:', kwami.value.memory.isInitialized());
  console.log('Config:', kwami.value.memory.getConfig());
  console.groupEnd();
  console.group('Tools');
  console.log('Tools:', kwami.value.tools.getAll());
  console.groupEnd();
  console.groupEnd();
}

function logConfig() {
  if (!kwami.value) return;
  console.group('⚙️ Kwami Configuration');
  console.log('Agent:', kwami.value.agent.getConfig());
  console.log('Soul:', kwami.value.soul.getConfig());
  console.log('Memory:', kwami.value.memory.getConfig());
  console.log('Tools:', kwami.value.tools.getAll());
  console.groupEnd();
}

// Events
const onStateChanged = () => updateState();
const onConnected = () => updateState();
const onDisconnected = () => updateState();

onMounted(() => {
  updateState();
  updateFPS();

  // Attempt to get version if available
  try {
    if (Kwami.getVersion) version.value = `v${Kwami.getVersion()}`;
  } catch {
    /* ignore */
  }

  window.addEventListener('kwami:stateChanged', onStateChanged);
  window.addEventListener('kwami:connected', onConnected);
  window.addEventListener('kwami:disconnected', onDisconnected);
});

onUnmounted(() => {
  cancelAnimationFrame(rafId);
  window.removeEventListener('kwami:stateChanged', onStateChanged);
  window.removeEventListener('kwami:connected', onConnected);
  window.removeEventListener('kwami:disconnected', onDisconnected);
});
</script>

<template>
  <div class="panel-inner">
    <div class="panel-header">
      <iconify-icon :icon="panelIcons.info" class="panel-icon"></iconify-icon>
      <h2>{{ t('infoPanel.title') }}</h2>
      <PanelHeaderControls />
    </div>

    <div class="panel-body">
      <!-- Current State -->
      <section class="panel-section">
        <h3>{{ t('infoPanel.currentState') }}</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">{{ t('infoPanel.state') }}</span>
            <span class="info-value">{{ currentState }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ t('infoPanel.connected') }}</span>
            <span class="info-value">{{ isConnected ? t('infoPanel.yes') : t('infoPanel.no') }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ t('infoPanel.fps') }}</span>
            <span class="info-value">{{ fps }}</span>
          </div>
        </div>
      </section>

      <!-- Version Info -->
      <section class="panel-section">
        <h3>{{ t('infoPanel.version') }}</h3>
        <div class="version-info">
          <div class="version-row">
            <span>Kwami</span>
            <span class="version-badge">{{ version }}</span>
          </div>
          <div class="version-row">
            <span>{{ t('infoPanel.app') }}</span>
            <span class="version-badge">v1.0.0</span>
          </div>
        </div>
      </section>

      <!-- Keyboard Shortcuts -->
      <section class="panel-section">
        <h3>{{ t('infoPanel.keyboardShortcuts') }}</h3>
        <div class="shortcuts-list">
          <div class="shortcut-group">
            <span class="shortcut-group-title">{{ t('infoPanel.avatarControls') }}</span>
            <div class="shortcut-item"><kbd>R</kbd> <span>{{ t('infoPanel.randomizeBlob') }}</span></div>
            <div class="shortcut-item"><kbd>L</kbd> <span>{{ t('infoPanel.listeningMode') }}</span></div>
            <div class="shortcut-item"><kbd>T</kbd> <span>{{ t('infoPanel.thinkingMode') }}</span></div>
            <div class="shortcut-item"><kbd>I</kbd> <span>{{ t('infoPanel.idleMode') }}</span></div>
          </div>
          <div class="shortcut-group">
            <span class="shortcut-group-title">{{ t('infoPanel.panelNavigation') }}</span>
            <div class="shortcut-item"><kbd>P</kbd> <span>{{ t('infoPanel.togglePanel') }}</span></div>
            <div class="shortcut-item"><kbd>1</kbd>-<kbd>8</kbd> <span>{{ t('infoPanel.switchPanels') }}</span></div>
          </div>
        </div>
      </section>

      <!-- Panel Guide (Simplified list) -->
      <section class="panel-section">
        <h3>{{ t('infoPanel.panelGuide') }}</h3>
        <div class="panel-guide">
          <div class="guide-item">
            <iconify-icon icon="ph:ghost-duotone"></iconify-icon>
            <div><strong>{{ t('sidebar.panels.avatar') }}</strong> <span>{{ t('infoPanel.visualBlob') }}</span></div>
          </div>
          <div class="guide-item">
            <iconify-icon icon="ph:mountains-duotone"></iconify-icon>
            <div><strong>{{ t('scene.title') }}</strong> <span>{{ t('infoPanel.environment') }}</span></div>
          </div>
          <div class="guide-item">
            <iconify-icon icon="ph:waveform-duotone"></iconify-icon>
            <div><strong>{{ t('audioPanel.title') }}</strong> <span>{{ t('infoPanel.soundReactivity') }}</span></div>
          </div>
          <div class="guide-item">
            <iconify-icon icon="ph:robot-duotone"></iconify-icon>
            <div><strong>{{ t('sidebar.panels.agent') }}</strong> <span>{{ t('infoPanel.connection') }}</span></div>
          </div>
          <div class="guide-item">
            <iconify-icon icon="ph:microphone-duotone"></iconify-icon>
            <div><strong>{{ t('voice.title') }}</strong> <span>{{ t('infoPanel.pipelineConfig') }}</span></div>
          </div>
          <div class="guide-item">
            <iconify-icon icon="ph:sliders-duotone"></iconify-icon>
            <div><strong>{{ t('enhancements.title') }}</strong> <span>{{ t('infoPanel.audioProcess') }}</span></div>
          </div>
          <div class="guide-item">
            <iconify-icon icon="ph:user-circle-duotone"></iconify-icon>
            <div><strong>{{ t('soulPanel.title') }}</strong> <span>{{ t('infoPanel.personality') }}</span></div>
          </div>
          <div class="guide-item">
            <iconify-icon icon="ph:brain-duotone"></iconify-icon>
            <div><strong>{{ t('memory.title') }}</strong> <span>{{ t('infoPanel.longTermMemory') }}</span></div>
          </div>
          <div class="guide-item">
            <iconify-icon icon="ph:wrench-duotone"></iconify-icon>
            <div><strong>{{ t('tools.title') }}</strong> <span>{{ t('infoPanel.functionCalling') }}</span></div>
          </div>
        </div>
      </section>

      <!-- Console Access -->
      <section class="panel-section">
        <h3>{{ t('infoPanel.consoleAccess') }}</h3>
        <div class="console-info">
          <code>window.kwami</code>
          <p class="console-hint">{{ t('infoPanel.consoleHint') }}</p>
        </div>
      </section>

      <!-- Debug Actions -->
      <section class="panel-section">
        <h3>{{ t('infoPanel.debug') }}</h3>
        <div class="action-buttons">
          <button class="action-btn" @click="logState">
            <iconify-icon icon="ph:terminal-window-duotone"></iconify-icon> {{ t('infoPanel.logFullState') }}
          </button>
          <button class="action-btn" @click="logConfig">
            <iconify-icon icon="ph:gear-duotone"></iconify-icon> {{ t('infoPanel.logConfig') }}
          </button>
        </div>
      </section>

      <!-- About -->
      <section class="panel-section">
        <h3>{{ t('infoPanel.aboutKwami') }}</h3>
        <p class="about-text">
          {{ t('infoPanel.aboutText') }}
        </p>
        <div class="about-links">
          <a href="#" class="about-link"
            ><iconify-icon icon="ph:github-logo-duotone"></iconify-icon> {{ t('infoPanel.github') }}</a
          >
          <a href="#" class="about-link"
            ><iconify-icon icon="ph:book-open-duotone"></iconify-icon> {{ t('infoPanel.docs') }}</a
          >
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
/* Panel Sections */
.panel-section {
  padding: 16px 20px;
  border-bottom: 1px solid var(--glass-border);
}

.panel-section:last-child {
  border-bottom: none;
}

.panel-section h3 {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  color: var(--text-muted);
  margin: 0 0 14px 0;
}

/* Info Grid */
.info-grid {
  display: flex;
  gap: 8px;
}

.info-item {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 8px;
  background: var(--surface-1);
  border-radius: var(--radius-md);
  text-align: center;
}

.info-label {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.info-value {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent-primary);
  font-family: 'JetBrains Mono', monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Version Info */
.version-info {
  background: var(--surface-1);
  border-radius: 10px;
  padding: 10px;
}

.version-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  font-size: 12px;
  color: var(--text-secondary);
}

.version-badge {
  padding: 2px 8px;
  background: var(--accent-glow);
  border-radius: 6px;
  font-size: 10px;
  font-weight: 600;
  color: var(--accent-primary);
  font-family: 'JetBrains Mono', monospace;
}

/* Shortcuts List */
.shortcuts-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shortcut-group {
  margin-bottom: 12px;
}

.shortcut-group-title {
  display: block;
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.shortcut-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 6px;
  background: var(--surface-2);
  border: 1px solid var(--glass-border);
  border-radius: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary);
  box-shadow: 0 2px 0 var(--surface-3);
}

/* Panel Guide */
.panel-guide {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.guide-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  background: var(--surface-1);
  border-radius: 8px;
}

.guide-item iconify-icon {
  font-size: 18px;
  color: var(--accent-primary);
}

.guide-item div {
  display: flex;
  flex-direction: column;
}

.guide-item strong {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary);
}

.guide-item span {
  font-size: 10px;
  color: var(--text-muted);
}

/* Console Info */
.console-info {
  background: var(--surface-1);
  border-radius: 10px;
  padding: 12px;
}

.console-info code {
  display: block;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  color: var(--accent-primary);
  margin-bottom: 8px;
}

.console-hint {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.5;
}

/* Action Buttons */
.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  font-size: 12px;
  font-family: inherit;
  font-weight: 500;
  background: var(--surface-2);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn iconify-icon {
  font-size: 16px;
}

.action-btn:hover {
  background: var(--surface-3);
  color: var(--text-primary);
  transform: translateY(-1px);
}

/* About */
.about-text {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 12px;
}

.about-links {
  display: flex;
  gap: 12px;
}

.about-link {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: var(--surface-1);
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 12px;
  text-decoration: none;
  transition: all 0.2s ease;
}

.about-link:hover {
  background: var(--surface-2);
  color: var(--text-primary);
}

.about-link iconify-icon {
  font-size: 16px;
}
</style>
