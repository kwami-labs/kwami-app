<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useHudStore, type HudAction } from '@/stores/hud';
import { lookOf, tidyToolName } from '@/lib/hud/actions';

/**
 * Every tool Jarvis uses, as it uses it: a line appears when the call starts, sweeps
 * while it runs, and turns green or red when it ends. The voice says what it is doing;
 * this shows it.
 */
const { t, te } = useI18n();
const hud = useHudStore();
const collapsed = ref(false);
/** Clear of the sidebar's panel when it sits on the right. */
const position = computed(() => ({ right: `${16 + (hud.viewport.right ?? 0)}px` }));

const now = ref(Date.now());
let ticker: ReturnType<typeof setInterval> | null = null;

// Where it sits, for Jarvis's figure to keep clear of it (hud.avatar).
const root = ref<HTMLElement | null>(null);
let observer: ResizeObserver | null = null;
function report() {
  const el = root.value;
  hud.setLogRect(
    el && el.offsetWidth
      ? { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight }
      : null,
  );
}
watch(
  () => [hud.viewport.width, hud.viewport.height, hud.viewport.right],
  () => requestAnimationFrame(report),
);

onMounted(() => {
  ticker = setInterval(() => (now.value = Date.now()), 500);
  if (typeof ResizeObserver !== 'undefined' && root.value) {
    observer = new ResizeObserver(report);
    observer.observe(root.value);
  }
  report();
});
onBeforeUnmount(() => {
  if (ticker) clearInterval(ticker);
  observer?.disconnect();
  hud.setLogRect(null);
});

function label(action: HudAction): string {
  const look = lookOf(action.name);
  const key = `hud.tools.${look.labelKey ?? ''}`;
  return look.labelKey && te(key) ? t(key) : tidyToolName(action.name);
}

function took(action: HudAction): string {
  const ms = (action.endedAt ?? now.value) - action.startedAt;
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

const rows = computed(() =>
  hud.actions.slice(0, 9).map((action) => ({
    action,
    look: lookOf(action.name),
    label: label(action),
    took: took(action),
  })),
);
</script>

<template>
  <aside
    ref="root"
    class="action-log"
    :class="{ collapsed }"
    :style="position"
    :aria-label="t('hud.log.title')"
  >
    <header class="log-head">
      <span class="log-code">SYS // LOG</span>
      <span class="log-title">{{ t('hud.log.title') }}</span>
      <span v-if="hud.runningActions.length" class="log-live">{{ hud.runningActions.length }}</span>
      <button
        type="button"
        class="hud-icon-btn"
        :title="collapsed ? t('hud.log.expand') : t('hud.log.collapse')"
        @click="collapsed = !collapsed"
      >
        <iconify-icon :icon="collapsed ? 'ph:caret-down' : 'ph:caret-up'"></iconify-icon>
      </button>
    </header>
    <TransitionGroup v-if="!collapsed" tag="ol" name="log" class="log-list">
      <li v-if="!rows.length" key="empty" class="log-empty">{{ t('hud.log.empty') }}</li>
      <li
        v-for="row in rows"
        :key="row.action.id"
        class="log-row"
        :class="[row.action.phase, row.look.family]"
      >
        <span class="row-mark"></span>
        <iconify-icon :icon="row.look.icon" class="row-icon"></iconify-icon>
        <span class="row-text">
          <span class="row-label">{{ row.label }}</span>
          <span v-if="row.action.update || row.action.detail" class="row-detail">{{
            row.action.update || row.action.detail
          }}</span>
        </span>
        <span class="row-state">
          <iconify-icon
            v-if="row.action.phase === 'running'"
            icon="ph:circle-notch"
            class="hud-spin"
          ></iconify-icon>
          <iconify-icon v-else-if="row.action.phase === 'done'" icon="ph:check-bold"></iconify-icon>
          <iconify-icon v-else icon="ph:x-bold"></iconify-icon>
          <span class="row-took">{{ row.took }}</span>
        </span>
      </li>
    </TransitionGroup>
    <footer v-if="!collapsed && rows.length" class="log-foot">
      <button type="button" class="log-clear" @click="hud.clearActions()">
        {{ t('hud.log.clear') }}
      </button>
    </footer>
  </aside>
</template>

<style scoped>
.action-log {
  position: absolute;
  bottom: 76px;
  right: 16px;
  width: 290px;
  max-height: 42%;
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  border-left: 1px solid var(--hud-line);
  background: linear-gradient(
    90deg,
    rgba(var(--hud-rgb), 0.07),
    rgba(3, 12, 20, 0.55) 40%,
    rgba(3, 12, 20, 0.35)
  );
  backdrop-filter: blur(8px);
  z-index: 5;
}
.action-log::before {
  content: '';
  position: absolute;
  top: -1px;
  left: -1px;
  width: 40px;
  height: 2px;
  background: var(--hud-accent);
  box-shadow: 0 0 10px var(--hud-accent);
}

.log-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 4px 4px 10px;
}
.log-code {
  font-family: var(--hud-mono);
  font-size: 9.5px;
  color: var(--hud-accent);
  opacity: 0.8;
}
.log-title {
  flex: 1;
  font-family: var(--hud-font);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--hud-dim);
}
.log-live {
  min-width: 18px;
  padding: 0 5px;
  font-family: var(--hud-mono);
  font-size: 10px;
  text-align: center;
  color: #000;
  background: var(--hud-amber);
}

.log-list {
  position: relative;
  list-style: none;
  margin: 0;
  padding: 2px 0 6px;
  overflow: hidden;
}

.log-empty {
  padding: 6px 12px;
  font-family: var(--hud-mono);
  font-size: 11px;
  color: var(--hud-faint);
}

.log-row {
  position: relative;
  display: grid;
  grid-template-columns: 3px 18px 1fr auto;
  align-items: center;
  gap: 7px;
  padding: 5px 10px 5px 0;
  font-size: 12px;
}
.log-row + .log-row {
  border-top: 1px solid var(--hud-line-faint);
}
.row-mark {
  align-self: stretch;
  background: var(--hud-line-soft);
}
.log-row.running .row-mark {
  background: var(--hud-amber);
  box-shadow: 0 0 8px var(--hud-amber);
}
.log-row.running::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(var(--hud-amber-rgb), 0.12), transparent);
  animation: row-sweep 1.3s linear infinite;
  pointer-events: none;
}
@keyframes row-sweep {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(100%);
  }
}
.log-row.done .row-mark {
  background: var(--hud-green);
}
.log-row.error .row-mark,
.log-row.cancelled .row-mark {
  background: var(--hud-red);
}
.row-icon {
  font-size: 15px;
  color: var(--hud-accent);
}
.row-text {
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.row-label {
  font-family: var(--hud-font);
  font-weight: 600;
  font-size: 13px;
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.row-detail {
  font-family: var(--hud-mono);
  font-size: 10.5px;
  color: var(--hud-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.row-state {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}
.log-row.running .row-state {
  color: var(--hud-amber);
}
.log-row.done .row-state {
  color: var(--hud-green);
}
.log-row.error .row-state,
.log-row.cancelled .row-state {
  color: var(--hud-red);
}
.row-took {
  font-family: var(--hud-mono);
  font-size: 9.5px;
  color: var(--hud-faint);
}

.log-foot {
  display: flex;
  justify-content: flex-end;
  padding: 0 8px 6px;
}
.log-clear {
  padding: 0;
  border: 0;
  background: none;
  font-family: var(--hud-mono);
  font-size: 10px;
  color: var(--hud-faint);
  cursor: pointer;
}
.log-clear:hover {
  color: var(--hud-text);
}

.log-enter-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}
.log-enter-from {
  opacity: 0;
  transform: translateX(24px);
}
.log-leave-active {
  display: none;
}

.action-log.collapsed {
  width: 210px;
}

@media (max-width: 767px) {
  .action-log {
    display: none;
  }
}
</style>
