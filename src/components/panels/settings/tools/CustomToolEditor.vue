<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from 'vue-toastification';
import BaseButton from '@/components/ui/BaseButton.vue';
import { getCurrentLocale } from '@/i18n';
import { describeParameters } from '@/lib/toolSchema';
import {
  PARAM_TYPES,
  createWebhookHandler,
  emptyUserTool,
  toParametersSchema,
  urlPlaceholders,
  validateUserTool,
  type ToolIssue,
  type UserToolParam,
  type UserWebhookTool,
} from '@/lib/userTools';
import ToolArgsForm from './ToolArgsForm.vue';
import ToolResultView, { type ToolRunResult } from './ToolResultView.vue';
import {
  TOOL_TEMPLATE_ICONS,
  TOOL_TEMPLATE_IDS,
  buildTemplate,
  type ToolTemplateId,
} from './toolTemplates';

/**
 * Create or edit a webhook tool.
 *
 * Parameters are built as rows rather than typed as JSON, because the JSON
 * route let through shapes the model provider rejects outright (see
 * lib/userTools), and every check runs as you type, before anything reaches
 * the agent.
 */
const props = defineProps<{
  /** The tool being edited, or null to create one. */
  editing: UserWebhookTool | null;
  /** Names already in use: the app's tools and the user's others. */
  takenNames: ReadonlySet<string>;
}>();

const emit = defineEmits<{
  (e: 'save', tool: UserWebhookTool, previousName?: string): void;
  (e: 'cancel'): void;
}>();

const { t } = useI18n();
const toast = useToast();

const draft = ref<UserWebhookTool>(emptyUserTool());
const chosenTemplate = ref<ToolTemplateId | null>(null);
/** Errors show once a field has been left, or after a save attempt. */
const touched = ref(new Set<string>());
const attempted = ref(false);
const openParam = ref<number | null>(null);

// Try it: the same handler the agent would get, on the unsaved draft. Declared
// before load(), which the immediate watch below runs during setup.
const tryArgs = ref<Record<string, unknown>>({});
const tryValid = ref(true);
const running = ref(false);
const run = ref<ToolRunResult | null>(null);

function load(tool: UserWebhookTool | null) {
  draft.value = tool ? (JSON.parse(JSON.stringify(tool)) as UserWebhookTool) : emptyUserTool();
  touched.value = new Set();
  attempted.value = false;
  openParam.value = null;
  run.value = null;
  chosenTemplate.value = null;
}

watch(() => props.editing, load, { immediate: true });

function applyTemplate(id: ToolTemplateId) {
  load(buildTemplate(id, t, getCurrentLocale()));
  chosenTemplate.value = id;
}

const issues = computed(() => validateUserTool(draft.value, props.takenNames, props.editing?.name));

function issuesFor(field: ToolIssue['field']) {
  if (!attempted.value && !touched.value.has(field)) return [];
  return issues.value.filter((issue) => issue.field === field);
}

function touch(field: string) {
  touched.value = new Set(touched.value).add(field);
}

function issueText(issue: ToolIssue) {
  return t(`toolsPanel.issues.${issue.code}`, { subject: issue.subject ?? '' });
}

const placeholders = computed(() => urlPlaceholders(draft.value.url));

function addParam() {
  draft.value.params = [
    ...draft.value.params,
    { name: '', type: 'string', required: false } satisfies UserToolParam,
  ];
  openParam.value = null;
}

function removeParam(index: number) {
  draft.value.params = draft.value.params.filter((_, i) => i !== index);
  if (openParam.value === index) openParam.value = null;
}

function enumText(param: UserToolParam) {
  return (param.enum ?? []).join(', ');
}

function setEnum(param: UserToolParam, text: string) {
  const values = text
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  if (values.length) param.enum = values;
  else delete param.enum;
}

const schema = computed(() => toParametersSchema(draft.value));
const preview = computed(() =>
  JSON.stringify(
    { name: draft.value.name, description: draft.value.description, parameters: schema.value },
    null,
    2,
  ),
);

const testParams = computed(() => describeParameters(schema.value));
const urlUsable = computed(() => !issues.value.some((issue) => issue.field === 'url'));

async function tryIt() {
  if (!urlUsable.value || !tryValid.value) return;
  running.value = true;
  const started = performance.now();
  const out = (await createWebhookHandler(draft.value)(tryArgs.value)) as {
    ok: boolean;
    status?: number;
    data?: unknown;
    error?: string;
  };
  run.value = {
    ok: out.ok,
    status: out.status,
    durationMs: Math.round(performance.now() - started),
    value: out.error ?? out.data,
  };
  running.value = false;
}

function submit() {
  attempted.value = true;
  if (issues.value.length) {
    toast.warning(t('toolsPanel.create.fixFirst'));
    return;
  }
  const tool: UserWebhookTool = {
    ...draft.value,
    name: draft.value.name.trim(),
    description: draft.value.description.trim(),
    url: draft.value.url.trim(),
    params: draft.value.params.map((p) => ({ ...p, name: p.name.trim() })),
  };
  emit('save', tool, props.editing?.name);
}
</script>

<template>
  <div class="editor">
    <p class="intro">{{ t('toolsPanel.create.intro') }}</p>

    <div v-if="!editing" class="templates">
      <span class="section-label">{{ t('toolsPanel.create.templates') }}</span>
      <div class="template-grid">
        <button
          v-for="id in TOOL_TEMPLATE_IDS"
          :key="id"
          type="button"
          class="template"
          :class="{ active: chosenTemplate === id }"
          :aria-pressed="chosenTemplate === id"
          @click="applyTemplate(id)"
        >
          <iconify-icon :icon="TOOL_TEMPLATE_ICONS[id]" class="template-icon"></iconify-icon>
          <span class="template-text">
            <span class="template-title">{{ t(`toolsPanel.templates.${id}.label`) }}</span>
            <span class="template-hint">{{ t(`toolsPanel.templates.${id}.hint`) }}</span>
          </span>
        </button>
      </div>
    </div>
    <p v-else class="editing">
      <iconify-icon icon="ph:pencil-simple-duotone"></iconify-icon>
      {{ t('toolsPanel.create.editing', { name: editing.name }) }}
    </p>

    <!-- Name -->
    <div class="field">
      <label class="label" for="custom-tool-name">{{ t('toolsPanel.create.name') }}</label>
      <input
        id="custom-tool-name"
        v-model="draft.name"
        class="control mono"
        :class="{ invalid: issuesFor('name').length }"
        placeholder="get_current_weather"
        autocomplete="off"
        spellcheck="false"
        translate="no"
        @blur="touch('name')"
      />
      <p v-for="issue in issuesFor('name')" :key="issue.code" class="error">
        {{ issueText(issue) }}
      </p>
      <p v-if="!issuesFor('name').length" class="hint">{{ t('toolsPanel.create.nameHint') }}</p>
    </div>

    <!-- Description -->
    <div class="field">
      <label class="label" for="custom-tool-description">{{
        t('toolsPanel.create.description')
      }}</label>
      <textarea
        id="custom-tool-description"
        v-model="draft.description"
        class="control"
        :class="{ invalid: issuesFor('description').length }"
        rows="4"
        @blur="touch('description')"
      ></textarea>
      <p v-for="issue in issuesFor('description')" :key="issue.code" class="error">
        {{ issueText(issue) }}
      </p>
      <p v-if="!issuesFor('description').length" class="hint">
        {{ t('toolsPanel.create.descriptionHint') }}
      </p>
    </div>

    <!-- Method + URL -->
    <div class="field">
      <span class="label" id="custom-tool-method-label">{{ t('toolsPanel.create.method') }}</span>
      <div class="segmented" role="radiogroup" aria-labelledby="custom-tool-method-label">
        <button
          v-for="method in ['GET', 'POST'] as const"
          :key="method"
          type="button"
          role="radio"
          class="segment"
          :class="{ active: draft.method === method }"
          :aria-checked="draft.method === method"
          @click="draft.method = method"
        >
          {{ method }}
        </button>
      </div>
      <p class="hint">{{ t('toolsPanel.create.methodHint') }}</p>
    </div>

    <div class="field">
      <label class="label" for="custom-tool-url">{{ t('toolsPanel.create.url') }}</label>
      <input
        id="custom-tool-url"
        v-model="draft.url"
        class="control mono"
        :class="{ invalid: issuesFor('url').length }"
        type="url"
        placeholder="https://example.com/hook"
        autocomplete="off"
        spellcheck="false"
        translate="no"
        @blur="touch('url')"
      />
      <div v-if="placeholders.length" class="placeholders">
        <span class="hint">{{ t('toolsPanel.create.inPath') }}</span>
        <code v-for="name in placeholders" :key="name" class="chip" translate="no">{{ name }}</code>
      </div>
      <p v-for="issue in issuesFor('url')" :key="issue.code + issue.subject" class="error">
        {{ issueText(issue) }}
      </p>
      <p v-if="!issuesFor('url').length" class="hint">{{ t('toolsPanel.create.urlHint') }}</p>
    </div>

    <!-- Parameters -->
    <div class="field">
      <div class="params-head">
        <span class="label">{{ t('toolsPanel.create.params') }}</span>
        <BaseButton size="sm" variant="ghost" icon="ph:plus-bold" @click="addParam">
          {{ t('toolsPanel.create.addParam') }}
        </BaseButton>
      </div>
      <p class="hint">{{ t('toolsPanel.create.paramsHint') }}</p>
      <p v-if="!draft.params.length" class="empty">{{ t('toolsPanel.create.noParams') }}</p>

      <ul v-else class="param-rows">
        <li v-for="(param, index) in draft.params" :key="index" class="param-row">
          <input
            v-model="param.name"
            class="control mono param-name"
            :aria-label="t('toolsPanel.create.paramName')"
            :placeholder="t('toolsPanel.create.paramName')"
            autocomplete="off"
            spellcheck="false"
            translate="no"
            @blur="touch('params')"
          />
          <div class="param-line">
            <select
              v-model="param.type"
              class="control param-type"
              :aria-label="t('toolsPanel.create.paramType')"
            >
              <option v-for="type in PARAM_TYPES" :key="type" :value="type">
                {{ t(`toolsPanel.create.types.${type}`) }}
              </option>
            </select>
            <label class="param-required">
              <input v-model="param.required" type="checkbox" />
              <span>{{ t('toolsPanel.create.paramRequired') }}</span>
            </label>
            <button
              type="button"
              class="icon-button"
              :class="{ active: openParam === index }"
              :aria-expanded="openParam === index"
              :aria-label="t('toolsPanel.create.paramMore', { name: param.name || '…' })"
              :title="t('toolsPanel.create.paramMore', { name: param.name || '…' })"
              @click="openParam = openParam === index ? null : index"
            >
              <iconify-icon icon="ph:dots-three-bold"></iconify-icon>
            </button>
            <button
              type="button"
              class="icon-button danger"
              :aria-label="t('toolsPanel.create.removeParam', { name: param.name || '…' })"
              :title="t('toolsPanel.create.removeParam', { name: param.name || '…' })"
              @click="removeParam(index)"
            >
              <iconify-icon icon="ph:trash-duotone"></iconify-icon>
            </button>
          </div>
          <div v-if="openParam === index" class="param-more">
            <input
              v-model="param.description"
              class="control"
              :aria-label="t('toolsPanel.create.paramDescription')"
              :placeholder="t('toolsPanel.create.paramDescription')"
            />
            <input
              v-if="param.type === 'string'"
              class="control mono"
              :value="enumText(param)"
              :aria-label="t('toolsPanel.create.paramValues')"
              :placeholder="t('toolsPanel.create.paramValues')"
              translate="no"
              @change="setEnum(param, ($event.target as HTMLInputElement).value)"
            />
          </div>
        </li>
      </ul>
      <p v-for="issue in issuesFor('params')" :key="issue.code + issue.subject" class="error">
        {{ issueText(issue) }}
      </p>
    </div>

    <!-- Preview -->
    <details class="preview">
      <summary>{{ t('toolsPanel.create.preview') }}</summary>
      <pre translate="no">{{ preview }}</pre>
    </details>

    <!-- Try it -->
    <div class="try">
      <div class="try-head">
        <span class="label">{{ t('toolsPanel.create.tryIt') }}</span>
        <span class="hint">{{ t('toolsPanel.create.tryItHint') }}</span>
      </div>
      <ToolArgsForm
        id-prefix="custom-try"
        :params="testParams"
        @update:model-value="tryArgs = $event"
        @update:valid="tryValid = $event"
      />
      <BaseButton
        size="sm"
        icon="ph:play-duotone"
        :loading="running"
        :disabled="!urlUsable || !tryValid || running"
        @click="tryIt"
      >
        {{ t('toolsPanel.create.tryIt') }}
      </BaseButton>
      <ToolResultView v-if="run" :result="run" />
    </div>

    <div class="actions">
      <BaseButton
        variant="primary"
        :icon="editing ? 'ph:floppy-disk-duotone' : 'ph:plus-duotone'"
        @click="submit"
      >
        {{ editing ? t('toolsPanel.create.saveChanges') : t('toolsPanel.create.save') }}
      </BaseButton>
      <BaseButton v-if="editing" variant="ghost" @click="emit('cancel')">
        {{ t('toolsPanel.create.cancel') }}
      </BaseButton>
      <BaseButton v-else-if="draft.name || draft.url" variant="ghost" @click="load(null)">
        {{ t('toolsPanel.create.reset') }}
      </BaseButton>
    </div>
  </div>
</template>

<style scoped>
.editor {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.intro {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-secondary);
}
.section-label,
.label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.templates {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.template-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}
.template {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 8px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--surface-1);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color var(--duration-fast) ease,
    background var(--duration-fast) ease;
}
.template:hover {
  background: var(--surface-2);
  border-color: var(--surface-4);
}
.template.active {
  border-color: var(--accent-primary);
  background: color-mix(in srgb, var(--accent-primary) 8%, transparent);
}
.template:focus-visible,
.segment:focus-visible,
.icon-button:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 1px;
}
.template-icon {
  flex: none;
  font-size: 18px;
  color: var(--accent-primary);
}
.template-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.template-title {
  font-size: 12px;
  font-weight: 600;
  line-height: 1.25;
  color: var(--text-primary);
}
.template-hint {
  font-size: 10px;
  line-height: 1.3;
  color: var(--text-muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.editing {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  font-size: 12px;
  color: var(--accent-primary);
  background: color-mix(in srgb, var(--accent-primary) 8%, transparent);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.control {
  width: 100%;
  padding: 8px 10px;
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font: inherit;
  font-size: 13px;
  transition: border-color var(--duration-fast) ease;
}
textarea.control {
  resize: vertical;
  line-height: 1.45;
}
.control:focus {
  outline: none;
  border-color: var(--accent-primary);
}
.control.invalid {
  border-color: var(--error);
}
.control.mono {
  font-family: var(--font-mono);
  font-size: 12px;
}
select.control option {
  background: var(--surface-0);
  color: var(--text-primary);
}
.hint {
  margin: 0;
  font-size: 11px;
  line-height: 1.4;
  color: var(--text-muted);
}
.error {
  margin: 0;
  font-size: 11px;
  line-height: 1.4;
  color: var(--error);
}
.empty {
  margin: 0;
  padding: 10px;
  font-size: 12px;
  text-align: center;
  color: var(--text-muted);
  border: 1px dashed var(--glass-border);
  border-radius: var(--radius-sm);
}
.segmented {
  display: inline-flex;
  align-self: flex-start;
  padding: 3px;
  gap: 2px;
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
  border-radius: 999px;
}
.segment {
  padding: 4px 14px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 12px;
  cursor: pointer;
}
.segment.active {
  background: var(--surface-3);
  color: var(--accent-primary);
}
.placeholders {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}
.chip {
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  background: var(--surface-3);
  color: var(--accent-primary);
}
.params-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.param-rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.param-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
  border-radius: var(--radius-sm);
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
}
.param-line {
  display: flex;
  align-items: center;
  gap: 4px;
}
.param-type {
  flex: 1 1 auto;
  min-width: 0;
  padding: 6px 8px;
  font-size: 12px;
}
.param-required {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: none;
  padding: 0 4px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
}
.param-required input {
  accent-color: var(--accent-primary);
  cursor: pointer;
}
.icon-button {
  display: grid;
  place-items: center;
  flex: none;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}
.icon-button:hover,
.icon-button.active {
  color: var(--text-primary);
  background: var(--surface-3);
}
.icon-button.danger:hover {
  color: var(--error);
}
.param-more {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.preview summary {
  cursor: pointer;
  font-size: 12px;
  color: var(--text-secondary);
}
.preview pre {
  margin: 6px 0 0;
  padding: 10px;
  max-height: 220px;
  overflow: auto;
  border-radius: var(--radius-sm);
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-secondary);
}
.try {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: var(--radius-md);
  border: 1px dashed var(--glass-border);
}
.try-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.try > :deep(.btn),
.try > button {
  align-self: flex-start;
}
.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
