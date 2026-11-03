/** One thing said with a pause in it is one message, however the transcript arrived. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTranscriptionState } from '../../src/composables/useTranscriptionState';

describe('the pieces of what the user said', () => {
  const state = useTranscriptionState();
  const said = () => state.liveMessages.value.map((m) => `${m.role}: ${m.content}`);

  beforeEach(() => {
    vi.useFakeTimers();
    state.clearMessages();
  });
  afterEach(() => vi.useRealTimers());

  it('are one message', () => {
    state.addMessage('user', 'Mira el correo,');
    state.addMessage('user', 'y dime quien es Alex.');
    expect(said()).toEqual(['user: Mira el correo, y dime quien es Alex.']);
  });

  it('stay apart once the assistant has answered', () => {
    state.addMessage('user', 'Hola.');
    state.addMessage('assistant', 'Buenas.');
    state.addMessage('user', 'Adios.');
    expect(said()).toHaveLength(3);
  });

  it('stay apart after a long silence', () => {
    state.addMessage('user', 'Hola.');
    vi.advanceTimersByTime(31_000);
    state.addMessage('user', 'Sigues ahi?');
    expect(said()).toHaveLength(2);
  });

  it('the assistant keeps its own messages', () => {
    state.addMessage('assistant', 'Uno.');
    state.addMessage('assistant', 'Dos.');
    expect(said()).toHaveLength(2);
  });
});
