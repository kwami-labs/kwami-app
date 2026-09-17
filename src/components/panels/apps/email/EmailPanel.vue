<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BasePanel from '@/components/ui/BasePanel.vue';
import { panelIcons } from '@/constants/panel-icons';
import { useEmailStore } from '@/stores/email';
import { useWorkspaceStore } from '@/stores/workspace';
import EmailActivation from './EmailActivation.vue';
import SmartHubInbox from './SmartHubInbox.vue';
import EmailThread from './EmailThread.vue';
import EmailCompose from './EmailCompose.vue';

const { t } = useI18n();
const emailStore = useEmailStore();
const workspaceStore = useWorkspaceStore();

type View = 'loading' | 'activation' | 'inbox' | 'thread' | 'compose';
const currentView = ref<View>('loading');
const replyContext = ref<{ to: string; subject: string } | null>(null);

async function loadAccount() {
  currentView.value = 'loading';
  try {
    await emailStore.fetchAccount();
  } catch {
    // API unreachable
  }
  currentView.value = emailStore.isActivated ? 'inbox' : 'activation';
}

function handleSelectConversation(address: string) {
  emailStore.selectConversation(address);
  currentView.value = 'thread';
}

function handleCompose() {
  replyContext.value = null;
  currentView.value = 'compose';
}

function handleBack() {
  emailStore.selectConversation(null);
  emailStore.selectMessage(null);
  replyContext.value = null;
  currentView.value = 'inbox';
}

function handleDeactivated() {
  currentView.value = 'activation';
}

watch(() => workspaceStore.activeWorkspaceId, () => {
  loadAccount();
});

watch(() => emailStore.isActivated, (activated) => {
  if (activated && currentView.value === 'activation') {
    currentView.value = 'inbox';
  }
});

onMounted(() => {
  loadAccount();
});
</script>

<template>
  <BasePanel
    :title="t('sidebar.panels.email')"
    :icon="panelIcons.email"
    :no-padding="currentView !== 'loading' && currentView !== 'activation'"
  >
    <div v-if="currentView === 'loading'" key="loading" class="center-state">
      <iconify-icon icon="ph:spinner-gap-bold" class="spin loading-icon"></iconify-icon>
    </div>

    <EmailActivation v-if="currentView === 'activation'" key="activation" />

    <SmartHubInbox
      v-if="currentView === 'inbox'"
      key="inbox"
      @select-conversation="handleSelectConversation"
      @compose="handleCompose"
      @deactivated="handleDeactivated"
    />

    <EmailThread
      v-if="currentView === 'thread'"
      key="thread"
      @back="handleBack"
    />

    <EmailCompose
      v-if="currentView === 'compose'"
      key="compose"
      :reply-to="replyContext"
      @back="handleBack"
    />
  </BasePanel>
</template>

<style scoped>
.center-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px;
  grid-column: 1 / -1;
}

.loading-icon {
  font-size: 28px;
  color: var(--accent-primary);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
