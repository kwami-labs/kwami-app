<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from 'vue-toastification';

export interface ToolRunResult {
  /** Whether the call worked, as far as can be told from its result. */
  ok: boolean;
  /** HTTP status, for webhooks. */
  status?: number;
  durationMs: number;
  /** What the tool returned, or the error text. */
  value: unknown;
}

const props = defineProps<{ result: ToolRunResult }>();

const { t } = useI18n();
const toast = useToast();

/** Long answers are shown cut: the agent itself only ever sees 4,000 characters. */
const MAX_SHOWN = 20_000;

const text = computed(() => {
  const value = props.result.value;
  const full = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return full === undefined ? '' : full;
});

const shown = computed(() =>
  text.value.length > MAX_SHOWN ? `${text.value.slice(0, MAX_SHOWN)}\n…` : text.value,
);

async function copy() {
  try {
    await navigator.clipboard.writeText(text.value);
    toast.success(t('toolsPanel.result.copied'));
  } catch {
    toast.error(t('toolsPanel.catalog.copyFailed'));
  }
}
</script>

<template>
  <div class="result" :class="result.ok ? 'ok' : 'failed'" role="status">
    <div class="bar">
      <iconify-icon
        :icon="result.ok ? 'ph:check-circle-duotone' : 'ph:warning-circle-duotone'"
        class="state-icon"
        aria-hidden="true"
      ></iconify-icon>
      <strong>{{ result.ok ? t('toolsPanel.result.ok') : t('toolsPanel.result.failed') }}</strong>
      <span v-if="result.status" class="meta">{{
        t('toolsPanel.result.status', { status: result.status })
      }}</span>
      <span class="meta">{{ t('toolsPanel.result.duration', { ms: result.durationMs }) }}</span>
      <button
        type="button"
        class="copy"
        :title="t('toolsPanel.result.copy')"
        :aria-label="t('toolsPanel.result.copy')"
        @click="copy"
      >
        <iconify-icon icon="ph:copy-duotone"></iconify-icon>
      </button>
    </div>
    <pre class="body" translate="no">{{ shown }}</pre>
  </div>
</template>

<style scoped>
.result {
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
  background: var(--surface-1);
  overflow: hidden;
}
.result.ok {
  border-color: color-mix(in srgb, var(--success) 35%, var(--glass-border));
}
.result.failed {
  border-color: color-mix(in srgb, var(--error) 40%, var(--glass-border));
}
.bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  font-size: 12px;
  border-bottom: 1px solid var(--glass-border);
}
.ok .bar {
  background: var(--success-glow);
}
.failed .bar {
  background: var(--error-glow);
}
.state-icon {
  font-size: 16px;
}
.ok .state-icon,
.ok strong {
  color: var(--success);
}
.failed .state-icon,
.failed strong {
  color: var(--error);
}
.meta {
  font-size: 11px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.copy {
  margin-left: auto;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}
.copy:hover {
  color: var(--text-primary);
  background: var(--surface-3);
}
.body {
  margin: 0;
  padding: 10px;
  max-height: 260px;
  overflow: auto;
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
