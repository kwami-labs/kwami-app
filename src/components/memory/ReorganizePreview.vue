<script setup lang="ts">
import { api } from '@/lib/apiClient'
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'vue-toastification'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { translateApiUserMessage } from '@/utils/translateApiMessage'

const { t } = useI18n()

// apiBaseUrl is gone: the memory store owns the base URL now, so this
// component can no longer be pointed at a different host than the rest of
// the app by accident.
const props = defineProps<{
  userId: string
}>()

const emit = defineEmits<{
  (e: 'done'): void
}>()

const toast = useToast()

// State
interface OrphanPreview { uuid: string; name: string; summary: string | null; labels?: string[]; selected: boolean }
interface MergePreview { score: number; keep: { uuid: string; name: string; edge_count: number }; remove: { uuid: string; name: string; edge_count: number }; selected: boolean }

const showDialog = ref(false)
const loading = ref(false)
const applying = ref(false)
const previewOrphans = ref<OrphanPreview[]>([])
const previewMerges = ref<MergePreview[]>([])
const previewCommunities = ref(0)

async function fetchPreview() {
  loading.value = true
  try {
    const data = await api.post<{
      orphans?: OrphanPreview[]
      duplicates?: MergePreview[]
      communities_estimate?: number
    }>(`/memory/${props.userId}/reorganize/preview`, undefined, { timeoutMs: 60_000 })
    previewOrphans.value = (data.orphans || []).map((o: OrphanPreview) => ({ ...o, selected: true }))
    previewMerges.value = (data.duplicates || []).map((d: MergePreview) => ({ ...d, selected: true }))
    previewCommunities.value = data.communities_estimate || 0
    showDialog.value = true
  } catch (e) {
    toast.error(
      t('memoryReorg.previewFailed', { message: translateApiUserMessage((e as Error).message, t) }),
    )
  } finally {
    loading.value = false
  }
}

async function apply() {
  const selectedOrphans = previewOrphans.value.filter(o => o.selected).map(o => o.uuid)
  const selectedMerges = previewMerges.value.filter(m => m.selected).map(m => ({
    keep_uuid: m.keep.uuid,
    remove_uuid: m.remove.uuid,
  }))

  if (selectedOrphans.length === 0 && selectedMerges.length === 0) {
    toast.info(t('memoryReorg.noActionsSelected'))
    showDialog.value = false
    return
  }

  applying.value = true
  try {
    const result = await api.post<{
      report: { orphans_removed: number; merges_performed: number }
    }>(
      `/memory/${props.userId}/reorganize/apply`,
      { orphan_uuids: selectedOrphans, merge_pairs: selectedMerges },
      // Destructive graph surgery: never retried, and it can run long.
      { retry: false, timeoutMs: 120_000 },
    )
    const r = result.report
    toast.success(
      t('memoryReorg.doneReport', { orphans: r.orphans_removed, merges: r.merges_performed }),
      { timeout: 5000 },
    )
    showDialog.value = false
    emit('done')
  } catch (e) {
    toast.error(
      t('memoryReorg.applyFailed', { message: translateApiUserMessage((e as Error).message, t) }),
    )
  } finally {
    applying.value = false
  }
}

const selectedCount = () =>
  previewOrphans.value.filter(o => o.selected).length +
  previewMerges.value.filter(m => m.selected).length

const applyConfirmLabel = computed(() =>
  t('memoryReorg.applyWithCount', { count: selectedCount() }),
)

// Expose trigger method for parent
defineExpose({ fetchPreview, loading, applying })
</script>

<template>
  <ConfirmDialog
    :open="showDialog"
    :title="t('memoryReorg.previewTitle')"
    icon="ph:broom-duotone"
    :confirmLabel="applyConfirmLabel"
    confirmIcon="ph:check-bold"
    confirmVariant="primary"
    :loading="applying"
    @confirm="apply"
    @cancel="showDialog = false"
  >
    <p v-if="previewOrphans.length === 0 && previewMerges.length === 0" class="empty-msg">
      {{ t('memoryReorg.nothingToReorganize') }}
    </p>

    <!-- Orphans -->
    <div v-if="previewOrphans.length > 0" class="reorg-section">
      <div class="reorg-section-header">
        <iconify-icon icon="ph:trash-simple-duotone"></iconify-icon>
        <strong>{{
          t('memoryReorg.orphanTitle', {
            selected: previewOrphans.filter((o) => o.selected).length,
            total: previewOrphans.length,
          })
        }}</strong>
        <span class="reorg-hint">{{ t('memoryReorg.orphanHint') }}</span>
      </div>
      <div class="reorg-checklist">
        <label v-for="orphan in previewOrphans" :key="orphan.uuid" class="reorg-check-item">
          <input type="checkbox" v-model="orphan.selected" />
          <div class="reorg-check-info">
            <span class="reorg-check-name">{{ orphan.name }}</span>
            <span v-if="orphan.summary" class="reorg-check-sub">
              {{ orphan.summary.slice(0, 60) }}{{ orphan.summary.length > 60 ? '...' : '' }}
            </span>
          </div>
        </label>
      </div>
    </div>

    <!-- Merges -->
    <div v-if="previewMerges.length > 0" class="reorg-section">
      <div class="reorg-section-header">
        <iconify-icon icon="ph:git-merge-duotone"></iconify-icon>
        <strong>{{
          t('memoryReorg.duplicateTitle', {
            selected: previewMerges.filter((m) => m.selected).length,
            total: previewMerges.length,
          })
        }}</strong>
        <span class="reorg-hint">{{ t('memoryReorg.duplicateHint') }}</span>
      </div>
      <div class="reorg-checklist">
        <label v-for="(merge, idx) in previewMerges" :key="idx" class="reorg-check-item">
          <input type="checkbox" v-model="merge.selected" />
          <div class="reorg-check-info">
            <div class="merge-preview-row">
              <span class="merge-keep">{{ merge.keep.name }}</span>
              <iconify-icon icon="ph:arrow-left-duotone" class="merge-arrow-icon"></iconify-icon>
              <span class="merge-remove">{{ merge.remove.name }}</span>
              <span class="merge-score-badge">{{ merge.score }}%</span>
            </div>
          </div>
        </label>
      </div>
    </div>

    <!-- Communities info -->
    <div v-if="previewCommunities > 0" class="communities-info">
      <iconify-icon icon="ph:circles-three-plus-duotone"></iconify-icon>
      <span>{{
        t('memoryReorg.communitiesDetected', { n: previewCommunities }, previewCommunities)
      }}</span>
    </div>

    <p v-if="previewOrphans.length > 0 || previewMerges.length > 0" class="reorg-warning">
      {{ t('memoryReorg.warningUndo') }}
    </p>
  </ConfirmDialog>
</template>

<style scoped>
.empty-msg {
  text-align: center;
  color: var(--text-muted);
}

.reorg-section {
  margin-bottom: 14px;
}
.reorg-section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--text-primary);
}
.reorg-section-header iconify-icon {
  font-size: 16px;
  color: var(--accent-primary);
}
.reorg-hint {
  font-size: 10px;
  color: var(--text-muted);
  margin-left: auto;
}
.reorg-checklist {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 180px;
  overflow-y: auto;
  padding-right: 4px;
}
.reorg-check-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 10px;
  background: var(--surface-2);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--duration-fast) ease;
}
.reorg-check-item:hover {
  background: var(--surface-3);
}
.reorg-check-item input[type="checkbox"] {
  margin-top: 2px;
  accent-color: var(--accent-primary);
  flex-shrink: 0;
}
.reorg-check-info {
  flex: 1;
  min-width: 0;
}
.reorg-check-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.reorg-check-sub {
  font-size: 10px;
  color: var(--text-muted);
  display: block;
  margin-top: 2px;
}
.merge-preview-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.merge-keep {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent-primary);
}
.merge-remove {
  font-size: 12px;
  color: var(--text-muted);
  text-decoration: line-through;
}
.merge-arrow-icon {
  font-size: 12px;
  color: var(--text-muted);
}
.merge-score-badge {
  font-size: 9px;
  padding: 1px 6px;
  background: var(--accent-glow);
  color: var(--accent-primary);
  border-radius: 8px;
  font-weight: 700;
  margin-left: auto;
}
.communities-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--surface-2);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 10px;
}
.communities-info iconify-icon {
  font-size: 16px;
  color: var(--accent-primary);
}
.reorg-warning {
  margin-top: 12px;
  padding: 10px 12px;
  background: var(--error-glow, rgba(239, 68, 68, 0.08));
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--error, var(--accent-error));
}
</style>
