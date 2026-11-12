<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import PanelSection from '@/components/ui/PanelSection.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import {
  checkForUpdate,
  currentBuild,
  forceFreshReload,
  type UpdateCheckResult,
} from '@/lib/appUpdate';

const { t, locale } = useI18n();

const build = currentBuild();
const builtAt = computed(() => {
  const date = new Date(build.builtAt);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(
    date,
  );
});

const checking = ref(false);
const reloading = ref(false);
const result = ref<UpdateCheckResult | null>(null);

async function handleCheck() {
  checking.value = true;
  try {
    result.value = await checkForUpdate();
  } finally {
    checking.value = false;
  }
}

async function handleForceReload() {
  reloading.value = true;
  await forceFreshReload();
}
</script>

<template>
  <PanelSection :title="t('account.update.title')" icon="ph:arrows-clockwise-duotone">
    <div class="update-body">
      <p class="update-version" data-testid="app-build">
        {{ t('account.update.version', { sha: build.sha }) }}
        <span v-if="builtAt" class="update-date">· {{ builtAt }}</span>
      </p>

      <BaseButton
        variant="secondary"
        icon="ph:arrows-clockwise-duotone"
        block
        :loading="checking"
        data-testid="app-update-check"
        @click="handleCheck"
      >
        {{ t('account.update.check') }}
      </BaseButton>

      <p v-if="result" class="update-result" data-testid="app-update-result" role="status">
        {{ t(`account.update.result.${result}`) }}
      </p>

      <BaseButton
        variant="ghost"
        size="sm"
        icon="ph:broom-duotone"
        block
        :loading="reloading"
        data-testid="app-update-force"
        @click="handleForceReload"
      >
        {{ t('account.update.force') }}
      </BaseButton>
      <p class="update-hint">{{ t('account.update.forceHint') }}</p>
    </div>
  </PanelSection>
</template>

<style scoped>
.update-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.update-version {
  margin: 0;
  font-size: 12px;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.update-date {
  color: var(--text-muted);
}

.update-result,
.update-hint {
  margin: 0;
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-muted);
}

.update-result {
  padding: 10px 12px;
  background: var(--surface-1);
  border-radius: var(--radius-md);
}
</style>
