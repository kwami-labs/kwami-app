<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { useVoiceStore } from '@/stores/voice';
import { BRAIN_BILLING, type BrainBilling } from '@/lib/brain';

/**
 * How the brain pays: the Claude plan on the user's PC, the API key, which first, or
 * only one of them (the agent's brain/plan.py). The choice goes to the agent with the
 * rest of the brain and is saved with the kwami, where the PC's work thread reads it
 * for work with no call behind it, so it holds for scheduled work too.
 *
 * Below the choice, what the agent says this moment: what the next piece of Claude
 * work would use, why it is not the first choice when it is not, and what is left of
 * the plan as Claude Code itself reported it.
 */
const { t, locale } = useI18n();
const { brain, brainStatus } = storeToRefs(useVoiceStore());

const billing = computed(() => brain.value.billing);
function choose(mode: BrainBilling) {
  if (mode !== brain.value.billing) brain.value = { ...brain.value, billing: mode };
}

const state = computed(() => brainStatus.value?.billing ?? null);

/**
 * The agent reports only during a call, and the last report is kept for a day: an old
 * one says when it was, so "your subscription" from this morning is not read as now.
 */
const STALE_MS = 2 * 60_000;
const clockNow = ref(Date.now());
const ticking = setInterval(() => (clockNow.value = Date.now()), 30_000);
onBeforeUnmount(() => clearInterval(ticking));
const reportedAt = computed(() => {
  const at = brainStatus.value?.receivedAt;
  if (!state.value || !at || clockNow.value - at < STALE_MS) return '';
  return when(new Date(at).toISOString(), 'at');
});
/** The agent's report answers the choice it had: a click since then is on its way. */
const pending = computed(() => !!state.value && state.value.mode !== billing.value);

const nowLabel = computed(() =>
  state.value ? t(`brainBilling.now.${state.value.now}`) : t('brainBilling.nowUnknown'),
);

/**
 * A moment as the user says it, in one of two shapes: "until" (hasta las 14:30, hasta
 * el martes a las 9:00) or "at" (a las 14:30, el martes a las 9:00). Empty when unknown.
 */
function when(iso: string | null, shape: 'until' | 'at'): string {
  if (!iso) return '';
  const moment = new Date(iso);
  if (Number.isNaN(moment.getTime())) return '';
  const time = new Intl.DateTimeFormat(locale.value, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(moment);
  if (new Date().toDateString() === moment.toDateString()) {
    return t(`brainBilling.clock.${shape}Today`, { time });
  }
  const day = new Intl.DateTimeFormat(locale.value, { weekday: 'long' }).format(moment);
  return t(`brainBilling.clock.${shape}Day`, { day, time });
}

const windows = ['five_hour', 'seven_day', 'seven_day_opus', 'seven_day_sonnet', 'overage'];
function windowName(name: string): string {
  return t(`brainBilling.window.${windows.includes(name) ? name : 'other'}`);
}

const planLine = computed(() => {
  const plan = state.value?.plan;
  if (!plan) return '';
  if (plan.out) {
    const time = when(plan.until, 'until');
    return time ? t('brainBilling.planOutUntil', { time }) : t('brainBilling.planOut');
  }
  const window = windowName(plan.window);
  const time = when(plan.resetsAt, 'at');
  if (plan.utilization !== null) {
    const used = { percent: Math.round(plan.utilization * 100), window };
    return time
      ? t('brainBilling.planUsedUntil', { ...used, time })
      : t('brainBilling.planUsed', used);
  }
  // Claude Code gives no share while there is room: what it gives is when it renews.
  if (plan.status === 'allowed_warning') {
    return time
      ? t('brainBilling.planNearUntil', { window, time })
      : t('brainBilling.planNear', { window });
  }
  if (plan.status) {
    return time ? t('brainBilling.planOkUntil', { window, time }) : t('brainBilling.planOk');
  }
  return t('brainBilling.planUnknown');
});
const planUsed = computed(() => {
  const plan = state.value?.plan;
  if (!plan) return null;
  if (plan.out) return 100;
  return plan.utilization === null ? null : Math.round(plan.utilization * 100);
});
</script>

<template>
  <section class="billing" data-test="brain-billing">
    <header class="head">
      <iconify-icon icon="ph:wallet-duotone" class="icon" />
      <span class="title">{{ t('brainBilling.title') }}</span>
    </header>
    <p class="hint">{{ t('brainBilling.hint') }}</p>

    <div class="options" role="radiogroup" :aria-label="t('brainBilling.title')">
      <button
        v-for="mode in BRAIN_BILLING"
        :key="mode"
        type="button"
        role="radio"
        class="option"
        :class="{ active: billing === mode }"
        :aria-checked="billing === mode"
        :data-test="`billing-${mode}`"
        @click="choose(mode)"
      >
        <span class="name">{{ t(`brainBilling.mode.${mode}`) }}</span>
        <span class="desc">{{ t(`brainBilling.modeHint.${mode}`) }}</span>
      </button>
    </div>

    <div
      class="now"
      :class="pending ? 'unknown' : (state?.now ?? 'unknown')"
      data-test="billing-now"
    >
      <span class="label">{{ t('brainBilling.nowTitle') }}</span>
      <strong class="value">{{ pending ? t('brainBilling.pending') : nowLabel }}</strong>
      <span v-if="!pending && state?.why" class="why">{{ state.why }}</span>
      <span v-if="!pending && reportedAt" class="age" data-test="billing-age">{{
        t('brainBilling.reportedAt', { time: reportedAt })
      }}</span>
    </div>

    <ul v-if="state" class="facts">
      <li data-test="billing-plan">
        <iconify-icon icon="simple-icons:anthropic" />
        <span>{{ planLine }}</span>
      </li>
      <li v-if="planUsed !== null" class="meter" :aria-label="planLine">
        <span class="fill" :class="{ full: planUsed >= 100 }" :style="{ width: `${planUsed}%` }" />
      </li>
      <li data-test="billing-key">
        <iconify-icon icon="ph:key-duotone" />
        <span>{{ state.apiKey ? t('brainBilling.keyOn') : t('brainBilling.keyOff') }}</span>
      </li>
      <li v-if="!state.otherProvidersPaid" data-test="billing-others">
        <iconify-icon icon="ph:prohibit-duotone" />
        <span>{{ t('brainBilling.othersOff') }}</span>
      </li>
    </ul>
    <p class="hint small">{{ t('brainBilling.voiceApart') }}</p>
  </section>
</template>

<style scoped>
.billing {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: var(--radius-lg);
  background: var(--surface-1);
  border: 1px solid var(--surface-2);
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
.title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
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
.options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 6px;
}
.option {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid var(--surface-2);
  background: var(--surface-2);
  color: var(--text-secondary);
  text-align: left;
  cursor: pointer;
}
.option.active {
  border-color: var(--accent-primary);
  color: var(--text-primary);
}
.option .name {
  font-size: 12px;
  font-weight: 600;
}
.option .desc {
  font-size: 10px;
  line-height: 1.35;
  color: var(--text-tertiary);
}
.now {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px;
  padding: 8px;
  border-radius: 8px;
  border-left: 3px solid var(--text-muted);
  background: var(--surface-2);
}
.now.account {
  border-left-color: #4ade80;
}
.now.api {
  border-left-color: #60a5fa;
}
.now.none {
  border-left-color: #fbbf24;
}
.now .label {
  font-size: 11px;
  color: var(--text-tertiary);
}
.now .value {
  font-size: 12px;
  color: var(--text-primary);
}
.now .age {
  flex-basis: 100%;
  font-size: 10px;
  color: var(--text-tertiary);
}
.now .why {
  flex-basis: 100%;
  font-size: 11px;
  color: var(--text-secondary);
}
.facts {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.facts li {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-secondary);
}
.meter {
  height: 4px;
  border-radius: 2px;
  background: var(--surface-2);
  overflow: hidden;
}
.meter .fill {
  display: block;
  height: 100%;
  background: #4ade80;
}
.meter .fill.full {
  background: #fbbf24;
}
</style>
