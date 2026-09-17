<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import PanelSection from '@/components/ui/PanelSection.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import { usePwaInstall } from '@/composables/usePwaInstall';

const { t } = useI18n();
const { canPrompt, isInstalled, isPrompting, platform, showManualSteps, install } = usePwaInstall();

async function handleDownload() {
  await install();
}
</script>

<template>
  <PanelSection :title="t('account.installApp')" icon="ph:device-mobile-duotone">
    <div class="install-card">
      <div class="install-copy">
        <img src="/sphere.svg" alt="" class="install-icon" width="40" height="40" />
        <div class="install-text">
          <span class="install-title">{{ t('account.installTitle') }}</span>
          <span class="install-hint">{{ t('account.installHint') }}</span>
        </div>
      </div>

      <div v-if="isInstalled" class="installed-badge" data-testid="pwa-installed">
        <iconify-icon icon="ph:check-circle-duotone"></iconify-icon>
        {{ t('account.installed') }}
      </div>

      <BaseButton
        v-else
        variant="primary"
        icon="ph:download-simple-duotone"
        block
        :loading="isPrompting"
        data-testid="pwa-download"
        @click="handleDownload"
      >
        {{ t('account.downloadApp') }}
      </BaseButton>

      <p v-if="showManualSteps && platform === 'ios'" class="install-steps">
        {{ t('account.installIos') }}
      </p>
      <p v-else-if="showManualSteps && platform === 'android'" class="install-steps">
        {{ t('account.installAndroid') }}
      </p>
      <p v-else-if="showManualSteps && !canPrompt" class="install-steps">
        {{ t('account.installDesktop') }}
      </p>
    </div>
  </PanelSection>
</template>

<style scoped>
.install-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.install-copy {
  display: flex;
  align-items: center;
  gap: 12px;
}

.install-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  flex-shrink: 0;
  background: var(--surface-1);
}

.install-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.install-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.install-hint {
  font-size: 11px;
  line-height: 1.45;
  color: var(--text-muted);
}

.installed-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--surface-1);
  border-radius: var(--radius-md);
  font-size: 12px;
  font-weight: 500;
  color: var(--accent-primary);
}

.installed-badge iconify-icon {
  font-size: 16px;
}

.install-steps {
  margin: 0;
  padding: 10px 12px;
  background: var(--surface-1);
  border-radius: var(--radius-md);
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-muted);
}
</style>
