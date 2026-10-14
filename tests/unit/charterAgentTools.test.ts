/**
 * The charter and the user profile the agent keeps on the user.
 *
 * What matters: the profile is visible and editable (no hidden state), a note
 * is never stored twice, an over-full profile is refused rather than silently
 * truncated, and every write reaches the running agent as a charter-only soul
 * update so the next turn already knows.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { useCharterAgentTools } from '@/composables/useCharterAgentTools';
import { useVoiceStore } from '@/stores/voice';
import {
  CHARTER_PROFILE_MAX_CHARS,
  appendProfileNote,
  charterForPreset,
  chiefOfStaffCharter,
  defaultCharter,
  normalizeCharter,
  removeProfileNotes,
} from '@/lib/charter';

type ToolDef = {
  name: string;
  handler: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

const registered = new Map<string, ToolDef>();
const soulUpdates: Record<string, unknown>[] = [];
const backendSyncs: { kind: string; payload: unknown }[] = [];

vi.mock('@/composables/useAgentActionState', () => ({
  useAgentActionState: () => ({ recordAction: vi.fn(), recordError: vi.fn() }),
}));

const fakeKwami = {
  registerTool: (def: ToolDef) => registered.set(def.name, def),
  soul: { updateConfig: (c: Record<string, unknown>) => soulUpdates.push(c) },
  agent: {
    syncConfigToBackend: (kind: string, payload: unknown) => backendSyncs.push({ kind, payload }),
  },
};

const Host = defineComponent({
  setup() {
    useCharterAgentTools().registerCharterTools(fakeKwami as never);
    return () => h('div');
  },
});

function call(name: string, args: Record<string, unknown> = {}) {
  const tool = registered.get(name);
  if (!tool) throw new Error(`tool ${name} was never registered`);
  return tool.handler(args);
}

function enableCharter(profile = '') {
  const store = useVoiceStore();
  store.soulConfig = {
    ...store.soulConfig,
    charter: { ...chiefOfStaffCharter(), userProfile: profile },
  };
  return store;
}

beforeEach(() => {
  registered.clear();
  soulUpdates.length = 0;
  backendSyncs.length = 0;
  localStorage.clear();
  setActivePinia(createPinia());
  mount(Host);
});

describe('charter defaults', () => {
  it('is off by default, so a kwami that never opts in is unchanged', () => {
    expect(defaultCharter().enabled).toBe(false);
    expect(useVoiceStore().soulConfig.charter.enabled).toBe(false);
  });

  it('chief of staff matches what the user chose', () => {
    const c = chiefOfStaffCharter();
    expect(c).toMatchObject({
      enabled: true,
      addressAs: 'señor',
      formal: true,
      wit: 'marked',
      pushback: 'once',
      opinions: 'always',
      initiative: 'act',
      learn: 'announce',
      greeting: 'brief_pending',
      adaptiveLength: true,
    });
    expect(c.watch).toEqual(['money', 'privacy', 'impulse']);
  });

  it('normalizes old or malformed saves', () => {
    expect(normalizeCharter(undefined)).toEqual(defaultCharter());
    const n = normalizeCharter({ enabled: true, watch: ['money', 'astrology'], userProfile: 3 });
    expect(n.enabled).toBe(true);
    expect(n.watch).toEqual(['money']);
    expect(n.userProfile).toBe('');
    expect(n.greeting).toBe('brief_pending');
  });
});

describe('appendProfileNote', () => {
  it('adds a bullet line', () => {
    const r = appendProfileNote('', 'Prefiere las reuniones por la mañana');
    expect(r).toEqual({
      status: 'added',
      profile: '- Prefiere las reuniones por la mañana',
      note: 'Prefiere las reuniones por la mañana',
    });
  });

  it('never stores the same fact twice, ignoring case, accents and punctuation', () => {
    const profile = '- Prefiere las reuniones por la mañana.';
    expect(appendProfileNote(profile, 'prefiere las reuniones por la manana').status).toBe(
      'duplicate',
    );
  });

  it('keeps one note on one line', () => {
    const r = appendProfileNote('', '  Opera\nen   bolsa ');
    expect(r.status === 'added' && r.profile).toBe('- Opera en bolsa');
  });

  it('refuses rather than truncates when full', () => {
    const full = 'x'.repeat(CHARTER_PROFILE_MAX_CHARS - 5);
    expect(appendProfileNote(full, 'otra cosa más').status).toBe('full');
  });

  it('rejects empty notes', () => {
    expect(appendProfileNote('', '   ').status).toBe('empty');
    expect(appendProfileNote('', 42).status).toBe('empty');
  });
});

describe('removeProfileNotes', () => {
  it('removes matching lines regardless of accents', () => {
    const r = removeProfileNotes('- Estudia el CQF\n- Café sin azúcar', 'cafe');
    expect(r).toEqual({ profile: '- Estudia el CQF', removed: 1 });
  });

  it('removes nothing for an empty needle', () => {
    expect(removeProfileNotes('- a', '').removed).toBe(0);
  });
});

describe('remember_about_user', () => {
  it('refuses while the charter is off', async () => {
    const r = await call('remember_about_user', { note: 'x' });
    expect(r.success).toBe(false);
    expect(backendSyncs).toHaveLength(0);
  });

  it('writes the store and syncs only the profile to the agent', async () => {
    const store = enableCharter('- Estudia el CQF');

    const r = await call('remember_about_user', { note: 'Opera en bolsa' });

    expect(r).toMatchObject({ success: true, changed: true });
    expect(store.soulConfig.charter.userProfile).toBe('- Estudia el CQF\n- Opera en bolsa');
    expect(store.soulConfig.charter.addressAs).toBe('señor');
    expect(backendSyncs).toEqual([
      { kind: 'soul', payload: { charter: { userProfile: '- Estudia el CQF\n- Opera en bolsa' } } },
    ]);
    expect(soulUpdates.at(-1)).toMatchObject({ charter: { enabled: true } });
  });

  it('reports a duplicate without writing', async () => {
    enableCharter('- Opera en bolsa');
    const r = await call('remember_about_user', { note: 'opera en bolsa' });
    expect(r).toMatchObject({ success: true, changed: false });
    expect(backendSyncs).toHaveLength(0);
  });
});

describe('forget_about_user and read_user_profile', () => {
  it('forgets matching lines and syncs', async () => {
    const store = enableCharter('- Estudia el CQF\n- Opera en bolsa');
    const r = await call('forget_about_user', { text: 'bolsa' });
    expect(r).toMatchObject({ success: true, removed: 1 });
    expect(store.soulConfig.charter.userProfile).toBe('- Estudia el CQF');
    expect(backendSyncs).toHaveLength(1);
  });

  it('says so when nothing matched', async () => {
    enableCharter('- Estudia el CQF');
    const r = await call('forget_about_user', { text: 'golf' });
    expect(r.success).toBe(false);
  });

  it('reads the stored profile', async () => {
    enableCharter('- Estudia el CQF');
    const r = await call('read_user_profile');
    expect(r).toMatchObject({ enabled: true, profile: '- Estudia el CQF' });
  });
});

describe('persistence', () => {
  it('survives a reload through the store snapshot', async () => {
    const store = enableCharter('- Estudia el CQF');
    const snapshot = JSON.parse(JSON.stringify(store.getSnapshot()));

    setActivePinia(createPinia());
    const fresh = useVoiceStore();
    fresh.applySnapshot(snapshot);

    expect(fresh.soulConfig.charter.enabled).toBe(true);
    expect(fresh.soulConfig.charter.userProfile).toBe('- Estudia el CQF');
  });
});

describe('CharterSettings panel', () => {
  it('turns the charter on, applies the chief of staff setup and edits the profile', async () => {
    const updates: unknown[] = [];
    const syncs: unknown[] = [];
    vi.doMock('@/composables/useKwami', async () => {
      const { ref } = await import('vue');
      return {
        useKwami: () => ({
          kwami: ref({
            soul: { updateConfig: (c: unknown) => updates.push(c) },
            agent: { syncConfigToBackend: (k: string, p: unknown) => syncs.push({ k, p }) },
          }),
          isConnected: ref(true),
        }),
      };
    });
    vi.useFakeTimers();
    const { default: CharterSettings } =
      await import('@/components/panels/settings/soul/CharterSettings.vue');
    const wrapper = mount(CharterSettings);
    const store = useVoiceStore();

    // Off: only the toggle and the setup button are shown.
    expect(wrapper.find('textarea').exists()).toBe(false);

    const setup = wrapper.findAll('button').find((b) => b.text().includes('chief of staff'));
    expect(setup).toBeTruthy();
    await setup!.trigger('click');

    expect(store.soulConfig.charter).toMatchObject({ enabled: true, addressAs: 'señor' });
    const textarea = wrapper.find('textarea');
    expect(textarea.exists()).toBe(true);

    await textarea.setValue('- Estudia el CQF');
    expect(store.soulConfig.charter.userProfile).toBe('- Estudia el CQF');

    // Debounced: one push to the agent after typing settles.
    await vi.advanceTimersByTimeAsync(700);
    expect(syncs.at(-1)).toMatchObject({
      k: 'soul',
      p: { charter: { enabled: true, userProfile: '- Estudia el CQF' } },
    });

    // Watch chips toggle membership.
    const health = wrapper.findAll('button.chip').find((b) => b.text() === 'Health');
    await health!.trigger('click');
    expect(store.soulConfig.charter.watch).toContain('health');

    vi.useRealTimers();
    vi.doUnmock('@/composables/useKwami');
  });
});

describe('charterForPreset', () => {
  it('brings the rules a preset ships with and keeps the learnt profile', () => {
    const current = { ...defaultCharter(), userProfile: '- Prefiere el café solo' };

    const charter = charterForPreset({ enabled: true, addressAs: 'señor', formal: true }, current);

    expect(charter.enabled).toBe(true);
    expect(charter.addressAs).toBe('señor');
    expect(charter.formal).toBe(true);
    expect(charter.userProfile).toBe('- Prefiere el café solo');
  });

  it('never lets a preset overwrite the profile', () => {
    const current = { ...defaultCharter(), userProfile: '- Vive en Madrid' };

    expect(charterForPreset({ userProfile: 'x' }, current).userProfile).toBe('- Vive en Madrid');
  });

  it('leaves the charter alone for a preset without one', () => {
    const current = { ...chiefOfStaffCharter(), userProfile: '- Madruga' };

    expect(charterForPreset(undefined, current)).toBe(current);
  });
});
