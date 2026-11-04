<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import PanelSection from '@/components/ui/PanelSection.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import { api } from '@/lib/apiClient';
import { useWorkspaceStore } from '@/stores/workspace';

interface Site {
  host: string;
  url: string;
  state: 'pending' | 'connected' | 'signed_out' | 'refused';
}

/** Pages only a signed-in user sees, so a daily look can tell when the session has gone. */
const SUGGESTED = [
  { name: 'Gmail', host: 'mail.google.com', url: 'https://mail.google.com/mail/u/0/' },
  { name: 'GitHub', host: 'github.com', url: 'https://github.com/settings/profile' },
  { name: 'LinkedIn', host: 'www.linkedin.com', url: 'https://www.linkedin.com/feed/' },
  { name: 'Amazon', host: 'www.amazon.es', url: 'https://www.amazon.es/gp/css/homepage.html' },
  { name: 'Notion', host: 'www.notion.so', url: 'https://www.notion.so/' },
];
const POLL_MS = 2000;
/** A little over what the PC holds a window for. */
const GIVE_UP_MS = 11 * 60 * 1000;

const { t } = useI18n();
const workspaceStore = useWorkspaceStore();

const online = ref(false);
const claudeLogin = ref(false);
const site = ref('');
const sites = ref<Site[]>([]);
const suggested = computed(() =>
  SUGGESTED.filter((item) => !sites.value.some((known) => known.host === item.host)),
);
const busy = ref(false);
const message = ref('');
let timer: ReturnType<typeof setTimeout> | undefined;

function stopWaiting() {
  if (timer) clearTimeout(timer);
  timer = undefined;
}

async function refresh() {
  try {
    const status = await api.get<{ online: boolean; claude_login: boolean }>('/pc/status');
    online.value = status.online;
    claudeLogin.value = status.claude_login;
  } catch {
    online.value = false;
    return;
  }
  try {
    sites.value = (await api.get<{ sites: Site[] }>('/pc/sites')).sites;
  } catch {
    // The PC is still there: only the list is missing for now.
    sites.value = [];
  }
}

async function forgetSite(host: string) {
  try {
    await api.del(`/pc/sites/${encodeURIComponent(host)}`);
    await refresh();
  } catch {
    message.value = t('assistant.pcFailed');
  }
}

function follow(id: string, started: number) {
  timer = setTimeout(async () => {
    try {
      const order = await api.get<{ status: string; result: string }>(`/pc/orders/${id}`);
      if (order.status !== 'queued' && order.status !== 'running') {
        busy.value = false;
        message.value = order.result;
        void refresh();
        return;
      }
    } catch {
      // A blip: the next look decides.
    }
    if (Date.now() - started > GIVE_UP_MS) {
      busy.value = false;
      message.value = t('assistant.pcFailed');
      return;
    }
    follow(id, started);
  }, POLL_MS);
}

async function order(path: string, body: Record<string, string>, waiting: string) {
  const kwamiId = workspaceStore.activeWorkspaceId;
  if (!kwamiId) return;
  stopWaiting();
  busy.value = true;
  message.value = waiting;
  try {
    const { id } = await api.post<{ id: string }>(path, { kwami_id: kwamiId, ...body });
    follow(id, Date.now());
  } catch {
    busy.value = false;
    message.value = t('assistant.pcFailed');
    void refresh();
  }
}

function connectClaude() {
  void order('/pc/claude', {}, t('assistant.pcClaudeWaiting'));
}

function openSite(address = site.value.trim()) {
  if (!address) return;
  void order('/pc/sites', { address }, t('assistant.pcSiteWaiting'));
  site.value = '';
}

onMounted(() => void refresh());
onUnmounted(stopWaiting);
</script>

<template>
  <PanelSection :title="t('assistant.pcTitle')" icon="ph:desktop-duotone">
    <p v-if="!online" class="pc-text">{{ t('assistant.pcOffline') }}</p>
    <template v-else>
      <p class="pc-text">
        {{ claudeLogin ? t('assistant.pcClaudeReady') : t('assistant.pcClaudeMissing') }}
      </p>
      <BaseButton size="sm" :loading="busy" @click="connectClaude">
        {{ claudeLogin ? t('assistant.pcClaudeChange') : t('assistant.pcClaudeConnect') }}
      </BaseButton>

      <p class="pc-text">{{ t('assistant.pcSiteHelp') }}</p>
      <div v-for="known in sites" :key="known.host" class="pc-site">
        <span class="pc-site__host">{{ known.host }}</span>
        <span class="pc-site__state">{{ t(`assistant.pcState.${known.state}`) }}</span>
        <BaseButton
          v-if="known.state !== 'connected'"
          size="sm"
          :loading="busy"
          @click="openSite(known.url)"
        >
          {{ t('assistant.pcSiteOpen') }}
        </BaseButton>
        <BaseButton variant="secondary" size="sm" @click="forgetSite(known.host)">
          {{ t('assistant.pcSiteForget') }}
        </BaseButton>
      </div>
      <div v-if="suggested.length" class="pc-site">
        <BaseButton
          v-for="item in suggested"
          :key="item.host"
          variant="secondary"
          size="sm"
          :loading="busy"
          @click="openSite(item.url)"
        >
          {{ item.name }}
        </BaseButton>
      </div>
      <BaseInput
        v-model="site"
        :label="t('assistant.pcSiteLabel')"
        placeholder="github.com"
        block
      />
      <BaseButton size="sm" :loading="busy" :disabled="!site.trim()" @click="openSite()">
        {{ t('assistant.pcSiteOpen') }}
      </BaseButton>
    </template>
    <p v-if="message" class="pc-note" role="status">{{ message }}</p>
  </PanelSection>
</template>

<style scoped>
.pc-text {
  margin: 0.5rem 0;
  font-size: 0.875rem;
  line-height: 1.4;
}

.pc-site {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.pc-site__host {
  font-weight: 500;
}

.pc-site__state {
  color: var(--text-muted);
  font-size: 0.8125rem;
}

.pc-note {
  margin: 0.25rem 0 0;
  color: var(--text-muted);
  font-size: 0.8125rem;
}
</style>
