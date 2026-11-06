import { describe, expect, it, vi } from 'vitest';
import type { Kwami } from 'kwami';
import { registerToolBatch } from '@/lib/toolRegistration';

function liveStub(connected: boolean) {
  const defs = new Map<string, { name: string; description: string }>();
  return {
    isConnected: vi.fn(() => connected),
    tools: {
      register: vi.fn((def: { name: string; description: string }) => defs.set(def.name, def)),
      getToolDefinitions: vi.fn(() => [...defs.values()]),
    },
    agent: { registerTool: vi.fn(), syncConfigToBackend: vi.fn() },
    soul: { updateConfig: vi.fn() },
    registerTool: vi.fn(),
  };
}

const tool = (name: string) => ({ name, description: name, handler: async () => ({}) });

describe('registerToolBatch', () => {
  it('fills the registry and the dispatch table, and files each tool under its group', () => {
    const live = liveStub(false);
    const seen: [string, string][] = [];

    registerToolBatch(
      live as unknown as Kwami,
      ({ instance, group }) => {
        instance.registerTool(tool('before_any_group'));
        group('search');
        instance.registerTool(tool('focus_result'));
        group('email');
        instance.registerTool(tool('send_email'));
      },
      (name, group) => seen.push([name, group]),
    );

    expect(live.tools.register).toHaveBeenCalledTimes(3);
    expect(live.agent.registerTool.mock.calls.map(([name]) => name)).toEqual([
      'before_any_group',
      'focus_result',
      'send_email',
    ]);
    expect(seen).toEqual([
      ['before_any_group', 'other'],
      ['focus_result', 'search'],
      ['send_email', 'email'],
    ]);
    // Not through the public registerTool, which would sync on every call.
    expect(live.registerTool).not.toHaveBeenCalled();
  });

  // A language switch mid-call re-registers ~100 tools. It used to send the
  // agent ~100 copies of the whole list; it must send one.
  it('sends the agent the tool list once per batch while connected', () => {
    const live = liveStub(true);

    registerToolBatch(
      live as unknown as Kwami,
      ({ instance }) => {
        for (let i = 0; i < 100; i += 1) instance.registerTool(tool(`tool_${i}`));
      },
      () => {},
    );

    expect(live.agent.syncConfigToBackend).toHaveBeenCalledTimes(1);
    const [type, defs] = live.agent.syncConfigToBackend.mock.calls[0];
    expect(type).toBe('tools');
    expect(defs).toHaveLength(100);
  });

  it('sends nothing without a session: connect carries the list itself', () => {
    const live = liveStub(false);
    registerToolBatch(
      live as unknown as Kwami,
      ({ instance }) => instance.registerTool(tool('a')),
      () => {},
    );
    expect(live.agent.syncConfigToBackend).not.toHaveBeenCalled();
  });

  it('still sends what registered when a registrar throws', () => {
    const live = liveStub(true);
    expect(() =>
      registerToolBatch(
        live as unknown as Kwami,
        ({ instance }) => {
          instance.registerTool(tool('a'));
          throw new Error('registrar broke');
        },
        () => {},
      ),
    ).toThrow('registrar broke');
    expect(live.agent.syncConfigToBackend).toHaveBeenCalledTimes(1);
  });

  it('hands registrars the live agent and soul', () => {
    const live = liveStub(false);
    registerToolBatch(
      live as unknown as Kwami,
      ({ instance }) => {
        expect(instance.agent).toBe(live.agent);
        expect(instance.soul).toBe(live.soul);
      },
      () => {},
    );
  });
});
