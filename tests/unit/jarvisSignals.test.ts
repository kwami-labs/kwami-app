import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { effectScope, nextTick, type EffectScope } from 'vue';
import { formatHudAmount, useJarvisSignals } from '@/composables/avatar/useJarvisSignals';
import type { JarvisHandle } from '@/composables/avatar/sync/rendererTypes';
import { useAgentActionState } from '@/composables/useAgentActionState';
import { useCreditsStore } from '@/stores/credits';

vi.mock('@/composables/useCreditsApi', () => ({
  fetchBalance: vi.fn(),
  fetchPacks: vi.fn(),
  fetchTransactions: vi.fn(),
  fetchUsageLogs: vi.fn(),
  createCheckoutSession: vi.fn(),
}));

const funded = {
  balance: 993_739_108,
  balance_credits: 993_739,
  lifetime_purchased: 1_000_000_000,
  lifetime_used: 6_760_892,
};

function fakeHud() {
  return { signal: vi.fn(), log: vi.fn(), setStatus: vi.fn() };
}

function emit(name: string, detail?: unknown): void {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

let scope: EffectScope;
let hud: ReturnType<typeof fakeHud>;
let present: boolean;
let signals: ReturnType<typeof useJarvisSignals>;

beforeEach(() => {
  vi.useFakeTimers();
  setActivePinia(createPinia());
  hud = fakeHud();
  present = true;
  scope = effectScope();
  scope.run(() => {
    signals = useJarvisSignals(() => (present ? (hud as unknown as JarvisHandle) : undefined));
  });
});

afterEach(() => {
  // Leave the shared agent-action state disconnected for the next test.
  emit('kwami:disconnected');
  scope.stop();
  vi.useRealTimers();
});

describe('formatHudAmount', () => {
  it('keeps small amounts whole and shortens large ones', () => {
    expect(formatHudAmount(0)).toBe('0');
    expect(formatHudAmount(999)).toBe('999');
    expect(formatHudAmount(1000)).toBe('1K');
    expect(formatHudAmount(993_739)).toBe('993.7K');
    expect(formatHudAmount(3_400_000)).toBe('3.4M');
  });

  it('never rounds up past what there is', () => {
    expect(formatHudAmount(1999)).toBe('1.9K');
    expect(formatHudAmount(999_999)).toBe('999.9K');
    expect(formatHudAmount(-5)).toBe('0');
  });
});

describe('useJarvisSignals', () => {
  it('announces the voice link coming up and going down', () => {
    emit('kwami:connected');
    expect(hud.signal).toHaveBeenLastCalledWith('success', 'Voice link established');
    expect(hud.setStatus).toHaveBeenCalledWith('link', { label: 'Link', value: 'Live', hot: true });

    emit('kwami:disconnected');
    expect(hud.signal).toHaveBeenLastCalledWith('info', 'Voice link closed');
    expect(hud.setStatus).toHaveBeenLastCalledWith('energy', null);
    expect(hud.setStatus).toHaveBeenCalledWith('link', {
      label: 'Link',
      value: 'Standby',
      hot: false,
    });
  });

  it('stays quiet about a disconnect when there was no link', () => {
    emit('kwami:disconnected');
    expect(hud.signal).not.toHaveBeenCalled();
  });

  it('raises a failed link and an empty balance as alerts', () => {
    emit('kwami:connectFailed');
    expect(hud.signal).toHaveBeenLastCalledWith('error', 'Voice link failed');
    emit('kwami:insufficient-credits');
    expect(hud.signal).toHaveBeenLastCalledWith('warning', 'Insufficient energy');
  });

  it('acknowledges messages without copying what was said onto the HUD', () => {
    emit('kwami:message', { role: 'user', content: 'my card number is 4111' });
    expect(hud.signal).toHaveBeenLastCalledWith('message', 'Operator message');

    emit('kwami:message', { role: 'assistant', content: 'noted' });
    expect(hud.log).toHaveBeenLastCalledWith('Response delivered');

    // System lines are the agent-action announcements, signalled through the action watcher.
    hud.signal.mockClear();
    hud.log.mockClear();
    emit('kwami:message', { role: 'system', content: 'Opening calendar' });
    expect(hud.signal).not.toHaveBeenCalled();
    expect(hud.log).not.toHaveBeenCalled();
  });

  it('signals every agent action as a tool call, and a failed one as an error', async () => {
    const actions = useAgentActionState();

    actions.recordAction('Opening calendar');
    await nextTick();
    expect(hud.signal).toHaveBeenLastCalledWith('tool', 'Opening calendar');

    vi.advanceTimersByTime(10);
    actions.recordError('Could not send the email');
    await nextTick();
    expect(hud.signal).toHaveBeenLastCalledWith('error', 'Could not send the email');
  });

  it('follows the browser session', () => {
    emit('kwami:browser_session', { action: 'open' });
    expect(hud.signal).toHaveBeenLastCalledWith('tool', 'Browser session open');
    emit('kwami:browser_session', { action: 'close' });
    expect(hud.log).toHaveBeenLastCalledWith('Browser session closed');
    hud.signal.mockClear();
    emit('kwami:browser_session', { action: 'update' });
    expect(hud.signal).not.toHaveBeenCalled();
  });

  it('shows the balance once it is known and updates it', async () => {
    const credits = useCreditsStore();
    credits.balance = funded;
    await nextTick();
    expect(hud.setStatus).toHaveBeenLastCalledWith('energy', {
      label: 'Energy',
      value: '993.7K',
      hot: true,
    });

    credits.balance = { ...funded, balance: 0, balance_credits: 0 };
    await nextTick();
    expect(hud.setStatus).toHaveBeenLastCalledWith('energy', {
      label: 'Energy',
      value: '0',
      hot: false,
    });
  });

  it('re-applies the status rows to a HUD built by a renderer switch', () => {
    emit('kwami:connected');
    hud.setStatus.mockClear();
    emit('kwami:rendererChanged', 'jarvis');
    expect(hud.setStatus).toHaveBeenCalledWith('link', { label: 'Link', value: 'Live', hot: true });
  });

  it('does nothing while another renderer is on screen', async () => {
    present = false;
    emit('kwami:connected');
    emit('kwami:message', { role: 'user', content: 'hello' });
    useAgentActionState().recordAction('Opening calendar');
    await nextTick();
    signals.syncStatus();
    expect(hud.signal).not.toHaveBeenCalled();
    expect(hud.setStatus).not.toHaveBeenCalled();
  });

  it('stops listening once its scope is disposed', () => {
    scope.stop();
    emit('kwami:connected');
    expect(hud.signal).not.toHaveBeenCalled();
  });
});
