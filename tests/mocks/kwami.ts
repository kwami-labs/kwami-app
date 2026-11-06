import { vi } from 'vitest';

/**
 * Stub for the `kwami` package.
 *
 * The real library builds a WebGL context and opens a LiveKit connection, neither
 * of which exists under jsdom. Every unit/component test gets this instead, via
 * `vi.mock('kwami')` in tests/setup.ts.
 *
 * Each sub-API is a plain object of `vi.fn()`s so tests can assert on calls
 * (e.g. that a slider change reaches `avatar.setScale`) without a real renderer.
 */
const jarvisPalette = {
  primary: '#7ee7ff',
  secondary: '#3d8bfd',
  accent: '#ffffff',
  alert: '#ffb020',
  background: '#02060c',
  backgroundGlow: '#063044',
};

/**
 * The published `kwami` package these tests resolve does not export the Jarvis
 * helpers until the SDK release that adds the renderer. The app already imports
 * them, so the mock has to provide them or Vitest refuses the import.
 */
export const jarvisSdkStubs = {
  getJarvisPalette: vi.fn(() => ({ ...jarvisPalette })),
  getDefaultJarvisConfig: vi.fn(() => ({
    palettePreset: 'holo-cyan' as const,
    color: { ...jarvisPalette },
    intensity: 1,
    reactivity: 1,
    rotationSpeed: 1,
    parallax: 0.2,
    quality: 'high' as const,
    backdrop: true,
    labels: true,
    title: 'KWAMI',
    scale: 1,
    panels: true,
    grid: true,
    depth: 1,
  })),
};

export function createAvatarStub() {
  return {
    switchRenderer: vi.fn(),
    getRendererType: vi.fn(() => 'blob-xyz'),
    getBlob: vi.fn(() => null),
    getBlackHole: vi.fn(() => null),
    getEyeIris: vi.fn(() => null),
    getJarvis: vi.fn(() => null),
    getParticlesFace: vi.fn(() => null),
    getScene: vi.fn(() => null),
    randomize: vi.fn(),
    setScale: vi.fn(),
    setOpacity: vi.fn(),
    setRotation: vi.fn(),
    setSkin: vi.fn(),
    setShininess: vi.fn(),
    setWireframe: vi.fn(),
    dispose: vi.fn(),
  };
}

export function createAgentStub() {
  return {
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
    getConfig: vi.fn(() => ({})),
    updateConfig: vi.fn(),
    syncConfigToBackend: vi.fn(),
    updateLlmLive: vi.fn(),
    updateSttLive: vi.fn(),
    updateTtsLive: vi.fn(),
    updateVoiceLive: vi.fn(),
    updateRealtimeLive: vi.fn(),
    registerTool: vi.fn(),
    unregisterTool: vi.fn(),
  };
}

export function createKwamiStub() {
  return {
    id: 'kwami-test-id',
    avatar: createAvatarStub(),
    agent: createAgentStub(),
    soul: { getConfig: vi.fn(() => ({})), updateConfig: vi.fn() },
    memory: { search: vi.fn(async () => []), clear: vi.fn(async () => undefined) },
    tools: {
      register: vi.fn(),
      unregister: vi.fn(),
      getAll: vi.fn(() => []),
      getToolDefinitions: vi.fn(() => []),
    },
    skills: { register: vi.fn(), unregister: vi.fn() },
    registerTool: vi.fn(),
    unregisterTool: vi.fn(),
    isConnected: vi.fn(() => false),
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
    dispose: vi.fn(),
    getState: vi.fn(() => ({ connected: false })),
    updateVoice: vi.fn(),
  };
}

export type KwamiStub = ReturnType<typeof createKwamiStub>;

/** The instance handed back by the mocked `new Kwami(...)` in the current test. */
export let lastKwamiStub: KwamiStub | null = null;

export const Kwami = vi.fn(function Kwami() {
  lastKwamiStub = createKwamiStub();
  return lastKwamiStub;
}) as unknown as new (...args: unknown[]) => KwamiStub;

export function resetKwamiStub() {
  lastKwamiStub = null;
}
