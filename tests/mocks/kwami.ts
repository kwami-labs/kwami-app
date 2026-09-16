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
export function createAvatarStub() {
  return {
    switchRenderer: vi.fn(),
    getRendererType: vi.fn(() => 'blob-xyz'),
    getBlob: vi.fn(() => null),
    getBlackHole: vi.fn(() => null),
    getEyeIris: vi.fn(() => null),
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
  };
}

export function createKwamiStub() {
  return {
    id: 'kwami-test-id',
    avatar: createAvatarStub(),
    agent: createAgentStub(),
    soul: { getConfig: vi.fn(() => ({})), updateConfig: vi.fn() },
    memory: { search: vi.fn(async () => []), clear: vi.fn(async () => undefined) },
    tools: { register: vi.fn(), unregister: vi.fn(), getToolDefinitions: vi.fn(() => []) },
    skills: { register: vi.fn(), unregister: vi.fn() },
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
