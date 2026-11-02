<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { useVoiceStore } from '@/stores/voice';
import { useAuthStore } from '@/stores/auth';

/**
 * The Claude plan as the brain's main account. The login is Claude Code's, on the
 * user's own PC, made in Anthropic's own page: this card only shows how to start it
 * and what the agent reports, a yes or a no. It never asks for anything secret.
 */
const { t } = useI18n();
const { brainStatus } = storeToRefs(useVoiceStore());
const auth = useAuthStore();

type State = 'on' | 'noLogin' | 'off' | 'unknown';
const state = computed<State>(() => {
  const account = brainStatus.value?.account;
  if (!account) return 'unknown';
  if (account.loggedIn) return 'on';
  return account.pcOnline ? 'noLogin' : 'off';
});
const label = computed(
  () =>
    ({
      on: t('mind.accountOn'),
      noLogin: t('mind.accountNoLogin'),
      off: t('mind.accountOff'),
      unknown: t('mind.accountUnknown'),
    })[state.value],
);

// Through the worker: its Claude Code is the one to sign in, and often the only one.
const loginCommand = 'scripts\\brain-worker.cmd --login';
const workerCommand = computed(
  () => `scripts\\brain-worker.cmd --user ${auth.userId || '<user id>'}`,
);

const copied = ref('');
let timer: ReturnType<typeof setTimeout> | null = null;
async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    return; // The command stays on screen to select by hand.
  }
  copied.value = text;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => (copied.value = ''), 1500);
}
onBeforeUnmount(() => {
  if (timer) clearTimeout(timer);
});
</script>

<template>
  <section class="account" :class="state">
    <header class="head">
      <iconify-icon icon="simple-icons:anthropic" class="icon" />
      <div class="names">
        <span class="title">{{ t('mind.accountTitle') }}</span>
        <span class="state"><i class="dot" /> {{ label }}</span>
      </div>
    </header>
    <p class="hint">{{ t('mind.accountHint') }}</p>
    <template v-if="state !== 'on'">
      <div class="step">
        <span class="hint">{{ t('mind.accountStep1') }}</span>
        <button class="command" :title="t('mind.copy')" @click="copy(loginCommand)">
          <code>{{ loginCommand }}</code>
          <span class="copy">{{
            copied === loginCommand ? t('mind.copied') : t('mind.copy')
          }}</span>
        </button>
      </div>
      <div class="step">
        <span class="hint">{{ t('mind.accountStep2') }}</span>
        <button class="command" :title="t('mind.copy')" @click="copy(workerCommand)">
          <code>{{ workerCommand }}</code>
          <span class="copy">{{
            copied === workerCommand ? t('mind.copied') : t('mind.copy')
          }}</span>
        </button>
      </div>
    </template>
    <p class="hint small">{{ t('mind.accountNeedsPc') }}</p>
  </section>
</template>

<style scoped>
.account {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: var(--radius-lg);
  background: var(--surface-1);
  border: 1px solid var(--surface-2);
}
.account.on {
  border-color: rgba(74, 222, 128, 0.5);
}
.head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.icon {
  font-size: 20px;
  color: var(--accent-primary);
  flex-shrink: 0;
}
.names {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.state {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-secondary);
}
.dot {
  width: 7px;
  height: 7px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--text-muted);
}
.on .dot {
  background: #4ade80;
}
.noLogin .dot,
.off .dot {
  background: #fbbf24;
}
.hint {
  margin: 0;
  font-size: 11px;
  line-height: 1.4;
  color: var(--text-tertiary);
}
.hint.small {
  font-size: 10px;
}
.step {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.command {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid var(--surface-2);
  background: var(--surface-2);
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
}
.command code {
  font-size: 10px;
  font-family: var(--font-mono, monospace);
  overflow-wrap: anywhere;
  min-width: 0;
}
.copy {
  font-size: 10px;
  color: var(--accent-primary);
  flex-shrink: 0;
}
</style>
