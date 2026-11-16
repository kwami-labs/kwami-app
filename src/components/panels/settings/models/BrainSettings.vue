<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { useVoiceStore } from '@/stores/voice';
import PanelSection from '@/components/ui/PanelSection.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import BaseToggle from '@/components/ui/BaseToggle.vue';
import BrainModelCard from './BrainModelCard.vue';
import ClaudeAccountCard from './ClaudeAccountCard.vue';
import MindDirector from './MindDirector.vue';
import ModelConnections from './ModelConnections.vue';
import VoiceKeyConnections from './VoiceKeyConnections.vue';
import {
  BRAIN_PROVIDERS,
  MODEL_SUGGESTIONS,
  PROVIDER_ICONS,
  PROVIDER_KEY_NAME,
  PROVIDER_ROLES,
  defaultBrainModels,
  rosterModel,
  type BrainConfig,
  type BrainModel,
  type BrainProvider,
  type BrainRole,
} from '@/lib/brain';

/**
 * The brain's roster and rules. Bound to the store; `useBrainSync` sends every
 * change to a running agent, so nothing here talks to the agent directly.
 */
const { t } = useI18n();
const voiceStore = useVoiceStore();
const { brain, brainStatus } = storeToRefs(voiceStore);

function patch(changes: Partial<BrainConfig>) {
  brain.value = { ...brain.value, ...changes };
}
function patchModel(id: string, changes: Partial<BrainModel>) {
  patch({ models: brain.value.models.map((m) => (m.id === id ? { ...m, ...changes } : m)) });
}
function patchExecutor(changes: Partial<BrainConfig['executor']>) {
  patch({ executor: { ...brain.value.executor, ...changes } });
}
function removeModel(id: string) {
  patch({ models: brain.value.models.filter((m) => m.id !== id) });
}
function moveUp(id: string) {
  const list = [...brain.value.models];
  const i = list.findIndex((m) => m.id === id);
  if (i <= 0) return;
  [list[i - 1], list[i]] = [list[i], list[i - 1]];
  patch({ models: list });
}
function resetRoster() {
  patch({ models: defaultBrainModels() });
}

const providerLabel = (p: BrainProvider) => t(`brainPanel.providers.${p}`);
const roleLabel = (r: BrainRole) => t(`brainPanel.roles.${r}`);

/** false only when the agent has said so; unknown is not "missing". */
function hasKey(provider: BrainProvider): boolean {
  return brainStatus.value?.providers?.[provider] !== false;
}

const draftRoles = computed(() =>
  PROVIDER_ROLES[draft.value.provider].map((r) => ({ value: r, label: roleLabel(r) })),
);
const providerOptions = computed(() =>
  BRAIN_PROVIDERS.map((p) => ({ value: p, label: providerLabel(p), icon: PROVIDER_ICONS[p] })),
);

// -- add a model ---------------------------------------------------------------

const adding = ref(false);
const draft = ref({
  provider: 'openai' as BrainProvider,
  model: '',
  label: '',
  role: 'expert' as BrainRole,
});
const addError = ref('');
const suggestions = computed(() => MODEL_SUGGESTIONS[draft.value.provider]);

function changeDraftProvider(provider: BrainProvider) {
  const allowed = PROVIDER_ROLES[provider];
  const role = allowed.includes(draft.value.role) ? draft.value.role : allowed[0];
  draft.value = { provider, model: '', label: '', role };
}
function useSuggestion(s: { model: string; label: string }) {
  draft.value = { ...draft.value, model: s.model, label: s.label };
}
/** "Add a model" opened on a provider just connected, with its first suggestion filled in. */
function addFromProvider(provider: BrainProvider) {
  const first = MODEL_SUGGESTIONS[provider][0];
  draft.value = {
    provider,
    model: first?.model ?? '',
    label: first?.label ?? '',
    role: PROVIDER_ROLES[provider][0],
  };
  addError.value = '';
  adding.value = true;
}
function addModel() {
  const model = draft.value.model.trim();
  if (!model) return;
  const allowed = PROVIDER_ROLES[draft.value.provider];
  const role = allowed.includes(draft.value.role) ? draft.value.role : allowed[0];
  const id = `${draft.value.provider}-${model}`.toLowerCase().replace(/[^a-z0-9.-]+/g, '-');
  if (brain.value.models.some((m) => m.id === id)) {
    addError.value = t('brainPanel.duplicate');
    return;
  }
  patch({
    models: [
      ...brain.value.models,
      rosterModel(id, draft.value.label.trim() || model, draft.value.provider, model, role),
    ],
  });
  adding.value = false;
  addError.value = '';
  draft.value = { provider: 'openai', model: '', label: '', role: 'expert' };
}

// -- rules ---------------------------------------------------------------------

type Option<T extends string> = { id: T; label: string };
const routingOptions = computed<Option<BrainConfig['routing']>[]>(() => [
  { id: 'auto', label: t('brainPanel.routingAuto') },
  { id: 'manual', label: t('brainPanel.routingManual') },
]);
const councilOptions = computed<Option<BrainConfig['council']>[]>(() => [
  { id: 'important', label: t('brainPanel.councilImportant') },
  { id: 'on_request', label: t('brainPanel.councilOnRequest') },
  { id: 'research', label: t('brainPanel.councilResearch') },
]);
const searchOptions = computed<Option<BrainConfig['search']>[]>(() => [
  { id: 'native', label: t('brainPanel.searchNative') },
  { id: 'tavily', label: t('brainPanel.searchTavily') },
  { id: 'both', label: t('brainPanel.searchBoth') },
]);
const deliveryOptions = computed<Option<BrainConfig['delivery']>[]>(() => [
  { id: 'next_pause', label: t('brainPanel.deliveryPause') },
  { id: 'interrupt', label: t('brainPanel.deliveryInterrupt') },
  { id: 'on_request', label: t('brainPanel.deliveryRequest') },
]);
const hangupOptions = computed<Option<BrainConfig['onHangup']>[]>(() => [
  { id: 'finish', label: t('brainPanel.hangupFinish') },
  { id: 'cancel', label: t('brainPanel.hangupCancel') },
]);
const budgetOptions = computed<Option<BrainConfig['budgetPolicy']>[]>(() => [
  { id: 'inform', label: t('brainPanel.budgetInform') },
  { id: 'downgrade', label: t('brainPanel.budgetDowngrade') },
  { id: 'stop', label: t('brainPanel.budgetStop') },
]);
const permOptions = computed<Option<BrainConfig['executor']['permissions']>[]>(() => [
  { id: 'full_no_push', label: t('brainPanel.permFull') },
  { id: 'edit_only', label: t('brainPanel.permEdit') },
  { id: 'read_only', label: t('brainPanel.permRead') },
]);
const defaultModelOptions = computed(() =>
  brain.value.models
    .filter((m) => m.provider !== 'local')
    .map((m) => ({ value: m.id, label: m.label || m.model })),
);

const budget = computed({
  get: () => brain.value.monthlyBudgetUsd,
  set: (v: string | number) => patch({ monthlyBudgetUsd: Math.max(0, Number(v) || 0) }),
});
const maxTaskUsd = computed({
  get: () => brain.value.executor.maxTaskUsd,
  set: (v: string | number) => patchExecutor({ maxTaskUsd: Math.max(0.05, Number(v) || 0.05) }),
});
const folder = computed({
  get: () => brain.value.executor.folder,
  set: (v: string | number) => patchExecutor({ folder: String(v) }),
});

const spend = computed(() => brainStatus.value?.spend ?? null);
const spendPct = computed(() => {
  const s = spend.value;
  const cap = brain.value.monthlyBudgetUsd;
  return s && cap > 0 ? Math.min(100, (s.usd / cap) * 100) : 0;
});
const tasks = computed(() => [...(brainStatus.value?.tasks ?? [])].reverse());
const taskStatusLabel = (s: string) =>
  t(`brainPanel.task${s.charAt(0).toUpperCase()}${s.slice(1)}`);
</script>

<template>
  <div class="brain">
    <BaseToggle
      :model-value="brain.enabled"
      :label="t('brainPanel.enabled')"
      @update:model-value="patch({ enabled: $event })"
    />
    <p class="hint">{{ t('brainPanel.brainHint') }}</p>
    <p v-if="!brainStatus" class="hint warn">
      <iconify-icon icon="ph:plug-duotone" /> {{ t('brainPanel.statusUnknown') }}
    </p>

    <ClaudeAccountCard />
    <MindDirector />
    <ModelConnections @add="addFromProvider" />
    <VoiceKeyConnections />

    <!-- Roster -->
    <ul class="roster">
      <BrainModelCard
        v-for="(m, i) in brain.models"
        :key="m.id"
        :model="m"
        :first="i === 0"
        @change="patchModel(m.id, $event)"
        @move-up="moveUp(m.id)"
        @remove="removeModel(m.id)"
      />
    </ul>

    <!-- Add -->
    <div v-if="adding" class="add-form">
      <span class="option-label">{{ t('brainPanel.addTitle') }}</span>
      <BaseSelect
        :model-value="draft.provider"
        :options="providerOptions"
        :label="t('brainPanel.provider')"
        block
        @update:model-value="changeDraftProvider($event as BrainProvider)"
      />
      <div class="chips">
        <button
          v-for="s in suggestions"
          :key="s.model"
          class="chip"
          :class="{ active: draft.model === s.model }"
          @click="useSuggestion(s)"
        >
          {{ s.label }}
        </button>
      </div>
      <BaseInput
        v-model="draft.model"
        :label="t('brainPanel.modelId')"
        mono
        placeholder="gpt-5.2"
      />
      <BaseInput v-model="draft.label" :label="t('brainPanel.label')" placeholder="GPT-5.2" />
      <BaseSelect
        v-if="draftRoles.length > 1"
        :model-value="draft.role"
        :options="draftRoles"
        :label="t('brainPanel.role')"
        block
        @update:model-value="draft = { ...draft, role: $event as BrainRole }"
      />
      <p v-if="!hasKey(draft.provider)" class="hint warn">
        {{ t('brainPanel.noKeyHint', { key: PROVIDER_KEY_NAME[draft.provider] }) }}
      </p>
      <p v-if="addError" class="hint warn">{{ addError }}</p>
      <div class="row">
        <BaseButton size="sm" variant="secondary" @click="adding = false">{{
          t('brainPanel.cancel')
        }}</BaseButton>
        <BaseButton
          size="sm"
          icon="ph:plus-bold"
          :disabled="!draft.model.trim()"
          @click="addModel"
          >{{ t('brainPanel.add') }}</BaseButton
        >
      </div>
    </div>
    <div v-else class="row">
      <BaseButton size="sm" icon="ph:plus-bold" @click="adding = true">{{
        t('brainPanel.addModel')
      }}</BaseButton>
      <BaseButton
        size="sm"
        variant="secondary"
        icon="ph:arrow-counter-clockwise"
        @click="resetRoster"
        >{{ t('brainPanel.resetDefaults') }}</BaseButton
      >
    </div>

    <!-- Rules -->
    <PanelSection :title="t('brainPanel.rules')" icon="ph:sliders-horizontal-duotone" collapsible>
      <BaseToggle
        :model-value="brain.splitTasks"
        :label="t('brainPanel.splitTasks')"
        size="sm"
        @update:model-value="patch({ splitTasks: $event })"
      />
      <p class="hint small" style="margin: 0 0 8px">{{ t('brainPanel.splitTasksHint') }}</p>
      <div class="option-group">
        <span class="option-label">{{ t('brainPanel.routing') }}</span>
        <div class="toggle-group">
          <button
            v-for="o in routingOptions"
            :key="o.id"
            class="toggle-btn"
            :class="{ active: brain.routing === o.id }"
            @click="patch({ routing: o.id })"
          >
            {{ o.label }}
          </button>
        </div>
        <BaseSelect
          v-if="brain.routing === 'manual'"
          :model-value="brain.defaultModel"
          :options="defaultModelOptions"
          :label="t('brainPanel.defaultModel')"
          block
          style="margin-top: 8px"
          @update:model-value="patch({ defaultModel: String($event) })"
        />
      </div>

      <div class="option-group">
        <span class="option-label">{{ t('brainPanel.councilWhen') }}</span>
        <div class="toggle-group">
          <button
            v-for="o in councilOptions"
            :key="o.id"
            class="toggle-btn"
            :class="{ active: brain.council === o.id }"
            @click="patch({ council: o.id })"
          >
            {{ o.label }}
          </button>
        </div>
      </div>

      <div class="option-group">
        <span class="option-label"
          >{{ t('brainPanel.search') }}
          <span v-if="brainStatus && !brainStatus.tavily" class="badge nokey-badge">{{
            t('brainPanel.tavilyOff')
          }}</span></span
        >
        <div class="toggle-group">
          <button
            v-for="o in searchOptions"
            :key="o.id"
            class="toggle-btn"
            :class="{ active: brain.search === o.id }"
            @click="patch({ search: o.id })"
          >
            {{ o.label }}
          </button>
        </div>
        <p class="hint small">{{ t('brainPanel.searchHint') }}</p>
      </div>

      <div class="option-group">
        <span class="option-label">{{ t('brainPanel.delivery') }}</span>
        <div class="toggle-group">
          <button
            v-for="o in deliveryOptions"
            :key="o.id"
            class="toggle-btn"
            :class="{ active: brain.delivery === o.id }"
            @click="patch({ delivery: o.id })"
          >
            {{ o.label }}
          </button>
        </div>
      </div>

      <div class="option-group">
        <span class="option-label">{{ t('brainPanel.onHangup') }}</span>
        <div class="toggle-group">
          <button
            v-for="o in hangupOptions"
            :key="o.id"
            class="toggle-btn"
            :class="{ active: brain.onHangup === o.id }"
            @click="patch({ onHangup: o.id })"
          >
            {{ o.label }}
          </button>
        </div>
      </div>

      <div class="option-group">
        <BaseInput
          v-model="budget"
          type="number"
          :label="t('brainPanel.budget')"
          icon="ph:currency-dollar"
        />
        <span class="option-label" style="margin-top: 8px">{{ t('brainPanel.budgetPolicy') }}</span>
        <div class="toggle-group">
          <button
            v-for="o in budgetOptions"
            :key="o.id"
            class="toggle-btn"
            :class="{ active: brain.budgetPolicy === o.id }"
            @click="patch({ budgetPolicy: o.id })"
          >
            {{ o.label }}
          </button>
        </div>
        <div v-if="spend" class="spend">
          <div class="spend-head">
            <span>{{ t('brainPanel.spend', { month: spend.month }) }}</span>
            <strong>{{ spend.usd.toFixed(2) }} $ / {{ brain.monthlyBudgetUsd }} $</strong>
          </div>
          <div class="bar"><div class="bar-fill" :style="{ width: spendPct + '%' }" /></div>
          <span class="hint small">{{ t('brainPanel.spendApprox') }}</span>
        </div>
      </div>
    </PanelSection>

    <!-- Executor -->
    <PanelSection
      :title="t('brainPanel.executor')"
      icon="ph:terminal-window-duotone"
      collapsible
      defaultCollapsed
    >
      <p class="hint">{{ t('brainPanel.executorHint') }}</p>
      <BaseInput v-model="folder" :label="t('brainPanel.folder')" icon="ph:folder-duotone" mono />
      <span class="option-label" style="margin-top: 8px">{{ t('brainPanel.permissions') }}</span>
      <div class="toggle-group">
        <button
          v-for="o in permOptions"
          :key="o.id"
          class="toggle-btn"
          :class="{ active: brain.executor.permissions === o.id }"
          @click="patchExecutor({ permissions: o.id })"
        >
          {{ o.label }}
        </button>
      </div>
      <p v-if="brain.executor.permissions === 'full_no_push'" class="hint small">
        {{ t('brainPanel.permFullHint') }}
      </p>
      <BaseInput
        v-model="maxTaskUsd"
        type="number"
        :label="t('brainPanel.maxTaskUsd')"
        icon="ph:currency-dollar"
      />
    </PanelSection>

    <!-- Tasks -->
    <PanelSection
      :title="t('brainPanel.tasks')"
      icon="ph:list-checks-duotone"
      collapsible
      defaultCollapsed
    >
      <p v-if="!tasks.length" class="hint">{{ t('brainPanel.noTasks') }}</p>
      <ul v-else class="tasks">
        <li v-for="task in tasks" :key="task.id" class="task" :class="task.status">
          <div class="task-head">
            <span class="task-title">{{ task.title }}</span>
            <span v-if="task.viaAccount" class="badge account-badge">{{
              t('brainPanel.onAccount')
            }}</span>
            <span class="badge">{{ taskStatusLabel(task.status) }}</span>
          </div>
          <span class="task-meta"
            >{{ task.models.join(' · ')
            }}<template v-if="task.council"> · {{ t('brainPanel.council') }}</template> ·
            {{ task.costUsd.toFixed(3) }} $</span
          >
          <span v-if="task.briefed?.length" class="task-briefed" data-testid="task-briefed">
            <iconify-icon icon="ph:check-circle-duotone"></iconify-icon>
            {{ t('brainPanel.briefed', { models: task.briefed.join(' · ') }) }}
          </span>
          <ol v-if="task.steps?.length" class="task-steps">
            <li v-for="(step, si) in task.steps" :key="si" :class="{ failed: !step.ok }">
              <span class="step-model">{{ step.model }}</span> · {{ step.goal }}
            </li>
          </ol>
          <p v-if="task.result" class="task-result">{{ task.result }}</p>
        </li>
      </ul>
    </PanelSection>
  </div>
</template>

<style scoped>
.brain {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.hint {
  font-size: 11px;
  color: var(--text-tertiary);
  margin: 0;
  line-height: 1.4;
}
.hint.small {
  font-size: 10px;
  margin-top: 6px;
}
.hint.warn {
  color: #fbbf24;
  display: flex;
  gap: 6px;
  align-items: center;
}
.roster {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.task-briefed {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--text-muted);
}
.task-briefed iconify-icon {
  color: #4ade80;
}
.account-badge {
  background: rgba(74, 222, 128, 0.15);
  color: #4ade80;
}
.nokey-badge {
  background: rgba(251, 191, 36, 0.15);
  color: #fbbf24;
}
.badge {
  font-size: 9px;
  padding: 2px 6px;
  border-radius: 999px;
  background: var(--surface-2);
  color: var(--text-secondary);
  white-space: nowrap;
}
.add-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--accent-primary);
  background: var(--surface-1);
}
.row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.option-group {
  margin: 6px 0 10px;
}
.option-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
  margin-bottom: 8px;
}
.toggle-group {
  display: flex;
  background: var(--surface-2);
  padding: 2px;
  border-radius: 8px;
  flex: 1;
  min-width: 0;
}
.toggle-btn {
  flex: 1;
  padding: 6px 6px;
  background: transparent;
  border: none;
  font-size: 11px;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
  white-space: nowrap;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.toggle-btn.active {
  background: var(--accent-primary);
  color: white;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip {
  padding: 4px 9px;
  border-radius: 999px;
  border: 1px solid var(--glass-border);
  background: var(--surface-1);
  color: var(--text-secondary);
  font-size: 11px;
  cursor: pointer;
}
.chip.active {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: white;
}
.spend {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.spend-head {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-secondary);
}
.bar {
  height: 6px;
  border-radius: 999px;
  background: var(--surface-2);
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  background: var(--accent-primary);
}
.tasks {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.task {
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--surface-1);
  border-left: 3px solid var(--surface-2);
}
.task.running {
  border-left-color: var(--accent-primary);
}
.task.done {
  border-left-color: #4ade80;
}
.task.failed {
  border-left-color: #f87171;
}
.task-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.task-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}
.task-meta {
  font-size: 10px;
  color: var(--text-tertiary);
}
.task-steps {
  margin: 6px 0 0;
  padding-left: 16px;
  font-size: 10px;
  color: var(--text-tertiary);
}
.task-steps li.failed {
  color: #f87171;
}
.step-model {
  color: var(--text-secondary);
  font-weight: 600;
}
.task-result {
  margin: 6px 0 0;
  font-size: 11px;
  color: var(--text-secondary);
  white-space: pre-wrap;
  max-height: 140px;
  overflow: auto;
}
</style>
