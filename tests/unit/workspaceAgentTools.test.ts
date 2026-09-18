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
import { useVoiceStore } from '@/stores/voice';
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

/**
 * A fake music crate.
 *
 * `isPlaying` is not flipped by `toggle()` here on purpose in one test: the
 * real `play()` resumes an AudioContext and browsers refuse that outside a
 * user gesture, so "the call was made" and "music is playing" are genuinely
 * different facts and the tool has to report the second one.
 */
const soundtrackStub = {
  isPlaying: ref(false),
  currentTrack: ref<{ title: string; artist: string } | null>(null),
  toggle: vi.fn(() => {
    soundtrackStub.isPlaying.value = !soundtrackStub.isPlaying.value;
  }),
  next: vi.fn(() => {
    soundtrackStub.isPlaying.value = true;
    soundtrackStub.currentTrack.value = { title: 'Vastness', artist: 'Nexow' };
  }),
  stop: vi.fn(() => {
    soundtrackStub.isPlaying.value = false;
    soundtrackStub.currentTrack.value = null;
  }),
  owns: vi.fn(() => true),
  release: vi.fn(),
  dispose: vi.fn(),
};
const soundtrackLevel = ref(0.8);

vi.mock('@/composables/useSoundtrack', () => ({
  useWorkspaceSoundtrack: () => ({ soundtrack: soundtrackStub, level: soundtrackLevel }),
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
  soundtrackStub.isPlaying.value = false;
  soundtrackStub.currentTrack.value = null;
  soundtrackLevel.value = 0.8;
  soundtrackStub.toggle.mockImplementation(() => {
    soundtrackStub.isPlaying.value = !soundtrackStub.isPlaying.value;
  });
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

describe('control_soundtrack', () => {
  it('starts the music and reports that it is playing', async () => {
    const result = await call('control_soundtrack', { action: 'play' });
    expect(soundtrackStub.toggle).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.isPlaying).toBe(true);
  });

  it('does not claim success when the browser refuses to start audio', async () => {
    // Autoplay policy: play() resolves, an AudioContext stays suspended, and
    // nothing is audible. Reporting "playing" here would be the agent lying
    // about the world to the person listening to silence.
    soundtrackStub.toggle.mockImplementation(() => {});

    const result = await call('control_soundtrack', { action: 'play' });

    expect(result.success).toBe(false);
    expect(result.isPlaying).toBe(false);
  });

  it('is a no-op when the music is already playing', async () => {
    soundtrackStub.isPlaying.value = true;
    const result = await call('control_soundtrack', { action: 'play' });
    expect(soundtrackStub.toggle).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('pauses only when something is playing', async () => {
    await call('control_soundtrack', { action: 'pause' });
    expect(soundtrackStub.toggle).not.toHaveBeenCalled();

    soundtrackStub.isPlaying.value = true;
    const result = await call('control_soundtrack', { action: 'pause' });
    expect(result.isPlaying).toBe(false);
  });

  it('skips to the next track and names it', async () => {
    const result = await call('control_soundtrack', { action: 'next' });
    expect(soundtrackStub.next).toHaveBeenCalled();
    expect(result.track).toMatchObject({ title: 'Vastness', artist: 'Nexow' });
  });

  it('stops and clears the deck', async () => {
    soundtrackStub.isPlaying.value = true;
    const result = await call('control_soundtrack', { action: 'stop' });
    expect(soundtrackStub.stop).toHaveBeenCalled();
    expect(result.isPlaying).toBe(false);
    expect(result.track).toBeNull();
  });

  it('reports status without changing anything', async () => {
    const result = await call('control_soundtrack', { action: 'status' });
    expect(soundtrackStub.toggle).not.toHaveBeenCalled();
    expect(soundtrackStub.next).not.toHaveBeenCalled();
    expect(result.isPlaying).toBe(false);
  });

  it.each([
    [0.4, 0.4],
    [40, 0.4],
    [100, 1],
    [0, 0],
  ])('accepts %s as a volume and stores %s', async (input, expected) => {
    // "Turn it up to 40" is as likely as a normalised value, and reading 40 as
    // a 0-1 figure would pin the volume at maximum.
    await call('control_soundtrack', { action: 'volume', volume: input });
    expect(soundtrackLevel.value).toBeCloseTo(expected, 5);
  });

  it('clamps a volume above the maximum', async () => {
    await call('control_soundtrack', { action: 'volume', volume: 500 });
    expect(soundtrackLevel.value).toBe(1);
  });

  it('refuses a volume that is not a number', async () => {
    const result = await call('control_soundtrack', { action: 'volume', volume: 'loud' });
    expect(result.success).toBe(false);
    expect(soundtrackLevel.value).toBe(0.8);
  });

  it('can set the volume while starting playback', async () => {
    const result = await call('control_soundtrack', { action: 'play', volume: 30 });
    expect(soundtrackLevel.value).toBeCloseTo(0.3, 5);
    expect(result.isPlaying).toBe(true);
  });

  it('names the valid actions when given one it does not have', async () => {
    const result = await call('control_soundtrack', { action: 'shuffle' });
    expect(result.success).toBe(false);
    expect(String(result.message)).toContain('shuffle');
  });
});

describe('the audio panel', () => {
  it('can be opened by voice, including as "music"', async () => {
    const result = await call('open_workspace_panel', { panelName: 'music' });
    expect(result.success).toBe(true);
    expect(result.panel).toBe('audio');
  });

  it('names the panel rather than echoing an i18n key path', async () => {
    const result = await call('open_workspace_panel', { panelName: 'audio' });
    expect(String(result.message)).not.toContain('workspaceAgentTools.');
  });

  it('names the email panel too, which was missing its label', async () => {
    const result = await call('open_workspace_panel', { panelName: 'inbox' });
    expect(String(result.message)).not.toContain('workspaceAgentTools.');
  });
});

/**
 * The soul panel writes six fields and, until now, exactly one of them
 * (`emotionalTone`) was reachable by any tool. So "call yourself Atlas and be
 * more direct" was a change the user could make by hand and not by voice — in
 * an app whose whole premise is speaking to it.
 */
describe('set_soul_control', () => {
  it('renames the companion', async () => {
    const result = await call('set_soul_control', { control: 'name', value: 'Atlas' });
    expect(result.success).toBe(true);
    expect(useVoiceStore().soulConfig.name).toBe('Atlas');
  });

  it('refuses a blank name rather than erasing the current one', async () => {
    const before = useVoiceStore().soulConfig.name;
    const result = await call('set_soul_control', { control: 'name', value: '   ' });
    expect(result.success).toBe(false);
    expect(useVoiceStore().soulConfig.name).toBe(before);
  });

  it('sets the personality description', async () => {
    await call('set_soul_control', {
      control: 'personality',
      value: 'Dry, precise, allergic to filler.',
    });
    expect(useVoiceStore().soulConfig.personality).toContain('Dry, precise');
  });

  it('sets the conversation style', async () => {
    await call('set_soul_control', { control: 'conversationStyle', value: 'direct' });
    expect(useVoiceStore().soulConfig.conversationStyle).toBe('direct');
  });

  it('sets personality traits from a list', async () => {
    const result = await call('set_soul_control', {
      control: 'traits',
      value: ['curious', 'patient', '  ', 'witty'],
    });
    expect(result.traits).toEqual(['curious', 'patient', 'witty']);
  });

  it('refuses traits that are not a list', async () => {
    const result = await call('set_soul_control', { control: 'traits', value: 'curious' });
    expect(result.success).toBe(false);
  });

  it('adjusts named emotional traits and clamps them to the slider range', async () => {
    const result = await call('set_soul_control', {
      control: 'emotionalTraits',
      value: { curiosity: 80, patience: -400, energy: 900 },
    });

    const traits = useVoiceStore().soulConfig.emotionalTraits;
    expect(result.success).toBe(true);
    expect(traits.curiosity).toBe(80);
    expect(traits.patience).toBe(-100);
    expect(traits.energy).toBe(100);
  });

  it('reports traits it does not have instead of inventing them', async () => {
    const result = await call('set_soul_control', {
      control: 'emotionalTraits',
      value: { sarcasm: 50 },
    });
    expect(result.success).toBe(false);
    expect(String(result.message)).toContain('curiosity');
  });

  it('ignores a non-numeric trait value but still applies the good ones', async () => {
    const result = await call('set_soul_control', {
      control: 'emotionalTraits',
      value: { curiosity: 40, empathy: 'lots' },
    });
    expect(result.updated).toEqual(['curiosity']);
  });

  it('routes response length to the voice handler rather than duplicating it', async () => {
    await call('set_soul_control', { control: 'responseLength', value: 'short', confirm: true });
    expect(useVoiceStore().soulConfig.responseLength).toBe('short');
  });

  it('is reachable through set_ui_control as the profile domain', async () => {
    await call('set_ui_control', { domain: 'profile', control: 'name', value: 'Sol' });
    expect(useVoiceStore().soulConfig.name).toBe('Sol');
  });

  it('names the valid controls when given one it does not have', async () => {
    const result = await call('set_soul_control', { control: 'mood', value: 'blue' });
    expect(result.success).toBe(false);
    expect(String(result.message)).toContain('mood');
  });
});

describe('get_soul_profile', () => {
  it('reads back who the companion is, so a change can adjust rather than overwrite', async () => {
    await call('set_soul_control', { control: 'name', value: 'Atlas' });
    await call('set_soul_control', { control: 'conversationStyle', value: 'direct' });

    const result = await call('get_soul_profile');
    const soul = result.soul as Record<string, unknown>;

    expect(soul.name).toBe('Atlas');
    expect(soul.conversationStyle).toBe('direct');
    expect(soul.emotionalTraits).toBeTruthy();
  });
});

describe('soul presets', () => {
  it('lists presets with their categories', async () => {
    const result = await call('list_soul_presets', {});
    const presets = result.presets as { name: string }[];
    expect(presets.length).toBeGreaterThan(0);
  });

  it('applies a preset by name and replaces the whole personality', async () => {
    const listed = (await call('list_soul_presets', {})).presets as { name: string }[];
    const target = listed[0].name;

    const result = await call('apply_soul_preset', { name: target, confirm: true });

    expect(result.success).toBe(true);
    expect(useVoiceStore().soulConfig.name).toBe(target);
  });

  it('names real alternatives when the preset does not exist', async () => {
    const result = await call('apply_soul_preset', { name: 'Space Pirate', confirm: true });
    expect(result.success).toBe(false);
    expect(String(result.message)).toContain('Space Pirate');
  });
});
