/**
 * The tools that let the agent drive the app by voice.
 *
 * These are the seam where "make the browser fullscreen" or "put a waterfall
 * behind you" becomes a store mutation, and the failure mode they all share is
 * the quiet one: a tool that reports success and changes nothing reads to the
 * user as the agent ignoring them. So every test here asserts the store
 * actually moved, not just that the handler resolved.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { useWorkspaceAgentTools } from '@/composables/useWorkspaceAgentTools';
import { useNavigationStore } from '@/stores/navigation';
import { useSceneStore } from '@/stores/scene';
import { useAvatarStore } from '@/stores/avatar';
import { useWorkspaceStore } from '@/stores/workspace';
import { sceneImagePresets } from '@/presets/scene/image-presets';

type ToolDef = {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
};

const registered = new Map<string, ToolDef>();
const sentConfigUpdates: { type: string; config: unknown }[] = [];
const isConnected = ref(false);

const kwamiStub = {
  registerTool: (def: ToolDef) => registered.set(def.name, def),
  agent: {
    getConfig: () => ({}),
    updateConfig: vi.fn(),
    syncConfigToBackend: vi.fn(),
    updateLlmLive: vi.fn(),
    updateSttLive: vi.fn(),
    updateTtsLive: vi.fn(),
    updateRealtimeLive: vi.fn(),
    getPipeline: () => ({
      sendConfigUpdate: (type: string, config: unknown) => {
        sentConfigUpdates.push({ type, config });
      },
    }),
  },
  soul: { updateConfig: vi.fn() },
};

// The global setup replaces the whole `kwami` module with a stub exporting only
// `Kwami`. These tests reach real preset data that lives in that package
// (avatar presets, soul presets), so keep the real exports and stub only the
// runtime class, which is the part that wants WebGL and LiveKit.
vi.mock('kwami', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const { Kwami } = await import('../mocks/kwami');
  return { ...actual, Kwami };
});

vi.mock('@/composables/useKwami', () => ({
  useKwami: () => ({
    kwami: ref(kwamiStub),
    rendererType: ref('blob-xyz'),
    isConnected,
  }),
}));

// The confirmation dialog is a UI affordance; these tests drive the tools
// directly, so approve everything and assert the gate separately.
vi.mock('@/composables/useAgentActionState', () => ({
  useAgentActionState: () => ({
    recordAction: vi.fn(),
    recordError: vi.fn(),
    requestConfirmation: vi.fn(async () => true),
  }),
}));

const Host = defineComponent({
  setup() {
    useWorkspaceAgentTools();
    return () => h('div');
  },
});

function call(name: string, args: Record<string, unknown> = {}) {
  const tool = registered.get(name);
  if (!tool) throw new Error(`tool ${name} was never registered`);
  return tool.handler(args) as Promise<Record<string, unknown>>;
}

beforeEach(() => {
  registered.clear();
  sentConfigUpdates.length = 0;
  isConnected.value = false;
  localStorage.clear();
  setActivePinia(createPinia());
  mount(Host);
});

describe('registration', () => {
  it('registers every tool the agent is told about', () => {
    for (const name of [
      'set_browser_panel',
      'list_scene_presets',
      'apply_scene_preset',
      'list_kwami_profiles',
      'switch_kwami_profile',
      'set_workspace_renderer',
      'set_ui_control',
    ]) {
      expect(registered.has(name), `${name} is missing`).toBe(true);
    }
  });

  it('offers eye-iris as a renderer', () => {
    const renderers = registered.get('set_workspace_renderer')?.parameters?.renderer as {
      enum: string[];
    };
    expect(renderers.enum).toContain('eye-iris');
  });

  it('gives every tool a real description rather than an unresolved key', () => {
    for (const [name, def] of registered) {
      expect(def.description, `${name} has no description`).toBeTruthy();
      expect(def.description, `${name} description is an i18n key`).not.toMatch(
        /^workspaceAgentTools\./,
      );
    }
  });
});

describe('set_browser_panel', () => {
  it('changes the layout', async () => {
    const result = await call('set_browser_panel', { control: 'layout', value: 'floating' });
    expect(result.success).toBe(true);
    expect(useNavigationStore().layout).toBe('floating');
  });

  it('rejects a layout that does not exist without changing anything', async () => {
    const result = await call('set_browser_panel', { control: 'layout', value: 'pip' });
    expect(result.success).toBe(false);
    expect(useNavigationStore().layout).toBe('docked');
  });

  it('expands and collapses back to where it started', async () => {
    const store = useNavigationStore();
    store.setLayout('floating');

    await call('set_browser_panel', { control: 'expand', value: true });
    expect(store.layout).toBe('fullscreen');

    await call('set_browser_panel', { control: 'expand', value: false });
    expect(store.layout).toBe('floating');
  });

  it('floats the panel when asked to move it', async () => {
    // A docked split pane cannot be positioned, so reporting success without
    // floating first would be a visible no-op.
    const result = await call('set_browser_panel', {
      control: 'position',
      value: { x: 40, y: 60 },
    });
    const store = useNavigationStore();
    expect(result.success).toBe(true);
    expect(store.layout).toBe('floating');
    expect(store.floatingRect).toMatchObject({ x: 40, y: 60 });
  });

  it('floats the panel when asked to resize it', async () => {
    await call('set_browser_panel', { control: 'size', value: { width: 800, height: 600 } });
    const store = useNavigationStore();
    expect(store.layout).toBe('floating');
    expect(store.floatingRect.width).toBe(800);
  });

  it('refuses a position that is not a pair of numbers', async () => {
    const result = await call('set_browser_panel', { control: 'position', value: 'middle' });
    expect(result.success).toBe(false);
    expect(useNavigationStore().layout).toBe('docked');
  });

  it('resets back to the default layout', async () => {
    const store = useNavigationStore();
    store.setLayout('floating');
    store.setRect({ x: 400, y: 300 });

    await call('set_browser_panel', { control: 'reset' });

    expect(store.layout).toBe('docked');
  });

  it('reports an unknown control instead of silently doing nothing', async () => {
    const result = await call('set_browser_panel', { control: 'minimise', value: true });
    expect(result.success).toBe(false);
    expect(String(result.message)).toContain('minimise');
  });

  it('is reachable through set_ui_control too', async () => {
    await call('set_ui_control', { domain: 'browser', control: 'layout', value: 'fullscreen' });
    expect(useNavigationStore().layout).toBe('fullscreen');
  });
});

describe('scene presets', () => {
  it('lists presets the model can then name', async () => {
    const result = await call('list_scene_presets', { kind: 'image' });
    const presets = result.presets as Record<string, string[]>;
    expect(presets.image.length).toBeGreaterThan(0);
    expect(presets.image).toContain(sceneImagePresets[0].name);
  });

  it('lists every kind when asked for all', async () => {
    const presets = (await call('list_scene_presets', { kind: 'all' })).presets as Record<
      string,
      string[]
    >;
    expect(Object.keys(presets).sort()).toEqual(['hdri', 'image', 'video']);
  });

  it('applies a preset by exact name and shows that medium', async () => {
    const scene = useSceneStore();
    const preset = sceneImagePresets[0];

    const result = await call('apply_scene_preset', { kind: 'image', name: preset.name });

    expect(result.success).toBe(true);
    expect(scene.background.media.image.url).toBe(preset.url);
    // Setting a URL alone changes nothing on screen unless the background is
    // actually showing that medium.
    expect(scene.background.media.type).toBe('image');
  });

  it('matches a partial spoken name', async () => {
    const preset = sceneImagePresets.find((p) => /waterfall/i.test(p.name));
    if (!preset) return;
    const result = await call('apply_scene_preset', { kind: 'image', name: 'waterfall' });
    expect(result.success).toBe(true);
    expect(useSceneStore().background.media.type).toBe('image');
  });

  it('names real alternatives when the preset does not exist', async () => {
    const result = await call('apply_scene_preset', { kind: 'image', name: 'nebula dragon' });
    expect(result.success).toBe(false);
    expect(String(result.message)).toContain(sceneImagePresets[0].name);
  });

  it('rejects a background kind it does not have', async () => {
    const result = await call('apply_scene_preset', { kind: 'hologram', name: 'x' });
    expect(result.success).toBe(false);
  });
});

describe('kwami profiles', () => {
  it('lists the saved companions and marks the active one', async () => {
    const workspace = useWorkspaceStore();
    workspace.ensureLocalWorkspace();

    const result = await call('list_kwami_profiles');
    const profiles = result.profiles as { id: string; name: string; active: boolean }[];

    expect(profiles.length).toBeGreaterThan(0);
    expect(profiles.filter((p) => p.active)).toHaveLength(1);
  });

  it('says so rather than failing when the name is unknown', async () => {
    useWorkspaceStore().ensureLocalWorkspace();
    const result = await call('switch_kwami_profile', { name: 'Nobody', confirm: true });
    expect(result.success).toBe(false);
    expect(String(result.message)).toContain('Nobody');
  });

  it('is a no-op when the companion is already active', async () => {
    const workspace = useWorkspaceStore();
    workspace.ensureLocalWorkspace();
    const active = workspace.getActiveWorkspace();

    const result = await call('switch_kwami_profile', { name: active?.name, confirm: true });

    expect(result.success).toBe(true);
    expect(workspace.activeWorkspaceId).toBe(active?.id);
  });
});

describe('renderer', () => {
  it('switches to eye-iris, which used to be unreachable by voice', async () => {
    const result = await call('set_workspace_renderer', { renderer: 'eye-iris' });
    expect(result.success).toBe(true);
    expect(useAvatarStore().rendererType).toBe('eye-iris');
  });

  it('still rejects a renderer that does not exist', async () => {
    const result = await call('set_workspace_renderer', { renderer: 'hologram' });
    expect(result.success).toBe(false);
  });
});

describe('pipeline switching', () => {
  it('sends the switch over the data channel when connected', async () => {
    // Without this the backend never heard about the switch at all: the old
    // code only mutated the local config object.
    isConnected.value = true;

    const result = await call('set_ui_control', {
      domain: 'voice',
      control: 'pipelineMode',
      value: 'realtime',
      confirm: true,
    });

    expect(result.success).toBe(true);
    expect(sentConfigUpdates).toContainEqual({
      type: 'pipeline',
      config: { pipelineType: 'realtime' },
    });
  });

  it('does not claim a live switch while disconnected', async () => {
    isConnected.value = false;
    await call('set_ui_control', {
      domain: 'voice',
      control: 'pipelineMode',
      value: 'realtime',
      confirm: true,
    });
    expect(sentConfigUpdates).toHaveLength(0);
  });
});
