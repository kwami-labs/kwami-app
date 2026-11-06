import { onScopeDispose, watch } from 'vue';
import type { JarvisHandle } from './sync/rendererTypes';
import { useAgentActionState } from '@/composables/useAgentActionState';
import { useCreditsStore } from '@/stores/credits';

/**
 * Tells the Jarvis HUD what the app is doing.
 *
 * The renderer already reacts to what it can observe on its own (voice, pointer, typing,
 * window focus). What it cannot see is the session: the voice link coming up, a message
 * arriving, the agent running a tool, an action failing, the balance. Those already travel on
 * the `kwami:*` window bus and through `useAgentActionState`, so this only forwards them —
 * `signal()` for things that happen, `setStatus()` for things that are.
 *
 * HUD text is English and upper-case like the rest of the hologram's readouts; the transcript
 * is where the localised wording lives.
 */

/** 1234 → "1.2K", 992900 → "992.9K", 3400000 → "3.4M". */
export function formatHudAmount(value: number): string {
  const amount = Math.max(0, Math.floor(value));
  if (amount >= 1_000_000) return `${trim(amount / 1_000_000)}M`;
  if (amount >= 1_000) return `${trim(amount / 1_000)}K`;
  return String(amount);
}

function trim(value: number): string {
  // One decimal, floored so the HUD never shows more than there is.
  return (Math.floor(value * 10) / 10).toFixed(1).replace(/\.0$/, '');
}

interface MessageDetail {
  role?: string;
  content?: string;
}

interface BrowserSessionDetail {
  action?: string;
}

export function useJarvisSignals(getJarvis: () => JarvisHandle | undefined) {
  const actions = useAgentActionState();
  const credits = useCreditsStore();
  let linked = false;

  /** Rows of the SYSTEMS panel. A renderer switch builds a new HUD, so this is re-applied. */
  function syncStatus(): void {
    const jarvis = getJarvis();
    if (!jarvis) return;
    jarvis.setStatus('link', { label: 'Link', value: linked ? 'Live' : 'Standby', hot: linked });
    jarvis.setStatus(
      'energy',
      credits.balanceKnown
        ? {
            label: 'Energy',
            value: formatHudAmount(credits.displayBalance),
            hot: credits.hasCredits,
          }
        : null,
    );
  }

  function onConnected(): void {
    linked = true;
    syncStatus();
    getJarvis()?.signal('success', 'Voice link established');
  }

  function onDisconnected(): void {
    if (!linked) return;
    linked = false;
    syncStatus();
    getJarvis()?.signal('info', 'Voice link closed');
  }

  function onConnectFailed(): void {
    getJarvis()?.signal('error', 'Voice link failed');
  }

  function onInsufficientCredits(): void {
    getJarvis()?.signal('warning', 'Insufficient energy');
  }

  function onMessage(event: Event): void {
    const detail = (event as CustomEvent<MessageDetail>).detail;
    // System lines are the agent-action announcements; those arrive through `lastAction`.
    if (detail?.role === 'user') getJarvis()?.signal('message', 'Operator message');
    else if (detail?.role === 'assistant') getJarvis()?.log('Response delivered');
  }

  function onBrowserSession(event: Event): void {
    const action = (event as CustomEvent<BrowserSessionDetail>).detail?.action;
    if (action === 'open') getJarvis()?.signal('tool', 'Browser session open');
    else if (action === 'close') getJarvis()?.log('Browser session closed');
  }

  const listeners: Array<[string, (event: Event) => void]> = [
    ['kwami:connected', onConnected],
    ['kwami:disconnected', onDisconnected],
    ['kwami:connectFailed', onConnectFailed],
    ['kwami:insufficient-credits', onInsufficientCredits],
    ['kwami:message', onMessage],
    ['kwami:browser_session', onBrowserSession],
    ['kwami:rendererChanged', syncStatus],
    ['kwami:configApplied', syncStatus],
  ];
  for (const [name, handler] of listeners) window.addEventListener(name, handler);

  // Every action the agent takes in the app lands here; a failed one is an alert.
  const stopActions = watch(actions.lastUpdatedAt, () => {
    const action = actions.lastAction.value;
    if (!action) return;
    getJarvis()?.signal(actions.state.value === 'error' ? 'error' : 'tool', action);
  });

  const stopCredits = watch(
    () => [credits.balanceKnown, credits.displayBalance, credits.hasCredits] as const,
    () => syncStatus(),
  );

  function dispose(): void {
    for (const [name, handler] of listeners) window.removeEventListener(name, handler);
    stopActions();
    stopCredits();
  }
  onScopeDispose(dispose);

  return { syncStatus, dispose };
}
