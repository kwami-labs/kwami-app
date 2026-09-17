<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  useThemeStore,
  accentPresets,
  themePresets,
  type ThemeMode,
  type SidebarPosition
} from '@/stores/theme';
import { useUIStore, type PanelSizePreset } from '@/stores/ui';
import BasePanel from '@/components/ui/BasePanel.vue';
import PanelSection from '@/components/ui/PanelSection.vue';
import { panelIcons } from '@/constants/panel-icons';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseSlider from '@/components/ui/BaseSlider.vue';
import BaseToggle from '@/components/ui/BaseToggle.vue';
import BaseTooltip from '@/components/ui/BaseTooltip.vue';
import BaseColorPicker from '@/components/ui/BaseColorPicker.vue';

const themeStore = useThemeStore();
const uiStore = useUIStore();
const { t } = useI18n();
const panelIcon = panelIcons.theme ?? 'ph:palette-duotone';

// Theme mode options
const themeModes = computed<{ value: ThemeMode; label: string; icon: string }[]>(() => [
  { value: 'dark', label: t('theme.modeDark'), icon: 'ph:moon-duotone' },
  { value: 'light', label: t('theme.modeLight'), icon: 'ph:sun-duotone' },
  { value: 'system', label: t('theme.modeSystem'), icon: 'ph:desktop-duotone' },
  { value: 'auto', label: t('theme.modeAuto'), icon: 'ph:clock-duotone' },
]);

// Sidebar position options
const sidebarPositions = computed<{ value: SidebarPosition; label: string; icon: string }[]>(() => [
  { value: 'left', label: t('theme.positionLeft'), icon: 'ph:sidebar-duotone' },
  { value: 'right', label: t('theme.positionRight'), icon: 'ph:sidebar-simple-duotone' },
]);

// Panel size tabs
const sizeTabs = computed<{ value: PanelSizePreset; label: string; icon: string }[]>(() => [
  { value: 'small', label: t('theme.sizeSmall'), icon: 'ph:rectangle-duotone' },
  { value: 'medium', label: t('theme.sizeMedium'), icon: 'ph:square-duotone' },
  { value: 'large', label: t('theme.sizeLarge'), icon: 'ph:selection-duotone' },
]);

// Current time for Auto mode display
const currentTime = ref('');
let timeInterval: ReturnType<typeof setInterval> | null = null;

function updateCurrentTime() {
  const now = new Date();
  currentTime.value = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

onMounted(() => {
  updateCurrentTime();
  timeInterval = setInterval(updateCurrentTime, 1000);
});

onUnmounted(() => {
  if (timeInterval) clearInterval(timeInterval);
});

function selectAccent(preset: typeof accentPresets[0]) {
  themeStore.setAccentPreset(preset);
}

// Export/Import
const showImportDialog = ref(false);
const importJson = ref('');
const importError = ref('');

function handleExport() {
  const json = themeStore.exportTheme();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'kwami-theme.json';
  a.click();
  URL.revokeObjectURL(url);
}

function handleImport() {
  importError.value = '';
  const success = themeStore.importTheme(importJson.value);
  if (success) {
    showImportDialog.value = false;
    importJson.value = '';
  } else {
    importError.value = t('theme.invalidThemeFormat');
  }
}

function handleFileImport(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    importJson.value = e.target?.result as string;
  };
  reader.readAsText(file);
}
</script>

<template>
  <BasePanel :icon="panelIcon" :title="t('theme.title')">
    <template #actions>
      <BaseTooltip :text="t('theme.undo')" position="bottom">
        <button
          class="icon-btn"
          :disabled="!themeStore.canUndo"
          @click="themeStore.undo"
        >
          <iconify-icon icon="ph:arrow-counter-clockwise-duotone"></iconify-icon>
        </button>
      </BaseTooltip>
      <BaseTooltip :text="t('theme.redo')" position="bottom">
        <button
          class="icon-btn"
          :disabled="!themeStore.canRedo"
          @click="themeStore.redo"
        >
          <iconify-icon icon="ph:arrow-clockwise-duotone"></iconify-icon>
        </button>
      </BaseTooltip>
    </template>
      <!-- Theme Presets -->
      <PanelSection :title="t('theme.presets')" icon="ph:stack-duotone" collapsible>
        <div class="preset-grid">
          <BaseTooltip
            v-for="preset in themePresets"
            :key="preset.name"
            :text="preset.description"
            position="top"
          >
            <button
              class="preset-card"
              @click="themeStore.applyPreset(preset)"
            >
              <iconify-icon :icon="preset.icon" class="preset-icon"></iconify-icon>
              <span class="preset-name">{{ preset.name }}</span>
            </button>
          </BaseTooltip>
        </div>
      </PanelSection>

      <!-- Theme Mode -->
      <PanelSection :title="t('theme.mode')" icon="ph:circles-four-duotone" collapsible>
        <div class="theme-modes">
          <button
            v-for="mode in themeModes"
            :key="mode.value"
            class="theme-mode-btn"
            :class="{ active: themeStore.mode === mode.value }"
            @click="themeStore.setMode(mode.value)"
          >
            <iconify-icon :icon="mode.icon"></iconify-icon>
            <span>{{ mode.label }}</span>
          </button>
        </div>
      </PanelSection>

      <!-- Auto Mode Schedule -->
      <PanelSection v-if="themeStore.mode === 'auto'" :title="t('theme.autoSchedule')" icon="ph:timer-duotone" collapsible>
        <div class="time-row">
          <div class="time-input">
            <label class="time-label">
              <iconify-icon icon="ph:sun-duotone"></iconify-icon>
              {{ t('theme.light') }}
            </label>
            <input
              type="time"
              :value="themeStore.autoStartTime"
              @input="themeStore.setAutoStartTime(($event.target as HTMLInputElement).value)"
            />
          </div>
          <div class="time-input">
            <label class="time-label">
              <iconify-icon icon="ph:moon-duotone"></iconify-icon>
              {{ t('theme.dark') }}
            </label>
            <input
              type="time"
              :value="themeStore.autoEndTime"
              @input="themeStore.setAutoEndTime(($event.target as HTMLInputElement).value)"
            />
          </div>
        </div>
        <div class="current-time">
          <iconify-icon icon="ph:clock-duotone"></iconify-icon>
          <span class="current-time-label">{{ t('theme.currentTime') }}</span>
          <span class="current-time-value">{{ currentTime }}</span>
        </div>
      </PanelSection>

      <!-- Accent Color Presets -->
      <PanelSection :title="t('theme.accentPresets')" icon="ph:paint-brush-duotone" collapsible>
        <div class="accent-grid">
          <BaseTooltip
            v-for="preset in accentPresets"
            :key="preset.name"
            :text="preset.name"
            position="top"
          >
            <button
              class="accent-btn"
              :class="{ active: themeStore.accentPrimary === preset.primary }"
              @click="selectAccent(preset)"
            >
              <span 
                class="accent-preview" 
                :style="{ background: `linear-gradient(var(--gradient-direction, 135deg), ${preset.primary} 0%, ${preset.secondary} 100%)` }"
              ></span>
            </button>
          </BaseTooltip>
        </div>
      </PanelSection>

      <!-- Custom Accent Color -->
      <PanelSection :title="t('theme.customColors')" icon="ph:eyedropper-duotone" collapsible>
        <div class="color-pickers">
          <BaseColorPicker
            variant="inline"
            :label="t('theme.primary')"
            :modelValue="themeStore.accentPrimary"
            @update:modelValue="themeStore.setAccentPrimary($event)"
          />
          <BaseColorPicker
            variant="inline"
            :label="t('theme.secondary')"
            :modelValue="themeStore.accentSecondary"
            @update:modelValue="themeStore.setAccentSecondary($event)"
          />
        </div>
        <BaseSlider
          :label="t('theme.gradientAngle')"
          :modelValue="themeStore.gradientDirection"
          @update:modelValue="themeStore.setGradientDirection($event)"
          :min="0"
          :max="360"
          :step="15"
          unit="°"
        />
        <BaseSlider
          :label="t('theme.saturation')"
          :modelValue="themeStore.saturation"
          @update:modelValue="themeStore.setSaturation($event)"
          :min="0"
          :max="200"
          :step="10"
          unit="%"
        />
      </PanelSection>

      <!-- Glass Settings -->
      <PanelSection :title="t('theme.glassEffect')" icon="ph:drop-duotone" collapsible>
        <div class="settings-group">
          <BaseSlider
            :label="t('theme.blur')"
            :modelValue="themeStore.glassBlur"
            @update:modelValue="themeStore.setGlassBlur($event)"
            :min="0"
            :max="48"
            :step="4"
            unit="px"
          />
          <BaseSlider
            :label="t('theme.opacity')"
            :modelValue="themeStore.glassOpacity"
            @update:modelValue="themeStore.setGlassOpacity($event)"
            :min="50"
            :max="100"
            :step="2"
            unit="%"
          />
          <BaseSlider
            :label="t('theme.tint')"
            :modelValue="themeStore.glassTint"
            @update:modelValue="themeStore.setGlassTint($event)"
            :min="0"
            :max="100"
            :step="5"
            unit="%"
          />
          <BaseSlider
            :label="t('theme.noise')"
            :modelValue="themeStore.noiseTexture"
            @update:modelValue="themeStore.setNoiseTexture($event)"
            :min="0"
            :max="100"
            :step="5"
            unit="%"
          />
          <BaseSlider
            :label="t('theme.shadow')"
            :modelValue="themeStore.shadowIntensity"
            @update:modelValue="themeStore.setShadowIntensity($event)"
            :min="0"
            :max="100"
            :step="5"
            unit="%"
          />
        </div>
      </PanelSection>

      <!-- Layout -->
      <PanelSection :title="t('theme.layout')" icon="ph:layout-duotone" collapsible>
        <div class="layout-preview">
          <div class="layout-preview-screen">
            <div 
              class="layout-preview-sidebar" 
              :class="{ right: themeStore.sidebarPosition === 'right' }"
            >
              <div class="layout-preview-nav"></div>
              <div class="layout-preview-panel"></div>
            </div>
            <div class="layout-preview-canvas"></div>
          </div>
        </div>
        <div class="option-group">
          <span class="option-label">{{ t('theme.sidebarPosition') }}</span>
          <div class="option-buttons">
            <button
              v-for="pos in sidebarPositions"
              :key="pos.value"
              class="option-btn"
              :class="{ active: themeStore.sidebarPosition === pos.value }"
              @click="themeStore.setSidebarPosition(pos.value)"
            >
              <iconify-icon :icon="pos.icon"></iconify-icon>
              {{ pos.label }}
            </button>
          </div>
        </div>

        <!-- Panel Size Presets -->
        <div class="option-group" style="margin-top: 14px;">
          <span class="option-label">{{ t('theme.panelSize') }}</span>
          <div class="size-tabs">
            <button
              v-for="tab in sizeTabs"
              :key="tab.value"
              class="size-tab"
              :class="{ active: uiStore.activeSizePreset === tab.value }"
              @click="uiStore.setSizePreset(tab.value)"
            >
              <iconify-icon :icon="tab.icon"></iconify-icon>
              {{ tab.label }}
            </button>
          </div>
        </div>

        <!-- Size preset configuration -->
        <div class="size-preset-config">
          <div 
            v-for="tab in sizeTabs" 
            :key="tab.value"
            class="size-preset-row"
            :class="{ active: uiStore.activeSizePreset === tab.value }"
          >
            <div class="preset-info">
              <iconify-icon :icon="tab.icon" class="preset-icon-small"></iconify-icon>
              <span class="preset-label">{{ tab.label }}</span>
            </div>
            <div class="preset-controls">
              <div class="width-input-group">
                <input
                  type="number"
                  class="width-input"
                  :value="uiStore.sizePresets[tab.value].width"
                  :min="uiStore.MIN_PANEL_WIDTH"
                  :max="uiStore.MAX_PANEL_WIDTH"
                  @input="uiStore.setPresetWidth(tab.value, parseInt(($event.target as HTMLInputElement).value) || uiStore.MIN_PANEL_WIDTH)"
                />
                <span class="width-unit">px</span>
              </div>
              <span class="shortcut-badge">{{ uiStore.sizePresets[tab.value].shortcut }}</span>
            </div>
          </div>
        </div>

        <!-- Custom Resize Toggle -->
        <div 
          class="toggle-group" 
          style="margin-top: 14px;"
          :title="themeStore.compactMode ? t('theme.disableCompactForResize') : ''"
        >
          <BaseToggle
            :label="t('theme.allowCustomResize')"
            :modelValue="uiStore.allowCustomResize"
            :disabled="themeStore.compactMode"
            @update:modelValue="uiStore.setAllowCustomResize($event)"
          />
        </div>

        <p class="layout-hint">
          <iconify-icon icon="ph:info-duotone"></iconify-icon>
          <template v-if="themeStore.compactMode">
            {{ t('theme.disableCompactForResize') }}
          </template>
          <template v-else-if="uiStore.allowCustomResize">
            {{ t('theme.dragEdgeToResize') }}
          </template>
          <template v-else>
            {{ t('theme.customResizeDisabled') }}
          </template>
        </p>
      </PanelSection>

      <!-- UI Settings -->
      <PanelSection :title="t('theme.interface')" icon="ph:sliders-horizontal-duotone" collapsible>
        <div class="settings-group">
          <BaseSlider
            :label="t('theme.roundness')"
            :modelValue="themeStore.borderRadius"
            @update:modelValue="themeStore.setBorderRadius($event)"
            :min="0"
            :max="20"
            :step="2"
            unit="px"
          />
          <BaseSlider
            :label="t('theme.contrast')"
            :modelValue="themeStore.surfaceContrast"
            @update:modelValue="themeStore.setSurfaceContrast($event)"
            :min="0"
            :max="100"
            :step="5"
            unit="%"
          />
          <BaseSlider
            :label="t('theme.animation')"
            :modelValue="themeStore.animationSpeed"
            @update:modelValue="themeStore.setAnimationSpeed($event)"
            :min="0.5"
            :max="2"
            :step="0.1"
            unit="x"
          />
        </div>
      </PanelSection>

      <!-- Toggles -->
      <PanelSection :title="t('theme.effects')" icon="ph:sparkle-duotone" collapsible>
        <div class="toggle-group">
          <BaseToggle
            :label="t('theme.panelBorders')"
            :modelValue="themeStore.panelBorder"
            @update:modelValue="themeStore.setPanelBorder($event)"
          />
          <BaseToggle
            :label="t('theme.glowEffects')"
            :modelValue="themeStore.glowEffects"
            @update:modelValue="themeStore.setGlowEffects($event)"
          />
          <BaseToggle
            :label="t('theme.compactMode')"
            :modelValue="themeStore.compactMode"
            @update:modelValue="themeStore.setCompactMode($event)"
          />
        </div>
      </PanelSection>

      <!-- Accessibility -->
      <PanelSection :title="t('theme.accessibility')" icon="ph:eye-duotone" collapsible>
        <div class="toggle-group">
          <BaseToggle
            :label="t('theme.highContrast')"
            :modelValue="themeStore.highContrast"
            @update:modelValue="themeStore.setHighContrast($event)"
          />
          <BaseToggle
            :label="t('theme.focusIndicators')"
            :modelValue="themeStore.focusIndicators"
            @update:modelValue="themeStore.setFocusIndicators($event)"
          />
        </div>
      </PanelSection>

      <!-- Cursor Flashlight -->
      <PanelSection :title="t('theme.cursorFlashlight')" icon="ph:flashlight-duotone" collapsible>
        <div class="toggle-group">
          <BaseToggle
            :label="t('theme.enableFlashlight')"
            :modelValue="themeStore.cursorFlashlight"
            @update:modelValue="themeStore.setCursorFlashlight($event)"
          />
        </div>
        <template v-if="themeStore.cursorFlashlight">
          <div class="settings-group" style="margin-top: 12px;">
            <BaseSlider
              :label="t('theme.size')"
              :modelValue="themeStore.flashlightSize"
              @update:modelValue="themeStore.setFlashlightSize($event)"
              :min="100"
              :max="500"
              :step="25"
              unit="px"
            />
            <BaseSlider
              :label="t('theme.intensity')"
              :modelValue="themeStore.flashlightIntensity"
              @update:modelValue="themeStore.setFlashlightIntensity($event)"
              :min="10"
              :max="80"
              :step="5"
              unit="%"
            />
            <BaseColorPicker
              variant="inline"
              :label="t('theme.color')"
              :modelValue="themeStore.flashlightColor"
              @update:modelValue="themeStore.setFlashlightColor($event)"
            />
          </div>
        </template>
      </PanelSection>

      <!-- Actions -->
      <PanelSection :title="t('theme.actions')" icon="ph:gear-six-duotone" collapsible>
        <div class="action-buttons">
          <BaseButton
            variant="secondary"
            icon="ph:download-duotone"
            @click="handleExport"
          >
            {{ t('theme.export') }}
          </BaseButton>
          <BaseButton
            variant="secondary"
            icon="ph:upload-duotone"
            @click="showImportDialog = true"
          >
            {{ t('theme.import') }}
          </BaseButton>
        </div>
        <BaseButton
          variant="secondary"
          icon="ph:arrow-counter-clockwise-duotone"
          block
          style="margin-top: 10px;"
          @click="themeStore.resetToDefaults"
        >
          {{ t('theme.resetToDefault') }}
        </BaseButton>
      </PanelSection>

    <!-- Import Dialog -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showImportDialog" class="modal-overlay" @click.self="showImportDialog = false">
          <div class="modal-container">
            <div class="modal-header">
              <h3>{{ t('theme.importTheme') }}</h3>
              <button class="close-btn" @click="showImportDialog = false">
                <iconify-icon icon="ph:x-bold"></iconify-icon>
              </button>
            </div>
            <div class="modal-body">
              <div class="import-option">
                <label class="file-input-label">
                  <iconify-icon icon="ph:file-duotone"></iconify-icon>
                  {{ t('theme.chooseFile') }}
                  <input
                    type="file"
                    accept=".json"
                    @change="handleFileImport"
                  />
                </label>
              </div>
              <div class="or-divider">{{ t('theme.orPasteJson') }}</div>
              <textarea
                v-model="importJson"
                :placeholder="t('theme.importJsonPlaceholder')"
                class="import-textarea"
              ></textarea>
              <p v-if="importError" class="import-error">{{ importError }}</p>
            </div>
            <div class="modal-footer">
              <BaseButton variant="ghost" @click="showImportDialog = false">{{ t('theme.cancel') }}</BaseButton>
              <BaseButton variant="primary" @click="handleImport">{{ t('theme.import') }}</BaseButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </BasePanel>
</template>

<style scoped>
/* Undo/Redo Buttons */
.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: var(--surface-1);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
}

.icon-btn:hover:not(:disabled) {
  background: var(--surface-2);
  color: var(--accent-primary);
}

.icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.icon-btn iconify-icon {
  font-size: 16px;
}

/* Theme Presets */
.preset-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.preset-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 8px 4px;
  background: var(--surface-1);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
}

.preset-card:hover {
  background: var(--surface-2);
  border-color: var(--accent-primary);
  color: var(--text-primary);
}

.preset-icon {
  font-size: 16px;
  color: var(--accent-primary);
}

.preset-name {
  font-size: 9px;
  font-weight: 600;
  text-align: center;
  line-height: 1.2;
}

.preset-desc {
  font-size: 10px;
  color: var(--text-muted);
}

/* Theme Mode Buttons */
.theme-modes {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.theme-mode-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 8px;
  background: var(--surface-1);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
}

.theme-mode-btn iconify-icon {
  font-size: 20px;
}

.theme-mode-btn span {
  font-size: 10px;
  font-weight: 500;
}

.theme-mode-btn:hover {
  background: var(--surface-2);
  color: var(--text-primary);
}

.theme-mode-btn.active {
  background: var(--accent-glow);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

/* Accent Color Grid */
.accent-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 6px;
}

.accent-btn {
  aspect-ratio: 1;
  padding: 3px;
  background: var(--surface-1);
  border: 2px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
}

.accent-btn:hover {
  transform: scale(1.12);
  z-index: 1;
}

.accent-btn.active {
  border-color: var(--text-primary);
  box-shadow: 0 0 12px var(--accent-glow);
}

.accent-preview {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: calc(var(--radius-sm) - 2px);
}

/* Color Pickers */
.color-pickers {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 14px;
}

/* Color picker styles now handled by BaseColorPicker component */

/* Option Buttons */
.option-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
}

.option-buttons {
  display: flex;
  gap: 6px;
}

.option-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 12px;
  background: var(--surface-1);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--duration-fast) ease;
}

.option-btn iconify-icon {
  font-size: 14px;
}

.option-btn:hover {
  background: var(--surface-2);
  color: var(--text-primary);
}

.option-btn.active {
  background: var(--accent-glow);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

/* Settings Groups */
.settings-group {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.toggle-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Time Row for Auto Schedule */
.time-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.time-input {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.time-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
}

.time-label iconify-icon {
  font-size: 14px;
  color: var(--text-muted);
}

.time-input input[type="time"] {
  width: 100%;
  padding: 10px 12px;
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 13px;
  font-family: 'JetBrains Mono', monospace;
  transition: all var(--duration-fast) ease;
}

.time-input input[type="time"]:focus {
  outline: none;
  border-color: var(--accent-primary);
  background: var(--surface-2);
}

.time-input input[type="time"]::-webkit-calendar-picker-indicator {
  filter: invert(0.7);
  cursor: pointer;
}

/* Current Time Display */
.current-time {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  margin-top: 12px;
  background: var(--surface-1);
  border-radius: var(--radius-md);
}

.current-time iconify-icon {
  font-size: 16px;
  color: var(--accent-primary);
}

.current-time-label {
  font-size: 12px;
  color: var(--text-muted);
}

.current-time-value {
  font-size: 14px;
  font-weight: 600;
  font-family: 'JetBrains Mono', monospace;
  color: var(--text-primary);
  margin-left: auto;
}

/* Layout Preview */
.layout-preview {
  margin-bottom: 14px;
}

.layout-preview-screen {
  position: relative;
  width: 100%;
  height: 64px;
  background: var(--surface-1);
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
  overflow: hidden;
}

.layout-preview-sidebar {
  position: absolute;
  left: 6px;
  top: 6px;
  bottom: 6px;
  display: flex;
  gap: 4px;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.layout-preview-sidebar.right {
  left: auto;
  right: 6px;
  flex-direction: row-reverse;
}

.layout-preview-nav {
  width: 8px;
  height: 100%;
  background: var(--accent-primary);
  border-radius: 4px;
  opacity: 0.8;
}

.layout-preview-panel {
  width: 32px;
  height: 100%;
  background: var(--surface-3);
  border-radius: 4px;
}

.layout-preview-canvas {
  position: absolute;
  inset: 6px;
  left: 52px;
  right: 6px;
  background: radial-gradient(circle at center, var(--accent-glow), transparent 70%);
  border-radius: 4px;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.layout-preview-sidebar.right ~ .layout-preview-canvas {
  left: 6px;
  right: 52px;
}

/* Layout hint */
.layout-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  padding: 8px 10px;
  background: var(--surface-1);
  border-radius: var(--radius-md);
  font-size: 11px;
  color: var(--text-muted);
}

.layout-hint iconify-icon {
  font-size: 14px;
  color: var(--accent-primary);
}

/* Size Tabs */
.size-tabs {
  display: flex;
  gap: 4px;
  background: var(--surface-1);
  border-radius: var(--radius-md);
  padding: 3px;
}

.size-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 10px;
  background: transparent;
  border: none;
  border-radius: calc(var(--radius-md) - 2px);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--duration-fast) ease;
}

.size-tab iconify-icon {
  font-size: 14px;
}

.size-tab:hover {
  background: var(--surface-2);
  color: var(--text-primary);
}

.size-tab.active {
  background: var(--accent-glow);
  color: var(--accent-primary);
}

/* Size Preset Configuration */
.size-preset-config {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
}

.size-preset-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background: var(--surface-1);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  transition: all var(--duration-fast) ease;
}

.size-preset-row.active {
  border-color: var(--accent-primary);
  background: var(--accent-glow);
}

.preset-info {
  display: flex;
  align-items: center;
  gap: 6px;
}

.preset-icon-small {
  font-size: 14px;
  color: var(--text-muted);
}

.size-preset-row.active .preset-icon-small {
  color: var(--accent-primary);
}

.preset-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
}

.size-preset-row.active .preset-label {
  color: var(--text-primary);
}

.preset-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.width-input-group {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--surface-2);
  border-radius: var(--radius-sm);
}

.width-input {
  width: 50px;
  padding: 0;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: 11px;
  font-family: 'JetBrains Mono', monospace;
  text-align: right;
}

.width-input:focus {
  outline: none;
}

.width-input::-webkit-inner-spin-button,
.width-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.width-input[type="number"] {
  -moz-appearance: textfield;
}

.width-unit {
  font-size: 10px;
  color: var(--text-muted);
}

.shortcut-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 6px;
  background: var(--surface-2);
  border-radius: var(--radius-sm);
  font-size: 9px;
  font-weight: 600;
  font-family: 'JetBrains Mono', monospace;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.size-preset-row.active .shortcut-badge {
  background: var(--accent-primary);
  color: var(--bg-primary);
}

/* Action Buttons */
.action-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-container {
  width: 100%;
  max-width: 400px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--glass-shadow);
  backdrop-filter: blur(var(--glass-blur));
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--glass-border);
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
}

.close-btn:hover {
  background: var(--surface-2);
  color: var(--text-primary);
}

.modal-body {
  padding: 20px;
}

.import-option {
  display: flex;
  justify-content: center;
}

.file-input-label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: var(--surface-1);
  border: 1px dashed var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--duration-fast) ease;
}

.file-input-label:hover {
  background: var(--surface-2);
  border-color: var(--accent-primary);
  color: var(--text-primary);
}

.file-input-label input {
  display: none;
}

.or-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 16px 0;
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
}

.or-divider::before,
.or-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--glass-border);
}

.import-textarea {
  width: 100%;
  height: 120px;
  padding: 12px;
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 12px;
  font-family: 'JetBrains Mono', monospace;
  resize: vertical;
}

.import-textarea:focus {
  outline: none;
  border-color: var(--accent-primary);
}

.import-error {
  margin-top: 8px;
  font-size: 12px;
  color: #ef4444;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid var(--glass-border);
}

/* Fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--duration-normal) ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
