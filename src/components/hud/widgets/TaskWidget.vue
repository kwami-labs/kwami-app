<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import HudWindow from '../HudWindow.vue';
import { useHudStore, type HudWidget } from '@/stores/hud';
import { useVoiceStore } from '@/stores/voice';
import { lookOfActivity, missionClock, taskKey } from '@/lib/hud/actions';
import { renderMarkdown, reportOf, titleOf } from '@/lib/hud/markdown';
import { sendToAgent } from '@/lib/hud/agentLink';
import type { BrainTaskStatus } from '@/lib/brain';

/**
 * A task Jarvis is working on, as it works: which models it brought in, the plan it
 * split the work into, and a live log of every step (a command on the PC, a file read,
 * a search), with the clock running. When it finishes, the result and the full report.
 */
const props = defineProps<{ widget: HudWidget; index: number }>();

const { t } = useI18n();
const hud = useHudStore();
const { brainStatus } = storeToRefs(useVoiceStore());

const task = computed<BrainTaskStatus | undefined>(() =>
  brainStatus.value?.tasks.find((candidate) => taskKey(candidate) === props.widget.taskId),
);
const full = computed(() =>
  props.widget.taskId ? hud.taskResults[props.widget.taskId] : undefined,
);

const now = ref(Date.now());
let ticker: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  ticker = setInterval(() => (now.value = Date.now()), 1000);
});
onBeforeUnmount(() => {
  if (ticker) clearInterval(ticker);
});

const running = computed(() => task.value?.status === 'running');
const status = computed(() => {
  switch (task.value?.status) {
    case 'running':
      return 'running' as const;
    case 'done':
      return 'done' as const;
    case 'failed':
      return 'error' as const;
    default:
      return 'idle' as const;
  }
});
const statusLabel = computed(() =>
  task.value ? t(`hud.task.status.${task.value.status}`) : t('hud.task.status.cancelled'),
);

const elapsed = computed(() => {
  if (!task.value) return '00:00';
  const end = task.value.finishedAt ? Date.parse(task.value.finishedAt) : now.value;
  const seconds = Math.max(0, Math.floor((end - Date.parse(task.value.startedAt)) / 1000));
  const m = Math.floor(seconds / 60);
  return `${String(m).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
});

const lines = computed(() => {
  const started = task.value?.startedAt ?? '';
  return (task.value?.activity ?? []).map((line, i, all) => {
    const look = lookOfActivity(line.text);
    let label: string;
    let detail = look.detail;
    if (look.kind === 'plan') {
      label = t('hud.activity.plan', { n: look.detail });
      detail = '';
    } else if (look.kind === 'team') {
      label = `${t('hud.activity.team')} · ${look.tool}`;
    } else if (look.kind === 'browser') {
      label = `${t('hud.activity.browser')} · ${look.tool.replace('mcp__browser__', '')}`;
    } else if (look.kind === 'other') {
      label = look.tool.replace(/^mcp__/, '').replace(/__/g, ' · ');
    } else {
      label = t(`hud.activity.${look.kind}`);
    }
    return {
      key: `${line.at}-${i}`,
      clock: missionClock(line.at, started),
      icon: look.icon,
      kind: look.kind,
      label,
      detail,
      current: running.value && i === all.length - 1,
    };
  });
});

const resultText = computed(() => reportOf(full.value?.result || task.value?.result || ''));
const preview = computed(() => renderMarkdown(resultText.value.slice(0, 900)));
const sources = computed(() => full.value?.sources ?? task.value?.sources ?? []);
const where = computed(() => {
  if (task.value?.viaAccount) return t('hud.task.viaAccount');
  return task.value?.onPc ? t('hud.task.onPc') : t('hud.task.inCloud');
});

const code = computed(() => `TSK-${String(props.index + 1).padStart(2, '0')}`);

const log = ref<HTMLElement | null>(null);
watch(
  () => lines.value.length,
  async () => {
    await nextTick();
    if (log.value) log.value.scrollTop = log.value.scrollHeight;
  },
);

function stop() {
  if (task.value) sendToAgent({ type: 'brain_cancel', id: task.value.id });
}

function openReport() {
  if (!resultText.value || !props.widget.taskId) return;
  const title = task.value?.title || titleOf(resultText.value, t('hud.doc.untitled'));
  const body = sources.value.length
    ? `${resultText.value}\n\n## ${t('hud.task.sources')}\n\n${sources.value.map((s) => `- ${s}`).join('\n')}`
    : resultText.value;
  const doc = hud.createDocument(title, body, { taskId: props.widget.taskId });
  hud.openDocument(doc, 'user');
}

const copied = ref(false);
async function copyResult() {
  try {
    await navigator.clipboard.writeText(resultText.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1600);
  } catch {
    // Clipboard blocked: nothing to do but not pretend.
  }
}
</script>

<template>
  <HudWindow
    :widget="widget"
    :code="code"
    icon="ph:brain-duotone"
    :status="status"
    :status-label="statusLabel"
  >
    <div class="task">
      <div class="task-meta">
        <div class="meta-cell">
          <span class="hud-label">{{ t('hud.task.elapsed') }}</span>
          <span class="meta-value mono" :class="{ ticking: running }">{{ elapsed }}</span>
        </div>
        <div class="meta-cell">
          <span class="hud-label">{{ t('hud.task.cost') }}</span>
          <span class="meta-value mono">${{ (task?.costUsd ?? 0).toFixed(3) }}</span>
        </div>
        <div class="meta-cell">
          <span class="hud-label">{{ t('hud.kinds.task') }}</span>
          <span class="meta-value">{{ where }}</span>
        </div>
      </div>

      <div v-if="task?.models?.length" class="task-models">
        <span class="hud-label">{{ t('hud.task.models') }}</span>
        <span v-for="model in task.models" :key="model" class="hud-chip">
          <iconify-icon icon="ph:cpu-duotone"></iconify-icon>{{ model }}
        </span>
      </div>

      <div v-if="running" class="task-scan" aria-hidden="true"><span></span></div>

      <div v-if="task?.steps?.length" class="task-steps">
        <span class="hud-label">{{ t('hud.task.steps') }}</span>
        <ol>
          <li v-for="(step, i) in task.steps" :key="i" :class="{ failed: !step.ok }">
            <iconify-icon
              :icon="step.ok ? 'ph:check-circle-duotone' : 'ph:warning-circle-duotone'"
            ></iconify-icon>
            <span class="step-goal">{{ step.goal }}</span>
            <span v-if="step.model" class="hud-chip">{{ step.model }}</span>
          </li>
        </ol>
      </div>

      <div class="task-log-head">
        <span class="hud-label">{{ t('hud.task.log') }}</span>
        <span class="mono faint">{{ lines.length }}</span>
      </div>
      <div ref="log" class="task-log hud-scroll">
        <div v-if="!lines.length" class="log-empty">
          <iconify-icon icon="ph:circle-notch" class="hud-spin"></iconify-icon>
          {{ running ? task?.progress || t('hud.task.preparing') : t('hud.task.preparing') }}
        </div>
        <div
          v-for="line in lines"
          :key="line.key"
          class="log-line"
          :class="[line.kind, { current: line.current }]"
        >
          <span class="log-clock mono">{{ line.clock }}</span>
          <iconify-icon :icon="line.icon" class="log-icon"></iconify-icon>
          <span class="log-label">{{ line.label }}</span>
          <span v-if="line.detail" class="log-detail mono" :title="line.detail">{{
            line.detail
          }}</span>
        </div>
      </div>

      <div v-if="!running && resultText" class="task-result">
        <span class="hud-label">{{ t('hud.task.result') }}</span>
        <!-- eslint-disable-next-line vue/no-v-html -- renderMarkdown escapes everything it is given -->
        <div class="hud-prose result-preview hud-scroll" v-html="preview"></div>
      </div>
    </div>

    <template #footer>
      <span>{{ task?.kind?.toUpperCase() }} · {{ task?.difficulty?.toUpperCase() }}</span>
      <span class="spacer"></span>
      <button
        v-if="!running && resultText"
        type="button"
        class="hud-icon-btn"
        :title="copied ? t('hud.task.copied') : t('hud.task.copy')"
        @click="copyResult"
      >
        <iconify-icon :icon="copied ? 'ph:check' : 'ph:copy'"></iconify-icon>
      </button>
      <button v-if="running" type="button" class="hud-action-btn danger" @click="stop">
        <iconify-icon icon="ph:stop-circle-duotone"></iconify-icon>{{ t('hud.task.stop') }}
      </button>
      <button v-else-if="resultText" type="button" class="hud-action-btn" @click="openReport">
        <iconify-icon icon="ph:article-duotone"></iconify-icon>{{ t('hud.task.openReport') }}
      </button>
    </template>
  </HudWindow>
</template>

<style scoped>
.task {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  flex: 1;
  padding: 12px 14px 10px;
}

.task-meta {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.meta-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 7px 9px;
  border: 1px solid var(--hud-line-faint);
  background: rgba(var(--hud-rgb), 0.04);
}

.meta-value {
  font-size: 15px;
  color: var(--hud-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.meta-value.ticking {
  color: var(--hud-amber);
  text-shadow: 0 0 10px rgba(var(--hud-amber-rgb), 0.5);
}

.mono {
  font-family: var(--hud-mono);
}
.faint {
  color: var(--hud-faint);
  font-size: 11px;
}

.task-models {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.task-scan {
  position: relative;
  height: 2px;
  overflow: hidden;
  background: rgba(var(--hud-amber-rgb), 0.15);
}
.task-scan span {
  position: absolute;
  inset: 0 auto 0 0;
  width: 30%;
  background: linear-gradient(90deg, transparent, var(--hud-amber), transparent);
  animation: task-scan 1.6s ease-in-out infinite;
}
@keyframes task-scan {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(340%);
  }
}

.task-steps ol {
  list-style: none;
  margin: 6px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.task-steps li {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12.5px;
  color: var(--hud-text);
}
.task-steps li iconify-icon {
  color: var(--hud-green);
  flex-shrink: 0;
}
.task-steps li.failed iconify-icon {
  color: var(--hud-red);
}
.step-goal {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-log-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.task-log {
  flex: 1;
  min-height: 90px;
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 4px 0;
  border-top: 1px solid var(--hud-line-faint);
  border-bottom: 1px solid var(--hud-line-faint);
}

.log-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 4px;
  color: var(--hud-dim);
  font-size: 12.5px;
}

.log-line {
  display: grid;
  grid-template-columns: 50px 18px auto 1fr;
  align-items: center;
  gap: 6px;
  padding: 3px 4px;
  font-size: 12px;
  animation: log-in 0.35s ease-out both;
}
.log-line.current {
  background: linear-gradient(90deg, rgba(var(--hud-amber-rgb), 0.14), transparent);
}
.log-line.current .log-icon {
  color: var(--hud-amber);
  animation: hud-pulse 1s ease-in-out infinite;
}
.log-line.stepDone .log-icon {
  color: var(--hud-green);
}
.log-line.stepFailed .log-icon {
  color: var(--hud-red);
}
@keyframes log-in {
  from {
    opacity: 0;
    transform: translateX(-8px);
  }
}

.log-clock {
  font-size: 10.5px;
  color: var(--hud-faint);
}
.log-icon {
  color: var(--hud-accent);
  font-size: 14px;
}
.log-label {
  font-family: var(--hud-font);
  font-weight: 600;
  letter-spacing: 0.03em;
  white-space: nowrap;
}
.log-detail {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  color: var(--hud-dim);
}

.task-result {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 40%;
  min-height: 0;
}
.result-preview {
  font-size: 13px;
  padding: 2px 4px 2px 0;
  mask-image: linear-gradient(180deg, #000 75%, transparent);
}

.spacer {
  flex: 1;
}
</style>
