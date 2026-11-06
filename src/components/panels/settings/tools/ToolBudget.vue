<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ToolDefinition } from 'kwami';
import { USER_TOOL_GROUPS, type ToolGroupId } from '@/lib/toolRegistration';
import type { ToolInventory } from '@/stores/toolInventory';
import { getCurrentLocale, intlLocaleTag } from '@/i18n';

/**
 * How much of the model's tool list is spent, and on what.
 *
 * The agent sends the model at most `limit` tools -- its own plus the app's
 * plus the user's -- and leaves the rest out. This shows the split from the
 * agent's last report, and which tools did not make it, so the user can
 * switch off a group they do not need instead of silently losing one they do.
 */
const props = defineProps<{
  inventory: ToolInventory | null;
  /** The client tools registered now. */
  clientTools: ToolDefinition[];
  groupOf: (name: string) => ToolGroupId;
}>();

const { t } = useI18n();

/** Names shown in the dropped list before "and N more". */
const SHOWN_DROPPED = 6;

const split = computed(() => {
  const inv = props.inventory;
  if (!inv) return null;
  const dropped = new Set(inv.dropped);
  let app = 0;
  let yours = 0;
  for (const tool of props.clientTools) {
    if (dropped.has(tool.name)) continue;
    if (USER_TOOL_GROUPS.has(props.groupOf(tool.name))) yours += 1;
    else app += 1;
  }
  const limit = Math.max(inv.limit, 1);
  const pct = (n: number) => `${Math.min(100, (n / limit) * 100).toFixed(2)}%`;
  return {
    agent: inv.builtin.length,
    app,
    yours,
    widths: { agent: pct(inv.builtin.length), app: pct(app), yours: pct(yours) },
  };
});

const time = computed(() =>
  props.inventory
    ? new Date(props.inventory.receivedAt).toLocaleTimeString(intlLocaleTag(getCurrentLocale()), {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '',
);
</script>

<template>
  <section class="budget" :class="{ warn: inventory && inventory.dropped.length }">
    <template v-if="inventory && split">
      <div class="head">
        <span class="title">{{ t('toolsPanel.budget.title') }}</span>
        <span class="figure">{{
          t('toolsPanel.budget.reaches', { total: inventory.total, limit: inventory.limit })
        }}</span>
      </div>
      <div
        class="bar"
        role="img"
        :aria-label="
          t('toolsPanel.budget.reaches', { total: inventory.total, limit: inventory.limit })
        "
      >
        <span class="seg agent" :style="{ width: split.widths.agent }"></span>
        <span class="seg app" :style="{ width: split.widths.app }"></span>
        <span class="seg yours" :style="{ width: split.widths.yours }"></span>
      </div>
      <ul class="legend">
        <li>
          <i class="dot agent"></i>{{ t('toolsPanel.budget.legendAgent') }}
          <b>{{ split.agent }}</b>
        </li>
        <li>
          <i class="dot app"></i>{{ t('toolsPanel.budget.legendApp') }} <b>{{ split.app }}</b>
        </li>
        <li>
          <i class="dot yours"></i>{{ t('toolsPanel.budget.legendYours') }}
          <b>{{ split.yours }}</b>
        </li>
      </ul>

      <div v-if="inventory.dropped.length" class="dropped">
        <p>
          <iconify-icon icon="ph:warning-duotone" aria-hidden="true"></iconify-icon>
          {{ t('toolsPanel.budget.dropped', inventory.dropped.length) }}.
          {{ t('toolsPanel.budget.droppedHint') }}
        </p>
        <div class="names">
          <code
            v-for="name in inventory.dropped.slice(0, SHOWN_DROPPED)"
            :key="name"
            translate="no"
            >{{ name }}</code
          >
          <span v-if="inventory.dropped.length > SHOWN_DROPPED" class="more"
            >+{{ inventory.dropped.length - SHOWN_DROPPED }}</span
          >
        </div>
      </div>
      <p class="as-of">{{ t('toolsPanel.budget.asOf', { time }) }}</p>
    </template>

    <p v-else class="unknown">
      <iconify-icon icon="ph:info-duotone" aria-hidden="true"></iconify-icon>
      {{ t('toolsPanel.budget.unknown', { count: clientTools.length, limit: 128 }) }}
    </p>
  </section>
</template>

<style scoped>
.budget {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
  background: var(--surface-1);
}
.budget.warn {
  border-color: color-mix(in srgb, var(--warning) 35%, var(--glass-border));
}
.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.figure {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.bar {
  display: flex;
  height: 8px;
  border-radius: 999px;
  overflow: hidden;
  background: var(--surface-3);
}
.seg {
  height: 100%;
  transition: width var(--duration-normal) var(--ease-out);
}
.agent {
  background: #c084fc;
}
.app {
  background: var(--accent-primary);
}
.yours {
  background: #2dd4bf;
}
.legend {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  font-size: 11px;
  color: var(--text-secondary);
}
.legend li {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.legend b {
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.dropped p,
.unknown {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  margin: 0;
  font-size: 11px;
  line-height: 1.45;
}
.dropped p {
  color: var(--warning);
}
.unknown {
  color: var(--text-muted);
}
.names {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}
.names code {
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  background: var(--warning-glow);
  color: var(--text-secondary);
}
.more {
  font-size: 11px;
  color: var(--text-muted);
}
.as-of {
  margin: 0;
  font-size: 10px;
  color: var(--text-muted);
}
</style>
