/**
 * Forgetting things, and moving around past conversations.
 *
 * `forget_memory` is the most dangerous tool in the app that does not cost
 * money: what it deletes cannot be recovered, and the user will not find out
 * it deleted the wrong thing until the Kwami fails to know something months
 * later. So the tests here are weighted towards refusing rather than
 * succeeding — ambiguity must stop the deletion, and a declined dialog must
 * leave everything in place.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { useRecallAgentTools } from '@/composables/useRecallAgentTools';
import { useMemoryStore } from '@/stores/memory';
import { recallEn, recallEs } from '@/i18n/recall.locale';

type ToolDef = {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

const registered = new Map<string, ToolDef>();
const approve = { value: true };
const confirmations: { title: string; message: string }[] = [];

vi.mock('@/composables/useAgentActionState', () => ({
  useAgentActionState: () => ({
    recordAction: vi.fn(),
    recordError: vi.fn(),
    requestConfirmation: vi.fn(async (options: { title: string; message: string }) => {
      confirmations.push(options);
      return approve.value;
    }),
  }),
}));

/** A controllable stand-in for the transcript store. */
const transcript = {
  sessions: [] as { id: string; createdAt: number; messages: unknown[] }[],
  viewingHistoryId: { value: null as string | null },
  liveSessionId: { value: 'live-1' as string | null },
  openHistorySession: vi.fn(),
  returnToLiveView: vi.fn(),
  deleteHistorySession: vi.fn(),
  clearMessages: vi.fn(),
};

vi.mock('@/composables/useTranscriptionState', () => ({
  useTranscriptionState: () => ({
    sessionsForKwami: { get value() { return transcript.sessions; } },
    viewingHistoryId: transcript.viewingHistoryId,
    liveSessionId: transcript.liveSessionId,
    sessionTitle: (createdAt: number) => `Session ${createdAt}`,
    openHistorySession: transcript.openHistorySession,
    returnToLiveView: transcript.returnToLiveView,
    deleteHistorySession: transcript.deleteHistorySession,
    clearMessages: transcript.clearMessages,
  }),
}));

const Host = defineComponent({
  setup() {
    const { registerRecallTools } = useRecallAgentTools();
    registerRecallTools({
      registerTool: (def: ToolDef) => registered.set(def.name, def),
    } as never);
    return () => h('div');
  },
});

function call(name: string, args: Record<string, unknown> = {}) {
  const tool = registered.get(name);
  if (!tool) throw new Error(`tool ${name} was never registered`);
  return tool.handler(args);
}

function seedMemory(facts: string[], entities: string[] = []) {
  const store = useMemoryStore();
  store.edges = facts.map((fact, i) => ({
    uuid: `edge-${i}`,
    fact,
    name: null,
    valid_at: null,
    invalid_at: null,
    created_at: null,
  })) as never;
  store.nodes = entities.map((name, i) => ({
    uuid: `node-${i}`,
    name,
    summary: null,
    labels: [],
    created_at: null,
  })) as never;
  store.load = vi.fn(async () => {}) as typeof store.load;
  store.deleteEdge = vi.fn(async () => {}) as typeof store.deleteEdge;
  store.deleteNode = vi.fn(async () => {}) as typeof store.deleteNode;
  store.deleteAll = vi.fn(async () => ({ deleted_threads: 3 })) as typeof store.deleteAll;
  return store;
}

beforeEach(() => {
  registered.clear();
  confirmations.length = 0;
  approve.value = true;
  vi.clearAllMocks();
  transcript.sessions = [];
  transcript.viewingHistoryId.value = null;
  localStorage.clear();
  setActivePinia(createPinia());
  mount(Host);
});

describe('registration', () => {
  it('registers every tool', () => {
    for (const name of [
      'list_memories',
      'forget_memory',
      'forget_everything',
      'list_conversations',
      'open_conversation',
      'return_to_live_conversation',
      'delete_conversation',
      'clear_transcript',
    ]) {
      expect(registered.has(name), `${name} is missing`).toBe(true);
    }
  });

  it('gives every tool a resolved description rather than a key path', () => {
    for (const [name, def] of registered) {
      expect(def.description, `${name} has no description`).toBeTruthy();
      expect(def.description, `${name} description is an i18n key`).not.toMatch(/^recall\./);
    }
  });

  it('tells the model how forgetting differs from clearing the transcript', () => {
    // The two are easy to confuse and confusing them is destructive in one
    // direction: "clear this" must not erase what the Kwami knows.
    expect(registered.get('clear_transcript')?.description).toContain('forget_memory');
  });
});

describe('forget_memory', () => {
  it('forgets a matching fact', async () => {
    const store = seedMemory(['the user likes oat milk', 'the user lives in Lisbon']);
    const result = await call('forget_memory', { query: 'oat milk' });
    expect(result.success).toBe(true);
    expect(result.forgotten).toBe(true);
    expect(store.deleteEdge).toHaveBeenCalledWith('edge-0');
  });

  it('searches entities as well as facts, because the user does not distinguish', async () => {
    const store = seedMemory([], ['Marcus']);
    const result = await call('forget_memory', { query: 'Marcus' });
    expect(result.success).toBe(true);
    expect(store.deleteNode).toHaveBeenCalledWith('node-0');
  });

  it('refuses rather than picking when two memories match', async () => {
    const store = seedMemory(['the user likes coffee', 'the user hates coffee']);
    const result = await call('forget_memory', { query: 'coffee' });
    expect(result.success).toBe(false);
    expect(result.forgotten).toBe(false);
    expect(store.deleteEdge).not.toHaveBeenCalled();
    // The candidates go back so the model can ask instead of guessing.
    expect((result.candidates as string[]).length).toBe(2);
  });

  it('deletes nothing when the user declines', async () => {
    const store = seedMemory(['the user likes oat milk']);
    approve.value = false;
    const result = await call('forget_memory', { query: 'oat milk' });
    expect(result.cancelled).toBe(true);
    expect(store.deleteEdge).not.toHaveBeenCalled();
  });

  it('cannot be bypassed by the model claiming it already confirmed', async () => {
    const store = seedMemory(['the user likes oat milk']);
    approve.value = false;
    const result = await call('forget_memory', { query: 'oat milk', confirm: true });
    expect(result.success).toBe(false);
    expect(store.deleteEdge).not.toHaveBeenCalled();
  });

  it('reads the memory back in the dialog before deleting it', async () => {
    seedMemory(['the user likes oat milk']);
    await call('forget_memory', { query: 'oat milk' });
    expect(confirmations[0]!.message).toContain('the user likes oat milk');
  });

  it('reloads afterwards so a repeat does not match a stale list', async () => {
    const store = seedMemory(['the user likes oat milk']);
    await call('forget_memory', { query: 'oat milk' });
    expect(store.load).toHaveBeenCalled();
  });

  it('says so when nothing matches, without opening a dialog', async () => {
    seedMemory(['the user likes oat milk']);
    const result = await call('forget_memory', { query: 'skiing' });
    expect(result.success).toBe(false);
    expect(confirmations).toHaveLength(0);
  });

  it('requires something to search for', async () => {
    seedMemory(['a fact']);
    const result = await call('forget_memory', {});
    expect(result.success).toBe(false);
  });
});

describe('forget_everything', () => {
  it('asks first and erases nothing when declined', async () => {
    const store = seedMemory(['a', 'b']);
    approve.value = false;
    const result = await call('forget_everything');
    expect(result.cancelled).toBe(true);
    expect(store.deleteAll).not.toHaveBeenCalled();
  });

  it('erases when approved and reports what went', async () => {
    const store = seedMemory(['a', 'b']);
    const result = await call('forget_everything');
    expect(result.forgotten).toBe(true);
    expect(result.deletedThreads).toBe(3);
    expect(store.deleteAll).toHaveBeenCalled();
  });

  it('reports a failure honestly rather than as an erase', async () => {
    const store = seedMemory(['a']);
    (store.deleteAll as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('zep down'));
    const result = await call('forget_everything');
    expect(result.success).toBe(false);
    expect(result.forgotten).toBe(false);
  });
});

describe('conversations', () => {
  beforeEach(() => {
    transcript.sessions = [
      { id: 's1', createdAt: 1, messages: [] },
      { id: 's2', createdAt: 2, messages: [] },
    ];
  });

  it('numbers sessions from one, the way the user counts', async () => {
    const result = await call('list_conversations');
    expect((result.sessions as { position: number }[])[0]!.position).toBe(1);
  });

  it('opens by position', async () => {
    const result = await call('open_conversation', { which: 2 });
    expect(result.success).toBe(true);
    expect(transcript.openHistorySession).toHaveBeenCalledWith('s2');
  });

  it('flags that the panel is now showing history', async () => {
    const result = await call('open_conversation', { which: 1 });
    // Otherwise the next live reply looks like it went missing.
    expect(result.viewingHistory).toBe(true);
  });

  it('says how many there are when asked for one past the end', async () => {
    const result = await call('open_conversation', { which: 9 });
    expect(result.success).toBe(false);
    expect(String(result.message)).toContain('2');
  });

  it('returning to live is safe when already live', async () => {
    const result = await call('return_to_live_conversation');
    expect(result.success).toBe(true);
    expect(transcript.returnToLiveView).not.toHaveBeenCalled();
  });

  it('returns to live when viewing history', async () => {
    transcript.viewingHistoryId.value = 's1';
    const result = await call('return_to_live_conversation');
    expect(result.viewingHistory).toBe(false);
    expect(transcript.returnToLiveView).toHaveBeenCalled();
  });

  it('confirms before deleting a conversation', async () => {
    approve.value = false;
    const result = await call('delete_conversation', { which: 1 });
    expect(result.cancelled).toBe(true);
    expect(transcript.deleteHistorySession).not.toHaveBeenCalled();
  });

  it('confirms before clearing the transcript', async () => {
    approve.value = false;
    const result = await call('clear_transcript');
    expect(result.cancelled).toBe(true);
    expect(transcript.clearMessages).not.toHaveBeenCalled();
  });
});

describe('locale messages', () => {
  const bundles: Record<string, Record<string, unknown>> = { en: recallEn, es: recallEs };

  function leafKeys(node: unknown, prefix = ''): string[] {
    if (typeof node === 'string') return [prefix];
    if (node && typeof node === 'object') {
      return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
        leafKeys(value, prefix ? `${prefix}.${key}` : key),
      );
    }
    return [];
  }

  for (const [locale, bundle] of Object.entries(bundles)) {
    it(`compiles every ${locale} message without losing a branch`, () => {
      const i18n = createI18n({ legacy: false, locale, messages: { [locale]: bundle } });
      for (const key of leafKeys(bundle)) {
        const raw = key.split('.').reduce<unknown>(
          (node, part) => (node as Record<string, unknown> | undefined)?.[part],
          bundle,
        ) as string;
        let rendered = '';
        expect(() => {
          rendered = i18n.global.t(key, {
            query: 'x', text: 'x', error: 'x', list: 'x', count: 1, name: 'x',
            title: 'x', position: 1,
          });
        }, key).not.toThrow();
        expect(rendered.length, `${key} lost characters`).toBeGreaterThanOrEqual(raw.length - 40);
      }
    });
  }

  it('describes both locales with the same keys', () => {
    expect(leafKeys(recallEs).sort()).toEqual(leafKeys(recallEn).sort());
  });
});
