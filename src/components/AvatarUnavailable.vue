<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { AvatarUnavailableReason } from '@/lib/webgl';

/**
 * Shown where the avatar would be when it could not start.
 *
 * Without it a browser with no WebGL got a black canvas and nothing else:
 * production strips console output, so not even a log line said why.
 */
defineProps<{ reason: AvatarUnavailableReason }>();

const { t } = useI18n();
</script>

<template>
  <div class="avatar-unavailable" role="status" data-testid="avatar-unavailable">
    <h2 class="title">{{ t('avatarUnavailable.title') }}</h2>
    <template v-if="reason === 'webgl'">
      <p>{{ t('avatarUnavailable.webglBody') }}</p>
      <p class="hint">{{ t('avatarUnavailable.webglHint') }}</p>
    </template>
    <p v-else>{{ t('avatarUnavailable.errorBody') }}</p>
  </div>
</template>

<style scoped>
.avatar-unavailable {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  max-width: min(440px, calc(100% - 48px));
  padding: 20px 24px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.5;
  text-align: center;
  z-index: 1;
}

.title {
  margin: 0 0 8px;
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 600;
}

p {
  margin: 0;
}

.hint {
  margin-top: 8px;
  color: var(--text-muted);
  font-size: 13px;
}
</style>
