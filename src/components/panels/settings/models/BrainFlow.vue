<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { useVoiceStore } from '@/stores/voice';
import { BRAIN_ROLES, modelUsable, type BrainModel, type BrainRole } from '@/lib/brain';

/**
 * "Who does what": the voice, the bridge, and which model each role lands on.
 *
 * Mirrors the agent's router (`brain/router.py`): within a role the first
 * usable model answers and the next one is the fallback; the council is the
 * flagged models, topped up from other providers when fewer than two.
 */
const { t } = useI18n();
const voiceStore = useVoiceStore();
const { brain, brainStatus, realtime, stt, llm, tts, pipelineMode } = storeToRefs(voiceStore);

/** One line per stage: a realtime model is one stage, the standard pipeline three. */
const voiceChain = computed(() =>
  pipelineMode.value === 'realtime'
    ? [`${realtime.value.provider} · ${realtime.value.model} (${realtime.value.voice})`]
    : [
        `STT ${stt.value.provider} · ${stt.value.model}`,
        `LLM ${llm.value.provider} · ${llm.value.model}`,
        `TTS ${tts.value.provider} · ${tts.value.model} (${tts.value.voice})`,
      ],
);

const roleIcons: Record<BrainRole, string> = {
  fast: 'ph:lightning-duotone',
  standard: 'ph:brain-duotone',
  expert: 'ph:graduation-cap-duotone',
  search: 'ph:magnifying-glass-duotone',
  code: 'ph:terminal-window-duotone',
};
const roleKey: Record<BrainRole, string> = {
  fast: 'Fast',
  standard: 'Standard',
  expert: 'Expert',
  search: 'Search',
  code: 'Code',
};

const rows = computed(() =>
  BRAIN_ROLES.map((role) => {
    const inRole = brain.value.models.filter((m) => m.role === role && m.enabled);
    const usable = inRole.filter((m) => modelUsable(m, brainStatus.value));
    return {
      role,
      primary: usable[0] as BrainModel | undefined,
      backups: usable.slice(1),
      blocked: inRole.filter((m) => !usable.includes(m)),
    };
  }),
);

const councilMembers = computed(() => {
  const remote = brain.value.models.filter(
    (m) => m.provider !== 'local' && modelUsable(m, brainStatus.value),
  );
  const members = remote.filter((m) => m.council);
  if (members.length < 2) {
    const order: Record<string, number> = { expert: 0, standard: 1, search: 2, fast: 3 };
    for (const m of [...remote].sort((a, b) => (order[a.role] ?? 9) - (order[b.role] ?? 9))) {
      if (!members.includes(m) && members.every((x) => x.provider !== m.provider)) members.push(m);
      if (members.length >= 3) break;
    }
  }
  return members.slice(0, 5);
});

const councilWhen = computed(() => {
  const map = {
    important: 'brainPanel.councilWhenImportant',
    on_request: 'brainPanel.councilWhenRequest',
    research: 'brainPanel.councilWhenResearch',
  } as const;
  return t(map[brain.value.council]);
});

function name(m: BrainModel) {
  return m.label || m.model;
}
</script>

<template>
  <div class="flow">
    <p class="hint">{{ t('brainPanel.flowHint') }}</p>

    <div class="node voice">
      <iconify-icon icon="ph:microphone-duotone" class="node-icon" />
      <div class="node-body">
        <span class="node-title">{{ t('brainPanel.voice') }}</span>
        <span v-for="line in voiceChain" :key="line" class="node-model">{{ line }}</span>
        <span class="node-sub">{{ t('brainPanel.voiceRole') }}</span>
      </div>
    </div>

    <div class="link" :class="{ off: !brain.enabled }" />

    <div class="node bridge" :class="{ off: !brain.enabled }">
      <iconify-icon icon="ph:git-fork-duotone" class="node-icon" />
      <div class="node-body">
        <span class="node-title">{{ t('brainPanel.bridge') }}</span>
        <span class="node-sub">{{ t('brainPanel.bridgeRole') }}</span>
        <span v-if="brain.splitTasks" class="node-sub planner">
          <iconify-icon icon="ph:tree-structure-duotone" /> {{ t('brainPanel.plannerRole') }}
        </span>
      </div>
    </div>

    <div class="link" :class="{ off: !brain.enabled }" />

    <ul class="roles" :class="{ off: !brain.enabled }">
      <li v-for="row in rows" :key="row.role" class="role-row">
        <iconify-icon :icon="roleIcons[row.role]" class="role-icon" />
        <div class="role-text">
          <span class="role-name">{{ t(`brainPanel.role${roleKey[row.role]}`) }}</span>
          <span class="role-hint">{{ t(`brainPanel.role${roleKey[row.role]}Hint`) }}</span>
        </div>
        <div class="role-models">
          <span v-if="row.primary" class="model-chip primary">{{ name(row.primary) }}</span>
          <span v-for="b in row.backups" :key="b.id" class="model-chip backup">{{ name(b) }}</span>
          <span v-for="b in row.blocked" :key="b.id" class="model-chip blocked">
            {{ name(b) }} · {{ t('brainPanel.noKey') }}
          </span>
          <span v-if="!row.primary && !row.blocked.length" class="model-chip empty">{{
            t('brainPanel.nobody')
          }}</span>
        </div>
      </li>
      <li class="role-row council">
        <iconify-icon icon="ph:users-three-duotone" class="role-icon" />
        <div class="role-text">
          <span class="role-name">{{ t('brainPanel.council') }}</span>
          <span class="role-hint">{{ councilWhen }}</span>
        </div>
        <div class="role-models">
          <span v-for="m in councilMembers" :key="m.id" class="model-chip council-chip">{{
            name(m)
          }}</span>
          <span v-if="councilMembers.length < 2" class="model-chip empty">{{
            t('brainPanel.nobody')
          }}</span>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.flow {
  display: flex;
  flex-direction: column;
}
.hint {
  font-size: 11px;
  color: var(--text-tertiary);
  margin: 0 0 10px;
  line-height: 1.4;
}
.node {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 10px 12px;
  border-radius: var(--radius-lg);
  background: var(--surface-1);
  border: 1px solid var(--surface-2);
}
.node.voice {
  border-color: var(--accent-primary);
}
.node-icon {
  font-size: 18px;
  color: var(--accent-primary);
  margin-top: 1px;
}
.node-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.node-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-primary);
}
.node-model {
  font-size: 11px;
  font-family: var(--font-mono, monospace);
  color: var(--text-secondary);
  word-break: break-all;
}
.node-sub {
  font-size: 11px;
  color: var(--text-tertiary);
  line-height: 1.35;
}
.node-sub.planner {
  display: flex;
  gap: 4px;
  align-items: center;
  color: var(--text-secondary);
}
.link {
  width: 2px;
  height: 12px;
  margin-left: 20px;
  background: var(--accent-primary);
  opacity: 0.6;
}
.off {
  opacity: 0.45;
}
.roles {
  list-style: none;
  margin: 0;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-radius: var(--radius-lg);
  background: var(--surface-1);
  border: 1px solid var(--surface-2);
}
.role-row {
  display: grid;
  grid-template-columns: 18px minmax(0, 0.9fr) minmax(0, 1.4fr);
  gap: 8px;
  align-items: center;
  padding: 6px 8px;
  border-radius: 8px;
}
.role-row.council {
  border-top: 1px dashed var(--surface-2);
  margin-top: 2px;
  padding-top: 8px;
}
.role-icon {
  font-size: 15px;
  color: var(--text-secondary);
}
.role-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.role-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}
.role-hint {
  font-size: 10px;
  color: var(--text-tertiary);
}
.role-models {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: flex-end;
}
.model-chip {
  font-size: 10px;
  padding: 3px 7px;
  border-radius: 999px;
  white-space: nowrap;
  border: 1px solid var(--surface-2);
  color: var(--text-secondary);
}
.model-chip.primary {
  background: var(--accent-glow);
  border-color: var(--accent-primary);
  color: var(--text-primary);
}
.model-chip.backup {
  opacity: 0.8;
}
.model-chip.blocked {
  border-style: dashed;
  color: var(--text-muted);
}
.model-chip.council-chip {
  background: rgba(167, 139, 250, 0.15);
  border-color: rgba(167, 139, 250, 0.5);
  color: var(--text-primary);
}
.model-chip.empty {
  color: var(--text-muted);
  font-style: italic;
}
</style>
