<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { EmailConversation } from '@/stores/email';

const props = defineProps<{ conversation: EmailConversation }>();
const emit = defineEmits<{ (e: 'select', address: string): void }>();
const { t } = useI18n();

interface CategoryMeta {
  icon: string;
  color: string;
}

const UNCATEGORIZED_META: CategoryMeta = { icon: 'ph:envelope-duotone', color: '#94a3b8' };

const CATEGORY_META: Record<string, CategoryMeta> = {
  travel:        { icon: 'ph:airplane-duotone',       color: '#3b82f6' },
  bills:         { icon: 'ph:receipt-duotone',         color: '#f59e0b' },
  events:        { icon: 'ph:calendar-check-duotone',  color: '#8b5cf6' },
  newsletters:   { icon: 'ph:newspaper-duotone',       color: '#6366f1' },
  personal:      { icon: 'ph:user-circle-duotone',     color: '#22c55e' },
  notifications: { icon: 'ph:bell-ringing-duotone',    color: '#ef4444' },
  shopping:      { icon: 'ph:shopping-bag-duotone',    color: '#ec4899' },
  work:          { icon: 'ph:briefcase-duotone',       color: '#0ea5e9' },
  uncategorized: UNCATEGORIZED_META,
};

const categoryMeta = computed<CategoryMeta>(
  () => CATEGORY_META[props.conversation.category] ?? UNCATEGORIZED_META,
);

const initials = computed(() => {
  const name = props.conversation.displayName;
  const parts = name.split(/[\s._-]+/).filter(Boolean);
  const [first, second] = parts;
  if (first && second) return (first.charAt(0) + second.charAt(0)).toUpperCase();
  return name.slice(0, 2).toUpperCase();
});

const lastSnippet = computed(() => {
  const msg = props.conversation.lastMessage;
  const prefix = msg.direction === 'outbound' ? `${t('email.thread.you')}: ` : '';
  const subj = (msg.subject || '').trim();
  const body = (msg.body_text || '').trim();
  let line: string;
  if (subj && body) line = `${subj} — ${prefix}${body.slice(0, 72)}`;
  else if (subj) line = `${prefix}${subj}`.trim();
  else if (body) line = `${prefix}${body.slice(0, 96)}`;
  else line = prefix + t('email.inbox.noSubject');
  return line.slice(0, 120);
});

const timeAgo = computed(() => {
  const now = Date.now();
  const then = new Date(props.conversation.lastMessage.received_at).getTime();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('email.time.now');
  if (mins < 60) return t('email.time.minutesAgo', { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('email.time.hoursAgo', { n: hours });
  const days = Math.floor(hours / 24);
  return t('email.time.daysAgo', { n: days });
});

const hasUnread = computed(() => props.conversation.unreadCount > 0);
</script>

<template>
  <button
    class="conv-card"
    :class="{ unread: hasUnread }"
    @click="emit('select', conversation.address)"
  >
    <div class="avatar" :style="{ '--cat-color': categoryMeta.color }">
      <span class="avatar-initials">{{ initials }}</span>
    </div>

    <div class="conv-body">
      <div class="conv-top">
        <span class="conv-name" :class="{ bold: hasUnread }">{{ conversation.displayName }}</span>
        <span class="conv-time">{{ timeAgo }}</span>
      </div>
      <div class="conv-bottom">
        <span class="conv-snippet" :class="{ bold: hasUnread }">{{ lastSnippet }}</span>
        <div class="conv-badges">
          <iconify-icon
            :icon="categoryMeta.icon"
            class="cat-dot"
            :style="{ color: categoryMeta.color }"
          ></iconify-icon>
          <span v-if="hasUnread" class="unread-badge">{{ conversation.unreadCount }}</span>
        </div>
      </div>
    </div>
  </button>
</template>

<style scoped>
.conv-card {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 20px;
  background: none;
  border: none;
  border-bottom: 1px solid var(--glass-border);
  cursor: pointer;
  transition: background var(--duration-fast) ease;
  text-align: left;
  font-family: inherit;
}

.conv-card:last-child {
  border-bottom: none;
}

.conv-card:hover {
  background: var(--surface-1);
}

.conv-card.unread {
  background: color-mix(in srgb, var(--accent-primary) 4%, transparent);
}

.avatar {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--cat-color) 18%, var(--surface-2));
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-initials {
  font-size: 13px;
  font-weight: 700;
  color: var(--cat-color);
  letter-spacing: 0.5px;
}

.conv-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.conv-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.conv-name {
  font-size: 13px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conv-name.bold {
  font-weight: 600;
  color: var(--text-primary);
}

.conv-time {
  font-size: 10px;
  color: var(--text-muted);
  white-space: nowrap;
  flex-shrink: 0;
}

.conv-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.conv-snippet {
  font-size: 12px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.conv-snippet.bold {
  color: var(--text-secondary);
}

.conv-badges {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.cat-dot {
  font-size: 14px;
  opacity: 0.6;
}

.unread-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--accent-primary);
  color: white;
  font-size: 10px;
  font-weight: 700;
}
</style>
