import { ref, reactive, computed } from 'vue';

export interface TranscriptionMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface TranscriptionSessionRecord {
  id: string;
  createdAt: number;
  endedAt?: number;
  messages: TranscriptionMessage[];
}

const STORAGE_KEY = 'kwami.transcription.v1';
/** So session chips work after refresh (before next connect). */
const LAST_KWAMI_KEY = 'kwami.transcription.lastKwamiKey';

type PersistedStore = {
  version: number;
  byKwami: Record<string, TranscriptionSessionRecord[]>;
};

function loadStore(): PersistedStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { version: 1, byKwami: {} };
    const p = JSON.parse(raw) as PersistedStore;
    if (!p || typeof p.byKwami !== 'object') return { version: 1, byKwami: {} };
    return p;
  } catch {
    return { version: 1, byKwami: {} };
  }
}

function saveStore(store: PersistedStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota / private mode */
  }
}

function readLastKwamiKey(): string {
  try {
    return localStorage.getItem(LAST_KWAMI_KEY) ?? '';
  } catch {
    return '';
  }
}

function writeLastKwamiKey(key: string): void {
  try {
    localStorage.setItem(LAST_KWAMI_KEY, key);
  } catch {
    /* ignore */
  }
}

function sessionTitle(createdAt: number): string {
  return new Date(createdAt).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Live conversation buffer (current voice session)
const liveMessages = ref<TranscriptionMessage[]>([]);
const interimTranscript = ref<string | null>(null);
const isConnected = ref(false);
const currentKwamiKey = ref<string>('');
const liveSessionId = ref<string | null>(null);
const viewingHistoryId = ref<string | null>(null);
const historySnapshot = ref<TranscriptionMessage[]>([]);

const indicators = reactive({
  user: false,
  agent: false,
});

/** Shown in the panel: live feed or a read-only historical snapshot */
const messages = computed(() =>
  viewingHistoryId.value ? historySnapshot.value : liveMessages.value,
);

const sessionsForKwami = computed((): TranscriptionSessionRecord[] => {
  const k = currentKwamiKey.value;
  if (!k) return [];
  const store = loadStore();
  return [...(store.byKwami[k] ?? [])].sort((a, b) => b.createdAt - a.createdAt);
});

function persistLiveSessionNow(): void {
  if (!currentKwamiKey.value || !liveSessionId.value) return;
  const store = loadStore();
  const k = currentKwamiKey.value;
  const list = store.byKwami[k] ?? [];
  const idx = list.findIndex((s) => s.id === liveSessionId.value);
  if (idx === -1) return;
  const prev = list[idx]!;
  list[idx] = {
    id: prev.id,
    createdAt: prev.createdAt,
    endedAt: prev.endedAt,
    messages: liveMessages.value.map((m) => ({ ...m })),
  };
  store.byKwami[k] = list;
  saveStore(store);
}

function ensureLiveSessionInStore(): void {
  const k = currentKwamiKey.value;
  const sid = liveSessionId.value;
  if (!k || !sid) return;
  const store = loadStore();
  const list = store.byKwami[k] ?? [];
  if (!list.some((s) => s.id === sid)) {
    list.unshift({
      id: sid,
      createdAt: Date.now(),
      messages: [],
    });
    store.byKwami[k] = list;
    saveStore(store);
  }
}

function beginNewLiveSession(kwamiKey: string): void {
  currentKwamiKey.value = kwamiKey;
  writeLastKwamiKey(kwamiKey);
  viewingHistoryId.value = null;
  historySnapshot.value = [];
  liveSessionId.value = crypto.randomUUID();
  liveMessages.value = [];
  interimTranscript.value = null;
  ensureLiveSessionInStore();
}

function finalizeLiveSession(): void {
  const k = currentKwamiKey.value;
  const sid = liveSessionId.value;
  if (!k || !sid) return;
  const store = loadStore();
  const list = store.byKwami[k] ?? [];
  const idx = list.findIndex((s) => s.id === sid);
  if (idx !== -1) {
    const prev = list[idx]!;
    list[idx] = {
      id: prev.id,
      createdAt: prev.createdAt,
      endedAt: Date.now(),
      messages: liveMessages.value.map((m) => ({ ...m })),
    };
    store.byKwami[k] = list;
    saveStore(store);
  }
}

function findSessionAnywhere(
  sessionId: string,
): { kwamiKey: string; rec: TranscriptionSessionRecord } | null {
  const store = loadStore();
  for (const [kwamiKey, sessions] of Object.entries(store.byKwami)) {
    const rec = sessions.find((s) => s.id === sessionId);
    if (rec) return { kwamiKey, rec };
  }
  return null;
}

let listenersAttached = false;

function updateIndicators(state: 'idle' | 'listening' | 'thinking' | 'speaking') {
  indicators.user = false;
  indicators.agent = false;
  switch (state) {
    case 'listening':
      indicators.user = true;
      break;
    case 'speaking':
      indicators.agent = true;
      break;
  }
}

/**
 * The transcript arrives a sentence at a time, so one thing said with a pause in it read
 * as several messages. With nothing from the assistant between them, they are one.
 */
const SAME_MESSAGE_MS = 30_000;

function addMessage(role: 'user' | 'assistant' | 'system', content: string) {
  const now = Date.now();
  const last = liveMessages.value.at(-1);
  if (role === 'user' && last?.role === 'user' && now - last.timestamp < SAME_MESSAGE_MS) {
    const joined: TranscriptionMessage = {
      role,
      content: `${last.content} ${content}`,
      timestamp: now,
    };
    liveMessages.value = [...liveMessages.value.slice(0, -1), joined];
  } else {
    liveMessages.value = [...liveMessages.value, { role, content, timestamp: now }];
  }
  if (viewingHistoryId.value) {
    viewingHistoryId.value = null;
    historySnapshot.value = [];
  }
  persistLiveSessionNow();
  if (role === 'user') {
    updateIndicators('thinking');
    interimTranscript.value = null;
  } else if (role === 'assistant') {
    updateIndicators('listening');
  }
}

function clearMessages(): void {
  liveMessages.value = [];
  if (liveSessionId.value && currentKwamiKey.value) {
    const store = loadStore();
    const k = currentKwamiKey.value;
    const list = store.byKwami[k] ?? [];
    const idx = list.findIndex((s) => s.id === liveSessionId.value);
    if (idx !== -1) {
      const prev = list[idx]!;
      list[idx] = { id: prev.id, createdAt: prev.createdAt, endedAt: prev.endedAt, messages: [] };
      store.byKwami[k] = list;
      saveStore(store);
    }
  }
}

function openHistorySession(sessionId: string): void {
  const k = currentKwamiKey.value;
  let rec: TranscriptionSessionRecord | undefined;

  if (k) {
    rec = (loadStore().byKwami[k] ?? []).find((s) => s.id === sessionId);
  }
  if (!rec) {
    const found = findSessionAnywhere(sessionId);
    if (!found) return;
    rec = found.rec;
    currentKwamiKey.value = found.kwamiKey;
    writeLastKwamiKey(found.kwamiKey);
  }

  let rows = rec.messages.map((m) => ({ ...m }));
  // Stored copy may be empty until first message; live buffer may have newer lines.
  if (sessionId === liveSessionId.value && rows.length === 0 && liveMessages.value.length > 0) {
    rows = liveMessages.value.map((m) => ({ ...m }));
  }

  viewingHistoryId.value = sessionId;
  historySnapshot.value = rows;
}

function returnToLiveView(): void {
  viewingHistoryId.value = null;
  historySnapshot.value = [];
}

function deleteHistorySession(sessionId: string): void {
  const store = loadStore();
  for (const k of Object.keys(store.byKwami)) {
    store.byKwami[k] = (store.byKwami[k] ?? []).filter((s) => s.id !== sessionId);
  }
  saveStore(store);
  if (viewingHistoryId.value === sessionId) {
    returnToLiveView();
  }
}

// Global event listeners — attach once, never detach
function attachGlobalListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  // Restore kwami scope so history chips load before the next connect (e.g. after refresh).
  const last = readLastKwamiKey();
  if (last && !currentKwamiKey.value) {
    currentKwamiKey.value = last;
  }

  window.addEventListener('kwami:message', (e: Event) => {
    const detail = (e as CustomEvent).detail as { role: string; content: string };
    if (!detail?.content) return;
    addMessage(detail.role as 'user' | 'assistant' | 'system', detail.content);
  });

  window.addEventListener('kwami:sessionPrepare', (e: Event) => {
    const mid =
      ((e as CustomEvent).detail as { memoryUserId?: string } | undefined)?.memoryUserId ??
      'default';
    beginNewLiveSession(mid);
  });

  window.addEventListener('kwami:connected', () => {
    isConnected.value = true;
    updateIndicators('listening');
  });

  window.addEventListener('kwami:connectFailed', () => {
    finalizeLiveSession();
    liveSessionId.value = null;
    liveMessages.value = [];
    interimTranscript.value = null;
  });

  window.addEventListener('kwami:disconnected', () => {
    isConnected.value = false;
    updateIndicators('idle');
    interimTranscript.value = null;
    finalizeLiveSession();
  });

  window.addEventListener('kwami:stateChanged', (e: Event) => {
    updateIndicators((e as CustomEvent).detail);
  });

  window.addEventListener('kwami:interim', (e: Event) => {
    interimTranscript.value = (e as CustomEvent).detail as string;
  });
}

export function useTranscriptionState() {
  attachGlobalListeners();

  return {
    messages,
    liveMessages,
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
  };
}
