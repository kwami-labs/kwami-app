<script lang="ts">
import { ref as moduleRef } from 'vue';

interface HistoryEntry {
  tool: string;
  ok: boolean;
  durationMs: number;
}

/**
 * Recent runs, for the session. Held here rather than in the component: the
 * panel's tabs unmount it, and the list would empty every time you looked at
 * the catalog in between.
 */
const history = moduleRef<HistoryEntry[]>([]);
</script>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ToolDefinition } from 'kwami';
import BaseButton from '@/components/ui/BaseButton.vue';
import { TOOL_GROUPS, type ToolGroupId } from '@/lib/toolRegistration';
import { describeParameters } from '@/lib/toolSchema';
import ToolArgsForm from './ToolArgsForm.vue';
import ToolResultView, { type ToolRunResult } from './ToolResultView.vue';

/**
 * Run any registered tool by hand, the way the agent would.
 *
 * Arguments come from a form built from the tool's schema instead of typed
 * JSON. The call goes through the same handler the agent reaches, so a tool
 * that sends or deletes asks for the same confirmation it asks the agent for.
 */
const props = defineProps<{
  tools: ToolDefinition[];
  groupOf: (name: string) => ToolGroupId;
  run: (name: string, args: Record<string, unknown>) => Promise<unknown>;
}>();

/** v-model: the selected tool's name, so the catalog's Test button can pick it. */
const selected = defineModel<string>({ default: '' });

const { t } = useI18n();

const HISTORY_SIZE = 5;

const args = ref<Record<string, unknown>>({});
const argsValid = ref(true);
const running = ref(false);
const result = ref<ToolRunResult | null>(null);

const tool = computed(() => props.tools.find((candidate) => candidate.name === selected.value));
const params = computed(() => describeParameters(tool.value?.parameters));
const missingRequired = computed(() =>
  params.value.filter((p) => p.required && !(p.name in args.value)).map((p) => p.name),
);

/** The picker's options, grouped like the catalog. */
const optionGroups = computed(() =>
  TOOL_GROUPS.map((id) => ({
    id,
    tools: props.tools
      .filter((candidate) => props.groupOf(candidate.name) === id)
      .map((candidate) => candidate.name)
      .sort(),
  })).filter((group) => group.tools.length),
);

watch(selected, () => {
  result.value = null;
});

/**
 * Whether a result reads as a failure. Handlers report trouble in their return
 * value rather than by throwing -- `{ ok: false }`, `{ success: false }`, an
 * `error` field -- because that is what reaches the model.
 */
function looksFailed(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return v.ok === false || v.success === false || (typeof v.error === 'string' && !!v.error);
}

async function execute() {
  if (!tool.value || running.value || !argsValid.value) return;
  running.value = true;
  const name = tool.value.name;
  const started = performance.now();
  let value: unknown;
  let ok = true;
  try {
    value = await props.run(name, args.value);
    ok = !looksFailed(value);
  } catch (e) {
    value = e instanceof Error ? e.message : String(e);
    ok = false;
  }
  const durationMs = Math.round(performance.now() - started);
  const status =
    value && typeof value === 'object' && typeof (value as { status?: unknown }).status === 'number'
      ? ((value as { status: number }).status as number)
      : undefined;
  result.value = { ok, durationMs, value, status };
  history.value = [{ tool: name, ok, durationMs }, ...history.value].slice(0, HISTORY_SIZE);
  running.value = false;
}
</script>

<template>
  <div class="tester">
    <p class="intro">{{ t('toolsPanel.test.intro') }}</p>

    <div class="field">
      <label class="label" for="tool-tester-select">{{ t('toolsPanel.test.tool') }}</label>
      <select id="tool-tester-select" v-model="selected" class="control mono" translate="no">
        <option value="" disabled>{{ t('toolsPanel.test.choose') }}</option>
        <optgroup
          v-for="group in optionGroups"
          :key="group.id"
          :label="t(`toolsPanel.groups.${group.id}.title`)"
        >
          <option v-for="name in group.tools" :key="name" :value="name">{{ name }}</option>
        </optgroup>
      </select>
      <p v-if="tool" class="desc">{{ tool.description }}</p>
    </div>

    <template v-if="tool">
      <div class="field">
        <span class="label">{{ t('toolsPanel.test.arguments') }}</span>
        <ToolArgsForm
          :key="tool.name"
          id-prefix="tool-tester"
          :params="params"
          @update:model-value="args = $event"
          @update:valid="argsValid = $event"
        />
      </div>

      <details class="preview">
        <summary>{{ t('toolsPanel.test.preview') }}</summary>
        <pre translate="no">{{ JSON.stringify(args, null, 2) }}</pre>
      </details>

      <p v-if="missingRequired.length" class="note">
        {{ t('toolsPanel.test.missing', { names: missingRequired.join(', ') }) }}
      </p>
      <p class="note">
        <iconify-icon icon="ph:info-duotone" aria-hidden="true"></iconify-icon>
        {{ t('toolsPanel.test.realRun') }}
      </p>

      <BaseButton
        variant="primary"
        icon="ph:play-duotone"
        :loading="running"
        :disabled="running || !argsValid"
        @click="execute"
      >
        {{ running ? t('toolsPanel.test.running') : t('toolsPanel.test.run') }}
      </BaseButton>

      <ToolResultView v-if="result" :result="result" />
    </template>

    <div v-if="history.length" class="history">
      <span class="label">{{ t('toolsPanel.test.history') }}</span>
      <ul>
        <li v-for="(entry, index) in history" :key="index">
          <button type="button" class="history-item" @click="selected = entry.tool">
            <iconify-icon
              :icon="entry.ok ? 'ph:check-circle-fill' : 'ph:x-circle-fill'"
              :class="entry.ok ? 'ok' : 'bad'"
              aria-hidden="true"
            ></iconify-icon>
            <code translate="no">{{ entry.tool }}</code>
            <span class="muted">{{
              t('toolsPanel.result.duration', { ms: entry.durationMs })
            }}</span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.tester {
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
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
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
}
.control.mono {
  font-family: var(--font-mono);
  font-size: 12px;
}
.control:focus {
  outline: none;
  border-color: var(--accent-primary);
}
select.control option,
select.control optgroup {
  background: var(--surface-0);
  color: var(--text-primary);
}
.desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-secondary);
  max-height: 120px;
  overflow: auto;
}
.preview summary {
  cursor: pointer;
  font-size: 12px;
  color: var(--text-secondary);
}
.preview pre {
  margin: 6px 0 0;
  padding: 10px;
  border-radius: var(--radius-sm);
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-secondary);
}
.note {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  margin: 0;
  font-size: 11px;
  line-height: 1.4;
  color: var(--text-muted);
}
.history ul {
  list-style: none;
  margin: 6px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.history-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.history-item:hover {
  background: var(--surface-2);
}
.history-item code {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-primary);
}
.ok {
  color: var(--success);
}
.bad {
  color: var(--error);
}
.muted {
  font-size: 11px;
  color: var(--text-muted);
}
</style>
