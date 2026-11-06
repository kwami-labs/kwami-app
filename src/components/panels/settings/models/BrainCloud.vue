<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import BaseToggle from '@/components/ui/BaseToggle.vue';
import { ApiError } from '@/lib/apiClient';
import {
  brainCloud,
  type BrainJobRow,
  type BrainPlaces,
  type BrainSyncRow,
  type BrainTarget,
} from '@/lib/brainCloud';
import { useWorkspaceStore } from '@/stores/workspace';

/**
 * Where the brain works when nobody is on a call: the PC while it is on, the cloud
 * while it is off (if the user allows it), and what the cloud made that the PC
 * still has to bring home. Work can be asked from here, on the phone as well.
 */
const REFRESH_MS = 20_000;

const { t } = useI18n();
const workspaceStore = useWorkspaceStore();

const places = ref<BrainPlaces | null>(null);
const jobs = ref<BrainJobRow[]>([]);
const syncItems = ref<BrainSyncRow[]>([]);
const unavailable = ref(false);
const task = ref('');
const target = ref<BrainTarget>('auto');
const sending = ref(false);
const message = ref('');
let timer: ReturnType<typeof setInterval> | undefined;

const targetOptions = computed(() =>
  (['auto', 'pc', 'cloud'] as const).map((value) => ({
    value,
    label: t(`brainCloud.target.${value}`),
  })),
);
const pcLabel = computed(() => {
  const pc = places.value?.pc;
  if (!pc?.online) return t('brainCloud.pcOff');
  return pc.claude_login ? t('brainCloud.pcOnLogin') : t('brainCloud.pcOn');
});
const visibleSync = computed(() => syncItems.value.filter((s) => s.status !== 'discarded'));

/** A server without migration 029, or without the routes, says so once and stops asking. */
function notThere(e: unknown): boolean {
  return ApiError.is(e) && (e.status === 404 || e.status === 503);
}

async function refresh() {
  try {
    places.value = await brainCloud.places();
  } catch (e) {
    if (notThere(e)) {
      unavailable.value = true;
      stop();
    }
    return;
  }
  const kwamiId = workspaceStore.activeWorkspaceId;
  try {
    jobs.value = kwamiId ? await brainCloud.jobs(kwamiId) : [];
    syncItems.value = await brainCloud.sync();
  } catch {
    // The places are known; the lists come with the next look.
  }
}

async function allow(enabled: boolean) {
  try {
    await brainCloud.allowCloud(enabled);
  } catch {
    message.value = t('brainCloud.failed');
  }
  await refresh();
}

async function ask() {
  const kwamiId = workspaceStore.activeWorkspaceId;
  const words = task.value.trim();
  if (!kwamiId || !words || sending.value) return;
  sending.value = true;
  try {
    const queued = await brainCloud.ask(kwamiId, words, target.value);
    message.value = t(`brainCloud.queued.${queued.where}`);
    task.value = '';
  } catch (e) {
    message.value =
      ApiError.is(e) && e.status === 429 ? t('brainCloud.tooMany') : t('brainCloud.failed');
  } finally {
    sending.value = false;
  }
  await refresh();
}

async function cancel(job: BrainJobRow) {
  try {
    await brainCloud.cancel(job.id);
  } catch {
    // Already over: the list will say how it ended.
  }
  await refresh();
}

async function discard(item: BrainSyncRow) {
  try {
    await brainCloud.discardSync(item.id);
  } catch {
    // Already on its way to the PC.
  }
  await refresh();
}

function stop() {
  if (timer) clearInterval(timer);
  timer = undefined;
}

onMounted(() => {
  void refresh();
  timer = setInterval(() => void refresh(), REFRESH_MS);
});
onUnmounted(stop);
</script>

<template>
  <div class="cloud">
    <p v-if="unavailable" class="hint">{{ t('brainCloud.unavailable') }}</p>
    <template v-else>
      <p class="hint">{{ t('brainCloud.hint') }}</p>

      <div v-if="places" class="places">
        <div class="place" :class="{ on: places.pc.online }">
          <iconify-icon icon="ph:desktop-duotone" />
          <span class="place-name">{{ t('brainCloud.pc') }}</span>
          <span class="place-state">{{ pcLabel }}</span>
        </div>
        <div class="place" :class="{ on: places.cloud.online }">
          <iconify-icon icon="ph:cloud-duotone" />
          <span class="place-name">{{ t('brainCloud.cloud') }}</span>
          <span class="place-state">{{
            places.cloud.online ? t('brainCloud.cloudReady') : t('brainCloud.cloudAway')
          }}</span>
        </div>
        <BaseToggle
          size="sm"
          :model-value="places.cloud.enabled"
          :label="t('brainCloud.allow')"
          :description="t('brainCloud.allowHint')"
          @update:model-value="allow"
        />
        <p class="auto">{{ t(`brainCloud.auto.${places.auto}`) }}</p>
        <p v-if="places.sync.pending" class="pending">
          <iconify-icon icon="ph:arrows-down-up-duotone" />
          {{ t('brainCloud.pending', { count: places.sync.pending }) }}
        </p>
      </div>

      <div class="ask">
        <span class="label">{{ t('brainCloud.askTitle') }}</span>
        <textarea
          v-model="task"
          class="task"
          rows="2"
          maxlength="8000"
          :placeholder="t('brainCloud.askPlaceholder')"
        />
        <div class="ask-row">
          <BaseSelect v-model="target" :options="targetOptions" />
          <BaseButton size="sm" variant="primary" :loading="sending" @click="ask">
            {{ t('brainCloud.ask') }}
          </BaseButton>
        </div>
        <p v-if="message" class="message" role="status">{{ message }}</p>
      </div>

      <div class="list">
        <span class="label">{{ t('brainCloud.jobsTitle') }}</span>
        <p v-if="!jobs.length" class="hint">{{ t('brainCloud.noJobs') }}</p>
        <div v-for="job in jobs" :key="job.id" class="row">
          <div class="row-text">
            <span class="row-title">{{ job.title }}</span>
            <span class="row-sub">
              <i class="badge" :class="job.status">{{ t(`brainCloud.status.${job.status}`) }}</i>
              <template v-if="job.ran_on === 'cloud'">{{ t('brainCloud.ranOnCloud') }}</template>
              <template v-else-if="job.ran_on === 'pc'">{{ t('brainCloud.ranOnPc') }}</template>
              <template v-if="job.status === 'running' && job.progress">
                · {{ job.progress }}</template
              >
            </span>
          </div>
          <BaseButton
            v-if="job.status === 'queued' || job.status === 'running'"
            size="sm"
            variant="ghost"
            @click="cancel(job)"
          >
            {{ t('brainCloud.cancel') }}
          </BaseButton>
        </div>
      </div>

      <div v-if="visibleSync.length" class="list">
        <span class="label">{{ t('brainCloud.syncTitle') }}</span>
        <div v-for="item in visibleSync" :key="item.id" class="row">
          <div class="row-text">
            <span class="row-title">{{ item.title || t(`brainCloud.syncKind.${item.kind}`) }}</span>
            <span class="row-sub">
              <i class="badge" :class="item.status">{{
                t(`brainCloud.syncStatus.${item.status}`)
              }}</i>
              {{ t(`brainCloud.syncKind.${item.kind}`) }}
            </span>
            <span v-if="item.result" class="row-result">{{ item.result }}</span>
          </div>
          <BaseButton
            v-if="item.status === 'pending'"
            size="sm"
            variant="ghost"
            @click="discard(item)"
          >
            {{ t('brainCloud.discard') }}
          </BaseButton>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.cloud {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.hint {
  font-size: 11px;
  color: var(--text-tertiary);
  margin: 0;
  line-height: 1.4;
}
.places {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.place {
  display: grid;
  grid-template-columns: 18px auto minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  padding: 6px 10px;
  border-radius: var(--radius-lg);
  background: var(--surface-1);
  border: 1px solid var(--surface-2);
  font-size: 12px;
  color: var(--text-tertiary);
}
.place.on {
  border-color: var(--accent-primary);
  color: var(--text-primary);
}
.place-name {
  font-weight: 600;
}
.place-state {
  justify-self: end;
  font-size: 11px;
  text-align: right;
}
.auto,
.pending {
  font-size: 11px;
  margin: 0;
  color: var(--text-secondary);
  display: flex;
  gap: 4px;
  align-items: center;
}
.label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-secondary);
}
.ask {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.task {
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
  min-height: 48px;
  padding: 8px 10px;
  font: inherit;
  font-size: 12px;
  color: var(--text-primary);
  background: var(--surface-1);
  border: 1px solid var(--surface-2);
  border-radius: var(--radius-lg);
}
.task:focus {
  outline: none;
  border-color: var(--accent-primary);
}
.ask-row {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}
.ask-row > :first-child {
  flex: 1 1 140px;
  min-width: 0;
}
.message {
  font-size: 11px;
  margin: 0;
  color: var(--text-secondary);
}
.list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.row {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  border-radius: 8px;
  background: var(--surface-1);
}
.row-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.row-title {
  font-size: 12px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.row-sub,
.row-result {
  font-size: 10px;
  color: var(--text-tertiary);
  overflow-wrap: anywhere;
}
.badge {
  font-style: normal;
  padding: 1px 6px;
  margin-right: 4px;
  border-radius: 999px;
  border: 1px solid var(--surface-2);
}
.badge.done,
.badge.applied {
  border-color: var(--accent-primary);
  color: var(--text-primary);
}
.badge.failed,
.badge.conflict {
  border-color: rgba(248, 113, 113, 0.6);
  color: rgb(248, 113, 113);
}
.badge.running,
.badge.applying {
  border-style: dashed;
}
</style>
