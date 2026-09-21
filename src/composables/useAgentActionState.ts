import { computed, ref } from 'vue';

type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';
export type AgentActionState = VoiceState | 'acting' | 'confirming' | 'error';

interface PendingConfirmation {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  expiresAt: number;
  timerId: number;
  resolve: (approved: boolean) => void;
}

const currentVoiceState = ref<VoiceState>('idle');
const transientState = ref<'acting' | 'error' | null>(null);
const lastAction = ref<string | null>(null);
const lastDetail = ref<string | null>(null);
const lastUpdatedAt = ref<number | null>(null);
const pendingConfirmation = ref<PendingConfirmation | null>(null);

let listenersAttached = false;
let transientResetTimer: number | null = null;

function clearTransientResetTimer() {
  if (transientResetTimer !== null) {
    window.clearTimeout(transientResetTimer);
    transientResetTimer = null;
  }
}

function announceToTranscript(content: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('kwami:message', {
      detail: {
        role: 'system',
        content,
      },
    }),
  );
}

function setLastAction(
  action: string,
  detail?: string,
  options?: { state?: 'acting' | 'error'; resetAfterMs?: number },
) {
  lastAction.value = action;
  lastDetail.value = detail ?? null;
  lastUpdatedAt.value = Date.now();
  transientState.value = options?.state ?? 'acting';
  scheduleTransientReset(options?.resetAfterMs ?? 2400);
}

function attachGlobalListeners() {
  if (listenersAttached || typeof window === 'undefined') return;
  listenersAttached = true;

  window.addEventListener('kwami:connected', () => {
    currentVoiceState.value = 'listening';
  });

  window.addEventListener('kwami:disconnected', () => {
    currentVoiceState.value = 'idle';
    if (pendingConfirmation.value) {
      const confirmation = pendingConfirmation.value;
      window.clearTimeout(confirmation.timerId);
      pendingConfirmation.value = null;
      confirmation.resolve(false);
    }
  });

  window.addEventListener('kwami:stateChanged', (e: Event) => {
    currentVoiceState.value = (e as CustomEvent).detail as VoiceState;
  });

  window.addEventListener('kwami:search_results', (e: Event) => {
    const detail = (e as CustomEvent).detail as { query?: string };
    setLastAction('Showing search results', detail?.query ? `Search: ${detail.query}` : undefined);
  });
}

function scheduleTransientReset(delayMs = 2400) {
  if (typeof window === 'undefined') return;
  clearTransientResetTimer();
  transientResetTimer = window.setTimeout(() => {
    transientState.value = null;
    transientResetTimer = null;
  }, delayMs);
}

export function useAgentActionState() {
  attachGlobalListeners();

  const state = computed<AgentActionState>(() => {
    if (pendingConfirmation.value) return 'confirming';
    if (transientState.value) return transientState.value;
    return currentVoiceState.value;
  });

  function recordAction(
    action: string,
    detail?: string,
    options?: { announce?: boolean; state?: 'acting' | 'error'; resetAfterMs?: number },
  ) {
    setLastAction(action, detail, options);

    if (options?.announce) {
      announceToTranscript(detail ? `${action}: ${detail}` : action);
    }
  }

  function recordError(message: string, detail?: string) {
    recordAction(message, detail, {
      announce: true,
      state: 'error',
      resetAfterMs: 4500,
    });
  }

  function requestConfirmation(options: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    timeoutMs?: number;
  }): Promise<boolean> {
    if (typeof window === 'undefined') return Promise.resolve(false);

    if (pendingConfirmation.value) {
      return Promise.resolve(false);
    }

    recordAction(options.title, options.message, {
      state: 'acting',
      announce: true,
      resetAfterMs: 1500,
    });

    return new Promise<boolean>((resolve) => {
      const timeoutMs = options.timeoutMs ?? 30000;
      const timerId = window.setTimeout(() => {
        pendingConfirmation.value = null;
        recordError('Confirmation timed out', options.message);
        resolve(false);
      }, timeoutMs);

      pendingConfirmation.value = {
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel ?? 'Confirm',
        cancelLabel: options.cancelLabel ?? 'Cancel',
        expiresAt: Date.now() + timeoutMs,
        timerId,
        resolve,
      };
    });
  }

  function resolveConfirmation(approved: boolean) {
    const confirmation = pendingConfirmation.value;
    if (!confirmation) return;

    window.clearTimeout(confirmation.timerId);
    pendingConfirmation.value = null;
    confirmation.resolve(approved);
  }

  return {
    state,
    lastAction,
    lastDetail,
    lastUpdatedAt,
    pendingConfirmation,
    recordAction,
    recordError,
    requestConfirmation,
    confirmPending: () => resolveConfirmation(true),
    cancelPending: () => resolveConfirmation(false),
  };
}
