<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { useKwami } from '@/composables/useKwami';
import { useBlobXyzStore } from '@/stores/avatar.blob-xyz';
import {
  randomBlobColors,
  randomBlobSurface,
  randomBlobScale,
  randomBlobVector3Degrees,
  randomBlobSpikes,
  randomBlobAmplitude,
  randomBlobTime,
  randomBlobRotation,
  randomBlobBreathing,
  randomBlobTouch,
} from 'kwami';
import { 
  useColorPalettes, 
  type PaletteType 
} from '@/composables/avatar/useColorPalettes';
import { 
  useAvatarInteractions, 
  actionOptions, 
  cursorOptions 
} from '@/composables/avatar/useAvatarInteractions';
import PanelSection from '@/components/ui/PanelSection.vue';
import BaseSlider from '@/components/ui/BaseSlider.vue';
import BaseToggle from '@/components/ui/BaseToggle.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import BaseColorPicker from '@/components/ui/BaseColorPicker.vue';

const { t, te } = useI18n();
const { kwami } = useKwami();
const blobStore = useBlobXyzStore();
const { skin, shape, animation, clickEvents, cursorTouch } = storeToRefs(blobStore);

// Link toggles for XYZ controls
const linkSpikes = ref(false);
const linkAmplitude = ref(false);
const linkTime = ref(false);
const linkRotation = ref(false);
const linkPosition = ref(false);

// =====================================================
// COMPOSABLES
// =====================================================

function getBlob() {
  return kwami.value?.avatar.getBlob();
}

const { executeAction, testAction } = useAvatarInteractions({
  getRenderer: getBlob,
});

const { palettes, applyPalette } = useColorPalettes();

// =====================================================
// SECTION-SPECIFIC RANDOMIZERS
// =====================================================

const SKINS = [
  'radial', 'banded', 'striped', 'marble', 'fresnel', 'iridescent', 'spiral', 'plasma', 'gradient',
  'matte', 'glossy', 'metallic', 'subsurface',
  'chrome', 'clay', 'jade', 'toon-matcap', 'hologram',
  'flat', 'stepped', 'halftone', 'outlined',
] as const;

type SkinFilter = 'all' | 'core' | 'material' | 'stylized';

const SKIN_FILTERS = computed(() => [
  { id: 'all' as SkinFilter, label: t('blobAvatar.filterAll') },
  { id: 'core' as SkinFilter, label: t('blobAvatar.filterCore') },
  { id: 'material' as SkinFilter, label: t('blobAvatar.filterMaterial') },
  { id: 'stylized' as SkinFilter, label: t('blobAvatar.filterStylized') },
]);

const SKIN_CATEGORIES: Record<string, Exclude<SkinFilter, 'all'>> = {
  radial: 'core',
  banded: 'core',
  striped: 'core',
  marble: 'core',
  fresnel: 'core',
  iridescent: 'core',
  spiral: 'core',
  plasma: 'core',
  gradient: 'core',
  matte: 'material',
  glossy: 'material',
  metallic: 'material',
  subsurface: 'material',
  chrome: 'material',
  clay: 'material',
  jade: 'material',
  'toon-matcap': 'stylized',
  hologram: 'stylized',
  flat: 'stylized',
  stepped: 'stylized',
  halftone: 'stylized',
  outlined: 'stylized',
};

const activeSkinFilter = ref<SkinFilter>('all');

function formatSkinLabel(value: string) {
  const key = `blobAvatar.skins.${value.replace(/-/g, '_')}`;
  if (te(key)) return t(key);
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const filteredSkins = computed(() => {
  if (activeSkinFilter.value === 'all') return SKINS;
  return SKINS.filter((skinType) => SKIN_CATEGORIES[skinType] === activeSkinFilter.value);
});

const selectedSkinLabel = computed(() =>
  t('blobAvatar.currentSkin', { name: formatSkinLabel(skin.value.type) }),
);

const localizedActionOptions = computed(() =>
  actionOptions.map((o) => ({ ...o, label: t(`avatarActions.${o.value}`) })),
);
const localizedCursorOptions = computed(() =>
  cursorOptions.map((o) => ({ ...o, label: t(`avatarCursors.${o.value}`) })),
);

function setSkinFilter(filter: SkinFilter) {
  activeSkinFilter.value = filter;
}

function skinFilterCount(filter: SkinFilter) {
  if (filter === 'all') return SKINS.length;
  return SKINS.filter((skinType) => SKIN_CATEGORIES[skinType] === filter).length;
}

function randomizeStyle() {
  const pool = filteredSkins.value.length ? filteredSkins.value : SKINS;
  skin.value.type = pool[Math.floor(Math.random() * pool.length)]!;
}

// Colors
function randomizeColors() {
  skin.value.colors = randomBlobColors();
}

// Surface properties
function randomizeSurface() {
  Object.assign(skin.value, randomBlobSurface());
}

// Scale
function randomizeScale() {
  shape.value.scale = randomBlobScale();
}

// Position
function randomizePosition() {
  shape.value.position = randomBlobVector3Degrees(linkPosition.value);
}

// Spikes
function randomizeSpikes() {
  shape.value.spikes = randomBlobSpikes(linkSpikes.value);
}

// Amplitude
function randomizeAmplitude() {
  shape.value.amplitude = randomBlobAmplitude(linkAmplitude.value);
}

// Animation Speed
function randomizeSpeed() {
  animation.value.time = randomBlobTime(linkTime.value);
}

// Rotation
function randomizeRotation() {
  animation.value.rotation = randomBlobRotation(linkRotation.value);
}

// Breathing
function randomizeBreathing() {
  animation.value.breathing = randomBlobBreathing();
}

// Touch
function randomizeTouch() {
  cursorTouch.value.touch = randomBlobTouch();
}

function randomizeCursorFollow() {
  cursorTouch.value.cursorFollow.enabled = Math.random() > 0.35;
  cursorTouch.value.cursorFollow.sensitivity = Number((0.6 + Math.random() * 1.1).toFixed(2));
}

// =====================================================
// COLOR PALETTE HANDLER
// =====================================================

function handleApplyPalette(type: PaletteType) {
  const colors = applyPalette(type);
  skin.value.colors.x = colors.x;
  skin.value.colors.y = colors.y;
  skin.value.colors.z = colors.z;
}

// =====================================================
// LINKED VALUE WATCHERS
// =====================================================

watch(() => shape.value.spikes.x, (val) => {
  if (linkSpikes.value) {
    shape.value.spikes.y = val;
    shape.value.spikes.z = val;
  }
});

watch(() => shape.value.amplitude.x, (val) => {
  if (linkAmplitude.value) {
    shape.value.amplitude.y = val;
    shape.value.amplitude.z = val;
  }
});

watch(() => animation.value.time.x, (val) => {
  if (linkTime.value) {
    animation.value.time.y = val;
    animation.value.time.z = val;
  }
});

watch(() => animation.value.rotation.x, (val) => {
  if (linkRotation.value) {
    animation.value.rotation.y = val;
    animation.value.rotation.z = val;
  }
});

watch(() => shape.value.position.x, (val) => {
  if (linkPosition.value) {
    shape.value.position.y = val;
    shape.value.position.z = val;
  }
});

// =====================================================
// INTERACTION WATCHERS (sync to blob instance)
// =====================================================

watch(clickEvents, (config) => {
  const blob = getBlob();
  if (!blob) return;

  blob.onClick = config.click.enabled && config.click.action !== 'none'
    ? () => executeAction(config.click.action)
    : () => {};

  blob.onDoubleClick = config.doubleClick.enabled && config.doubleClick.action !== 'none'
    ? () => executeAction(config.doubleClick.action)
    : () => {};

  if (config.rightClick.enabled && config.rightClick.action !== 'none') {
    blob.setRightClickCallback(() => executeAction(config.rightClick.action));
  } else {
    blob.setRightClickCallback(() => {});
  }

  if (config.doubleRightClick.enabled && config.doubleRightClick.action !== 'none') {
    blob.setDoubleRightClickCallback(() => executeAction(config.doubleRightClick.action));
  } else {
    blob.setDoubleRightClickCallback(() => {});
  }
}, { deep: true, immediate: true });

// =====================================================
// COMPUTED
// =====================================================

const skinGradient = computed(() => {
  const { x, y, z } = skin.value.colors;
  return {
    radial: `conic-gradient(${x}, ${y}, ${z}, ${x})`,
    banded: `linear-gradient(180deg, ${x} 0%, ${y} 50%, ${z} 100%)`,
    striped: `radial-gradient(circle, ${x}, ${y}, ${z})`,
    marble: `radial-gradient(ellipse at 30% 40%, ${x}, ${y} 50%, ${z})`,
    fresnel: `radial-gradient(circle, transparent 20%, ${x} 50%, ${y} 75%, ${z})`,
    iridescent: `linear-gradient(135deg, ${x}, ${y}, ${z}, ${x})`,
    spiral: `conic-gradient(from 45deg, ${x}, ${y}, ${z}, ${x}, ${y}, ${z})`,
    plasma: `radial-gradient(circle at 30% 70%, ${x}, transparent), radial-gradient(circle at 70% 30%, ${y}, transparent), radial-gradient(circle at 50% 50%, ${z}, transparent)`,
    gradient: `linear-gradient(180deg, ${x} 0%, ${y} 50%, ${z} 100%)`,
    matte: `linear-gradient(135deg, ${x}, ${x}dd)`,
    glossy: `radial-gradient(circle at 35% 35%, white 0%, ${x} 40%, ${x}88 100%)`,
    metallic: `linear-gradient(160deg, ${x}44, ${x}, white, ${x}, ${x}44)`,
    subsurface: `radial-gradient(circle, ${x}88, ${x}, ${x}cc)`,
    chrome: `linear-gradient(160deg, #333, #eee, #999, #fff, #666)`,
    clay: `linear-gradient(135deg, #c4956a, #d4a574, #e8c9a8)`,
    jade: `radial-gradient(circle, #6ee7a0, #2ecc71, #1a9c52)`,
    'toon-matcap': `linear-gradient(180deg, ${x}, ${x}88, ${x}44)`,
    hologram: `linear-gradient(135deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3, #54a0ff)`,
    flat: `linear-gradient(180deg, ${x} 50%, ${x}66 50%)`,
    stepped: `linear-gradient(180deg, ${x} 25%, ${y} 25%, ${y} 50%, ${x}88 50%, ${x}88 75%, ${x}44 75%)`,
    halftone: `radial-gradient(circle, ${x} 30%, ${y} 30%)`,
    outlined: `linear-gradient(135deg, ${x}22, ${x}, ${x}22)`,
  } as Record<string, string>;
});
</script>

<template>
  <!-- ==================== SKIN STYLE ==================== -->
  <PanelSection :title="t('blobAvatar.skinStyle')" icon="ph:paint-brush-duotone" collapsible>
    <template #actions>
      <button class="dice-btn" @click="randomizeStyle" :title="t('blobAvatar.randomizeStyle')">
        <iconify-icon icon="ph:dice-three-duotone"></iconify-icon>
      </button>
    </template>
    <p class="section-desc">{{ t('blobAvatar.skinStyleDesc') }}</p>

    <div class="skin-filter-row">
      <button
        v-for="filter in SKIN_FILTERS"
        :key="filter.id"
        class="skin-filter-btn"
        :class="{ active: activeSkinFilter === filter.id }"
        @click="setSkinFilter(filter.id)"
        type="button"
      >
        {{ filter.label }} ({{ skinFilterCount(filter.id) }})
      </button>
    </div>

    <p class="skin-current">{{ selectedSkinLabel }}</p>

    <div class="skin-selector skin-selector-grid">
      <label
        v-for="skinType in filteredSkins"
        :key="skinType"
        class="skin-option"
        :class="{ active: skin.type === skinType }"
      >
        <input type="radio" :value="skinType" v-model="skin.type" />
        <span class="skin-preview" :style="{ background: skinGradient[skinType] }"></span>
        <span class="skin-label">{{ formatSkinLabel(skinType) }}</span>
      </label>
    </div>
  </PanelSection>

  <!-- ==================== COLOR PALETTE ==================== -->
  <PanelSection :title="t('blobAvatar.colorPalette')" icon="ph:palette-duotone" collapsible>
    <template #actions>
      <button class="dice-btn" @click="randomizeColors" :title="t('blobAvatar.randomizeColors')">
        <iconify-icon icon="ph:dice-three-duotone"></iconify-icon>
      </button>
    </template>
    <p class="section-desc">{{ t('blobAvatar.colorPaletteDesc') }}</p>
    <div class="row-3">
      <BaseColorPicker :label="t('blobAvatar.axisX')" v-model="skin.colors.x" />
      <BaseColorPicker :label="t('blobAvatar.axisY')" v-model="skin.colors.y" />
      <BaseColorPicker :label="t('blobAvatar.axisZ')" v-model="skin.colors.z" />
    </div>
    <div class="color-palettes">
      <span class="palette-label">{{ t('blobAvatar.quickPalettes') }}</span>
      <div class="palette-grid">
        <button 
          v-for="(palette, key) in palettes" 
          :key="key"
          class="palette-btn" 
          @click="handleApplyPalette(key as PaletteType)" 
          :title="palette.label"
        >
          <iconify-icon :icon="palette.icon"></iconify-icon>
        </button>
      </div>
    </div>
  </PanelSection>

  <!-- ==================== MATERIAL ==================== -->
  <PanelSection :title="t('blobAvatar.material')" icon="ph:sphere-duotone" collapsible>
    <template #actions>
      <button class="dice-btn" @click="randomizeSurface" :title="t('blobAvatar.randomizeMaterial')">
        <iconify-icon icon="ph:dice-three-duotone"></iconify-icon>
      </button>
    </template>
    <p class="section-desc">{{ t('blobAvatar.materialDesc') }}</p>
    <div class="slider-group">
      <BaseSlider :label="t('theme.opacity')" :min="0" :max="1" :step="0.01" v-model="skin.opacity" />
      <BaseSlider :label="t('blobAvatar.shininess')" :min="1" :max="200" :step="1" v-model="skin.shininess" />
      <BaseSlider :label="t('blobAvatar.lightIntensity')" :min="0" :max="5" :step="0.1" v-model="skin.lightIntensity" />
      <BaseSlider :label="t('blobAvatar.resolution')" :min="32" :max="512" :step="8" v-model="skin.resolution" />
    </div>
    <div class="toggle-group" style="margin-top: 12px">
      <BaseToggle :label="t('blobAvatar.wireframe')" v-model="skin.wireframe" />
      <BaseToggle :label="t('blobAvatar.glassEffect')" v-model="skin.glassMode" />
    </div>
  </PanelSection>

  <!-- ==================== SIZE ==================== -->
  <PanelSection :title="t('blobAvatar.size')" icon="ph:arrows-out-duotone" collapsible>
    <template #actions>
      <button class="dice-btn" @click="randomizeScale" :title="t('blobAvatar.randomizeSize')">
        <iconify-icon icon="ph:dice-three-duotone"></iconify-icon>
      </button>
    </template>
    <p class="section-desc">{{ t('blobAvatar.sizeDesc') }}</p>
    <BaseSlider :label="t('blobAvatar.scale')" :min="0.5" :max="10" :step="0.1" v-model="shape.scale" />
  </PanelSection>

  <!-- ==================== ORIENTATION ==================== -->
  <PanelSection :title="t('blobAvatar.orientation')" icon="ph:compass-duotone" collapsible>
    <template #actions>
      <button 
        class="link-btn" 
        :class="{ active: linkPosition }" 
        @click="linkPosition = !linkPosition"
        :title="t('blobAvatar.linkXyz')"
      >
        <iconify-icon :icon="linkPosition ? 'ph:link-duotone' : 'ph:link-break-duotone'"></iconify-icon>
      </button>
      <button class="dice-btn" @click="randomizePosition" :title="t('blobAvatar.randomizeOrientation')">
        <iconify-icon icon="ph:dice-three-duotone"></iconify-icon>
      </button>
    </template>
    <p class="section-desc">{{ t('blobAvatar.orientationDesc') }}</p>
    <div class="slider-group" :class="{ linked: linkPosition }">
      <BaseSlider :label="t('blobAvatar.xDeg')" :min="0" :max="360" :step="1" v-model="shape.position.x" />
      <BaseSlider v-if="!linkPosition" :label="t('blobAvatar.yDeg')" :min="0" :max="360" :step="1" v-model="shape.position.y" />
      <BaseSlider v-if="!linkPosition" :label="t('blobAvatar.zDeg')" :min="0" :max="360" :step="1" v-model="shape.position.z" />
    </div>
  </PanelSection>

  <!-- ==================== DEFORMATION ==================== -->
  <PanelSection :title="t('blobAvatar.deformation')" icon="ph:asterisk-duotone" collapsible>
    <template #actions>
      <button 
        class="link-btn" 
        :class="{ active: linkSpikes }" 
        @click="linkSpikes = !linkSpikes"
        :title="t('blobAvatar.linkXyz')"
      >
        <iconify-icon :icon="linkSpikes ? 'ph:link-duotone' : 'ph:link-break-duotone'"></iconify-icon>
      </button>
      <button class="dice-btn" @click="randomizeSpikes" :title="t('blobAvatar.randomizeDeformation')">
        <iconify-icon icon="ph:dice-three-duotone"></iconify-icon>
      </button>
    </template>
    <p class="section-desc">{{ t('blobAvatar.deformationDesc') }}</p>
    <div class="slider-group" :class="{ linked: linkSpikes }">
      <BaseSlider :label="t('blobAvatar.axisX')" :min="0" :max="8" :step="0.05" v-model="shape.spikes.x" />
      <BaseSlider v-if="!linkSpikes" :label="t('blobAvatar.axisY')" :min="0" :max="8" :step="0.05" v-model="shape.spikes.y" />
      <BaseSlider v-if="!linkSpikes" :label="t('blobAvatar.axisZ')" :min="0" :max="8" :step="0.05" v-model="shape.spikes.z" />
    </div>
  </PanelSection>

  <!-- ==================== WAVE AMPLITUDE ==================== -->
  <PanelSection :title="t('blobAvatar.waveAmplitude')" icon="ph:wave-sine-duotone" collapsible>
    <template #actions>
      <button 
        class="link-btn" 
        :class="{ active: linkAmplitude }" 
        @click="linkAmplitude = !linkAmplitude"
        :title="t('blobAvatar.linkXyz')"
      >
        <iconify-icon :icon="linkAmplitude ? 'ph:link-duotone' : 'ph:link-break-duotone'"></iconify-icon>
      </button>
      <button class="dice-btn" @click="randomizeAmplitude" :title="t('blobAvatar.randomizeAmplitude')">
        <iconify-icon icon="ph:dice-three-duotone"></iconify-icon>
      </button>
    </template>
    <p class="section-desc">{{ t('blobAvatar.waveAmplitudeDesc') }}</p>
    <div class="slider-group" :class="{ linked: linkAmplitude }">
      <BaseSlider :label="t('blobAvatar.axisX')" :min="0.1" :max="2" :step="0.05" v-model="shape.amplitude.x" />
      <BaseSlider v-if="!linkAmplitude" :label="t('blobAvatar.axisY')" :min="0.1" :max="2" :step="0.05" v-model="shape.amplitude.y" />
      <BaseSlider v-if="!linkAmplitude" :label="t('blobAvatar.axisZ')" :min="0.1" :max="2" :step="0.05" v-model="shape.amplitude.z" />
    </div>
  </PanelSection>

  <!-- ==================== ANIMATION SPEED ==================== -->
  <PanelSection :title="t('blobAvatar.animationSpeed')" icon="ph:timer-duotone" collapsible>
    <template #actions>
      <button 
        class="link-btn" 
        :class="{ active: linkTime }" 
        @click="linkTime = !linkTime"
        :title="t('blobAvatar.linkXyz')"
      >
        <iconify-icon :icon="linkTime ? 'ph:link-duotone' : 'ph:link-break-duotone'"></iconify-icon>
      </button>
      <button class="dice-btn" @click="randomizeSpeed" :title="t('blobAvatar.randomizeSpeed')">
        <iconify-icon icon="ph:dice-three-duotone"></iconify-icon>
      </button>
    </template>
    <p class="section-desc">{{ t('blobAvatar.animationSpeedDesc') }}</p>
    <div class="slider-group" :class="{ linked: linkTime }">
      <BaseSlider :label="t('blobAvatar.axisX')" :min="0.1" :max="10" :step="0.1" v-model="animation.time.x" />
      <BaseSlider v-if="!linkTime" :label="t('blobAvatar.axisY')" :min="0.1" :max="10" :step="0.1" v-model="animation.time.y" />
      <BaseSlider v-if="!linkTime" :label="t('blobAvatar.axisZ')" :min="0.1" :max="10" :step="0.1" v-model="animation.time.z" />
    </div>
  </PanelSection>

  <!-- ==================== AUTO ROTATION ==================== -->
  <PanelSection :title="t('blobAvatar.autoRotation')" icon="ph:arrows-clockwise-duotone" collapsible>
    <template #actions>
      <button 
        class="link-btn" 
        :class="{ active: linkRotation }" 
        @click="linkRotation = !linkRotation"
        :title="t('blobAvatar.linkXyz')"
      >
        <iconify-icon :icon="linkRotation ? 'ph:link-duotone' : 'ph:link-break-duotone'"></iconify-icon>
      </button>
      <button class="dice-btn" @click="randomizeRotation" :title="t('blobAvatar.randomizeRotation')">
        <iconify-icon icon="ph:dice-three-duotone"></iconify-icon>
      </button>
    </template>
    <p class="section-desc">{{ t('blobAvatar.autoRotationDesc') }}</p>
    <div class="slider-group" :class="{ linked: linkRotation }">
      <BaseSlider :label="t('blobAvatar.axisX')" :min="0" :max="0.02" :step="0.001" v-model="animation.rotation.x" />
      <BaseSlider v-if="!linkRotation" :label="t('blobAvatar.axisY')" :min="0" :max="0.02" :step="0.001" v-model="animation.rotation.y" />
      <BaseSlider v-if="!linkRotation" :label="t('blobAvatar.axisZ')" :min="0" :max="0.02" :step="0.001" v-model="animation.rotation.z" />
    </div>
  </PanelSection>

  <!-- ==================== IDLE BREATHING ==================== -->
  <PanelSection :title="t('blobAvatar.idleBreathing')" icon="ph:wind-duotone" collapsible>
    <template #actions>
      <button class="dice-btn" @click="randomizeBreathing" :title="t('blobAvatar.randomizeBreathing')">
        <iconify-icon icon="ph:dice-three-duotone"></iconify-icon>
      </button>
    </template>
    <p class="section-desc">{{ t('blobAvatar.idleBreathingDesc') }}</p>
    <BaseSlider 
      :label="t('blobAvatar.idleIntensity')" 
      :min="0" :max="0.2" :step="0.005" 
      v-model="animation.breathing"
    />
  </PanelSection>

  <!-- ==================== CLICK ACTIONS ==================== -->
  <PanelSection :title="t('blobAvatar.clickActions')" icon="ph:hand-tap-duotone" collapsible>
    <p class="section-desc">{{ t('blobAvatar.clickActionsDesc') }}</p>
    <div class="interaction-row">
      <div class="interaction-header">
        <iconify-icon icon="ph:hand-tap-duotone"></iconify-icon>
        <span>{{ t('blobAvatar.singleClick') }}</span>
        <BaseToggle v-model="clickEvents.click.enabled" size="sm" />
      </div>
      <div class="interaction-config" v-if="clickEvents.click.enabled">
        <BaseSelect :label="t('blobAvatar.action')" v-model="clickEvents.click.action" :options="localizedActionOptions" />
        <button class="test-btn" @click="testAction(clickEvents.click.action)" :title="t('blobAvatar.test')">
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
        <BaseSelect :label="t('blobAvatar.action')" v-model="clickEvents.doubleClick.action" :options="localizedActionOptions" />
        <button class="test-btn" @click="testAction(clickEvents.doubleClick.action)" :title="t('blobAvatar.test')">
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
        <BaseSelect :label="t('blobAvatar.action')" v-model="clickEvents.rightClick.action" :options="localizedActionOptions" />
        <button class="test-btn" @click="testAction(clickEvents.rightClick.action)" :title="t('blobAvatar.test')">
          <iconify-icon icon="ph:play-fill"></iconify-icon>
        </button>
      </div>
    </div>

    <div class="interaction-row">
      <div class="interaction-header">
        <iconify-icon icon="ph:mouse-duotone"></iconify-icon>
        <span>{{ t('blobAvatar.doubleRightClick') }}</span>
        <BaseToggle v-model="clickEvents.doubleRightClick.enabled" size="sm" />
      </div>
      <div class="interaction-config" v-if="clickEvents.doubleRightClick.enabled">
        <BaseSelect :label="t('blobAvatar.action')" v-model="clickEvents.doubleRightClick.action" :options="localizedActionOptions" />
        <button class="test-btn" @click="testAction(clickEvents.doubleRightClick.action)" :title="t('blobAvatar.test')">
          <iconify-icon icon="ph:play-fill"></iconify-icon>
        </button>
      </div>
    </div>
  </PanelSection>

  <!-- ==================== HOVER EFFECTS ==================== -->
  <PanelSection :title="t('blobAvatar.hoverEffects')" icon="ph:cursor-duotone" collapsible>
    <p class="section-desc">{{ t('blobAvatar.hoverEffectsDesc') }}</p>
    <div class="interaction-row">
      <div class="interaction-header">
        <iconify-icon icon="ph:cursor-duotone"></iconify-icon>
        <span>{{ t('blobAvatar.enableHover') }}</span>
        <BaseToggle v-model="cursorTouch.hover.enabled" size="sm" />
      </div>
      <div class="interaction-config" v-if="cursorTouch.hover.enabled">
        <BaseToggle :label="t('blobAvatar.highlight')" v-model="cursorTouch.hover.highlightOnHover" />
        <BaseSelect :label="t('blobAvatar.cursor')" v-model="cursorTouch.hover.cursorStyle" :options="localizedCursorOptions" />
      </div>
    </div>
  </PanelSection>

  <!-- ==================== DRAG INTERACTION ==================== -->
  <PanelSection :title="t('blobAvatar.dragInteraction')" icon="ph:hand-grabbing-duotone" collapsible>
    <p class="section-desc">{{ t('blobAvatar.dragInteractionDesc') }}</p>
    <div class="interaction-row">
      <div class="interaction-header">
        <iconify-icon icon="ph:hand-grabbing-duotone"></iconify-icon>
        <span>{{ t('blobAvatar.enableDrag') }}</span>
        <BaseToggle v-model="cursorTouch.drag.enabled" size="sm" />
      </div>
      <div class="interaction-config" v-if="cursorTouch.drag.enabled">
        <BaseSlider :label="t('blobAvatar.sensitivity')" :min="0.1" :max="3" :step="0.1" v-model="cursorTouch.drag.sensitivity" />
      </div>
    </div>
  </PanelSection>

  <!-- ==================== TOUCH PHYSICS ==================== -->
  <PanelSection :title="t('blobAvatar.touchPhysics')" icon="ph:hand-pointing-duotone" collapsible>
    <template #actions>
      <button class="dice-btn" @click="randomizeTouch" :title="t('blobAvatar.randomizeTouch')">
        <iconify-icon icon="ph:dice-three-duotone"></iconify-icon>
      </button>
    </template>
    <p class="section-desc">{{ t('blobAvatar.touchPhysicsDesc') }}</p>
    <div class="slider-group">
      <BaseSlider :label="t('blobAvatar.strength')" :min="0.1" :max="3" :step="0.1" v-model="cursorTouch.touch.strength" />
      <BaseSlider :label="t('blobAvatar.durationMs')" :min="100" :max="3000" :step="100" v-model="cursorTouch.touch.duration" />
      <BaseSlider :label="t('blobAvatar.maxPoints')" :min="1" :max="20" :step="1" v-model="cursorTouch.touch.maxPoints" />
    </div>
  </PanelSection>

  <!-- ==================== CURSOR FOLLOW ==================== -->
  <PanelSection :title="t('blobAvatar.cursorFollow')" icon="ph:cursor-click-duotone" collapsible>
    <template #actions>
      <button class="dice-btn" @click="randomizeCursorFollow" :title="t('blobAvatar.randomizeCursorFollow')">
        <iconify-icon icon="ph:dice-three-duotone"></iconify-icon>
      </button>
    </template>
    <p class="section-desc">{{ t('blobAvatar.cursorFollowDesc') }}</p>
    <div class="interaction-row">
      <div class="interaction-header">
        <iconify-icon icon="ph:cursor-click-duotone"></iconify-icon>
        <span>{{ t('blobAvatar.enableCursorFollow') }}</span>
        <BaseToggle v-model="cursorTouch.cursorFollow.enabled" size="sm" />
      </div>
    </div>
    <div class="slider-group" v-if="cursorTouch.cursorFollow.enabled">
      <BaseSlider :label="t('blobAvatar.cursorFollowSensitivity')" :min="0.1" :max="2.5" :step="0.05" v-model="cursorTouch.cursorFollow.sensitivity" />
    </div>
  </PanelSection>

</template>

<style scoped>
@import '@/styles/avatar-settings.css';

.skin-filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.skin-filter-btn {
  border: 1px solid var(--glass-border);
  background: var(--surface-1);
  color: var(--text-secondary);
  border-radius: 999px;
  font-size: 10px;
  padding: 4px 8px;
  cursor: pointer;
}

.skin-filter-btn.active {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
  background: var(--accent-glow);
}

.skin-current {
  font-size: 10px;
  color: var(--text-muted);
  margin: 0 0 8px 0;
}

.skin-selector-grid .skin-option {
  min-width: 0;
}

.skin-selector-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.skin-selector-grid .skin-option {
  width: 100%;
  flex: unset;
}

</style>
