<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import BaseToggle from '@/components/ui/BaseToggle.vue';
import { api, ApiError } from '@/lib/apiClient';
import {
  AGENT_NAME,
  brainCloud,
  type BrainAgent,
  type BrainAgentFields,
  type BrainEffort,
  type BrainTarget,
} from '@/lib/brainCloud';
import { useWorkspaceStore } from '@/stores/workspace';

/**
 * The user's agents: specialists the brain hands work to by name, run from here or
 * every day at a time. The server keeps them (`/brain/agents`) and limits their
 * models and tools to the executor's own, whatever is sent from here.
 */
const { t } = useI18n();
const workspaceStore = useWorkspaceStore();

const agents = ref<BrainAgent[]>([]);
const models = ref<string[]>([]);
const tools = ref<string[]>([]);
const unavailable = ref(false);
const editing = ref<string | null>(null);
const draft = ref<BrainAgentFields>(blank());
const runTask = ref<Record<string, string>>({});
const scheduleAt = ref<Record<string, string>>({});
const message = ref('');
const saving = ref(false);

function blank(): BrainAgentFields {
  return {
    name: '',
    description: '',
    prompt: '',
    model: 'claude-sonnet-5-5',
    tools: ['Read', 'Glob', 'Grep'],
    effort: 'medium',
    target: 'auto',
    enabled: true,
  };
}

const modelOptions = computed(() => models.value.map((m) => ({ value: m, label: m })));
const effortOptions = computed(() =>
  (['low', 'medium', 'high'] as BrainEffort[]).map((value) => ({
    value,
    label: t(`brainAgents.effortLevel.${value}`),
  })),
);
const targetOptions = computed(() =>
  (['auto', 'pc', 'cloud'] as BrainTarget[]).map((value) => ({
    value,
    label: t(`brainCloud.target.${value}`),
  })),
);

async function load() {
  try {
    const listed = await brainCloud.agents();
    agents.value = listed.agents;
    models.value = listed.models;
    tools.value = listed.tools;
  } catch (e) {
    if (ApiError.is(e) && (e.status === 404 || e.status === 503)) unavailable.value = true;
  }
}

function startNew() {
  editing.value = 'new';
  draft.value = blank();
  message.value = '';
}

function startEdit(agent: BrainAgent) {
  editing.value = agent.id;
  const { id: _id, ...fields } = agent;
  draft.value = { ...fields, tools: [...fields.tools] };
  message.value = '';
}

function toggleTool(tool: string) {
  const chosen = draft.value.tools;
  draft.value.tools = chosen.includes(tool) ? chosen.filter((x) => x !== tool) : [...chosen, tool];
}

async function save() {
  if (!AGENT_NAME.test(draft.value.name.trim())) {
    message.value = t('brainAgents.badName');
    return;
  }
  saving.value = true;
  try {
    const fields = { ...draft.value, name: draft.value.name.trim() };
    if (editing.value === 'new') await brainCloud.createAgent(fields);
    else if (editing.value) await brainCloud.updateAgent(editing.value, fields);
    editing.value = null;
    message.value = '';
  } catch (e) {
    message.value =
      ApiError.is(e) && typeof e.body === 'object' && e.body && 'detail' in e.body
        ? String((e.body as { detail: unknown }).detail)
        : t('brainAgents.failed');
  } finally {
    saving.value = false;
  }
  await load();
}

async function remove(agent: BrainAgent) {
  try {
    await brainCloud.deleteAgent(agent.id);
  } catch {
    message.value = t('brainAgents.failed');
  }
  if (editing.value === agent.id) editing.value = null;
  await load();
}

async function run(agent: BrainAgent) {
  const kwamiId = workspaceStore.activeWorkspaceId;
  if (!kwamiId) return;
  try {
    await brainCloud.runAgent(agent.id, kwamiId, runTask.value[agent.id] ?? '');
    runTask.value[agent.id] = '';
    message.value = t('brainAgents.ran', { name: agent.name });
  } catch (e) {
    message.value =
      ApiError.is(e) && e.status === 429 ? t('brainCloud.tooMany') : t('brainCloud.failed');
  }
}

async function schedule(agent: BrainAgent) {
  const kwamiId = workspaceStore.activeWorkspaceId;
  const time = scheduleAt.value[agent.id] || '08:00';
  if (!kwamiId) return;
  try {
    await api.post('/assistant/tasks', {
      kwami_id: kwamiId,
      kind: 'work',
      title: agent.name,
      recurrence: 'daily',
      local_time: time,
      agent_id: agent.id,
      target: agent.target,
    });
    message.value = t('brainAgents.scheduled', { time });
  } catch {
    message.value = t('brainAgents.failed');
  }
}

onMounted(() => void load());
</script>

<template>
  <div class="agents">
    <p v-if="unavailable" class="hint">{{ t('brainAgents.unavailable') }}</p>
    <template v-else>
      <p class="hint">{{ t('brainAgents.hint') }}</p>
      <p v-if="!agents.length && editing !== 'new'" class="hint">{{ t('brainAgents.empty') }}</p>

      <div v-for="agent in agents" :key="agent.id" class="agent" :class="{ off: !agent.enabled }">
        <div class="agent-head">
          <iconify-icon icon="ph:robot-duotone" />
          <div class="agent-text">
            <span class="agent-name">{{ agent.name }}</span>
            <span class="agent-sub">{{ agent.description }}</span>
            <span class="agent-sub mono"
              >{{ agent.model }} · {{ t(`brainCloud.target.${agent.target}`) }}</span
            >
          </div>
        </div>
        <div v-if="agent.enabled" class="agent-run">
          <BaseInput
            :model-value="runTask[agent.id] ?? ''"
            :placeholder="t('brainAgents.runTask')"
            @update:model-value="(v: string | number) => (runTask[agent.id] = String(v))"
          />
          <BaseButton size="sm" variant="primary" @click="run(agent)">
            {{ t('brainAgents.run') }}
          </BaseButton>
        </div>
        <div v-if="agent.enabled" class="agent-run">
          <span class="agent-sub">{{ t('brainAgents.schedule') }}</span>
          <input
            class="time"
            type="time"
            :value="scheduleAt[agent.id] ?? '08:00'"
            @input="scheduleAt[agent.id] = ($event.target as HTMLInputElement).value"
          />
          <BaseButton size="sm" variant="ghost" @click="schedule(agent)">
            {{ t('brainAgents.scheduleSave') }}
          </BaseButton>
        </div>
        <div class="agent-actions">
          <BaseButton size="sm" variant="ghost" @click="startEdit(agent)">
            {{ t('brainAgents.edit') }}
          </BaseButton>
          <BaseButton size="sm" variant="danger" @click="remove(agent)">
            {{ t('brainAgents.remove') }}
          </BaseButton>
        </div>
      </div>

      <div v-if="editing" class="editor">
        <BaseInput
          v-model="draft.name"
          :label="t('brainAgents.name')"
          :placeholder="t('brainAgents.nameHint')"
          mono
        />
        <BaseInput v-model="draft.description" :label="t('brainAgents.description')" />
        <label class="field">
          <span class="field-label">{{ t('brainAgents.prompt') }}</span>
          <textarea v-model="draft.prompt" class="prompt" rows="4" maxlength="8000" />
        </label>
        <BaseSelect v-model="draft.model" :label="t('brainAgents.model')" :options="modelOptions" />
        <div class="field">
          <span class="field-label">{{ t('brainAgents.tools') }}</span>
          <div class="tools">
            <button
              v-for="tool in tools"
              :key="tool"
              type="button"
              class="tool"
              :class="{ on: draft.tools.includes(tool) }"
              :aria-pressed="draft.tools.includes(tool)"
              @click="toggleTool(tool)"
            >
              {{ tool }}
            </button>
          </div>
        </div>
        <BaseSelect
          v-model="draft.effort"
          :label="t('brainAgents.effort')"
          :options="effortOptions"
        />
        <BaseSelect
          v-model="draft.target"
          :label="t('brainAgents.where')"
          :options="targetOptions"
        />
        <BaseToggle v-model="draft.enabled" size="sm" :label="t('brainAgents.enabled')" />
        <div class="agent-actions">
          <BaseButton size="sm" variant="primary" :loading="saving" @click="save">
            {{ t('brainAgents.save') }}
          </BaseButton>
          <BaseButton size="sm" variant="ghost" @click="editing = null">
            {{ t('brainAgents.cancel') }}
          </BaseButton>
        </div>
      </div>
      <BaseButton v-else size="sm" icon="ph:plus" @click="startNew">
        {{ t('brainAgents.add') }}
      </BaseButton>

      <p v-if="message" class="message" role="status">{{ message }}</p>
    </template>
  </div>
</template>

<style scoped>
.agents {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.hint,
.message {
  font-size: 11px;
  color: var(--text-tertiary);
  margin: 0;
  line-height: 1.4;
}
.message {
  color: var(--text-secondary);
}
.agent,
.editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border-radius: var(--radius-lg);
  background: var(--surface-1);
  border: 1px solid var(--surface-2);
}
.agent.off {
  opacity: 0.6;
}
.agent-head {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  color: var(--accent-primary);
}
.agent-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.agent-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  font-family: var(--font-mono, monospace);
}
.agent-sub {
  font-size: 11px;
  color: var(--text-tertiary);
  overflow-wrap: anywhere;
}
.agent-sub.mono {
  font-family: var(--font-mono, monospace);
  font-size: 10px;
}
.agent-run,
.agent-actions {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}
.agent-run > :first-child {
  flex: 1 1 120px;
  min-width: 0;
}
.time {
  font: inherit;
  font-size: 12px;
  color: var(--text-primary);
  background: var(--surface-2);
  border: 1px solid var(--surface-2);
  border-radius: 8px;
  padding: 3px 6px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.field-label {
  font-size: 11px;
  color: var(--text-secondary);
}
.prompt {
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
  padding: 8px 10px;
  font: inherit;
  font-size: 12px;
  color: var(--text-primary);
  background: var(--surface-2);
  border: 1px solid var(--surface-2);
  border-radius: var(--radius-lg);
}
.tools {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.tool {
  font-size: 10px;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid var(--surface-2);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}
.tool.on {
  background: var(--accent-glow);
  border-color: var(--accent-primary);
  color: var(--text-primary);
}
</style>
