<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { useVoiceStore } from '@/stores/voice';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import { MAX_INSTRUCTIONS, modelUsable } from '@/lib/brain';

/** Who plans the brain's work, and the brief every worker gets. */
const { t } = useI18n();
const { brain, brainStatus } = storeToRefs(useVoiceStore());

const thinkers = computed(() =>
  brain.value.models.filter((m) => m.provider !== 'local' && m.enabled),
);
/** What the agent's router falls back on: the first model doing normal work. */
const automatic = computed(
  () =>
    thinkers.value.find((m) => m.roles.includes('standard') && modelUsable(m, brainStatus.value)) ??
    thinkers.value[0],
);
const options = computed(() => [
  {
    value: '',
    label: t('mind.directorAuto', {
      name: automatic.value?.label ?? t('brainPanel.nobody'),
    }),
  },
  ...thinkers.value.map((m) => ({ value: m.id, label: m.label || m.model })),
]);
/** A director removed or switched off: the agent then uses its own choice, and so do we. */
const director = computed({
  get: () =>
    thinkers.value.some((m) => m.id === brain.value.director) ? brain.value.director : '',
  set: (value: string | number) => {
    brain.value = { ...brain.value, director: String(value) };
  },
});
const brief = computed({
  get: () => brain.value.instructions,
  set: (value: string) => {
    brain.value = { ...brain.value, instructions: value };
  },
});
</script>

<template>
  <section class="director">
    <BaseSelect v-model="director" :options="options" :label="t('mind.directorTitle')" block />
    <p class="hint">{{ t('mind.directorHint') }}</p>
    <label class="label" for="brain-brief">{{ t('mind.brainBrief') }}</label>
    <textarea
      id="brain-brief"
      v-model="brief"
      class="brief"
      rows="3"
      :maxlength="MAX_INSTRUCTIONS"
      :placeholder="t('mind.briefPlaceholder')"
    />
  </section>
</template>

<style scoped>
.director {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.hint {
  margin: 0;
  font-size: 11px;
  line-height: 1.4;
  color: var(--text-tertiary);
}
.label {
  margin-top: 4px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}
.brief {
  width: 100%;
  box-sizing: border-box;
  padding: 8px;
  font: inherit;
  font-size: 12px;
  line-height: 1.4;
  resize: vertical;
  color: var(--text-primary);
  background: var(--surface-1);
  border: 1px solid var(--surface-2);
  border-radius: 8px;
}
</style>
