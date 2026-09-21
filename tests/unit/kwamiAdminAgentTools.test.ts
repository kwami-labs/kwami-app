/**
 * Creating, renaming and deleting Kwamis, reading credits, signing out, and
 * rolling a new look.
 *
 * Two of these are irreversible and one ends the session, so the tests that
 * matter are the same shape as the comms ones: does it refuse when the target
 * is ambiguous, does it actually ask first, and does it report what happened
 * rather than what it attempted. `deleteKwami` in particular returns `false`
 * when the database refuses while changing nothing locally — a handler that
 * reads that as success tells the user something is gone that comes back on
 * their next reload.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { useKwamiAdminAgentTools } from '@/composables/useKwamiAdminAgentTools';
import { useWorkspaceStore } from '@/stores/workspace';
import { useAuthStore } from '@/stores/auth';
import { useCreditsStore } from '@/stores/credits';
import { useSceneStore } from '@/stores/scene';
import { useAvatarStore } from '@/stores/avatar';
import { useBlobXyzStore } from '@/stores/avatar.blob-xyz';
import { kwamiAdminEn, kwamiAdminEs } from '@/i18n/kwamiAdmin.locale';

type ToolDef = {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

const registered = new Map<string, ToolDef>();
const approve = { value: true };

// The global setup replaces the whole `kwami` module with a stub exporting
// only `Kwami`. Randomizing reaches real preset data that lives in that
// package, so keep the real exports and stub only the runtime class, which is
// the part that wants WebGL and LiveKit.
vi.mock('kwami', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const { Kwami } = await import('../mocks/kwami');
  return { ...actual, Kwami };
});
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

const Host = defineComponent({
  setup() {
    const { registerKwamiAdminTools } = useKwamiAdminAgentTools();
    registerKwamiAdminTools({
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

/** Replace the store's DB-backed methods; these tests are about the tools. */
function seedWorkspaces(names: string[]) {
  const store = useWorkspaceStore();
  store.workspaces = names.map((name, i) => ({
    id: `id-${i}`,
    name,
    emoji: '*',
    colors: { x: '#fff', y: '#fff', z: '#fff' },
  })) as never;
  store.activeWorkspaceId = 'id-0';
  store.addKwami = vi.fn(async (_u, initial) => {
    const created = { id: 'id-new', name: initial?.name ?? 'Generated', emoji: '*' };
    store.workspaces = [...store.workspaces, created as never];
    return created as never;
  }) as typeof store.addKwami;
  store.updateKwami = vi.fn(async () => true) as typeof store.updateKwami;
  store.deleteKwami = vi.fn(async () => true) as typeof store.deleteKwami;
  return store;
}

beforeEach(() => {
  registered.clear();
  confirmations.length = 0;
  approve.value = true;
  vi.clearAllMocks();
  localStorage.clear();
  setActivePinia(createPinia());
  mount(Host);
});

describe('registration', () => {
  it('registers every tool', () => {
    for (const name of [
      'create_kwami',
      'rename_kwami',
      'delete_kwami',
      'get_credit_balance',
      'sign_out',
      'randomize_appearance',
    ]) {
      expect(registered.has(name), `${name} is missing`).toBe(true);
    }
  });

  it('gives every tool a resolved description rather than a key path', () => {
    for (const [name, def] of registered) {
      expect(def.description, `${name} has no description`).toBeTruthy();
      expect(def.description, `${name} description is an i18n key`).not.toMatch(/^kwamiAdmin\./);
    }
  });

  it('offers no tool that can spend money', () => {
    for (const name of registered.keys()) {
      expect(name).not.toMatch(/purchase|buy|topup|top_up|pay/);
    }
  });
});

describe('create_kwami', () => {
  it('creates and switches to it', async () => {
    const store = seedWorkspaces(['First']);
    const result = await call('create_kwami', { name: 'Nova' });
    expect(result.success).toBe(true);
    expect(result.name).toBe('Nova');
    expect(store.activeWorkspaceId).toBe('id-new');
  });

  it('randomizes the look by default', async () => {
    const store = seedWorkspaces(['First']);
    await call('create_kwami', { name: 'Nova' });
    // A new Kwami with no appearance is a grey placeholder the user then has
    // to describe from scratch.
    // First arg is the user id, which is null when nobody is signed in --
    // `expect.anything()` would not match that.
    expect(store.addKwami).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ randomize: true }),
    );
  });

  it('can be told not to switch', async () => {
    const store = seedWorkspaces(['First']);
    await call('create_kwami', { name: 'Nova', activate: false });
    expect(store.activeWorkspaceId).toBe('id-0');
  });

  it('does not ask the user to confirm, because it is reversible', async () => {
    seedWorkspaces(['First']);
    await call('create_kwami', { name: 'Nova' });
    expect(confirmations).toHaveLength(0);
  });
});

describe('rename_kwami', () => {
  it('renames by name', async () => {
    const store = seedWorkspaces(['Old Name', 'Other']);
    const result = await call('rename_kwami', { kwami: 'Old Name', name: 'New Name' });
    expect(result.success).toBe(true);
    expect(store.updateKwami).toHaveBeenCalledWith('id-0', { name: 'New Name' }, null);
  });

  it('sends only the name, leaving emoji and colors alone', async () => {
    const store = seedWorkspaces(['Old Name']);
    await call('rename_kwami', { kwami: 'Old Name', name: 'New' });
    const payload = (store.updateKwami as ReturnType<typeof vi.fn>).mock.calls[0]![1];
    expect(Object.keys(payload as object)).toEqual(['name']);
  });

  it('refuses rather than picking when two Kwamis match', async () => {
    const store = seedWorkspaces(['Nova One', 'Nova Two']);
    const result = await call('rename_kwami', { kwami: 'Nova', name: 'X' });
    expect(result.success).toBe(false);
    expect(store.updateKwami).not.toHaveBeenCalled();
    expect(String(result.message)).toContain('Nova One');
  });

  it('takes an exact name over a longer one containing it', async () => {
    const store = seedWorkspaces(['Nova', 'Nova Prime']);
    const result = await call('rename_kwami', { kwami: 'Nova', name: 'X' });
    expect(result.success).toBe(true);
    expect(store.updateKwami).toHaveBeenCalledWith('id-0', { name: 'X' }, null);
  });

  it('requires a new name', async () => {
    seedWorkspaces(['Nova']);
    const result = await call('rename_kwami', { kwami: 'Nova' });
    expect(result.success).toBe(false);
  });
});

describe('delete_kwami', () => {
  it('asks before deleting and names the Kwami', async () => {
    seedWorkspaces(['Nova', 'Other']);
    await call('delete_kwami', { kwami: 'Nova' });
    expect(confirmations).toHaveLength(1);
    expect(confirmations[0]!.message).toContain('Nova');
  });

  it('deletes nothing when the user declines', async () => {
    const store = seedWorkspaces(['Nova', 'Other']);
    approve.value = false;
    const result = await call('delete_kwami', { kwami: 'Nova' });
    expect(result.cancelled).toBe(true);
    expect(result.deleted).toBe(false);
    expect(store.deleteKwami).not.toHaveBeenCalled();
  });

  it('cannot be bypassed by the model claiming it already confirmed', async () => {
    const store = seedWorkspaces(['Nova', 'Other']);
    approve.value = false;
    const result = await call('delete_kwami', { kwami: 'Nova', confirm: true });
    expect(result.success).toBe(false);
    expect(store.deleteKwami).not.toHaveBeenCalled();
  });

  it('refuses to delete the only Kwami there is', async () => {
    const store = seedWorkspaces(['Only']);
    const result = await call('delete_kwami', { kwami: 'Only' });
    expect(result.success).toBe(false);
    expect(store.deleteKwami).not.toHaveBeenCalled();
    // The store would recreate a blank local one, which is never what
    // "delete my Kwami" meant.
    expect(confirmations).toHaveLength(0);
  });

  it('reports a refused delete as a failure, not a success', async () => {
    const store = seedWorkspaces(['Nova', 'Other']);
    (store.deleteKwami as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
    const result = await call('delete_kwami', { kwami: 'Nova' });
    // The store returns false when the database refused and nothing changed
    // locally; the user would discover the lie on their next reload.
    expect(result.success).toBe(false);
    expect(result.deleted).toBe(false);
  });

  it('refuses an ambiguous name rather than deleting the wrong one', async () => {
    const store = seedWorkspaces(['Nova One', 'Nova Two', 'Other']);
    const result = await call('delete_kwami', { kwami: 'Nova' });
    expect(result.success).toBe(false);
    expect(store.deleteKwami).not.toHaveBeenCalled();
  });
});

describe('sign_out', () => {
  it('asks first and does nothing when declined', async () => {
    const auth = useAuthStore();
    auth.user = { id: 'u1' } as never;
    auth.signOut = vi.fn(async () => {}) as typeof auth.signOut;
    approve.value = false;

    const result = await call('sign_out');
    expect(result.cancelled).toBe(true);
    expect(result.signedOut).toBe(false);
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it('signs out when approved', async () => {
    const auth = useAuthStore();
    auth.user = { id: 'u1' } as never;
    auth.signOut = vi.fn(async () => {}) as typeof auth.signOut;

    const result = await call('sign_out');
    expect(result.signedOut).toBe(true);
    expect(auth.signOut).toHaveBeenCalled();
  });

  it('says so when nobody is signed in, without opening a dialog', async () => {
    const result = await call('sign_out');
    expect(result.success).toBe(false);
    expect(confirmations).toHaveLength(0);
  });
});

describe('get_credit_balance', () => {
  it('reports the balance and that it cannot buy more', async () => {
    const credits = useCreditsStore();
    credits.loadBalance = vi.fn(async () => {
      credits.balance = { credits: 1200 } as never;
    }) as typeof credits.loadBalance;

    const result = await call('get_credit_balance');
    expect(result.success).toBe(true);
    expect(result.canPurchase).toBe(false);
  });

  it('reports a failed read rather than a zero balance', async () => {
    const credits = useCreditsStore();
    credits.loadBalance = vi.fn(async () => {
      throw new Error('upstream down');
    }) as typeof credits.loadBalance;

    const result = await call('get_credit_balance');
    // "You have no energy" and "I could not check" are very different
    // answers to someone deciding whether to keep talking.
    expect(result.success).toBe(false);
    expect(String(result.message)).toContain('upstream down');
  });
});

describe('randomize_appearance', () => {
  it('rerolls the active renderer', async () => {
    const avatar = useAvatarStore();
    avatar.rendererType = 'blob-xyz';
    const blob = useBlobXyzStore();
    const before = JSON.stringify(blob.$state);

    const result = await call('randomize_appearance', { target: 'avatar' });
    expect(result.success).toBe(true);
    expect(JSON.stringify(blob.$state)).not.toBe(before);
  });

  it('picks a real background from the presets for the scene', async () => {
    const scene = useSceneStore();
    const result = await call('randomize_appearance', { target: 'scene' });
    expect(result.success).toBe(true);
    // A random choice among curated presets, not a generated background --
    // the description says so rather than letting the model over-promise.
    expect(result.background).toBeTruthy();
    expect(['image', 'video', 'hdri']).toContain(scene.background.media.type);
  });

  it('defaults to the avatar when no target is given', async () => {
    const result = await call('randomize_appearance');
    expect(result.success).toBe(true);
    expect(result.target).toBe('avatar');
  });

  it('rejects a target it does not have', async () => {
    const result = await call('randomize_appearance', { target: 'everything' });
    expect(result.success).toBe(false);
  });

  it('does not ask to confirm, because reset_ui_domain puts it back', async () => {
    await call('randomize_appearance', { target: 'both' });
    expect(confirmations).toHaveLength(0);
  });
});

describe('locale messages', () => {
  const bundles: Record<string, Record<string, unknown>> = {
    en: kwamiAdminEn,
    es: kwamiAdminEs,
  };

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
            name: 'x', previous: 'x', error: 'x', list: 'x', display: 'x', background: 'x',
          });
        }, key).not.toThrow();
        // A bare pipe does not throw, it silently keeps one branch.
        expect(rendered.length, `${key} lost characters`).toBeGreaterThanOrEqual(
          raw.length - 40,
        );
      }
    });
  }

  it('describes both locales with the same keys', () => {
    expect(leafKeys(kwamiAdminEs).sort()).toEqual(leafKeys(kwamiAdminEn).sort());
  });
});
