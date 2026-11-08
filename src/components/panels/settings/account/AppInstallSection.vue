<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import PanelSection from '@/components/ui/PanelSection.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import { usePwaInstall } from '@/composables/usePwaInstall';
import { computed, onMounted, ref } from 'vue';
import {
  detectDevice,
  detectDeviceAccurately,
  detectNativeInstall,
  downloadNativeBuild,
  pickNativeBuild,
  type DeviceInfo,
} from '@/lib/nativeInstall';

const { t } = useI18n();

const { canPrompt, isInstalled, isPrompting, platform, showManualSteps, install } = usePwaInstall();
// The user agent answers at once; client hints may correct the processor a moment later.
const device = ref<DeviceInfo>(detectDevice());
onMounted(async () => {
  device.value = await detectDeviceAccurately();
});
const nativeState = computed(() => detectNativeInstall(device.value));
const nativeBuild = computed(() => pickNativeBuild(device.value));
// The PWA prompt only exists in a browser, so inside the native app its button would do nothing.
const insideNative = computed(() => nativeState.value === 'running');
const osName = computed(() => t(`account.nativeOs.${nativeBuild.value?.os ?? device.value.os}`));
const OS_ICONS: Record<string, string> = {
  windows: 'ph:windows-logo-duotone',
  macos: 'ph:apple-logo-duotone',
  linux: 'ph:linux-logo-duotone',
  android: 'ph:android-logo-duotone',
};

function handleNativeDownload() {
  if (nativeBuild.value) downloadNativeBuild(nativeBuild.value);
}

async function handleDownload() {
  await install();
}
</script>

<template>
  <PanelSection :title="t('account.installApp')" icon="ph:download-simple-duotone">
    <div class="install-options">
      <section class="install-card" data-testid="pwa-card">
        <div class="install-copy">
          <span class="install-icon install-icon--web">
            <iconify-icon icon="ph:globe-duotone"></iconify-icon>
          </span>
          <div class="install-text">
            <span class="install-heading">
              <span class="install-title">{{ t('account.installTitle') }}</span>
              <span class="install-tech install-tech--web">JS · PWA</span>
            </span>
            <span class="install-hint">{{ t('account.installHint') }}</span>
          </div>
        </div>

        <p v-if="insideNative" class="install-steps" data-testid="pwa-inside-native">
          {{ t('account.pwaInsideNative') }}
        </p>

        <template v-else>
          <div v-if="isInstalled" class="installed-badge" data-testid="pwa-installed">
            <iconify-icon icon="ph:check-circle-duotone"></iconify-icon>
            {{ t('account.installed') }}
          </div>

          <BaseButton
            v-else
            variant="primary"
            icon="ph:globe-duotone"
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
        </template>
      </section>

      <section class="install-card" data-testid="native-card">
        <div class="install-copy">
          <span class="install-icon install-icon--native">
            <iconify-icon icon="ph:devices-duotone"></iconify-icon>
          </span>
          <div class="install-text">
            <span class="install-heading">
              <span class="install-title">{{ t('account.nativeTitle') }}</span>
              <span class="install-tech install-tech--native">Rust · Tauri</span>
            </span>
            <span class="install-hint">{{ t('account.nativeHint') }}</span>
          </div>
        </div>

        <div v-if="nativeState === 'running'" class="installed-badge" data-testid="native-running">
          <iconify-icon icon="ph:check-circle-duotone"></iconify-icon>
          {{ t('account.nativeRunning') }}
        </div>

        <template v-else-if="nativeState === 'available' && nativeBuild">
          <BaseButton
            class="native-download"
            variant="secondary"
            :icon="OS_ICONS[nativeBuild.os]"
            block
            data-testid="native-download"
            @click="handleNativeDownload"
          >
            {{ t('account.nativeDownload', { os: osName, format: nativeBuild.format }) }}
          </BaseButton>
          <p class="install-steps" data-testid="native-steps">
            {{ t(`account.nativeSteps.${nativeBuild.os}`) }}
          </p>
        </template>

        <p v-else-if="device.os === 'ios'" class="install-steps" data-testid="native-unsupported">
          {{ t('account.nativeIos') }}
        </p>
        <p v-else class="install-steps" data-testid="native-unsupported">
          {{ t('account.nativeUnsupported', { os: osName }) }}
        </p>
      </section>
    </div>
  </PanelSection>
</template>

<style scoped>
.install-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.install-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
}

.install-copy {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.install-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  flex-shrink: 0;
  font-size: 22px;
  background: var(--surface-1);
}

.install-icon--web {
  color: var(--accent-primary);
}

.install-icon--native {
  color: var(--warning);
}

.install-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.install-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.install-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

/* Cyan and amber are too pale for text on the light theme, so they only colour the outline. */
.install-tech {
  padding: 1px 6px;
  border: 1px solid;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
}

.install-tech--web {
  border-color: var(--accent-primary);
}

.install-tech--native {
  border-color: var(--warning);
}

.install-card .native-download {
  border-color: var(--warning);
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
  color: var(--text-primary);
}

.installed-badge iconify-icon {
  font-size: 16px;
  color: var(--accent-primary);
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
