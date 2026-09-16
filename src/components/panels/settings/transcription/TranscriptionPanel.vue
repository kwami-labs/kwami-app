<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { panelIcons } from '@/constants/panel-icons';
import { useKwami } from '@/composables/useKwami';
import { useTranscriptionState } from '@/composables/useTranscriptionState';
import { useSearchResults } from '@/composables/useSearchResults';
import PanelHeaderControls from '@/components/ui/PanelHeaderControls.vue';
import { useThemeStore } from '@/stores/theme';
import { intlLocaleTag, getCurrentLocale } from '@/i18n';

const { kwami } = useKwami();
const { t } = useI18n();
const themeStore = useThemeStore();
const isRightSidebar = computed(() => themeStore.sidebarPosition === 'right');
const {
  query: searchQuery,
  results: searchItems,
  answer: searchAnswer,
  loading: searchLoading,
  error: searchError,
  clear: clearSearch,
  hasSearchData,
} = useSearchResults();
const {
  messages,
  interimTranscript,
  isConnected,
  indicators,
  sessionsForKwami,
  liveSessionId,
  viewingHistoryId,
  sessionTitle,
  addMessage,
  clearMessages,
  updateIndicators,
  openHistorySession,
  returnToLiveView,
  deleteHistorySession,
} = useTranscriptionState();

const isViewingHistory = computed(() => viewingHistoryId.value !== null);

// Local-only UI state
const inputMessage = ref('');
const conversationLog = ref<HTMLElement | null>(null);

// Helpers
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString(intlLocaleTag(getCurrentLocale()), {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function scrollToBottom() {
  nextTick(() => {
    if (conversationLog.value) {
      conversationLog.value.scrollTop = conversationLog.value.scrollHeight;
    }
  });
}

watch(
  () => messages.value.length,
  () => scrollToBottom(),
);

function clearLog() {
  clearMessages();
}

function sendMessage() {
  const text = inputMessage.value.trim();
  if (!text || !isConnected.value || isViewingHistory.value) return;

  kwami.value?.sendMessage(text);
  inputMessage.value = '';
}

function interrupt() {
  kwami.value?.interrupt();
  addMessage('system', `🛑 ${t('transcription.interrupted')}`);
  updateIndicators('listening');
}

// Keyboard shortcut (panel-local since it needs panel context)
const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && isConnected.value) {
    interrupt();
    addMessage('system', `🛑 ${t('transcription.interruptedEsc')}`);
  }
};

onMounted(() => {
  // Sync initial connection state
  if (kwami.value) {
    isConnected.value = kwami.value.isConnected();
  }
  document.addEventListener('keydown', onKeydown);
  scrollToBottom();
});

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <div class="panel-inner">
    <div class="panel-header">
      <iconify-icon :icon="panelIcons.transcription" class="panel-icon"></iconify-icon>
      <h2>{{ t('transcription.title') }}</h2>
      <template v-if="isRightSidebar">
        <PanelHeaderControls :show-divider="true" />
        <span class="message-count"
          >{{ messages.length }} {{ messages.length === 1 ? t('transcription.message') : t('transcription.messages') }}</span
        >
      </template>
      <template v-else>
        <span class="message-count"
          >{{ messages.length }} {{ messages.length === 1 ? t('transcription.message') : t('transcription.messages') }}</span
        >
        <PanelHeaderControls :show-divider="true" />
      </template>
    </div>

    <!-- Past sessions (stored locally per Kwami) -->
    <div v-if="sessionsForKwami.length" class="session-history">
      <div class="session-history-label">
        <iconify-icon icon="ph:clock-counter-clockwise-duotone"></iconify-icon>
        <span>{{ t('transcription.sessions') }}</span>
      </div>
      <div class="session-chips">
        <button
          v-if="isViewingHistory"
          type="button"
          class="session-chip session-chip-active"
          @click="returnToLiveView"
        >
          ← {{ t('transcription.current') }}
        </button>
        <button
          v-for="s in sessionsForKwami"
          :key="s.id"
          type="button"
          class="session-chip"
          :class="{ 'session-chip-selected': viewingHistoryId === s.id }"
          @click="openHistorySession(s.id)"
        >
          {{ sessionTitle(s.createdAt) }}
          <span v-if="s.id === liveSessionId && isConnected" class="session-live">{{ t('transcription.live') }}</span>
          <span
            v-if="s.id !== liveSessionId || !isConnected"
            class="session-delete"
            :title="t('transcription.removeFromHistory')"
            @click.stop="deleteHistorySession(s.id)"
          >
            <iconify-icon icon="ph:x"></iconify-icon>
          </span>
        </button>
      </div>
    </div>

    <div v-if="isViewingHistory" class="history-banner">
      <iconify-icon icon="ph:eye-duotone"></iconify-icon>
      <span>{{ t('transcription.readOnlyPast') }}</span>
      <button type="button" class="history-banner-btn" @click="returnToLiveView">{{ t('transcription.backToCurrent') }}</button>
    </div>

    <div class="panel-body transcription-body">
      <!-- Real-time indicator -->
      <div class="realtime-indicator">
        <div class="indicator-row" :class="{ active: indicators.user }">
          <iconify-icon icon="ph:microphone-duotone"></iconify-icon>
          <span>{{ t('transcription.listening') }}</span>
          <div class="voice-wave"><span></span><span></span><span></span><span></span></div>
        </div>
        <div class="indicator-row" :class="{ active: indicators.agent }">
          <iconify-icon icon="ph:speaker-high-duotone"></iconify-icon>
          <span>{{ t('transcription.speaking') }}</span>
          <div class="voice-wave"><span></span><span></span><span></span><span></span></div>
        </div>
      </div>

      <!-- Interim transcript -->
      <div v-if="interimTranscript && !isViewingHistory" class="interim-transcript">
        <span class="interim-label">{{ t('transcription.hearing') }}</span>
        <span class="interim-text">{{ interimTranscript }}</span>
      </div>

      <!-- Web search results (when agent used web_search) -->
      <div v-if="searchLoading || searchError || hasSearchData" class="search-results-section">
        <div class="search-results-header">
          <iconify-icon icon="ph:magnifying-glass-duotone"></iconify-icon>
          <span>{{ t('transcription.webSearch') }}</span>
          <button v-if="hasSearchData || searchError" class="search-clear" @click="clearSearch" :title="t('transcription.clearResults')">
            <iconify-icon icon="ph:x"></iconify-icon>
          </button>
        </div>
        <div v-if="searchLoading" class="search-loading">
          <iconify-icon icon="ph:spinner-gap-duotone" class="spin"></iconify-icon>
          {{ t('transcription.searching') }}
        </div>
        <div v-else-if="searchError" class="search-error">{{ searchError }}</div>
        <div v-else class="search-results-body">
          <p v-if="searchAnswer" class="search-answer">{{ searchAnswer }}</p>
          <p class="search-query">“{{ searchQuery }}”</p>
          <div class="search-list">
            <a
              v-for="(r, i) in searchItems"
              :key="i"
              :href="r.url"
              target="_blank"
              rel="noopener noreferrer"
              class="search-item"
            >
              <span class="search-item-title">{{ r.title }}</span>
              <span class="search-item-content">{{ r.content.slice(0, 160) }}{{ r.content.length > 160 ? '…' : '' }}</span>
            </a>
          </div>
        </div>
      </div>

      <!-- Conversation Log -->
      <div class="conversation-log" ref="conversationLog">
        <div v-if="messages.length === 0" class="log-empty">
          <iconify-icon icon="ph:chat-circle-dots-duotone"></iconify-icon>
          <span>{{ t('transcription.noMessages') }}</span>
          <span class="log-hint">{{ t('transcription.connectHint') }}</span>
        </div>

        <div v-for="(msg, index) in messages" :key="index" class="log-message" :class="msg.role">
          <div class="message-avatar">
            <iconify-icon
              :icon="
                msg.role === 'user'
                  ? 'ph:user-duotone'
                  : msg.role === 'assistant'
                    ? 'ph:robot-duotone'
                    : 'ph:info-duotone'
              "
            ></iconify-icon>
          </div>
          <div class="message-content">
            <div class="message-header">
              <span class="message-role">{{
                msg.role === 'user' ? t('transcription.you') : msg.role === 'assistant' ? t('transcription.kwami') : t('transcription.system')
              }}</span>
              <span class="message-time">{{ formatTime(msg.timestamp) }}</span>
            </div>
            <p class="message-text">{{ msg.content }}</p>
          </div>
        </div>
      </div>

      <!-- Message Input -->
      <div class="message-input-area">
        <div class="message-input-container">
          <input
            type="text"
            v-model="inputMessage"
            :placeholder="t('transcription.typeMessage')"
            :disabled="!isConnected || isViewingHistory"
            @keypress.enter="sendMessage"
          />
          <button
            class="send-btn"
            :disabled="!isConnected || !inputMessage.trim() || isViewingHistory"
            @click="sendMessage"
          >
            <iconify-icon icon="ph:paper-plane-right-duotone"></iconify-icon>
          </button>
        </div>
        <div class="input-actions">
          <button
            class="input-action-btn"
            :disabled="!isConnected || isViewingHistory"
            @click="interrupt"
            :title="t('transcription.interruptEsc')"
          >
            <iconify-icon icon="ph:hand-palm-duotone"></iconify-icon>
            {{ t('transcription.interrupt') }}
          </button>
          <button class="input-action-btn" @click="clearLog" :title="t('transcription.clearLog')">
            <iconify-icon icon="ph:trash-duotone"></iconify-icon>
            {{ t('transcription.clear') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.session-history {
  padding: 8px 12px 0;
  border-bottom: 1px solid var(--glass-border);
  background: var(--surface-0);
}

.session-history-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.session-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 72px;
  overflow-y: auto;
  padding-bottom: 8px;
}

.session-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid var(--glass-border);
  background: var(--surface-1);
  color: var(--text-secondary);
  font-size: 11px;
  cursor: pointer;
  max-width: 100%;
  transition: border-color 0.15s, background 0.15s;
}

.session-chip:hover {
  border-color: var(--accent-primary);
  color: var(--text-primary);
}

.session-chip-selected {
  border-color: var(--accent-primary);
  background: rgba(124, 92, 255, 0.12);
}

.session-chip-active {
  font-weight: 600;
}

.session-live {
  font-size: 9px;
  text-transform: uppercase;
  color: var(--success);
  font-weight: 700;
}

.session-delete {
  display: inline-flex;
  margin-left: 2px;
  opacity: 0.45;
  padding: 2px;
}

.session-delete:hover {
  opacity: 1;
  color: var(--accent-error);
}

.history-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(124, 92, 255, 0.08);
  border-bottom: 1px solid var(--glass-border);
  font-size: 12px;
  color: var(--text-secondary);
}

.history-banner-btn {
  margin-left: auto;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--glass-border);
  background: var(--surface-1);
  color: var(--accent-primary);
  font-size: 11px;
  cursor: pointer;
}

.history-banner-btn:hover {
  background: var(--surface-2);
}

.transcription-body {
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden; /* Flex container */
}

.realtime-indicator {
  padding: 12px 16px;
  background: var(--surface-1);
  border-bottom: 1px solid var(--glass-border);
  display: flex;
  gap: 16px;
  min-height: 48px;
}

.indicator-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-tertiary);
  opacity: 0.3;
  transition: all 0.3s;
}

.indicator-row.active {
  opacity: 1;
}

/* User listening: Blue */
.indicator-row:first-child.active {
  color: var(--accent-secondary);
  background: rgba(92, 156, 255, 0.1);
}

/* Agent speaking: Purple */
.indicator-row:last-child.active {
  color: var(--accent-primary);
  background: rgba(124, 92, 255, 0.1);
}

.voice-wave {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 12px;
}

.voice-wave span {
  width: 2px;
  height: 4px;
  background: currentColor;
  border-radius: 2px;
  animation: wave 0.8s ease-in-out infinite;
}

.voice-wave span:nth-child(2) {
  animation-delay: 0.1s;
}
.voice-wave span:nth-child(3) {
  animation-delay: 0.2s;
}
.voice-wave span:nth-child(4) {
  animation-delay: 0.3s;
}

@keyframes wave {
  0%,
  100% {
    height: 4px;
  }
  50% {
    height: 12px;
  }
}

.interim-transcript {
  padding: 8px 16px;
  background: var(--surface-2);
  border-bottom: 1px solid var(--glass-border);
  font-size: 12px;
  display: flex;
  gap: 8px;
  align-items: center;
}

.interim-label {
  color: var(--text-tertiary);
  font-weight: 500;
}

.interim-text {
  color: var(--text-secondary);
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-results-section {
  background: var(--surface-1);
  border-bottom: 1px solid var(--glass-border);
  padding: 12px 16px;
}

.search-results-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.search-results-header iconify-icon {
  font-size: 16px;
  color: var(--accent-primary);
}

.search-clear {
  margin-left: auto;
  padding: 4px;
  background: none;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: 4px;
}

.search-clear:hover {
  color: var(--text-primary);
  background: var(--surface-2);
}

.search-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.search-loading .spin {
  animation: spin 0.8s linear infinite;
}

.search-error {
  font-size: 12px;
  color: var(--accent-error);
}

.search-results-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.search-answer {
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.4;
  margin: 0;
}

.search-query {
  font-size: 11px;
  color: var(--text-tertiary);
  margin: 0;
}

.search-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 200px;
  overflow-y: auto;
}

.search-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  background: var(--surface-2);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  text-decoration: none;
  color: inherit;
  transition: background 0.2s;
}

.search-item:hover {
  background: var(--surface-0);
  border-color: var(--accent-primary);
}

.search-item-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent-primary);
}

.search-item-content {
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.3;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.conversation-log {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.log-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-tertiary);
  gap: 8px;
  opacity: 0.5;
}

.log-empty iconify-icon {
  font-size: 32px;
}

.log-hint {
  font-size: 11px;
}

.log-message {
  display: flex;
  gap: 12px;
  max-width: 90%;
  animation: fadeIn 0.3s ease-out;
}

.log-message.user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.log-message.system {
  align-self: center;
  max-width: 100%;
  opacity: 0.7;
}

.message-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--surface-2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.log-message.user .message-avatar {
  background: var(--accent-primary);
  color: #fff;
}

.message-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.log-message.user .message-content {
  align-items: flex-end;
}

.log-message.system .message-content {
  align-items: center;
}

.message-header {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: var(--text-tertiary);
}

.log-message.user .message-header {
  flex-direction: row-reverse;
}

.message-text {
  padding: 8px 12px;
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  border-top-left-radius: 2px;
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.4;
}

.log-message.user .message-text {
  background: var(--surface-2);
  border-color: var(--glass-border);
  border-radius: 12px;
  border-top-right-radius: 2px;
}

.log-message.system .message-text {
  background: transparent;
  border: 1px dashed var(--glass-border);
  padding: 4px 8px;
  font-size: 11px;
}

.message-input-area {
  padding: 16px;
  background: var(--surface-1);
  border-top: 1px solid var(--glass-border);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.message-input-container {
  display: flex;
  gap: 8px;
}

.message-input-container input {
  flex: 1;
  padding: 10px 14px;
  background: var(--surface-0);
  border: 1px solid var(--glass-border);
  border-radius: 20px;
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  transition: all 0.2s;
}

.message-input-container input:focus {
  border-color: var(--accent-primary);
  background: var(--surface-2);
}

.message-input-container input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.send-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--accent-primary);
  color: #fff;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.send-btn:hover:not(:disabled) {
  transform: scale(1.05);
}

.send-btn:disabled {
  background: var(--surface-2);
  color: var(--text-tertiary);
  cursor: not-allowed;
}

.input-actions {
  display: flex;
  justify-content: space-between;
}

.input-action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: transparent;
  border: none;
  color: var(--text-tertiary);
  font-size: 12px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.input-action-btn:hover:not(:disabled) {
  background: var(--surface-2);
  color: var(--text-secondary);
}

.input-action-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.message-count {
  font-size: 11px;
  padding: 2px 6px;
  background: var(--surface-2);
  border-radius: 10px;
  color: var(--text-tertiary);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
