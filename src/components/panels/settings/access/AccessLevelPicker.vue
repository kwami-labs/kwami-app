<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { SITE_ACCESS_LEVELS, SITE_ACCESS_META, type SiteAccessLevel } from '@/constants/siteAccess';

/**
 * The five levels as one segmented control. Each segment lights in its level's
 * colour, and the bar under it fills up to the chosen level, since each level
 * includes the ones before it.
 */
const props = defineProps<{
  modelValue: SiteAccessLevel;
  compact?: boolean;
  showHint?: boolean;
}>();
const emit = defineEmits<{ (e: 'update:modelValue', level: SiteAccessLevel): void }>();
const { t } = useI18n();

const index = computed(() => SITE_ACCESS_LEVELS.indexOf(props.modelValue));
const color = computed(() => SITE_ACCESS_META[props.modelValue].color);
const fill = computed(() =>
  props.modelValue === 'blocked' ? 0 : (index.value / (SITE_ACCESS_LEVELS.length - 1)) * 100,
);

function onKey(event: KeyboardEvent) {
  const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
  if (!step) return;
  event.preventDefault();
  const next = SITE_ACCESS_LEVELS[index.value + step];
  if (next) emit('update:modelValue', next);
}
</script>

<template>
  <div class="picker" :class="{ compact }" :style="{ '--sel': color }">
    <div class="segments" role="radiogroup" :aria-label="t('siteAccess.legend')" @keydown="onKey">
      <button
        v-for="level in SITE_ACCESS_LEVELS"
        :key="level"
        type="button"
        role="radio"
        class="segment"
        :class="{ on: level === modelValue }"
        :aria-checked="level === modelValue"
        :tabindex="level === modelValue ? 0 : -1"
        :title="t(`siteAccess.levelHints.${level}`)"
        :style="{ '--c': SITE_ACCESS_META[level].color }"
        @click="emit('update:modelValue', level)"
      >
        <iconify-icon :icon="SITE_ACCESS_META[level].icon"></iconify-icon>
        <span v-if="!compact" class="label">{{ t(`siteAccess.levels.${level}`) }}</span>
      </button>
    </div>
    <div class="meter" aria-hidden="true">
      <span class="meter-fill" :style="{ width: `${fill}%` }"></span>
    </div>
    <p v-if="showHint" class="level-hint">
      <strong>{{ t(`siteAccess.levels.${modelValue}`) }}</strong>
      · {{ t(`siteAccess.levelHints.${modelValue}`) }}
    </p>
  </div>
</template>

<style scoped>
.picker {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.segments {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
  padding: 3px;
  border-radius: var(--radius-md);
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
}
.segment {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  min-height: 44px;
  padding: 6px 2px;
  border: 1px solid transparent;
  border-radius: calc(var(--radius-md) - 2px);
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  cursor: pointer;
  transition:
    color var(--duration-fast) var(--ease-out),
    background var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}
.compact .segment {
  min-height: 30px;
  padding: 4px 2px;
}
.segment iconify-icon {
  font-size: 17px;
}
.compact .segment iconify-icon {
  font-size: 15px;
}
.segment .label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.2px;
}
.segment:hover {
  color: var(--c);
  background: color-mix(in srgb, var(--c) 10%, transparent);
}
.segment:focus-visible {
  outline: 2px solid var(--c);
  outline-offset: 1px;
}
.segment.on {
  color: var(--c);
  border-color: color-mix(in srgb, var(--c) 55%, transparent);
  background: color-mix(in srgb, var(--c) 18%, transparent);
  box-shadow:
    0 0 14px color-mix(in srgb, var(--c) 30%, transparent),
    inset 0 0 10px color-mix(in srgb, var(--c) 12%, transparent);
}
@media (hover: hover) {
  .segment:active {
    transform: scale(0.96);
  }
}
.meter {
  height: 3px;
  border-radius: 3px;
  background: var(--surface-2);
  overflow: hidden;
}
.meter-fill {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, #38bdf8, var(--sel));
  box-shadow: 0 0 8px var(--sel);
  transition: width 0.35s var(--ease-out);
}
.level-hint {
  margin: 0;
  font-size: 11px;
  color: var(--text-tertiary);
}
.level-hint strong {
  color: var(--sel);
}
</style>
