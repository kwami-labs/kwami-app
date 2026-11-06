<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from 'vue-toastification';
import type { ToolDefinition } from 'kwami';
import BaseButton from '@/components/ui/BaseButton.vue';
import { TOOL_GROUPS, USER_TOOL_GROUPS, type ToolGroupId } from '@/lib/toolRegistration';
import { describeParameters, foldForSearch, summarize, type ToolParam } from '@/lib/toolSchema';
import { TOOL_GROUP_LOOK } from './toolGroups';

/**
 * Every client tool the agent can call, grouped by what it is for.
 *
 * App tools are long, model-facing descriptions; the list shows each one's
 * first sentence and keeps the rest, with the parameters as a table, one click
 * away. Only tools the user added can be removed here: taking one of the app's
 * own away left a control the agent could no longer reach until a reload.
 */
const props = defineProps<{
  tools: ToolDefinition[];
  groupOf: (name: string) => ToolGroupId;
}>();

const emit = defineEmits<{
  (e: 'test', name: string): void;
  (e: 'remove', name: string): void;
  (e: 'edit', name: string): void;
}>();

const { t } = useI18n();
const toast = useToast();

type SourceFilter = 'all' | 'app' | 'yours';

const query = ref('');
const source = ref<SourceFilter>('all');
const openGroups = ref(new Set<ToolGroupId>(USER_TOOL_GROUPS));
const openTool = ref<string | null>(null);

const isUserTool = (name: string) => USER_TOOL_GROUPS.has(props.groupOf(name));

const paramsByTool = computed(() => {
  const map = new Map<string, ToolParam[]>();
  for (const tool of props.tools) map.set(tool.name, describeParameters(tool.parameters));
  return map;
});

const counts = computed(() => {
  const yours = props.tools.filter((tool) => isUserTool(tool.name)).length;
  return { all: props.tools.length, app: props.tools.length - yours, yours };
});

function groupTitle(id: ToolGroupId) {
  return t(`toolsPanel.groups.${id}.title`);
}

/** Name (also with spaces for underscores), description, parameters and group title. */
function haystack(tool: ToolDefinition): string {
  const params = paramsByTool.value.get(tool.name) ?? [];
  return foldForSearch(
    [
      tool.name,
      tool.name.replace(/_/g, ' '),
      tool.description,
      groupTitle(props.groupOf(tool.name)),
      ...params.map((p) => p.name),
    ].join(' '),
  );
}

const visibleGroups = computed(() => {
  const terms = foldForSearch(query.value).split(/\s+/).filter(Boolean);
  const byGroup = new Map<ToolGroupId, ToolDefinition[]>();
  for (const tool of props.tools) {
    const yours = isUserTool(tool.name);
    if (source.value === 'app' && yours) continue;
    if (source.value === 'yours' && !yours) continue;
    if (terms.length) {
      const text = haystack(tool);
      if (!terms.every((term) => text.includes(term))) continue;
    }
    const group = props.groupOf(tool.name);
    const list = byGroup.get(group) ?? [];
    list.push(tool);
    byGroup.set(group, list);
  }
  return TOOL_GROUPS.filter((id) => byGroup.has(id)).map((id) => ({
    id,
    tools: [...(byGroup.get(id) ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
  }));
});

const searching = computed(() => query.value.trim().length > 0);
const allOpen = computed(() => visibleGroups.value.every((g) => openGroups.value.has(g.id)));

function isOpen(id: ToolGroupId) {
  // A search opens whatever it found: matches hidden in folded groups read as
  // "no results".
  return searching.value || openGroups.value.has(id);
}

function toggleGroup(id: ToolGroupId) {
  const next = new Set(openGroups.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  openGroups.value = next;
}

function toggleAll() {
  openGroups.value = allOpen.value ? new Set() : new Set(visibleGroups.value.map((g) => g.id));
}

function toggleTool(name: string) {
  openTool.value = openTool.value === name ? null : name;
}

// A tool that vanished (removed, or filtered out) should not stay "open" and
// reappear expanded later.
watch(
  () => props.tools.map((tool) => tool.name).join(','),
  () => {
    if (openTool.value && !props.tools.some((tool) => tool.name === openTool.value)) {
      openTool.value = null;
    }
  },
);

async function copyDefinition(tool: ToolDefinition) {
  const definition = {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters ?? {},
  };
  try {
    await navigator.clipboard.writeText(JSON.stringify(definition, null, 2));
    toast.success(t('toolsPanel.catalog.copied', { name: tool.name }));
  } catch {
    toast.error(t('toolsPanel.catalog.copyFailed'));
  }
}

const filters = computed(() => [
  { id: 'all' as const, label: t('toolsPanel.catalog.filterAll'), count: counts.value.all },
  { id: 'app' as const, label: t('toolsPanel.catalog.filterApp'), count: counts.value.app },
  { id: 'yours' as const, label: t('toolsPanel.catalog.filterYours'), count: counts.value.yours },
]);

function sourceLabel(name: string) {
  const group = props.groupOf(name);
  if (group === 'mcp') return t('toolsPanel.catalog.sourceMcp');
  if (group === 'custom') return t('toolsPanel.catalog.sourceCustom');
  return null;
}
</script>

<template>
  <div class="catalog">
    <div class="search">
      <iconify-icon
        icon="ph:magnifying-glass"
        class="search-icon"
        aria-hidden="true"
      ></iconify-icon>
      <input
        v-model="query"
        type="search"
        class="search-input"
        :placeholder="t('toolsPanel.catalog.searchPlaceholder')"
        :aria-label="t('toolsPanel.catalog.searchLabel')"
        :title="t('toolsPanel.catalog.searchLabel')"
        @keydown.esc="query = ''"
      />
      <button
        v-if="query"
        type="button"
        class="search-clear"
        :aria-label="t('toolsPanel.catalog.clearSearch')"
        :title="t('toolsPanel.catalog.clearSearch')"
        @click="query = ''"
      >
        <iconify-icon icon="ph:x-bold"></iconify-icon>
      </button>
    </div>

    <div class="toolbar">
      <div class="filters" role="radiogroup">
        <button
          v-for="f in filters"
          :key="f.id"
          type="button"
          role="radio"
          class="filter"
          :class="{ active: source === f.id }"
          :aria-checked="source === f.id"
          @click="source = f.id"
        >
          {{ f.label }}<span class="filter-count">{{ f.count }}</span>
        </button>
      </div>
      <button
        v-if="visibleGroups.length > 1 && !searching"
        type="button"
        class="icon-button"
        :title="allOpen ? t('toolsPanel.catalog.collapseAll') : t('toolsPanel.catalog.expandAll')"
        :aria-label="
          allOpen ? t('toolsPanel.catalog.collapseAll') : t('toolsPanel.catalog.expandAll')
        "
        @click="toggleAll"
      >
        <iconify-icon
          :icon="allOpen ? 'ph:arrows-in-line-vertical-bold' : 'ph:arrows-out-line-vertical-bold'"
        ></iconify-icon>
      </button>
    </div>

    <p v-if="!tools.length" class="empty">{{ t('toolsPanel.catalog.noTools') }}</p>
    <p v-else-if="!visibleGroups.length" class="empty">
      {{ t('toolsPanel.catalog.noMatches', { query: query.trim() }) }}
    </p>

    <section
      v-for="group in visibleGroups"
      :key="group.id"
      class="group"
      :class="{ open: isOpen(group.id) }"
      :style="{ '--group-color': TOOL_GROUP_LOOK[group.id].color }"
    >
      <button
        type="button"
        class="group-head"
        :aria-expanded="isOpen(group.id)"
        @click="toggleGroup(group.id)"
      >
        <span class="group-icon" aria-hidden="true">
          <iconify-icon :icon="TOOL_GROUP_LOOK[group.id].icon"></iconify-icon>
        </span>
        <span class="group-text">
          <span class="group-title">{{ groupTitle(group.id) }}</span>
          <span class="group-hint">{{ t(`toolsPanel.groups.${group.id}.hint`) }}</span>
        </span>
        <span class="group-count">{{ group.tools.length }}</span>
        <iconify-icon icon="ph:caret-down-bold" class="caret" aria-hidden="true"></iconify-icon>
      </button>

      <ul v-show="isOpen(group.id)" class="rows">
        <li
          v-for="tool in group.tools"
          :key="tool.name"
          class="row"
          :class="{ expanded: openTool === tool.name }"
        >
          <button
            type="button"
            class="row-head"
            :aria-expanded="openTool === tool.name"
            @click="toggleTool(tool.name)"
          >
            <span class="row-main">
              <span class="row-title">
                <code class="tool-name" translate="no">{{ tool.name }}</code>
                <span v-if="sourceLabel(tool.name)" class="source">{{
                  sourceLabel(tool.name)
                }}</span>
              </span>
              <span v-if="openTool !== tool.name" class="tool-summary">{{
                summarize(tool.description)
              }}</span>
            </span>
            <iconify-icon icon="ph:caret-right-bold" class="row-caret" aria-hidden="true">
            </iconify-icon>
          </button>

          <div v-if="openTool === tool.name" class="detail">
            <p class="desc">{{ tool.description }}</p>

            <h4 class="detail-title">
              {{ t('toolsPanel.catalog.params') }}
              <span class="muted">{{
                t('toolsPanel.catalog.paramCount', paramsByTool.get(tool.name)?.length ?? 0)
              }}</span>
            </h4>
            <ul v-if="paramsByTool.get(tool.name)?.length" class="params">
              <li v-for="param in paramsByTool.get(tool.name)" :key="param.name" class="param">
                <div class="param-head">
                  <code class="param-name" translate="no">{{ param.name }}</code>
                  <span class="param-type" translate="no">{{ param.type }}</span>
                  <span v-if="param.required" class="param-required">{{
                    t('toolsPanel.catalog.required')
                  }}</span>
                </div>
                <p v-if="param.description" class="param-desc">{{ param.description }}</p>
                <div v-if="param.enum?.length" class="param-enum">
                  <span class="muted">{{ t('toolsPanel.catalog.values') }}</span>
                  <code v-for="value in param.enum" :key="value" class="chip" translate="no">{{
                    value
                  }}</code>
                </div>
              </li>
            </ul>

            <div class="actions">
              <BaseButton size="sm" icon="ph:play-duotone" @click="emit('test', tool.name)">
                {{ t('toolsPanel.catalog.test') }}
              </BaseButton>
              <BaseButton
                size="sm"
                variant="ghost"
                icon="ph:copy-duotone"
                @click="copyDefinition(tool)"
              >
                {{ t('toolsPanel.catalog.copy') }}
              </BaseButton>
              <BaseButton
                v-if="groupOf(tool.name) === 'custom'"
                size="sm"
                variant="ghost"
                icon="ph:pencil-simple-duotone"
                @click="emit('edit', tool.name)"
              >
                {{ t('toolsPanel.catalog.edit') }}
              </BaseButton>
              <BaseButton
                v-if="isUserTool(tool.name)"
                size="sm"
                variant="danger"
                icon="ph:trash-duotone"
                @click="emit('remove', tool.name)"
              >
                {{ t('toolsPanel.catalog.remove') }}
              </BaseButton>
            </div>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.catalog {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Search */
.search {
  position: relative;
  display: flex;
  align-items: center;
}
.search-icon {
  position: absolute;
  left: 12px;
  font-size: 15px;
  color: var(--text-muted);
  pointer-events: none;
}
.search-input {
  width: 100%;
  padding: 10px 36px 10px 36px;
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font: inherit;
  font-size: 13px;
  transition:
    border-color var(--duration-fast) ease,
    background var(--duration-fast) ease;
}
.search-input::placeholder {
  color: var(--text-muted);
}
.search-input:focus {
  outline: none;
  border-color: var(--accent-primary);
  background: var(--surface-2);
}
.search-input::-webkit-search-cancel-button {
  display: none;
}
.search-clear {
  position: absolute;
  right: 6px;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}
.search-clear:hover {
  color: var(--text-primary);
  background: var(--surface-3);
}

/* Filters */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.filters {
  display: inline-flex;
  padding: 3px;
  gap: 2px;
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
  border-radius: 999px;
}
.filter {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition:
    background var(--duration-fast) ease,
    color var(--duration-fast) ease;
}
.filter:hover {
  color: var(--text-primary);
}
.filter.active {
  background: var(--surface-3);
  color: var(--text-primary);
}
.filter-count {
  font-size: 10px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.filter.active .filter-count {
  color: var(--accent-primary);
}
.icon-button {
  display: grid;
  place-items: center;
  flex: none;
  width: 30px;
  height: 30px;
  border: 1px solid var(--glass-border);
  border-radius: 999px;
  background: var(--surface-1);
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
}
.icon-button:hover {
  color: var(--accent-primary);
  border-color: var(--accent-primary);
}
.icon-button:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}

.empty {
  margin: 0;
  padding: 18px 12px;
  text-align: center;
  font-size: 13px;
  color: var(--text-muted);
  background: var(--surface-1);
  border: 1px dashed var(--glass-border);
  border-radius: var(--radius-md);
}

/* Groups */
.group {
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--surface-1);
  overflow: hidden;
  transition: border-color var(--duration-fast) ease;
}
.group.open {
  border-color: color-mix(in srgb, var(--group-color) 28%, var(--glass-border));
}
.group-head {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.group-head:hover {
  background: var(--surface-2);
}
.group-head:focus-visible,
.row-head:focus-visible,
.filter:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: -2px;
}
.group-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm);
  font-size: 17px;
  color: var(--group-color);
  background: color-mix(in srgb, var(--group-color) 14%, transparent);
}
.group-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.group-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.group-hint {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.group-count {
  flex: none;
  min-width: 24px;
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  text-align: center;
  font-variant-numeric: tabular-nums;
  color: var(--group-color);
  background: color-mix(in srgb, var(--group-color) 12%, transparent);
}
.caret {
  flex: none;
  font-size: 12px;
  color: var(--text-muted);
  transition: transform var(--duration-normal) var(--ease-out);
}
.group.open .caret {
  transform: rotate(180deg);
}

/* Rows */
.rows {
  list-style: none;
  margin: 0;
  padding: 0 6px 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.row {
  border-radius: var(--radius-sm);
  transition: background var(--duration-fast) ease;
}
.row.expanded {
  background: var(--surface-2);
}
.row-head {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.row-head:hover {
  background: var(--surface-2);
}
.row-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}
.row-title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.tool-name {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.source {
  flex: none;
  padding: 0 6px;
  border-radius: 999px;
  font-size: 10px;
  line-height: 16px;
  color: var(--group-color);
  border: 1px solid color-mix(in srgb, var(--group-color) 40%, transparent);
}
.tool-summary {
  font-size: 12px;
  line-height: 1.35;
  color: var(--text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.row-caret {
  flex: none;
  font-size: 11px;
  color: var(--text-muted);
  transition: transform var(--duration-normal) var(--ease-out);
}
.row.expanded .row-caret {
  transform: rotate(90deg);
  color: var(--group-color);
}

/* Detail */
.detail {
  padding: 2px 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-secondary);
  white-space: pre-line;
}
.detail-title {
  margin: 4px 0 0;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
  display: flex;
  gap: 6px;
  align-items: baseline;
}
.detail-title .muted {
  text-transform: none;
  letter-spacing: 0;
  font-weight: 400;
}
.muted {
  color: var(--text-muted);
  font-size: 11px;
}
.params {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.param {
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
}
.param-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.param-name {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-primary);
}
.param-type {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--group-color);
}
.param-required {
  font-size: 10px;
  padding: 0 6px;
  border-radius: 999px;
  color: var(--warning);
  background: var(--warning-glow);
}
.param-desc {
  margin: 4px 0 0;
  font-size: 11px;
  color: var(--text-secondary);
}
.param-enum {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
}
.chip {
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  background: var(--surface-3);
  color: var(--text-secondary);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}
</style>
