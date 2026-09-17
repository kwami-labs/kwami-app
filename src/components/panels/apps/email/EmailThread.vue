<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useEmailStore, normalizeEmail, peerDisplayName } from '@/stores/email';
import BaseButton from '@/components/ui/BaseButton.vue';

const emit = defineEmits<{ (e: 'back'): void }>();
const { t } = useI18n();
const emailStore = useEmailStore();

const threadEl = ref<HTMLElement | null>(null);
const replyText = ref('');
const selectedSubjectKey = ref<string | null>(null);

const address = computed(() => emailStore.selectedConversationAddress);
const messages = computed(() => emailStore.conversationMessages);

type SubjectTab = {
  subjectKey: string;
  subjectLabel: string;
  count: number;
};

const peerName = computed(() => {
  if (!address.value) return '';
  return peerDisplayName(messages.value, address.value);
});

const peerEmailLine = computed(() => address.value ?? '');

function normalizeSubject(raw: string): string {
  if (!raw?.trim()) return '';
  return raw
    .trim()
    .replace(/^(re|fwd?|fw)\s*:\s*/gi, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

const subjectTabs = computed<SubjectTab[]>(() => {
  const groups = new Map<string, SubjectTab>();
  for (const msg of messages.value) {
    const normalized = normalizeSubject(msg.subject || '');
    const subjectKey = normalized || '__no_subject__';
    const subjectLabel = (msg.subject || '').trim() || t('email.inbox.noSubject');
    const existing = groups.get(subjectKey);
    if (existing) {
      existing.count += 1;
    } else {
      groups.set(subjectKey, {
        subjectKey,
        subjectLabel,
        count: 1,
      });
    }
  }
  return Array.from(groups.values()).sort((a, b) => b.count - a.count);
});

const filteredMessages = computed(() => {
  if (!selectedSubjectKey.value) return messages.value;
  return messages.value.filter((m) => {
    const normalized = normalizeSubject(m.subject || '');
    const key = normalized || '__no_subject__';
    return key === selectedSubjectKey.value;
  });
});

function toggleSubject(subjectKey: string) {
  selectedSubjectKey.value = selectedSubjectKey.value === subjectKey ? null : subjectKey;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );
}

function metaLine(msg: (typeof messages.value)[0]): string {
  const canon = address.value ?? '';
  if (msg.direction === 'inbound') {
    return `${t('email.thread.from')} ${msg.from_address}`;
  }
  const own = emailStore.account?.email_address
    ? normalizeEmail(emailStore.account.email_address)
    : '';
  const toRaw =
    msg.to_addresses.find((a) => normalizeEmail(a) !== own) ?? msg.to_addresses[0] ?? canon;
  return `${t('email.thread.you')} — ${t('email.thread.to')} ${toRaw}`;
}

function scrollToBottom() {
  nextTick(() => {
    if (threadEl.value) {
      threadEl.value.scrollTop = threadEl.value.scrollHeight;
    }
  });
}

async function sendReply() {
  if (!replyText.value.trim() || !address.value) return;
  const lastInbound = [...messages.value].reverse().find((m) => m.direction === 'inbound');
  const subject = lastInbound
    ? lastInbound.subject.startsWith('Re:')
      ? lastInbound.subject
      : `Re: ${lastInbound.subject}`
    : '';

  try {
    await emailStore.sendEmail({
      to: [address.value],
      subject,
      bodyText: replyText.value,
    });
    replyText.value = '';
    await emailStore.refreshInbox();
    scrollToBottom();
  } catch (e) {
    console.error('Failed to send reply:', e);
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendReply();
  }
}

onMounted(() => {
  messages.value.forEach((m) => {
    if (!m.is_read) emailStore.markRead(m.id);
  });
  scrollToBottom();
});

watch(messages, () => scrollToBottom(), { deep: true });
</script>

<template>
  <div class="thread-view">
    <div class="thread-header">
      <BaseButton size="sm" variant="ghost" icon="ph:arrow-left" @click="emit('back')" />
      <div class="thread-contact">
        <span class="contact-name">{{ peerName }}</span>
        <span class="contact-address">{{ peerEmailLine }}</span>
      </div>
    </div>

    <div class="thread-messages" ref="threadEl">
      <div v-if="messages.length === 0" class="thread-empty">
        <p>{{ t('email.thread.empty') }}</p>
      </div>

      <div v-if="subjectTabs.length > 0" class="subject-tabs">
        <button
          v-for="tab in subjectTabs"
          :key="tab.subjectKey"
          class="subject-tab"
          :class="{ active: selectedSubjectKey === tab.subjectKey }"
          @click="toggleSubject(tab.subjectKey)"
        >
          <span class="subject-tab-label">{{ tab.subjectLabel }}</span>
          <span class="subject-tab-count">{{ tab.count }}</span>
        </button>
      </div>

      <article
        v-for="msg in filteredMessages"
        :key="msg.id"
        class="mail-block"
        :class="msg.direction"
      >
        <div class="mail-meta">
          <span class="mail-meta-line" :title="metaLine(msg)">{{ metaLine(msg) }}</span>
          <time class="mail-time" :datetime="msg.received_at">{{ formatTime(msg.received_at) }}</time>
        </div>
        <div class="mail-subject">{{ msg.subject || t('email.inbox.noSubject') }}</div>
        <div class="mail-body">{{ msg.body_text || '…' }}</div>
      </article>
    </div>

    <div class="reply-bar">
      <div class="reply-label">{{ t('email.detail.reply') }}</div>
      <div class="reply-row">
        <textarea
          v-model="replyText"
          class="reply-input"
          :placeholder="t('email.thread.replyPlaceholder')"
          rows="3"
          @keydown="handleKeydown"
        ></textarea>
        <BaseButton
          size="sm"
          variant="primary"
          icon="ph:paper-plane-tilt-fill"
          :disabled="!replyText.trim()"
          :loading="emailStore.isSending"
          @click="sendReply"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.thread-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  grid-column: 1 / -1;
}

.thread-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--glass-border);
  flex-shrink: 0;
}

.thread-contact {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.contact-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.contact-address {
  font-size: 12px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.thread-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  scrollbar-width: thin;
  scrollbar-color: var(--surface-3) transparent;
}

.subject-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.subject-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--glass-border);
  background: var(--surface-1);
  color: var(--text-secondary);
  border-radius: 999px;
  padding: 6px 10px;
  cursor: pointer;
  white-space: nowrap;
  font-size: 11px;
  transition: all var(--duration-fast) ease;
}

.subject-tab:hover {
  border-color: color-mix(in srgb, var(--accent-primary) 45%, var(--glass-border));
}

.subject-tab.active {
  background: color-mix(in srgb, var(--accent-primary) 16%, var(--surface-1));
  border-color: color-mix(in srgb, var(--accent-primary) 60%, var(--glass-border));
  color: var(--text-primary);
}

.subject-tab-label {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.subject-tab-count {
  font-size: 10px;
  line-height: 1;
  padding: 3px 6px;
  border-radius: 999px;
  background: var(--surface-2);
}

.mail-subject {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.subject-tab.active .subject-tab-count {
  background: color-mix(in srgb, var(--accent-primary) 20%, var(--surface-2));
}

.thread-messages::-webkit-scrollbar {
  height: 8px;
}

.thread-messages::-webkit-scrollbar-thumb {
  background: var(--surface-3);
  border-radius: 8px;
}

.subject-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.subject-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 4px;
}

.subject-group-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subject-group-count {
  font-size: 10px;
  line-height: 1;
  color: var(--text-muted);
  background: var(--surface-2);
  border: 1px solid var(--glass-border);
  border-radius: 999px;
  padding: 4px 6px;
  flex-shrink: 0;
}

.mail-block {
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--surface-1);
  padding: 12px 14px;
  border-left: 3px solid var(--surface-3);
}

.mail-block.inbound {
  border-left-color: color-mix(in srgb, var(--accent-primary) 55%, var(--surface-3));
}

.mail-block.outbound {
  border-left-color: color-mix(in srgb, var(--text-muted) 40%, var(--surface-3));
  background: color-mix(in srgb, var(--surface-2) 80%, var(--surface-1));
}

.mail-meta {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.mail-meta-line {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.35;
  min-width: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.mail-time {
  font-size: 10px;
  color: var(--text-muted);
  white-space: nowrap;
  flex-shrink: 0;
  opacity: 0.85;
}

.mail-body {
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}

.thread-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 13px;
}

.reply-bar {
  padding: 12px 16px 14px;
  border-top: 1px solid var(--glass-border);
  flex-shrink: 0;
  background: var(--surface-1);
}

.reply-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.reply-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.reply-input {
  flex: 1;
  padding: 10px 14px;
  background: var(--surface-2);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
  outline: none;
  min-height: 72px;
  max-height: 200px;
  transition: border-color var(--duration-fast) ease;
}

.reply-input:focus {
  border-color: var(--accent-primary);
}

.reply-input::placeholder {
  color: var(--text-muted);
}
</style>
