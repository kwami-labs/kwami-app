<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import HudWindow from '../HudWindow.vue';
import { useHudStore, type HudWidget } from '@/stores/hud';
import { useKwami } from '@/composables/useKwami';
import { useToolCatalogStore } from '@/stores/toolCatalog';
import { useToolWidgets } from '@/composables/useToolWidgets';
import { renderMarkdown } from '@/lib/hud/markdown';
import { baseToolName, cell, toolMarkdown } from '@/lib/hud/toolWidget';

/**
 * A tool on Jarvis's screen (lib/hud/toolWidget): what one of the app's tools answered,
 * an MCP server's most of all, run again with a button or on a timer while it is in view.
 */
const props = defineProps<{ widget: HudWidget; index: number }>();

const { t, d } = useI18n();
const hud = useHudStore();
const { kwami } = useKwami();
const catalog = useToolCatalogStore();
const tools = useToolWidgets();

/** The timer choices, in seconds: by hand, then from half a minute to an hour. */
const EVERY = [0, 30, 60, 300, 900, 3600] as const;

const code = computed(() => `TOOL-${String(props.index + 1).padStart(2, '0')}`);
const result = computed(() => tools.runs[props.widget.id]);
const view = computed(() => result.value?.view);
const running = computed(() => result.value?.status === 'running');
const html = computed(() => (view.value?.type === 'text' ? renderMarkdown(view.value.text) : ''));
const source = computed(() => {
  const name = props.widget.tool ?? '';
  const server = name.includes('__') ? name.split('__')[0] : '';
  return { server, tool: baseToolName(name) };
});
const argsText = computed(() =>
  Object.entries(props.widget.args ?? {})
    .map(([k, v]) => `${k}: ${cell(v)}`)
    .join(' · '),
);
const errorText = computed(() => {
  const error = result.value?.status === 'error' ? result.value.error : undefined;
  if (!error) return '';
  if (error === 'missing') return t('hud.tool.missing', { tool: props.widget.tool });
  if (error === 'writes') return t('hud.tool.writes');
  if (error === 'timeout') return t('hud.tool.timeout');
  return error;
});
const note = ref('');

const pageVisible = ref(typeof document === 'undefined' || document.visibilityState === 'visible');
/** In view: not folded, on this screen, the tab in front, the app itself on screen. */
const inView = computed(
  () =>
    !props.widget.minimized &&
    props.widget.screen === hud.activeScreen &&
    hud.isShown(props.widget) &&
    pageVisible.value,
);
function onVisibility() {
  pageVisible.value = document.visibilityState === 'visible';
}

function refresh() {
  void tools.run(props.widget);
}

let timer: ReturnType<typeof setInterval> | null = null;
function stopTimer() {
  if (timer) clearInterval(timer);
  timer = null;
}
watch(
  [() => props.widget.refresh ?? 0, inView],
  ([every, visible]) => {
    stopTimer();
    if (!every || !visible) return;
    // Back in view after a while away: what it shows may be old.
    if (result.value && Date.now() - result.value.at > every * 1000) refresh();
    timer = setInterval(refresh, every * 1000);
  },
  { immediate: true },
);

// The first run: as soon as the tool is there. After a reload the window comes back
// before the app has registered its tools, and an MCP server's come later still.
const available = computed(() => {
  void catalog.revision;
  return !!props.widget.tool && !!kwami.value?.tools.get(props.widget.tool);
});
watch(
  available,
  (now) => {
    if (now && !result.value) refresh();
  },
  { immediate: true },
);
/** Waited long enough for the tool: say it is missing (it still runs if it comes). */
const WAIT_MS = 15_000;
const gaveUp = ref(false);
const waitTimer = setTimeout(() => (gaveUp.value = !available.value), WAIT_MS);

function cycleEvery() {
  const now = props.widget.refresh ?? 0;
  const next = EVERY[(EVERY.indexOf(now as (typeof EVERY)[number]) + 1) % EVERY.length];
  hud.setRefresh(props.widget.id, next);
}

function everyLabel(seconds: number): string {
  if (!seconds) return t('hud.tool.byHand');
  if (seconds < 60) return t('hud.tool.seconds', { n: seconds });
  if (seconds < 3600) return t('hud.tool.minutes', { n: Math.round(seconds / 60) });
  return t('hud.tool.hours', { n: Math.round(seconds / 3600) });
}

function asMarkdown(): string {
  return view.value ? toolMarkdown(view.value) : '';
}

async function copy() {
  try {
    await navigator.clipboard.writeText(asMarkdown());
    flash(t('hud.doc.copied'));
  } catch {
    flash(t('hud.doc.copyFailed'));
  }
}

function toDocument() {
  const markdown = asMarkdown();
  if (!markdown) return;
  const doc = hud.createDocument(props.widget.title, markdown);
  hud.openDocument(doc, 'user');
}

let noteTimer: ReturnType<typeof setTimeout> | null = null;
function flash(text: string) {
  note.value = text;
  if (noteTimer) clearTimeout(noteTimer);
  noteTimer = setTimeout(() => (note.value = ''), 1800);
}

onMounted(() => document.addEventListener('visibilitychange', onVisibility));
onBeforeUnmount(() => {
  stopTimer();
  clearTimeout(waitTimer);
  if (noteTimer) clearTimeout(noteTimer);
  document.removeEventListener('visibilitychange', onVisibility);
  // Closed for good, not only moved to another tab group or screen.
  if (!hud.byId(props.widget.id)) tools.forget(props.widget.id);
});
</script>

<template>
  <HudWindow :widget="widget" :code="code" icon="ph:plugs-connected-duotone">
    <div class="tool">
      <div class="hud-toolbar">
        <button
          type="button"
          class="hud-icon-btn"
          :title="t('hud.tool.refresh')"
          :disabled="running"
          @click="refresh"
        >
          <iconify-icon icon="ph:arrows-clockwise" :class="{ 'hud-spin': running }"></iconify-icon>
        </button>
        <button
          type="button"
          class="every"
          :class="{ 'is-on': !!widget.refresh }"
          :title="t('hud.tool.every')"
          @click="cycleEvery"
        >
          <iconify-icon icon="ph:timer"></iconify-icon>
          {{ everyLabel(widget.refresh ?? 0) }}
        </button>
        <span class="hud-sep"></span>
        <button
          type="button"
          class="hud-icon-btn"
          :title="t('hud.doc.copy')"
          :disabled="!view"
          @click="copy"
        >
          <iconify-icon icon="ph:copy"></iconify-icon>
        </button>
        <button
          type="button"
          class="hud-icon-btn"
          :title="t('hud.tool.toDocument')"
          :disabled="!view"
          @click="toDocument"
        >
          <iconify-icon icon="ph:file-text"></iconify-icon>
        </button>
        <span class="when">
          <template v-if="note">{{ note }}</template>
          <template v-else-if="running">{{ t('hud.tool.running') }}</template>
          <template v-else-if="result">
            {{
              t('hud.tool.updated', {
                time: d(new Date(result.at), {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                }),
              })
            }}
          </template>
        </span>
      </div>

      <div class="out hud-scroll">
        <p v-if="errorText" class="err" role="alert">
          <iconify-icon icon="ph:warning-circle"></iconify-icon>{{ errorText }}
        </p>
        <template v-if="view">
          <dl v-if="'pairs' in view && view.pairs.length" class="pairs">
            <template v-for="[k, v] in view.pairs" :key="k">
              <dt>{{ k }}</dt>
              <dd>{{ v }}</dd>
            </template>
          </dl>
          <!-- eslint-disable vue/no-v-html -- renderMarkdown escapes everything it is given -->
          <div v-if="view.type === 'text'" class="hud-prose" v-html="html"></div>
          <!-- eslint-enable vue/no-v-html -->
          <ul v-else-if="view.type === 'list'" class="items">
            <li v-for="(item, i) in view.items" :key="i">{{ item }}</li>
          </ul>
          <div v-else-if="view.type === 'table'" class="grid-wrap">
            <table class="grid">
              <thead>
                <tr>
                  <th v-for="c in view.columns" :key="c">{{ c }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, i) in view.rows" :key="i">
                  <td v-for="(value, j) in row" :key="j" :title="value">{{ value }}</td>
                </tr>
              </tbody>
            </table>
            <p v-if="view.more" class="more">{{ t('hud.tool.more', { n: view.more }) }}</p>
          </div>
          <p v-else-if="view.type === 'empty'" class="hud-empty">{{ t('hud.tool.empty') }}</p>
        </template>
        <p v-else-if="gaveUp && !available" class="err" role="alert">
          <iconify-icon icon="ph:plugs"></iconify-icon
          >{{ t('hud.tool.missing', { tool: widget.tool }) }}
        </p>
        <p v-else-if="!errorText" class="hud-empty">
          <iconify-icon icon="ph:circle-notch" class="hud-spin"></iconify-icon>
          {{ available ? t('hud.tool.running') : t('hud.tool.waiting') }}
        </p>
      </div>
    </div>

    <template #footer>
      <span v-if="source.server" class="hud-chip">
        <iconify-icon icon="ph:plugs"></iconify-icon>{{ source.server }}
      </span>
      <span class="hud-chip">{{ source.tool }}</span>
      <span v-if="argsText" class="args" :title="argsText">{{ argsText }}</span>
    </template>
  </HudWindow>
</template>

<style scoped>
.tool {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.every {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--hud-line-soft);
  background: transparent;
  color: var(--hud-dim);
  font-family: var(--hud-mono);
  font-size: 11px;
  cursor: pointer;
}
.every:hover {
  color: var(--hud-text);
  border-color: var(--hud-line);
}
.every.is-on {
  color: var(--hud-text);
  background: rgba(var(--hud-rgb), 0.12);
  border-color: var(--hud-line);
}

.when {
  margin-left: auto;
  font-family: var(--hud-mono);
  font-size: 10.5px;
  color: var(--hud-faint);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.out {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
}

.err {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin: 0;
  padding: 8px 10px;
  border: 1px solid rgba(var(--hud-red-rgb), 0.55);
  background: rgba(var(--hud-red-rgb), 0.1);
  color: var(--hud-text);
  font-size: 12.5px;
}
.err iconify-icon {
  flex: none;
  margin-top: 2px;
  color: rgb(var(--hud-red-rgb));
}

.pairs {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 4px 14px;
  margin: 0;
  font-size: 13px;
}
.pairs dt {
  font-family: var(--hud-mono);
  font-size: 11px;
  color: var(--hud-dim);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding-top: 2px;
}
.pairs dd {
  margin: 0;
  color: var(--hud-text);
  overflow-wrap: anywhere;
}

.items {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  color: var(--hud-text);
}
.items li {
  margin: 3px 0;
}

.grid-wrap {
  overflow-x: auto;
}
.grid {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}
.grid th {
  position: sticky;
  top: 0;
  padding: 5px 8px;
  text-align: left;
  font-family: var(--hud-mono);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--hud-dim);
  background: rgba(var(--hud-rgb), 0.08);
  border-bottom: 1px solid var(--hud-line-soft);
}
.grid td {
  max-width: 260px;
  padding: 5px 8px;
  color: var(--hud-text);
  border-bottom: 1px solid var(--hud-line-faint);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.grid tr:hover td {
  background: rgba(var(--hud-rgb), 0.05);
}
.more {
  margin: 6px 0 0;
  font-size: 11.5px;
  color: var(--hud-faint);
}

.args {
  min-width: 0;
  font-family: var(--hud-mono);
  font-size: 10.5px;
  color: var(--hud-faint);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
