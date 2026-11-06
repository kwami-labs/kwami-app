<script setup lang="ts">
/**
 * Conversation history as conversations.
 *
 * The panel listed every message of every session in one newest-first stream,
 * with no way to tell where one conversation ended and the next began. Each
 * session is a card here -- when it happened, how long it ran, how it opened --
 * and opening one loads its transcript, in the order it was spoken, and the
 * summary Zep keeps of it.
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { useMemoryStore, type MemoryMessage, type MemorySession } from '@/stores/memory';
import { getCurrentLocale, intlLocaleTag } from '@/i18n';

const { t } = useI18n();
const memoryStore = useMemoryStore();
const { sessions, sessionsLoading, sessionsError, sessionsNextOffset, transcripts } =
  storeToRefs(memoryStore);

const open = ref<string | null>(null);

const locale = computed(() => intlLocaleTag(getCurrentLocale()));

function when(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(locale.value, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function clock(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' });
}

/** Whole minutes between the first and last message; nothing under one. */
function duration(session: MemorySession): string {
  if (!session.started_at || !session.ended_at) return '';
  const ms = new Date(session.ended_at).getTime() - new Date(session.started_at).getTime();
  const minutes = Math.round(ms / 60_000);
  return Number.isFinite(minutes) && minutes >= 1 ? t('memory.sessionMinutes', { n: minutes }) : '';
}

function speaker(message: MemoryMessage): string {
  if (message.name) return message.name;
  const role = message.role || message.role_type;
  return role === 'user' || role === 'human' ? t('memory.you') : t('memory.assistantFallback');
}

function transcriptOf(threadId: string) {
  return transcripts.value[threadId];
}

function isUser(message: MemoryMessage): boolean {
  const role = message.role || message.role_type;
  return role === 'user' || role === 'human';
}

async function toggle(session: MemorySession) {
  if (open.value === session.thread_id) {
    open.value = null;
    return;
  }
  open.value = session.thread_id;
  await Promise.all([
    memoryStore.loadTranscript(session.thread_id),
    memoryStore.loadSummary(session.thread_id),
  ]);
}
</script>

<template>
  <div class="memory-sessions">
    <div v-if="sessionsLoading && !sessions.length" class="sessions-state">
      <iconify-icon icon="ph:spinner-gap-duotone" class="spin"></iconify-icon>
      {{ t('memory.loadingConversations') }}
    </div>
    <div v-else-if="sessionsError && !sessions.length" class="sessions-state error">
      <iconify-icon icon="ph:warning-duotone"></iconify-icon>
      {{ t('memory.conversationsLoadFailed', { message: sessionsError }) }}
      <button type="button" class="sessions-link" @click="memoryStore.loadSessions(true)">
        {{ t('memory.retry') }}
      </button>
    </div>
    <div v-else-if="!sessions.length" class="sessions-state">
      <iconify-icon icon="ph:chat-circle-dots-duotone"></iconify-icon>
      {{ t('memory.noConversationHistory') }}
    </div>

    <ul v-else class="sessions-list">
      <li
        v-for="session in sessions"
        :key="session.thread_id"
        class="session-card"
        :class="{ open: open === session.thread_id }"
      >
        <button
          type="button"
          class="session-head"
          :aria-expanded="open === session.thread_id"
          @click="toggle(session)"
        >
          <span class="session-when">
            <iconify-icon icon="ph:chats-circle-duotone"></iconify-icon>
            {{ when(session.started_at || session.created_at) }}
          </span>
          <span class="session-meta">
            <template v-if="session.unavailable">{{ t('memory.sessionUnavailable') }}</template>
            <template v-else>
              <span v-if="session.message_count !== null">{{
                t('memory.sessionMessages', { n: session.message_count }, session.message_count)
              }}</span>
              <span v-if="duration(session)"> · {{ duration(session) }}</span>
            </template>
          </span>
          <span class="session-preview">{{ session.preview || t('memory.sessionNoPreview') }}</span>
          <iconify-icon
            class="session-caret"
            :icon="open === session.thread_id ? 'ph:caret-up-bold' : 'ph:caret-down-bold'"
          ></iconify-icon>
        </button>

        <div v-if="open === session.thread_id" class="session-body">
          <div v-if="transcriptOf(session.thread_id)?.summary" class="session-summary">
            <span class="session-summary-label">{{ t('memory.conversationSummary') }}</span>
            <p>{{ transcriptOf(session.thread_id)?.summary }}</p>
          </div>
          <div
            v-if="
              transcriptOf(session.thread_id)?.loading &&
              !transcriptOf(session.thread_id)?.messages.length
            "
            class="sessions-state small"
          >
            <iconify-icon icon="ph:spinner-gap-duotone" class="spin"></iconify-icon>
            {{ t('memory.loadingConversation') }}
          </div>
          <div
            v-else-if="transcriptOf(session.thread_id)?.error"
            class="sessions-state small error"
          >
            {{
              t('memory.conversationLoadFailed', {
                message: transcriptOf(session.thread_id)?.error,
              })
            }}
          </div>
          <ol v-else class="transcript">
            <li
              v-for="(message, i) in transcriptOf(session.thread_id)?.messages || []"
              :key="message.uuid || i"
              class="line"
              :class="{ user: isUser(message) }"
            >
              <span class="line-head">
                <strong>{{ speaker(message) }}</strong>
                <time v-if="message.created_at">{{ clock(message.created_at) }}</time>
              </span>
              <span class="line-text">{{ message.content }}</span>
            </li>
          </ol>
          <button
            v-if="transcriptOf(session.thread_id)?.hasMore"
            type="button"
            class="sessions-link"
            :disabled="transcriptOf(session.thread_id)?.loading"
            @click="memoryStore.loadTranscript(session.thread_id, true)"
          >
            {{ t('memory.loadMoreMessages') }}
          </button>
        </div>
      </li>
    </ul>

    <button
      v-if="sessions.length && sessionsNextOffset !== null"
      type="button"
      class="sessions-more"
      :disabled="sessionsLoading"
      @click="memoryStore.loadMoreSessions()"
    >
      <iconify-icon
        :icon="sessionsLoading ? 'ph:spinner-gap-duotone' : 'ph:clock-counter-clockwise-duotone'"
        :class="{ spin: sessionsLoading }"
      ></iconify-icon>
      {{ t('memory.loadMoreSessions') }}
    </button>
  </div>
</template>

<style scoped>
.memory-sessions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sessions-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  font-size: 12px;
  color: var(--text-tertiary);
  text-align: center;
}
.sessions-state.small {
  padding: 8px;
}
.sessions-state.error {
  color: var(--text-secondary);
}
.sessions-state iconify-icon {
  font-size: 22px;
}
.sessions-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 420px;
  overflow-y: auto;
}
.session-card {
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  background: var(--surface-1);
  overflow: hidden;
}
.session-card.open {
  border-color: var(--accent-primary);
}
.session-head {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 2px 8px;
  padding: 8px 10px;
  background: none;
  border: none;
  color: inherit;
  text-align: left;
  cursor: pointer;
  font: inherit;
}
.session-when {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}
.session-meta {
  font-size: 11px;
  color: var(--text-tertiary);
  justify-self: end;
}
.session-preview {
  grid-column: 1;
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.session-caret {
  grid-column: 2;
  justify-self: end;
  color: var(--text-tertiary);
}
.session-body {
  border-top: 1px solid var(--glass-border);
  padding: 8px 10px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.session-summary {
  padding: 8px;
  border-radius: 6px;
  background: var(--surface-2, var(--surface-1));
  font-size: 12px;
  color: var(--text-secondary);
}
.session-summary p {
  margin: 4px 0 0;
  line-height: 1.4;
}
.session-summary-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--accent-primary);
}
.transcript {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 320px;
  overflow-y: auto;
}
.line {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 8px;
  border-left: 3px solid var(--accent-secondary);
  border-radius: 0 6px 6px 0;
  background: var(--surface-2, var(--surface-1));
}
.line.user {
  border-left-color: var(--accent-primary);
}
.line-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  color: var(--text-secondary);
}
.line-head time {
  color: var(--text-tertiary);
}
.line-text {
  font-size: 12px;
  line-height: 1.4;
  color: var(--text-secondary);
  white-space: pre-wrap;
}
.sessions-link,
.sessions-more {
  align-self: center;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid var(--glass-border);
  border-radius: 6px;
  background: var(--surface-1);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
}
.sessions-link:disabled,
.sessions-more:disabled {
  opacity: 0.6;
  cursor: default;
}
.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
