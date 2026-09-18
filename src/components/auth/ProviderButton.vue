<script setup lang="ts">
/**
 * One sign-in provider button.
 *
 * Replaces six `<button type="button">` elements that had aria-labels and no
 * click handler at all — the app's landing page shipped six controls that did
 * nothing when pressed.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseButton from '@/components/ui/BaseButton.vue';
import { useOAuthSignIn } from '@/composables/useOAuthSignIn';
import { useWeb3SignIn, type Web3Wallet } from '@/composables/useWeb3SignIn';
import type { ProviderDef } from './providers';

const props = defineProps<{ provider: ProviderDef }>();

const { t } = useI18n();
const oauth = useOAuthSignIn();
const web3 = useWeb3SignIn();

const isWeb3 = computed(() => !props.provider.oauth);
const isLoading = computed(() =>
  isWeb3.value ? web3.isLoading.value : oauth.isLoading.value,
);
const error = computed(() => (isWeb3.value ? web3.error.value : oauth.error.value));
const label = computed(() => t('auth.continueWith', { provider: t(props.provider.labelKey) }));
/** Only set for a wallet that is not installed; see useWeb3SignIn. */
const installUrl = computed(() => (isWeb3.value ? web3.installUrl.value : null));
const installLabel = computed(() =>
  t('auth.walletInstall', { wallet: t(props.provider.labelKey) }),
);

function onClick() {
  if (props.provider.oauth) {
    void oauth.signIn(props.provider.oauth);
  } else {
    void web3.signIn(props.provider.id as Web3Wallet);
  }
}
</script>

<template>
  <div class="provider-slot">
    <BaseButton
      variant="secondary"
      block
      :loading="isLoading"
      :icon="provider.icon"
      :aria-label="label"
      @click="onClick"
    >
      {{ label }}
    </BaseButton>
    <p v-if="error" class="provider-error" role="alert">{{ error }}</p>
    <!-- The tab is opened for them on click; this is the fallback for a blocked
         pop-up, and it gives keyboard and screen-reader users a real link. -->
    <a
      v-if="installUrl"
      class="provider-install"
      :href="installUrl"
      target="_blank"
      rel="noopener noreferrer"
    >
      {{ installLabel }}
    </a>
  </div>
</template>

<style scoped>
.provider-slot {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.provider-error {
  margin: 0;
  font-size: 12px;
  color: var(--danger, #ef4444);
  text-align: center;
}
.provider-install {
  font-size: 12px;
  font-weight: 700;
  text-align: center;
  color: rgba(248, 252, 255, 0.95);
  text-decoration: underline;
  text-underline-offset: 2px;
}
</style>
