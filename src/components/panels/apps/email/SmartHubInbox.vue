<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useEmailStore, type EmailCategory } from '@/stores/email';
import ConversationCard from './ConversationCard.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';

const emit = defineEmits<{
  (e: 'selectConversation', address: string): void;
  (e: 'compose'): void;
  (e: 'deactivated'): void;
}>();

const { t } = useI18n();
const emailStore = useEmailStore();

const showMenu = ref(false);
const showReleaseDialog = ref(false);
const isReleasing = ref(false);

function toggleMenu() {
  showMenu.value = !showMenu.value;
}

function closeMenu() {
  showMenu.value = false;
}

function openReleaseDialog() {
  showMenu.value = false;
  showReleaseDialog.value = true;
}

async function confirmRelease() {
  isReleasing.value = true;
  try {
    await emailStore.deactivateEmail();
    showReleaseDialog.value = false;
    emit('deactivated');
  } catch (e) {
    console.error('Failed to release email:', e);
  } finally {
    isReleasing.value = false;
  }
}

const categories: { id: EmailCategory; icon: string }[] = [
  { id: 'all',            icon: 'ph:squares-four-duotone' },
  { id: 'personal',       icon: 'ph:user-circle-duotone' },
  { id: 'work',           icon: 'ph:briefcase-duotone' },
  { id: 'travel',         icon: 'ph:airplane-duotone' },
  { id: 'bills',          icon: 'ph:receipt-duotone' },
  { id: 'events',         icon: 'ph:calendar-check-duotone' },
  { id: 'shopping',       icon: 'ph:shopping-bag-duotone' },
  { id: 'newsletters',    icon: 'ph:newspaper-duotone' },
  { id: 'notifications',  icon: 'ph:bell-ringing-duotone' },
];

const filteredConversations = computed(() => {
  const cat = emailStore.activeCategory;
  if (!cat || cat === 'all') return emailStore.conversations;
  return emailStore.conversations.filter((c) => c.category === cat);
});

function selectCategory(cat: EmailCategory) {
  emailStore.setCategory(cat);
}

function badgeCount(cat: EmailCategory): number {
  if (cat === 'all') return emailStore.totalUnread;
  return emailStore.unreadCounts[cat] ?? 0;
}

function handleSelect(address: string) {
  emit('selectConversation', address);
}

onMounted(async () => {
  try {
    await emailStore.refreshInbox();
  } catch (e) {
    console.error('Failed to refresh inbox:', e);
  }
});
</script>

<template>
  <div class="smart-hub" @click="closeMenu">
    <!-- Header bar -->
    <div class="hub-header">
      <div class="hub-title-row">
        <span class="hub-email">{{ emailStore.account?.email_address }}</span>
        <div class="hub-actions">
          <BaseButton
            size="sm"
            variant="accent"
            icon="ph:pencil-simple-duotone"
            @click="emit('compose')"
          >
            {{ t('email.inbox.compose') }}
          </BaseButton>
          <div class="menu-anchor" @click.stop>
            <button class="menu-trigger" @click="toggleMenu" :title="t('email.menu.title')">
              <iconify-icon icon="ph:dots-three-vertical-bold"></iconify-icon>
            </button>
            <Transition name="popover">
              <div v-if="showMenu" class="menu-popover">
                <button class="menu-item" @click="emailStore.refreshInbox(); closeMenu()">
                  <iconify-icon icon="ph:arrow-clockwise"></iconify-icon>
                  {{ t('email.inbox.refresh') }}
                </button>
                <div class="menu-divider"></div>
                <button class="menu-item danger" @click="openReleaseDialog">
                  <iconify-icon icon="ph:trash-duotone"></iconify-icon>
                  {{ t('email.menu.releaseEmail') }}
                </button>
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </div>

    <!-- Category filter bar -->
    <div class="category-bar">
      <button
        v-for="cat in categories"
        :key="cat.id"
        class="cat-pill"
        :class="{ active: emailStore.activeCategory === cat.id }"
        @click="selectCategory(cat.id)"
      >
        <iconify-icon :icon="cat.icon" class="cat-icon"></iconify-icon>
        <span class="cat-label">{{ t(`email.categories.${cat.id}`) }}</span>
        <span v-if="badgeCount(cat.id)" class="cat-badge">{{ badgeCount(cat.id) }}</span>
      </button>
    </div>

    <!-- Release confirmation -->
    <ConfirmDialog
      :open="showReleaseDialog"
      :title="t('email.release.title')"
      icon="ph:warning-duotone"
      confirm-variant="danger"
      :confirm-label="t('email.release.confirm')"
      :cancel-label="t('email.release.cancel')"
      :loading="isReleasing"
      @confirm="confirmRelease"
      @cancel="showReleaseDialog = false"
    >
      <p>{{ t('email.release.warning') }}</p>
      <p><strong>{{ emailStore.account?.email_address }}</strong></p>
      <p class="warning-text">{{ t('email.release.permanent') }}</p>
    </ConfirmDialog>

    <!-- Conversations list -->
    <div class="conversation-list">
      <ConversationCard
        v-for="conv in filteredConversations"
        :key="conv.address"
        :conversation="conv"
        @select="handleSelect"
      />

      <div v-if="!emailStore.isLoading && filteredConversations.length === 0" class="empty-state">
        <iconify-icon icon="ph:chat-circle-dots-duotone" class="empty-icon"></iconify-icon>
        <p>{{ t('email.inbox.empty') }}</p>
      </div>

      <div v-if="emailStore.isLoading && filteredConversations.length === 0" class="loading-state">
        <iconify-icon icon="ph:spinner-gap-bold" class="spin"></iconify-icon>
      </div>
    </div>
  </div>
</template>

<style scoped>
.smart-hub {
  display: flex;
  flex-direction: column;
  gap: 0;
  grid-column: 1 / -1;
}

.hub-header {
  padding: 12px 20px;
  border-bottom: 1px solid var(--glass-border);
}

.hub-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.hub-email {
  font-size: 12px;
  font-family: 'JetBrains Mono', monospace;
  color: var(--text-muted);
  letter-spacing: -0.3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hub-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

/* --- Popover menu --- */
.menu-anchor { position: relative; }

.menu-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: none;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  font-size: 16px;
  transition: all var(--duration-fast) ease;
}

.menu-trigger:hover {
  background: var(--surface-2);
  color: var(--text-primary);
  border-color: var(--glass-border);
}

.menu-popover {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 180px;
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  z-index: 200;
  padding: 4px;
  backdrop-filter: blur(var(--glass-blur));
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  transition: all var(--duration-fast) ease;
  white-space: nowrap;
}

.menu-item iconify-icon { font-size: 16px; flex-shrink: 0; }
.menu-item:hover { background: var(--surface-2); color: var(--text-primary); }
.menu-item.danger { color: var(--error); }
.menu-item.danger:hover { background: var(--error-glow, rgba(248, 113, 113, 0.1)); }
.menu-divider { height: 1px; margin: 4px 8px; background: var(--glass-border); }

.popover-enter-active { animation: popIn 0.15s cubic-bezier(0.16, 1, 0.3, 1); }
.popover-leave-active { animation: popOut 0.1s ease-in; }

@keyframes popIn {
  from { opacity: 0; transform: scale(0.92) translateY(-4px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

@keyframes popOut {
  from { opacity: 1; transform: scale(1) translateY(0); }
  to { opacity: 0; transform: scale(0.95) translateY(-2px); }
}

/* --- Category bar --- */
.category-bar {
  display: flex;
  gap: 6px;
  padding: 12px 20px;
  overflow-x: auto;
  scrollbar-width: none;
  border-bottom: 1px solid var(--glass-border);
}

.category-bar::-webkit-scrollbar { display: none; }

.cat-pill {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: 20px;
  border: 1px solid var(--glass-border);
  background: var(--surface-1);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--duration-fast) ease;
  font-family: inherit;
}

.cat-pill:hover { background: var(--surface-2); color: var(--text-primary); }

.cat-pill.active {
  background: var(--accent-glow);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.cat-icon { font-size: 14px; }
.cat-label { font-size: 11px; }

.cat-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--accent-primary);
  color: white;
  font-size: 9px;
  font-weight: 700;
}

/* --- Conversation list --- */
.conversation-list {
  flex: 1;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--surface-3) transparent;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px 20px;
  color: var(--text-muted);
}

.empty-icon { font-size: 40px; opacity: 0.5; }
.empty-state p { font-size: 13px; margin: 0; }

.loading-state {
  display: flex;
  justify-content: center;
  padding: 40px;
}

.loading-state iconify-icon {
  font-size: 24px;
  color: var(--accent-primary);
}

.spin { animation: spin 1s linear infinite; }

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
