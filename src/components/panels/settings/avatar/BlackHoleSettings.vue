<script setup lang="ts">
import type { InteractionAction } from '@/stores/avatar';
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { useKwami } from '@/composables/useKwami';
import { useBlackHoleStore, type BlackHoleColorScheme } from '@/stores/avatar.black-hole';
import {
  useAvatarInteractions,
  actionOptions,
  cursorOptions,
} from '@/composables/avatar/useAvatarInteractions';
import { randomHex, randomInRange } from '@/utils/color';
import PanelSection from '@/components/ui/PanelSection.vue';
import BaseSlider from '@/components/ui/BaseSlider.vue';
import BaseToggle from '@/components/ui/BaseToggle.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import BaseColorPicker from '@/components/ui/BaseColorPicker.vue';
import AudioVisualizer from '../audio/AudioVisualizer.vue';
import MicrophoneControl from '../audio/MicrophoneControl.vue';

const { t } = useI18n();
const { kwami } = useKwami();
const blackHoleStore = useBlackHoleStore();
const {
  colorScheme,
  core,
  disk,
  colors,
  animation,
  orientation,
  effects,
  clickEvents,
  cursorTouch,
  audio,
  scale,
  cameraZoom,
} = storeToRefs(blackHoleStore);

// Link toggle for orientation
const linkOrientation = ref(false);

// =====================================================
// COMPOSABLES
// =====================================================
function getBlackHole() {
  return kwami.value?.avatar.getBlackHole() ?? undefined;
}

const { executeAction } = useAvatarInteractions({
  getRenderer: getBlackHole,
});

function testAction(action: InteractionAction) {
  executeAction(action);
}

// =====================================================
// OPTIONS
// =====================================================

const schemeOptions = computed(() => [
  { label: t('blackHoleAvatar.schemeClassic'), value: 'classic' },
  { label: t('blackHoleAvatar.schemeFire'), value: 'fire' },
  { label: t('blackHoleAvatar.schemeIce'), value: 'ice' },
  { label: t('blackHoleAvatar.schemeNebula'), value: 'nebula' },
  { label: t('blackHoleAvatar.schemeVoid'), value: 'void' },
]);

const localizedActionOptions = computed(() =>
  actionOptions.map((o) => ({ ...o, label: t(`avatarActions.${o.value}`) })),
);
const localizedCursorOptions = computed(() =>
  cursorOptions.map((o) => ({ ...o, label: t(`avatarCursors.${o.value}`) })),
);

// =====================================================
// HELPERS (Removed or replaced)
// =====================================================
// (Helpers removed as they are now imported or replaced by composables)

// =====================================================
// SECTION-SPECIFIC RANDOMIZERS
// =====================================================

// Color Scheme
function randomizeColorScheme() {
  const schemes: BlackHoleColorScheme[] = ['classic', 'fire', 'ice', 'nebula', 'void'];
  blackHoleStore.setColorSchemePreset(
    schemes[Math.floor(Math.random() * schemes.length)] ?? 'classic',
  );
}

// Colors
function randomizeColors() {
  colors.value.hot = randomHex();
  colors.value.mid1 = randomHex();
  colors.value.mid2 = randomHex();
  colors.value.mid3 = randomHex();
  colors.value.outer = randomHex();
}

// Core
function randomizeCore() {
  const bhRadius = randomInRange(0.8, 2, 0.1);
  core.value.blackHoleRadius = bhRadius;
  core.value.eventHorizonRadius = bhRadius * randomInRange(1.02, 1.15, 0.01);
  core.value.glowIntensity = randomInRange(0.5, 1.5, 0.1);
  core.value.pulseSpeed = randomInRange(1.5, 4, 0.5);
}

// Disk
function randomizeDisk() {
  disk.value.innerRadius = randomInRange(0.1, 0.5, 0.05);
  disk.value.outerRadius = randomInRange(6, 12, 0.5);
  disk.value.flowSpeed = randomInRange(0.1, 0.4, 0.02);
  disk.value.noiseScale = randomInRange(1.5, 4, 0.5);
  disk.value.density = randomInRange(0.8, 1.8, 0.1);
  disk.value.tiltAngle = randomInRange(Math.PI / 6, Math.PI / 2, 0.1);
}

// Effects
function randomizeEffects() {
  effects.value.bloomIntensity = randomInRange(0.4, 1.2, 0.1);
  effects.value.bloomThreshold = randomInRange(0.6, 0.9, 0.05);
  effects.value.bloomRadius = randomInRange(0.5, 1, 0.1);
  effects.value.lensingStrength = randomInRange(0.08, 0.2, 0.02);
  effects.value.chromaticAberration = randomInRange(0.003, 0.015, 0.001);
}

// Animation
function randomizeAnimation() {
  animation.value.diskRotationSpeed = randomInRange(0.002, 0.01, 0.001);
  animation.value.starsRotationSpeed = randomInRange(0.001, 0.005, 0.0005);
}

// Audio
function randomizeAudio() {
  audio.value.reactivity = randomInRange(0.5, 2, 0.1);
  audio.value.smoothing = randomInRange(0.7, 0.95, 0.01);
}

// Frequency Effects
function randomizeFrequencyEffects() {
  audio.value.frequencyEffects = {
    bassDiskGlow: randomInRange(0.2, 0.8, 0.05),
    midDiskSpeed: randomInRange(0.1, 0.5, 0.05),
    highStarTwinkle: randomInRange(0.2, 0.6, 0.05),
  };
}

// Orientation
function randomizeOrientation() {
  if (linkOrientation.value) {
    const pos = randomInRange(0, 360, 1);
    orientation.value.x = pos;
    orientation.value.y = pos;
    orientation.value.z = pos;
  } else {
    orientation.value.x = randomInRange(0, 360, 1);
    orientation.value.y = randomInRange(0, 360, 1);
    orientation.value.z = randomInRange(0, 360, 1);
  }
}

// =====================================================
// LINKED WATCHERS
// =====================================================

watch(
  () => orientation.value.x,
  (val) => {
    if (linkOrientation.value) {
      orientation.value.y = val;
      orientation.value.z = val;
    }
  },
);

// =====================================================
// INTERACTION WATCHERS
// =====================================================

watch(
  clickEvents,
  (_config) => {
    const bh = getBlackHole();
    if (!bh) return;

    // Black hole doesn't have click callbacks yet, but we can set them up for future
  },
  { deep: true, immediate: true },
);
</script>

<template>
  <!-- ==================== COLOR SCHEME ==================== -->
  <PanelSection :title="t('blackHoleAvatar.colorScheme')" icon="ph:palette-duotone" collapsible>
    <template #actions>
      <button
        class="dice-btn"
        @click="randomizeColorScheme"
        :title="t('blackHoleAvatar.randomizeScheme')"
      >
        <iconify-icon icon="ph:dice-three-duotone"></iconify-icon>
      </button>
    </template>
    <p class="section-desc">{{ t('blackHoleAvatar.colorSchemeDesc') }}</p>
    <div class="style-selector">
      <label
        v-for="option in schemeOptions"
        :key="option.value"
        class="style-option"
        :class="{ active: colorScheme.preset === option.value }"
      >
        <input
          type="radio"
          :value="option.value"
          v-model="colorScheme.preset"
          @change="blackHoleStore.setColorSchemePreset(colorScheme.preset)"
        />
        <iconify-icon
          :icon="
            option.value === 'classic'
              ? 'ph:circle-duotone'
              : option.value === 'fire'
                ? 'ph:fire-duotone'
                : option.value === 'ice'
                  ? 'ph:snowflake-duotone'
                  : option.value === 'nebula'
                    ? 'ph:planet-duotone'
                    : 'ph:moon-duotone'
          "
          class="style-icon"
        ></iconify-icon>
        <span class="style-label">{{ option.label }}</span>
      </label>
    </div>
  </PanelSection>

  <!-- ==================== DISK COLORS ==================== -->
  <PanelSection :title="t('blackHoleAvatar.diskColors')" icon="ph:paint-brush-duotone" collapsible>
    <template #actions>
      <button class="dice-btn" @click="randomizeColors" :title="t('blobAvatar.randomizeColors')">
        <iconify-icon icon="ph:dice-three-duotone"></iconify-icon>
      </button>
    </template>
    <p class="section-desc">{{ t('blackHoleAvatar.diskColorsDesc') }}</p>
    <div class="color-grid">
      <BaseColorPicker :label="t('blackHoleAvatar.hotInner')" v-model="colors.hot" />
      <BaseColorPicker :label="t('blackHoleAvatar.mid1')" v-model="colors.mid1" />
      <BaseColorPicker :label="t('blackHoleAvatar.mid2')" v-model="colors.mid2" />
      <BaseColorPicker :label="t('blackHoleAvatar.mid3')" v-model="colors.mid3" />
      <BaseColorPicker :label="t('blackHoleAvatar.outer')" v-model="colors.outer" />
    </div>
  </PanelSection>

  <!-- ==================== SCALE & ZOOM ==================== -->
  <PanelSection :title="t('blackHoleAvatar.scaleZoom')" icon="ph:arrows-out-duotone" collapsible>
    <p class="section-desc">{{ t('blackHoleAvatar.scaleZoomDesc') }}</p>
    <div class="slider-group">
      <BaseSlider
        :label="t('blobAvatar.scale')"
        :min="0.5"
        :max="2"
        :step="0.1"
        v-model="scale.value"
      />
      <BaseSlider
        :label="t('blackHoleAvatar.cameraZoom')"
        :min="0.5"
        :max="3"
        :step="0.1"
        v-model="cameraZoom.value"
      />
    </div>
  </PanelSection>

  <!-- ==================== BLACK HOLE CENTER ==================== -->
  <PanelSection :title="t('blackHoleAvatar.blackHoleCenter')" icon="ph:circle-fill" collapsible>
    <template #actions>
      <button class="dice-btn" @click="randomizeCore" :title="t('blackHoleAvatar.randomizeCore')">
        <iconify-icon icon="ph:dice-three-duotone"></iconify-icon>
      </button>
    </template>
    <p class="section-desc">{{ t('blackHoleAvatar.centerDesc') }}</p>
    <div class="slider-group">
      <BaseSlider
        :label="t('blackHoleAvatar.blackHoleRadius')"
        :min="0.5"
        :max="3"
        :step="0.1"
        v-model="core.blackHoleRadius"
      />
    </div>
  </PanelSection>

  <!-- ==================== EVENT HORIZON ==================== -->
  <PanelSection :title="t('blackHoleAvatar.eventHorizon')" icon="ph:circle-duotone" collapsible>
    <p class="section-desc">{{ t('blackHoleAvatar.eventHorizonDesc') }}</p>
    <div class="slider-group">
      <BaseSlider
        :label="t('blackHoleAvatar.eventHorizonRadius')"
        :min="0.5"
        :max="4"
        :step="0.1"
        v-model="core.eventHorizonRadius"
      />
      <BaseSlider
        :label="t('blackHoleAvatar.glowIntensity')"
        :min="0.2"
        :max="2"
        :step="0.1"
        v-model="core.glowIntensity"
      />
      <BaseSlider
        :label="t('blackHoleAvatar.pulseSpeed')"
        :min="0.5"
        :max="5"
        :step="0.5"
        v-model="core.pulseSpeed"
      />
    </div>
  </PanelSection>

  <!-- ==================== ACCRETION DISK ==================== -->
  <PanelSection :title="t('blackHoleAvatar.accretionDisk')" icon="ph:spiral-duotone" collapsible>
    <template #actions>
      <button class="dice-btn" @click="randomizeDisk" :title="t('blackHoleAvatar.randomizeDisk')">
        <iconify-icon icon="ph:dice-three-duotone"></iconify-icon>
      </button>
    </template>
    <p class="section-desc">{{ t('blackHoleAvatar.accretionDesc') }}</p>
    <div class="slider-group">
      <BaseSlider
        :label="t('blackHoleAvatar.innerGap')"
        :min="0"
        :max="1"
        :step="0.05"
        v-model="disk.innerRadius"
      />
      <BaseSlider
        :label="t('blackHoleAvatar.outerRadius')"
        :min="4"
        :max="15"
        :step="0.5"
        v-model="disk.outerRadius"
      />
      <BaseSlider
        :label="t('blackHoleAvatar.flowSpeed')"
        :min="0.05"
        :max="0.5"
        :step="0.01"
        v-model="disk.flowSpeed"
      />
      <BaseSlider
        :label="t('blackHoleAvatar.noiseScale')"
        :min="1"
        :max="5"
        :step="0.5"
        v-model="disk.noiseScale"
      />
      <BaseSlider
        :label="t('blackHoleAvatar.density')"
        :min="0.5"
        :max="2"
        :step="0.1"
        v-model="disk.density"
      />
      <BaseSlider
        :label="t('blackHoleAvatar.tiltAngle')"
        :min="0.5"
        :max="1.57"
        :step="0.1"
        v-model="disk.tiltAngle"
      />
    </div>
  </PanelSection>

  <!-- ==================== POST-PROCESSING EFFECTS ==================== -->
  <PanelSection :title="t('blackHoleAvatar.effects')" icon="ph:sparkle-duotone" collapsible>
    <template #actions>
      <button
        class="dice-btn"
        @click="randomizeEffects"
        :title="t('blackHoleAvatar.randomizeEffects')"
      >
        <iconify-icon icon="ph:dice-three-duotone"></iconify-icon>
      </button>
    </template>
    <p class="section-desc">{{ t('blackHoleAvatar.effectsDesc') }}</p>
    <div class="slider-group">
      <BaseSlider
        :label="t('blackHoleAvatar.bloomIntensity')"
        :min="0"
        :max="2"
        :step="0.1"
        v-model="effects.bloomIntensity"
      />
      <BaseSlider
        :label="t('blackHoleAvatar.bloomThreshold')"
        :min="0.5"
        :max="1"
        :step="0.05"
        v-model="effects.bloomThreshold"
      />
      <BaseSlider
        :label="t('blackHoleAvatar.bloomRadius')"
        :min="0"
        :max="1.5"
        :step="0.1"
        v-model="effects.bloomRadius"
      />
      <BaseSlider
        :label="t('blackHoleAvatar.lensingStrength')"
        :min="0"
        :max="0.3"
        :step="0.01"
        v-model="effects.lensingStrength"
      />
      <BaseSlider
        :label="t('blackHoleAvatar.lensingRadius')"
        :min="0.1"
        :max="0.5"
        :step="0.02"
        v-model="effects.lensingRadius"
      />
      <BaseSlider
        :label="t('blackHoleAvatar.chromaticAberration')"
        :min="0"
        :max="0.02"
        :step="0.001"
        v-model="effects.chromaticAberration"
      />
    </div>
  </PanelSection>

  <!-- ==================== ANIMATION ==================== -->
  <PanelSection
    :title="t('blackHoleAvatar.animation')"
    icon="ph:arrows-clockwise-duotone"
    collapsible
  >
    <template #actions>
      <button
        class="dice-btn"
        @click="randomizeAnimation"
        :title="t('blackHoleAvatar.randomizeAnimation')"
      >
        <iconify-icon icon="ph:dice-three-duotone"></iconify-icon>
      </button>
    </template>
    <p class="section-desc">{{ t('blackHoleAvatar.animationDesc') }}</p>
    <div class="toggle-row">
      <BaseToggle :label="t('blackHoleAvatar.autoRotateCamera')" v-model="animation.autoRotate" />
    </div>
    <div class="slider-group" style="margin-top: 12px">
      <BaseSlider
        v-if="animation.autoRotate"
        :label="t('blackHoleAvatar.cameraRotationSpeed')"
        :min="0.01"
        :max="0.3"
        :step="0.01"
        v-model="animation.autoRotateSpeed"
      />
      <BaseSlider
        :label="t('blackHoleAvatar.diskRotationSpeed')"
        :min="0"
        :max="0.02"
        :step="0.001"
        v-model="animation.diskRotationSpeed"
      />
      <BaseSlider
        :label="t('blackHoleAvatar.starsRotationSpeed')"
        :min="0"
        :max="0.01"
        :step="0.0005"
        v-model="animation.starsRotationSpeed"
      />
    </div>
  </PanelSection>

  <!-- ==================== ORIENTATION ==================== -->
  <PanelSection :title="t('blackHoleAvatar.orientation')" icon="ph:compass-duotone" collapsible>
    <template #actions>
      <button
        class="link-btn"
        :class="{ active: linkOrientation }"
        @click="linkOrientation = !linkOrientation"
        :title="t('blobAvatar.linkXyz')"
      >
        <iconify-icon
          :icon="linkOrientation ? 'ph:link-duotone' : 'ph:link-break-duotone'"
        ></iconify-icon>
      </button>
      <button
        class="dice-btn"
        @click="randomizeOrientation"
        :title="t('blobAvatar.randomizeOrientation')"
      >
        <iconify-icon icon="ph:dice-three-duotone"></iconify-icon>
      </button>
    </template>
    <p class="section-desc">{{ t('blobAvatar.orientationDesc') }}</p>
    <div class="slider-group" :class="{ linked: linkOrientation }">
      <BaseSlider
        :label="t('blobAvatar.xDeg')"
        :min="0"
        :max="360"
        :step="1"
        v-model="orientation.x"
      />
      <BaseSlider
        v-if="!linkOrientation"
        :label="t('blobAvatar.yDeg')"
        :min="0"
        :max="360"
        :step="1"
        v-model="orientation.y"
      />
      <BaseSlider
        v-if="!linkOrientation"
        :label="t('blobAvatar.zDeg')"
        :min="0"
        :max="360"
        :step="1"
        v-model="orientation.z"
      />
    </div>
  </PanelSection>

  <!-- ==================== CLICK EVENTS ==================== -->
  <PanelSection
    :title="t('blackHoleAvatar.clickEvents')"
    icon="ph:cursor-click-duotone"
    collapsible
  >
    <p class="section-desc">{{ t('blackHoleAvatar.clickEventsDesc') }}</p>

    <div class="interaction-row">
      <div class="interaction-header">
        <iconify-icon icon="ph:hand-tap-duotone"></iconify-icon>
        <span>{{ t('blobAvatar.singleClick') }}</span>
        <BaseToggle v-model="clickEvents.click.enabled" size="sm" />
      </div>
      <div class="interaction-config" v-if="clickEvents.click.enabled">
        <BaseSelect
          :label="t('blobAvatar.action')"
          v-model="clickEvents.click.action"
          :options="localizedActionOptions"
        />
        <button
          class="test-btn"
          @click="testAction(clickEvents.click.action)"
          :title="t('blackHoleAvatar.testAction')"
        >
          <iconify-icon icon="ph:play-fill"></iconify-icon>
        </button>
      </div>
    </div>

    <div class="interaction-row">
      <div class="interaction-header">
        <iconify-icon icon="ph:hand-duotone"></iconify-icon>
        <span>{{ t('blobAvatar.doubleClick') }}</span>
        <BaseToggle v-model="clickEvents.doubleClick.enabled" size="sm" />
      </div>
      <div class="interaction-config" v-if="clickEvents.doubleClick.enabled">
        <BaseSelect
          :label="t('blobAvatar.action')"
          v-model="clickEvents.doubleClick.action"
          :options="localizedActionOptions"
        />
        <button
          class="test-btn"
          @click="testAction(clickEvents.doubleClick.action)"
          :title="t('blackHoleAvatar.testAction')"
        >
          <iconify-icon icon="ph:play-fill"></iconify-icon>
        </button>
      </div>
    </div>

    <div class="interaction-row">
      <div class="interaction-header">
        <iconify-icon icon="ph:mouse-right-click-duotone"></iconify-icon>
        <span>{{ t('blobAvatar.rightClick') }}</span>
        <BaseToggle v-model="clickEvents.rightClick.enabled" size="sm" />
      </div>
      <div class="interaction-config" v-if="clickEvents.rightClick.enabled">
        <BaseSelect
          :label="t('blobAvatar.action')"
          v-model="clickEvents.rightClick.action"
          :options="localizedActionOptions"
        />
        <button
          class="test-btn"
          @click="testAction(clickEvents.rightClick.action)"
          :title="t('blackHoleAvatar.testAction')"
        >
          <iconify-icon icon="ph:play-fill"></iconify-icon>
        </button>
      </div>
    </div>

    <div class="interaction-row">
      <div class="interaction-header">
        <iconify-icon icon="ph:mouse-right-click-duotone"></iconify-icon>
        <span>{{ t('blobAvatar.doubleRightClick') }}</span>
        <BaseToggle v-model="clickEvents.doubleRightClick.enabled" size="sm" />
      </div>
      <div class="interaction-config" v-if="clickEvents.doubleRightClick.enabled">
        <BaseSelect
          :label="t('blobAvatar.action')"
          v-model="clickEvents.doubleRightClick.action"
          :options="localizedActionOptions"
        />
        <button
          class="test-btn"
          @click="testAction(clickEvents.doubleRightClick.action)"
          :title="t('blackHoleAvatar.testAction')"
        >
          <iconify-icon icon="ph:play-fill"></iconify-icon>
        </button>
      </div>
    </div>
  </PanelSection>

  <!-- ==================== HOVER & DRAG ==================== -->
  <PanelSection :title="t('blackHoleAvatar.hoverDrag')" icon="ph:hand-duotone" collapsible>
    <p class="section-desc">{{ t('blackHoleAvatar.hoverDragDesc') }}</p>

    <div class="toggle-row">
      <BaseToggle :label="t('blackHoleAvatar.enableHover')" v-model="cursorTouch.hover.enabled" />
    </div>
    <div v-if="cursorTouch.hover.enabled" class="hover-config">
      <BaseToggle
        :label="t('blackHoleAvatar.highlightOnHover')"
        v-model="cursorTouch.hover.highlightOnHover"
      />
      <BaseSelect
        :label="t('blackHoleAvatar.cursorStyle')"
        v-model="cursorTouch.hover.cursorStyle"
        :options="localizedCursorOptions"
      />
    </div>

    <div class="toggle-row" style="margin-top: 12px">
      <BaseToggle :label="t('blackHoleAvatar.enableDrag')" v-model="cursorTouch.drag.enabled" />
    </div>
    <div v-if="cursorTouch.drag.enabled" class="slider-group">
      <BaseSlider
        :label="t('blobAvatar.sensitivity')"
        :min="0.1"
        :max="3"
        :step="0.1"
        v-model="cursorTouch.drag.sensitivity"
      />
    </div>
  </PanelSection>

  <!-- ==================== AUDIO REACTIVITY ==================== -->
  <PanelSection :title="t('audioPanel.audioReactivity')" icon="ph:waveform-duotone" collapsible>
    <template #actions>
      <button
        class="dice-btn"
        @click="randomizeAudio"
        :title="t('audioPanel.randomizeAudioSettings')"
      >
        <iconify-icon icon="ph:dice-three-duotone"></iconify-icon>
      </button>
    </template>
    <p class="section-desc">{{ t('blackHoleAvatar.audioReactivityDesc') }}</p>

    <div class="toggle-row">
      <BaseToggle :label="t('audioPanel.enableAudioEffects')" v-model="audio.enabled" />
    </div>

    <MicrophoneControl />
    <AudioVisualizer />

    <div v-if="audio.enabled" class="slider-group" style="margin-top: 12px">
      <BaseSlider
        :label="t('audioPanel.reactivity')"
        :min="0"
        :max="2"
        :step="0.1"
        v-model="audio.reactivity"
      />
      <BaseSlider
        :label="t('audioPanel.smoothing')"
        :min="0.5"
        :max="0.99"
        :step="0.01"
        v-model="audio.smoothing"
      />
    </div>
  </PanelSection>

  <!-- ==================== FREQUENCY RESPONSE ==================== -->
  <PanelSection :title="t('audioPanel.frequencyResponse')" icon="ph:equalizer-duotone" collapsible>
    <template #actions>
      <button
        class="dice-btn"
        @click="randomizeFrequencyEffects"
        :title="t('blackHoleAvatar.randomizeFrequency')"
      >
        <iconify-icon icon="ph:dice-three-duotone"></iconify-icon>
      </button>
    </template>
    <p class="section-desc">{{ t('blackHoleAvatar.frequencyResponseDesc') }}</p>

    <div class="slider-group">
      <BaseSlider
        :label="t('audioPanel.bassDiskGlow')"
        :min="0"
        :max="1"
        :step="0.05"
        v-model="audio.frequencyEffects.bassDiskGlow"
      />
      <BaseSlider
        :label="t('audioPanel.midDiskSpeed')"
        :min="0"
        :max="1"
        :step="0.05"
        v-model="audio.frequencyEffects.midDiskSpeed"
      />
      <BaseSlider
        :label="t('audioPanel.highStarTwinkle')"
        :min="0"
        :max="1"
        :step="0.05"
        v-model="audio.frequencyEffects.highStarTwinkle"
      />
    </div>
  </PanelSection>
</template>

<style scoped>
@import '@/styles/avatar-settings.css';
/* Section Description */
.section-desc {
  font-size: 11px;
  color: var(--text-muted);
  margin: 0 0 12px 0;
  line-height: 1.4;
}

/* Style Selector */
.style-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  background: var(--surface-1);
  padding: 4px;
  border-radius: 10px;
}

.style-option {
  flex: 1;
  min-width: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 4px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s;
  font-size: 10px;
  font-weight: 500;
}

.style-option input {
  display: none;
}

.style-option:hover {
  background: var(--surface-2);
  color: var(--text-primary);
}

.style-option.active {
  background: var(--surface-3);
  color: var(--text-primary);
  border: 1px solid var(--accent-primary);
}

.style-icon {
  font-size: 20px;
}

/* Color Grid */
.color-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.color-grid > :nth-child(4),
.color-grid > :nth-child(5) {
  grid-column: span 1;
}
</style>
