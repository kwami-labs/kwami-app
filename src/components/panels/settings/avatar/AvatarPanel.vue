<script setup lang="ts">
import { onMounted, onUnmounted, watch, computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { useKwami } from '@/composables/useKwami';
import { useAvatarStore, type AvatarState } from '@/stores/avatar';
import { useBlobXyzStore } from '@/stores/avatar.blob-xyz';
import { useBlackHoleStore } from '@/stores/avatar.black-hole';
import { useEyeIrisStore } from '@/stores/avatar.eye-iris';
import BasePanel from '@/components/ui/BasePanel.vue';
import PanelSection from '@/components/ui/PanelSection.vue';
import { panelIcons } from '@/constants/panel-icons';
import BlobXyzSettings from './BlobXyzSettings.vue';
import BlackHoleSettings from './BlackHoleSettings.vue';
import EyeIrisSettings from './EyeIrisSettings.vue';

// Sync composables
import { useBlobXyzSync } from '@/composables/avatar/sync/useBlobXyzSync';
import { useBlackHoleSync } from '@/composables/avatar/sync/useBlackHoleSync';
import { useEyeIrisSync } from '@/composables/avatar/sync/useEyeIrisSync';
import { randomizeAvatarPanel } from '@/composables/avatar/randomizeAvatarPanel';
import { useWorkspaceStore } from '@/stores/workspace';
import { useKwamiConfigSync } from '@/composables/useKwamiConfigSync';
import type { KwamiConfig } from '@/composables/useKwamiConfigSync';

const { kwami, rendererType: kwamiRendererType, switchRenderer } = useKwami();
const { t } = useI18n();
const workspaceStore = useWorkspaceStore();
const { getConfig } = useKwamiConfigSync();
const panelIcon = panelIcons.avatar ?? 'ph:ghost-duotone';
const avatarStore = useAvatarStore();
const blobStore = useBlobXyzStore();
const blackHoleStore = useBlackHoleStore();
const eyeIrisStore = useEyeIrisStore();

// Use store state
const {
  rendererType,
  blobXyzPresets,
  blackHolePresets,
  eyeIrisPresets,
} = storeToRefs(avatarStore);

// =====================================================
// HELPERS
// =====================================================

function getBlob() {
  return kwami.value?.avatar.getBlob();
}
function getBlackHole() {
  const avatar = kwami.value?.avatar as { getBlackHole?: () => unknown } | undefined;
  return avatar?.getBlackHole?.();
}
function getEyeIris() {
  const avatar = kwami.value?.avatar as { getEyeIris?: () => unknown } | undefined;
  return avatar?.getEyeIris?.();
}

// =====================================================
// SYNC COMPOSABLES
// =====================================================

// App.vue owns the always-on watcher set so the renderer stays in sync while
// this panel is closed (agent tools mutate these stores too). The panel only
// needs the imperative helpers, so it opts out to avoid double-firing them.
const { syncFromKwami: syncBlobFromKwami, applyToKwami: applyBlobToKwami } = useBlobXyzSync({
  kwami,
  getBlob,
  registerWatchers: false,
});

const { syncFromKwami: syncBlackHoleFromKwami, applyToKwami: applyBlackHoleToKwami } = useBlackHoleSync({
  kwami,
  getBlackHole,
  registerWatchers: false,
});
const { syncFromKwami: syncEyeIrisFromKwami, applyToKwami: applyEyeIrisToKwami } = useEyeIrisSync({
  kwami,
  getEyeIris,
  registerWatchers: false,
});

// =====================================================
// COMPUTED
// =====================================================

const currentPresets = computed(() => {
  switch (rendererType.value) {
    case 'blob-xyz':
      return blobXyzPresets.value;
    case 'black-hole':
      return blackHolePresets.value;
    case 'eye-iris':
      return eyeIrisPresets.value;
    default:
      return blobXyzPresets.value;
  }
});

// =====================================================
// SYNC FUNCTIONS
// =====================================================

function syncFromKwami() {
  if (!kwami.value) return;

  syncBlobFromKwami();
  syncBlackHoleFromKwami();
  syncEyeIrisFromKwami();

  avatarStore.setRendererType(
    kwamiRendererType.value as 'blob-xyz' | 'black-hole' | 'particles-face' | 'eye-iris',
  );
}

/** Apply the current store state to the kwami instance for the specified renderer */
function applyCurrentRendererToKwami(type: string) {
  switch (type) {
    case 'blob-xyz':
      applyBlobToKwami();
      break;
    case 'black-hole':
      applyBlackHoleToKwami();
      break;
    case 'eye-iris':
      applyEyeIrisToKwami();
      break;
  }
}

// =====================================================
// RENDERER TYPE WATCHER
// =====================================================

watch(rendererType, (type) => {
  if (kwamiRendererType.value !== type) {
    switchRenderer(type);
  }
});

// =====================================================
// PERSISTENCE WATCHERS
// =====================================================

// Watch all individual stores for changes and save to localStorage
watch(
  () => [
    blobStore.skin,
    blobStore.shape,
    blobStore.animation,
    blobStore.clickEvents,
    blobStore.cursorTouch,
    blobStore.audio,
  ],
  () => avatarStore.saveSettings(),
  { deep: true }
);

watch(
  () => [
    blackHoleStore.colorScheme,
    blackHoleStore.core,
    blackHoleStore.disk,
    blackHoleStore.colors,
    blackHoleStore.stars,
    blackHoleStore.animation,
    blackHoleStore.orientation,
    blackHoleStore.effects,
    blackHoleStore.audio,
    blackHoleStore.clickEvents,
    blackHoleStore.cursorTouch,
    blackHoleStore.scale,
    blackHoleStore.cameraZoom,
  ],
  () => avatarStore.saveSettings(),
  { deep: true }
);

watch(
  () => eyeIrisStore.state,
  () => avatarStore.saveSettings(),
  { deep: true }
);

// Save renderer type changes
watch(rendererType, () => avatarStore.saveSettings());

// =====================================================
// ACTIONS
// =====================================================

function handleSwitchRenderer(type: 'blob-xyz' | 'black-hole' | 'eye-iris') {
  avatarStore.setRendererType(type);
  switchRenderer(type);
  applyCurrentRendererToKwami(type);
}

function handleRandomize() {
  randomizeAvatarPanel({
    applyBlob: applyBlobToKwami,
    applyBlackHole: applyBlackHoleToKwami,
    applyParticles: () => {},
    applyEyeIris: applyEyeIrisToKwami,
  });
  window.dispatchEvent(new CustomEvent('kwami:randomized'));
}

function handleReset() {
  const savedAvatar = workspaceStore.getActiveSavedConfig()?.avatar;
  const hasSavedAvatar =
    savedAvatar &&
    typeof savedAvatar === 'object' &&
    Object.keys(savedAvatar as object).length > 0;

  if (hasSavedAvatar) {
    avatarStore.applySnapshot(
      savedAvatar as Parameters<typeof avatarStore.applySnapshot>[0],
    );
  } else {
    avatarStore.reset();
    blobStore.resetAll();
    blackHoleStore.resetAll();
  }

  if (kwamiRendererType.value !== rendererType.value) {
    switchRenderer(rendererType.value as 'blob-xyz' | 'black-hole' | 'particles-face' | 'eye-iris');
  }
  applyCurrentRendererToKwami(rendererType.value);

  workspaceStore.updateActiveConfigLocal(
    JSON.parse(JSON.stringify(getConfig())) as KwamiConfig,
  );
  avatarStore.saveSettings();
}

function handleApplyPreset(presetId: string) {
  const success = avatarStore.applyPreset(presetId);
  if (success) {
    // Switch renderer if needed
    if (kwamiRendererType.value !== rendererType.value) {
      switchRenderer(rendererType.value);
    }

    // Apply preset to kwami instance using sync composables
    switch (rendererType.value) {
      case 'blob-xyz':
        applyBlobToKwami();
        break;
      case 'black-hole':
        applyBlackHoleToKwami();
        break;
      case 'eye-iris':
        applyEyeIrisToKwami();
        break;
    }
  }
}

// =====================================================
// EVENT HANDLERS
// =====================================================

function onStateChanged(e: Event) {
  avatarStore.setActiveState((e as CustomEvent).detail as AvatarState);
}
function onRandomized() {
  // After randomize, sync the new state from kwami to store
  syncFromKwami();
  avatarStore.saveSettings();
}
function onRendererChanged() {
  // When renderer changes externally (e.g., via interaction or API),
  // apply the persisted store state to kwami
  // The handleSwitchRenderer already applies immediately for UI-triggered switches,
  // but this catches other renderer change sources
  applyCurrentRendererToKwami(rendererType.value);
}

// =====================================================
// DRAG ROTATION SYNC
// =====================================================

const isDragging = ref(false);
let dragAnimationFrame: number | null = null;
let lastMousePosition = { x: 0, y: 0 };

function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

function normalizeAngle(degrees: number): number {
  let normalized = degrees % 360;
  if (normalized < 0) normalized += 360;
  return normalized;
}

// For blob-xyz: sync from mesh rotation (blob has its own drag handlers)
function syncRotationFromMesh() {
  if (!kwami.value || !isDragging.value) return;

  try {
    if (rendererType.value === 'blob-xyz') {
      const blob = getBlob();
      if (blob) {
        const mesh = blob.getMesh();
        if (mesh) {
          const x = normalizeAngle(radToDeg(mesh.rotation.x));
          const y = normalizeAngle(radToDeg(mesh.rotation.y));
          const z = normalizeAngle(radToDeg(mesh.rotation.z));
          blobStore.shape.position.x = Math.round(x);
          blobStore.shape.position.y = Math.round(y);
          blobStore.shape.position.z = Math.round(z);
        }
      }
    }
    // For other renderers: orientation is updated via onCanvasMouseMove
  } catch {
    // Silently handle errors
  }

  if (isDragging.value) {
    dragAnimationFrame = requestAnimationFrame(syncRotationFromMesh);
  }
}

// Handle drag for non-blob renderers (they don't have built-in drag handlers)
function onCanvasMouseMove(e: MouseEvent) {
  if (!isDragging.value) return;

  const deltaX = e.clientX - lastMousePosition.x;
  const deltaY = e.clientY - lastMousePosition.y;
  lastMousePosition = { x: e.clientX, y: e.clientY };

  // For non-blob renderers, update orientation directly from mouse delta
  if (rendererType.value === 'black-hole') {
    blackHoleStore.orientation.y = normalizeAngle(blackHoleStore.orientation.y + deltaX * 0.5);
    blackHoleStore.orientation.x = normalizeAngle(blackHoleStore.orientation.x + deltaY * 0.5);
  }
}

function onCanvasMouseDown(e: MouseEvent) {
  if (e.button === 0) {
    isDragging.value = true;
    lastMousePosition = { x: e.clientX, y: e.clientY };
    // Only start animation frame for blob-xyz (which has its own drag handlers)
    if (rendererType.value === 'blob-xyz') {
      dragAnimationFrame = requestAnimationFrame(syncRotationFromMesh);
    }
  }
}

function onCanvasMouseUp() {
  isDragging.value = false;
  if (dragAnimationFrame !== null) {
    cancelAnimationFrame(dragAnimationFrame);
    dragAnimationFrame = null;
  }
}

function onCanvasMouseLeave() {
  if (isDragging.value) {
    isDragging.value = false;
    if (dragAnimationFrame !== null) {
      cancelAnimationFrame(dragAnimationFrame);
      dragAnimationFrame = null;
    }
  }
}

// =====================================================
// LIFECYCLE
// =====================================================

onMounted(() => {
  // Always sync from Kwami first so the store has the current on-screen state (e.g. rotation
  // from user dragging the blob while another panel was open). Otherwise applying store → Kwami
  // would overwrite the mesh with stale store values and reset the rotation.
  syncFromKwami();

  if (avatarStore.isInitialized) {
    if (kwamiRendererType.value !== rendererType.value) {
      switchRenderer(rendererType.value);
    }
    applyCurrentRendererToKwami(rendererType.value);
  }

  window.addEventListener('kwami:stateChanged', onStateChanged);
  window.addEventListener('kwami:randomized', onRandomized);
  window.addEventListener('kwami:rendererChanged', onRendererChanged);

  // Add drag rotation sync listeners
  const canvas = document.getElementById('kwami-canvas');
  if (canvas) {
    canvas.addEventListener('mousedown', onCanvasMouseDown);
    canvas.addEventListener('mouseup', onCanvasMouseUp);
    canvas.addEventListener('mousemove', onCanvasMouseMove);
    canvas.addEventListener('mouseleave', onCanvasMouseLeave);
  }
  window.addEventListener('mouseup', onCanvasMouseUp);
});

onUnmounted(() => {
  window.removeEventListener('kwami:stateChanged', onStateChanged);
  window.removeEventListener('kwami:randomized', onRandomized);
  window.removeEventListener('kwami:rendererChanged', onRendererChanged);

  // Remove drag rotation sync listeners
  const canvas = document.getElementById('kwami-canvas');
  if (canvas) {
    canvas.removeEventListener('mousedown', onCanvasMouseDown);
    canvas.removeEventListener('mouseup', onCanvasMouseUp);
    canvas.removeEventListener('mousemove', onCanvasMouseMove);
    canvas.removeEventListener('mouseleave', onCanvasMouseLeave);
  }
  window.removeEventListener('mouseup', onCanvasMouseUp);

  // Cancel any pending animation frame
  if (dragAnimationFrame !== null) {
    cancelAnimationFrame(dragAnimationFrame);
  }
});
</script>

<template>
  <BasePanel :icon="panelIcon" :title="t('avatar.title')">
    <!-- Avatar Type Selector -->
    <PanelSection :title="t('avatar.avatarType')" icon="ph:swap-duotone" collapsible>
      <p class="section-desc">{{ t('avatar.avatarTypeDesc') }}</p>
      <div class="renderer-selector">
        <label class="renderer-option" :class="{ active: rendererType === 'blob-xyz' }">
          <input
            type="radio"
            name="renderer"
            value="blob-xyz"
            :checked="rendererType === 'blob-xyz'"
            @change="handleSwitchRenderer('blob-xyz')"
          />
          <iconify-icon icon="ph:circle-wavy-duotone" class="renderer-icon"></iconify-icon>
          <div class="renderer-content">
            <span class="renderer-label">{{ t('avatar.rendererBlob') }}</span>
            <span class="renderer-desc">{{ t('avatar.rendererBlobDesc') }}</span>
          </div>
        </label>
        <label class="renderer-option" :class="{ active: rendererType === 'black-hole' }">
          <input
            type="radio"
            name="renderer"
            value="black-hole"
            :checked="rendererType === 'black-hole'"
            @change="handleSwitchRenderer('black-hole')"
          />
          <iconify-icon icon="ph:circle-dashed-duotone" class="renderer-icon"></iconify-icon>
          <div class="renderer-content">
            <span class="renderer-label">{{ t('avatar.rendererBlackHole') }}</span>
            <span class="renderer-desc">{{ t('avatar.rendererBlackHoleDesc') }}</span>
          </div>
        </label>
        <label class="renderer-option" :class="{ active: rendererType === 'eye-iris' }">
          <input
            type="radio"
            name="renderer"
            value="eye-iris"
            :checked="rendererType === 'eye-iris'"
            @change="handleSwitchRenderer('eye-iris')"
          />
          <iconify-icon icon="ph:eye-duotone" class="renderer-icon"></iconify-icon>
          <div class="renderer-content">
            <span class="renderer-label">{{ t('avatar.rendererEyeIris') }}</span>
            <span class="renderer-desc">{{ t('avatar.rendererEyeIrisDesc') }}</span>
          </div>
        </label>
      </div>
    </PanelSection>

    <!-- Presets -->
    <PanelSection :title="t('avatar.quickPresets')" icon="ph:magic-wand-duotone" collapsible>
      <p class="section-desc">{{ t('avatar.quickPresetsDesc') }}</p>
      <div class="presets-grid">
        <button
          v-for="preset in currentPresets"
          :key="preset.id"
          class="preset-btn"
          @click="handleApplyPreset(preset.id)"
          :title="preset.name"
        >
          <iconify-icon :icon="preset.icon" class="preset-icon"></iconify-icon>
          <span class="preset-name">{{ preset.name }}</span>
        </button>
      </div>
      <div class="preset-actions">
        <button
          class="action-btn randomize"
          @click="handleRandomize"
          :title="t('avatar.randomizeAllTitle')"
        >
          <iconify-icon icon="ph:dice-five-duotone"></iconify-icon>
          <span>{{ t('avatar.randomize') }}</span>
        </button>
        <button class="action-btn reset" @click="handleReset" :title="t('avatar.resetDefaultsTitle')">
          <iconify-icon icon="ph:arrow-counter-clockwise-duotone"></iconify-icon>
          <span>{{ t('avatar.reset') }}</span>
        </button>
      </div>
    </PanelSection>

    <!-- Sub-components -->
    <BlobXyzSettings v-if="rendererType === 'blob-xyz'" />
    <BlackHoleSettings v-if="rendererType === 'black-hole'" />
    <EyeIrisSettings v-if="rendererType === 'eye-iris'" />
  </BasePanel>
</template>

<style scoped>
/* Renderer Selector */
.renderer-selector {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
}

.renderer-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 12px;
  background: var(--surface-1);
  border: 1px solid transparent;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.renderer-option:hover {
  background: var(--surface-2);
  transform: translateY(-2px);
}

.renderer-option.active {
  background: var(--accent-glow);
  border-color: var(--accent-primary);
  box-shadow: 0 4px 20px var(--accent-glow);
}

.renderer-option input {
  display: none;
}

.renderer-icon {
  font-size: 26px;
  color: var(--text-secondary);
  transition: color 0.2s ease;
  flex-shrink: 0;
}

.renderer-option.active .renderer-icon {
  color: var(--accent-primary);
}

.renderer-option:hover .renderer-icon {
  color: var(--accent-primary);
}

.renderer-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.renderer-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.renderer-option.active .renderer-label {
  color: var(--text-primary);
}

.renderer-option:hover .renderer-label {
  color: var(--text-primary);
}

.renderer-desc {
  font-size: 10px;
  color: var(--text-muted);
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.renderer-option.active .renderer-desc {
  color: var(--text-secondary);
}

/* Presets Grid */
.presets-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.preset-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 8px;
  background: var(--surface-1);
  border: 1px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.preset-btn:hover {
  background: var(--surface-2);
  border-color: var(--accent-primary);
  transform: translateY(-2px);
}

.preset-btn:active {
  transform: translateY(0);
}

.preset-icon {
  font-size: 22px;
  color: var(--accent-primary);
}

.preset-name {
  font-size: 9px;
  font-weight: 500;
  color: var(--text-secondary);
  text-align: center;
  line-height: 1.2;
}

.preset-btn:hover .preset-name {
  color: var(--text-primary);
}

/* Preset Actions */
.preset-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--glass-border);
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 12px;
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn iconify-icon {
  font-size: 16px;
}

.action-btn:hover {
  background: var(--surface-2);
  color: var(--text-primary);
  transform: translateY(-1px);
}

.action-btn.randomize:hover {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.action-btn.reset:hover {
  border-color: var(--warning);
  color: var(--warning);
}

/* Section Description */
.section-desc {
  font-size: 11px;
  color: var(--text-muted);
  margin: 0 0 12px 0;
  line-height: 1.4;
}
</style>
