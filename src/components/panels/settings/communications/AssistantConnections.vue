<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { openUrl } from '@tauri-apps/plugin-opener';
import PanelSection from '@/components/ui/PanelSection.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import { api } from '@/lib/apiClient';
import { isTauri } from '@/lib/platform';
import { useWorkspaceStore } from '@/stores/workspace';

interface GoogleAccount {
  email: string;
  needs_reconnect: boolean;
  missing_scopes: string[];
}

interface GoogleStatus {
  configured: boolean;
  connected: boolean;
  email: string | null;
  accounts: GoogleAccount[];
}

/** Long enough to read the consent page, not so long it keeps asking for nothing. */
const WAIT_STEP_MS = 3000;
const WAIT_LIMIT_MS = 180_000;

const { t } = useI18n();
const workspaceStore = useWorkspaceStore();

const google = ref<GoogleStatus>({
  configured: false,
  connected: false,
  email: null,
  accounts: [],
});
const notifyTo = ref('');
const notifyChannel = ref('whatsapp');
const timezone = ref('Europe/Madrid');
const reportsEnabled = ref(false);
const busy = ref(false);
const message = ref('');
const googleMessage = ref('');
const waiting = ref(false);
let waitTimer: ReturnType<typeof setInterval> | undefined;

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function stopWaiting() {
  clearInterval(waitTimer);
  waitTimer = undefined;
  waiting.value = false;
}

/** Back from the browser: the page there can only say it is done, so ask again here. */
async function refreshGoogle() {
  const before = JSON.stringify(google.value.accounts);
  try {
    google.value = await api.get<GoogleStatus>('/google/status');
  } catch {
    return;
  }
  if (waiting.value && JSON.stringify(google.value.accounts) !== before) {
    stopWaiting();
    googleMessage.value = t('assistant.googleUpdated');
  }
}

function waitForGoogle() {
  stopWaiting();
  waiting.value = true;
  const startedAt = Date.now();
  waitTimer = setInterval(() => {
    if (Date.now() - startedAt >= WAIT_LIMIT_MS) stopWaiting();
    else void refreshGoogle();
  }, WAIT_STEP_MS);
}

async function load() {
  const kwamiId = workspaceStore.activeWorkspaceId;
  if (!kwamiId) return;
  try {
    google.value = await api.get<GoogleStatus>('/google/status');
    const { settings } = await api.get<{ settings: Record<string, unknown> }>(
      '/assistant/settings',
      { query: { kwami_id: kwamiId } },
    );
    notifyTo.value = String(settings.notify_to ?? '');
    notifyChannel.value = String(settings.notify_channel ?? 'whatsapp');
    timezone.value = String(settings.timezone ?? 'Europe/Madrid');
    reportsEnabled.value = Boolean(settings.reports_enabled);
  } catch (error) {
    message.value = errorText(error);
  }
}

async function connectGoogle() {
  busy.value = true;
  googleMessage.value = '';
  try {
    const { url } = await api.post<{ url: string }>('/google/connect');
    if (isTauri()) await openUrl(url);
    else window.open(url, '_blank', 'noopener');
    waitForGoogle();
  } catch (error) {
    googleMessage.value = errorText(error);
  } finally {
    busy.value = false;
  }
}

async function disconnectGoogle(email: string) {
  busy.value = true;
  googleMessage.value = '';
  try {
    await api.del('/google/account', { query: { account: email } });
    await refreshGoogle();
  } catch (error) {
    googleMessage.value = errorText(error);
  } finally {
    busy.value = false;
  }
}

async function save() {
  busy.value = true;
  message.value = '';
  try {
    await api.put('/assistant/settings', {
      kwami_id: workspaceStore.activeWorkspaceId,
      notify_to: notifyTo.value.trim() || null,
      notify_channel: notifyChannel.value,
      timezone: timezone.value,
      reports_enabled: reportsEnabled.value,
    });
    message.value = t('assistant.saved');
  } catch (error) {
    message.value = errorText(error);
  } finally {
    busy.value = false;
  }
}

onMounted(() => {
  void load();
  window.addEventListener('focus', refreshGoogle);
});

onUnmounted(() => {
  stopWaiting();
  window.removeEventListener('focus', refreshGoogle);
});
</script>

<template>
  <PanelSection :title="t('assistant.googleTitle')" icon="ph:google-logo-duotone">
    <p v-if="!google.configured">{{ t('assistant.googleNotConfigured') }}</p>
    <template v-else>
      <p v-if="!google.accounts.length">{{ t('assistant.googleDisconnected') }}</p>
      <div v-for="account in google.accounts" :key="account.email" class="assistant-account">
        <p class="assistant-account__email">{{ account.email }}</p>
        <p v-if="account.needs_reconnect" class="assistant-account__warning" role="alert">
          {{ t('assistant.googleNeedsReconnect') }}
        </p>
        <p v-else-if="account.missing_scopes.length" class="assistant-account__warning">
          {{ t('assistant.googleMissingScopes') }}
        </p>
        <p v-else class="assistant-account__ready">{{ t('assistant.googleReady') }}</p>
        <div class="assistant-account__actions">
          <BaseButton
            v-if="account.needs_reconnect || account.missing_scopes.length"
            size="sm"
            :loading="busy"
            @click="connectGoogle"
          >
            {{ t('assistant.googleReconnect') }}
          </BaseButton>
          <BaseButton
            variant="secondary"
            size="sm"
            :loading="busy"
            @click="disconnectGoogle(account.email)"
          >
            {{ t('assistant.googleDisconnect') }}
          </BaseButton>
        </div>
      </div>
      <BaseButton size="sm" :loading="busy" @click="connectGoogle">
        {{
          google.accounts.length
            ? t('assistant.googleConnectAnother')
            : t('assistant.googleConnect')
        }}
      </BaseButton>
      <p v-if="waiting" class="assistant-google-note" role="status">
        {{ t('assistant.googleWaiting') }}
      </p>
      <p v-else-if="googleMessage" class="assistant-google-note" role="status">
        {{ googleMessage }}
      </p>
    </template>
  </PanelSection>

  <PanelSection :title="t('assistant.reportsTitle')" icon="ph:calendar-check-duotone">
    <label class="assistant-row">
      <input v-model="reportsEnabled" type="checkbox" />
      <span>{{ t('assistant.reportsEnable') }}</span>
    </label>
    <BaseInput v-model="notifyTo" :label="t('assistant.notifyTo')" type="tel" block />
    <label class="assistant-row">
      <span>{{ t('assistant.notifyChannel') }}</span>
      <select v-model="notifyChannel">
        <option value="whatsapp">WhatsApp</option>
        <option value="sms">SMS</option>
      </select>
    </label>
    <BaseButton size="sm" :loading="busy" @click="save">{{ t('assistant.save') }}</BaseButton>
    <p v-if="message" role="status">{{ message }}</p>
  </PanelSection>
</template>

<style scoped>
.assistant-account {
  margin-bottom: 0.75rem;
  padding: 0.75rem;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
}

.assistant-account__email {
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--text-primary);
}

.assistant-account__ready,
.assistant-google-note {
  margin: 0.25rem 0 0;
  color: var(--text-muted);
  font-size: 0.8125rem;
}

.assistant-account__warning {
  margin: 0.25rem 0 0;
  color: var(--warning);
  font-size: 0.8125rem;
}

.assistant-account__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.625rem;
}

.assistant-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}
</style>
