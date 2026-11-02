<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { useVoiceStore } from '@/stores/voice';
import BaseToggle from '@/components/ui/BaseToggle.vue';
import {
  BRAIN_ACCESS,
  MAX_INSTRUCTIONS,
  PROVIDER_ICONS,
  PROVIDER_KEY_NAME,
  PROVIDER_ROLES,
  modelUsable,
  type BrainAccess,
  type BrainModel,
  type BrainRole,
} from '@/lib/brain';

/**
 * One model of the brain. Switched on, it shows what can be set for that model and
 * nothing else: only the jobs its provider has the tools for, and how to reach it
 * only on Claude, the one provider with an account as well as a key.
 */
const props = defineProps<{ model: BrainModel; first: boolean }>();
const emit = defineEmits<{
  change: [changes: Partial<BrainModel>];
  moveUp: [];
  remove: [];
}>();
const { t } = useI18n();
const { brainStatus } = storeToRefs(useVoiceStore());

/** Read once: emptying the text while writing must not close the box under the cursor. */
const startOpen = !!props.model.instructions;
const jobs = computed(() => PROVIDER_ROLES[props.model.provider]);
const hasAccess = computed(() => props.model.provider === 'anthropic');
const inCouncil = computed(() => props.model.provider !== 'local');
const usable = computed(() => modelUsable(props.model, brainStatus.value));

/** What it is missing, when it is on but cannot run. */
const missing = computed(() => {
  if (!props.model.enabled || usable.value) return '';
  const claude = props.model.provider === 'anthropic' || props.model.provider === 'local';
  return claude && props.model.access === 'account'
    ? t('mind.unavailableAccount')
    : t('mind.unavailableKey', { key: PROVIDER_KEY_NAME[props.model.provider] });
});

function toggleJob(job: BrainRole) {
  const current = props.model.roles;
  const roles = current.includes(job) ? current.filter((r) => r !== job) : [...current, job];
  // A model with no job would only take up room: keep the last one on.
  if (roles.length) emit('change', { roles, role: roles[0] });
}
const accessLabel: Record<BrainAccess, string> = {
  auto: 'mind.accessAuto',
  account: 'mind.accessAccount',
  api: 'mind.accessApi',
};
const accessHint: Record<BrainAccess, string> = {
  auto: 'mind.accessAutoHint',
  account: 'mind.accessAccountHint',
  api: 'mind.accessApiHint',
};
</script>

<template>
  <li class="model" :class="{ disabled: !model.enabled, nokey: missing }">
    <div class="top">
      <iconify-icon :icon="PROVIDER_ICONS[model.provider]" class="provider-icon" />
      <div class="names">
        <span class="label">{{ model.label || model.model }}</span>
        <span class="id">{{ model.model }}</span>
      </div>
      <BaseToggle
        :model-value="model.enabled"
        size="sm"
        @update:model-value="emit('change', { enabled: $event })"
      />
    </div>
    <p v-if="missing" class="missing">{{ missing }}</p>

    <template v-if="model.enabled">
      <div class="group">
        <span class="group-label">{{ t('mind.jobs') }}</span>
        <div class="chips">
          <button
            v-for="job in jobs"
            :key="job"
            class="chip"
            :class="{ active: model.roles.includes(job) }"
            :aria-pressed="model.roles.includes(job)"
            @click="toggleJob(job)"
          >
            {{ t(`brainPanel.roles.${job}`) }}
          </button>
          <button
            v-if="inCouncil"
            class="chip council"
            :class="{ active: model.council }"
            :aria-pressed="model.council"
            @click="emit('change', { council: !model.council })"
          >
            <iconify-icon icon="ph:users-three-duotone" /> {{ t('mind.inCouncil') }}
          </button>
        </div>
      </div>

      <div v-if="hasAccess" class="group">
        <span class="group-label">{{ t('mind.access') }}</span>
        <div class="segments">
          <button
            v-for="a in BRAIN_ACCESS"
            :key="a"
            class="segment"
            :class="{ active: model.access === a }"
            @click="emit('change', { access: a })"
          >
            {{ t(accessLabel[a]) }}
          </button>
        </div>
        <p class="hint">{{ t(accessHint[model.access]) }}</p>
      </div>

      <details class="brief" :open="startOpen">
        <summary>{{ t('mind.modelBrief') }}</summary>
        <textarea
          :value="model.instructions"
          rows="3"
          :maxlength="MAX_INSTRUCTIONS"
          :placeholder="t('mind.briefPlaceholder')"
          @input="emit('change', { instructions: ($event.target as HTMLTextAreaElement).value })"
        />
      </details>

      <div class="actions">
        <button
          class="icon-btn"
          :disabled="first"
          :title="t('brainPanel.moveUp')"
          @click="emit('moveUp')"
        >
          <iconify-icon icon="ph:arrow-up-bold" />
        </button>
        <button class="icon-btn danger" :title="t('brainPanel.remove')" @click="emit('remove')">
          <iconify-icon icon="ph:trash-duotone" />
        </button>
      </div>
    </template>
  </li>
</template>

<style scoped>
.model {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border-radius: var(--radius-lg);
  background: var(--surface-1);
  border: 1px solid var(--surface-2);
}
.model.disabled {
  opacity: 0.55;
}
.model.nokey {
  border-style: dashed;
}
.top {
  display: flex;
  align-items: center;
  gap: 8px;
}
.provider-icon {
  font-size: 15px;
  color: var(--text-secondary);
  flex-shrink: 0;
}
.names {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}
.id {
  font-size: 9px;
  font-family: var(--font-mono, monospace);
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
}
.missing {
  margin: 0;
  font-size: 10px;
  color: #fbbf24;
}
.group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.group-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--text-tertiary);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 9px;
  border-radius: 999px;
  border: 1px solid var(--glass-border);
  background: transparent;
  color: var(--text-secondary);
  font-size: 11px;
  cursor: pointer;
}
.chip.active {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: white;
}
.chip.council.active {
  background: rgba(167, 139, 250, 0.25);
  border-color: rgba(167, 139, 250, 0.7);
  color: #c4b5fd;
}
.segments {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 2px;
  border-radius: 8px;
  background: var(--surface-2);
}
.segment {
  flex: 1 1 auto;
  padding: 5px 6px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
}
.segment.active {
  background: var(--accent-primary);
  color: white;
}
.hint {
  margin: 0;
  font-size: 10px;
  line-height: 1.4;
  color: var(--text-tertiary);
}
.brief summary {
  font-size: 11px;
  color: var(--text-secondary);
  cursor: pointer;
}
.brief textarea {
  width: 100%;
  box-sizing: border-box;
  margin-top: 6px;
  padding: 8px;
  font: inherit;
  font-size: 12px;
  line-height: 1.4;
  resize: vertical;
  color: var(--text-primary);
  background: var(--surface-2);
  border: 1px solid var(--surface-2);
  border-radius: 8px;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: 1px solid var(--surface-2);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}
.icon-btn:disabled {
  opacity: 0.3;
  cursor: default;
}
.icon-btn.danger:hover {
  color: #f87171;
  border-color: rgba(248, 113, 113, 0.5);
}
</style>
