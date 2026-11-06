<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ToolParam } from '@/lib/toolSchema';

/**
 * One input per parameter, built from the tool's schema.
 *
 * Replaces typing the arguments as JSON: text, numbers, yes/no and allowed
 * values each get the control that fits, and only parameters whose type the
 * schema leaves open (`any`, arrays, objects) fall back to a JSON field.
 * The emitted object holds typed values and leaves out what was left blank.
 */
const props = defineProps<{
  params: ToolParam[];
  /** Prefix for input ids, so two forms on one page do not share labels. */
  idPrefix: string;
  /** Output only (v-model): the fields keep their own text. */
  modelValue?: Record<string, unknown>;
  valid?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: Record<string, unknown>): void;
  (e: 'update:valid', valid: boolean): void;
}>();

const { t } = useI18n();

/** What each field shows, as typed. Coerced on the way out. */
const raw = reactive<Record<string, string>>({});
const errors = reactive<Record<string, string>>({});

type Kind = 'text' | 'number' | 'boolean' | 'choice' | 'json';

function kindOf(param: ToolParam): Kind {
  if (param.enum?.length) return 'choice';
  if (param.type === 'string') return 'text';
  if (param.type === 'number' || param.type === 'integer') return 'number';
  if (param.type === 'boolean') return 'boolean';
  return 'json';
}

function coerce(param: ToolParam, text: string): { value?: unknown; error?: string } {
  if (text === '') return {};
  switch (kindOf(param)) {
    case 'number': {
      const n = Number(text);
      if (Number.isNaN(n)) return { error: t('toolsPanel.args.invalidJson') };
      return { value: param.type === 'integer' ? Math.trunc(n) : n };
    }
    case 'boolean':
      return { value: text === 'true' };
    case 'json':
      try {
        return { value: JSON.parse(text) };
      } catch {
        return { error: t('toolsPanel.args.invalidJson') };
      }
    default:
      return { value: text };
  }
}

function publish() {
  const value: Record<string, unknown> = {};
  let valid = true;
  for (const param of props.params) {
    const out = coerce(param, raw[param.name] ?? '');
    if (out.error) {
      errors[param.name] = out.error;
      valid = false;
    } else {
      delete errors[param.name];
      if (out.value !== undefined) value[param.name] = out.value;
    }
  }
  emit('update:modelValue', value);
  emit('update:valid', valid);
}

// A different tool, or a schema edited in the editor: keep what still applies.
watch(
  () => props.params.map((p) => `${p.name}:${p.type}`).join(','),
  () => {
    for (const key of Object.keys(raw)) {
      if (!props.params.some((p) => p.name === key)) delete raw[key];
    }
    publish();
  },
  { immediate: true },
);

function update(name: string, text: string) {
  raw[name] = text;
  publish();
}
</script>

<template>
  <div class="args">
    <p v-if="!params.length" class="none">{{ t('toolsPanel.args.noParams') }}</p>
    <div v-for="param in params" :key="param.name" class="field">
      <label class="label" :for="`${idPrefix}-${param.name}`">
        <code translate="no">{{ param.name }}</code>
        <span class="type" translate="no">{{ param.type }}</span>
        <span v-if="param.required" class="required">{{ t('toolsPanel.args.required') }}</span>
      </label>
      <p v-if="param.description" class="hint">{{ param.description }}</p>

      <select
        v-if="kindOf(param) === 'choice'"
        :id="`${idPrefix}-${param.name}`"
        class="control"
        :value="raw[param.name] ?? ''"
        translate="no"
        @change="update(param.name, ($event.target as HTMLSelectElement).value)"
      >
        <option value="">{{ param.required ? '—' : t('toolsPanel.args.any') }}</option>
        <option v-for="option in param.enum" :key="option" :value="option">{{ option }}</option>
      </select>

      <select
        v-else-if="kindOf(param) === 'boolean'"
        :id="`${idPrefix}-${param.name}`"
        class="control"
        :value="raw[param.name] ?? ''"
        @change="update(param.name, ($event.target as HTMLSelectElement).value)"
      >
        <option value="">—</option>
        <option value="true">{{ t('toolsPanel.args.yes') }}</option>
        <option value="false">{{ t('toolsPanel.args.no') }}</option>
      </select>

      <input
        v-else-if="kindOf(param) === 'number'"
        :id="`${idPrefix}-${param.name}`"
        class="control"
        type="number"
        :step="param.type === 'integer' ? 1 : 'any'"
        :value="raw[param.name] ?? ''"
        @input="update(param.name, ($event.target as HTMLInputElement).value)"
      />

      <textarea
        v-else-if="kindOf(param) === 'json'"
        :id="`${idPrefix}-${param.name}`"
        class="control mono"
        rows="2"
        :placeholder="t('toolsPanel.args.json')"
        :value="raw[param.name] ?? ''"
        translate="no"
        spellcheck="false"
        @input="update(param.name, ($event.target as HTMLTextAreaElement).value)"
      ></textarea>

      <input
        v-else
        :id="`${idPrefix}-${param.name}`"
        class="control"
        type="text"
        :value="raw[param.name] ?? ''"
        @input="update(param.name, ($event.target as HTMLInputElement).value)"
      />

      <p v-if="errors[param.name]" class="error">{{ errors[param.name] }}</p>
    </div>
  </div>
</template>

<style scoped>
.args {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.none {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
.label code {
  font-family: var(--font-mono);
  color: var(--text-primary);
}
.type {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--accent-primary);
}
.required {
  font-size: 10px;
  padding: 0 6px;
  border-radius: 999px;
  color: var(--warning);
  background: var(--warning-glow);
}
.hint {
  margin: 0;
  font-size: 11px;
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
.control:focus {
  outline: none;
  border-color: var(--accent-primary);
}
.control.mono {
  font-family: var(--font-mono);
  font-size: 12px;
  resize: vertical;
}
select.control option {
  background: var(--surface-0);
  color: var(--text-primary);
}
.error {
  margin: 0;
  font-size: 11px;
  color: var(--error);
}
</style>
