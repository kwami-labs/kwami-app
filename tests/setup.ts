import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { config } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { server } from './mocks/server';
import { Kwami, resetKwamiStub } from './mocks/kwami';
import { en } from '../src/i18n/translations/en';
import { es } from '../src/i18n/translations/es';
import { workspaceAgentToolsEn, workspaceAgentToolsEs } from '../src/i18n/workspaceAgentTools.locale';

// --- the kwami runtime is WebGL + LiveKit; never construct the real one ---
vi.mock('kwami', () => ({ Kwami }));

// --- env vars the app reads at module scope ---
vi.stubEnv('VITE_API_URL', 'http://localhost:8080');
vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321');
vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
vi.stubEnv('VITE_LIVEKIT_URL', 'wss://livekit.test');
vi.stubEnv('VITE_LIVEKIT_TOKEN_ENDPOINT', 'http://localhost:8080/token');

// --- jsdom gaps ---
// jsdom implements none of these; without stubs, component mounts throw before
// the assertion under test is ever reached.
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

class ObserverStub {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);
}
vi.stubGlobal('ResizeObserver', ObserverStub);
vi.stubGlobal('IntersectionObserver', ObserverStub);

// Canvas: return a usable 2D context stub and a null WebGL context, so code that
// feature-detects WebGL takes its no-renderer branch instead of crashing.
const context2dStub = () =>
  new Proxy(
    {
      canvas: null,
      createRadialGradient: () => ({ addColorStop: vi.fn() }),
      createLinearGradient: () => ({ addColorStop: vi.fn() }),
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
      measureText: () => ({ width: 0 }),
    } as Record<string, unknown>,
    { get: (target, prop) => (prop in target ? target[prop as string] : vi.fn()) },
  );

HTMLCanvasElement.prototype.getContext = vi.fn((kind: string) =>
  kind === '2d' ? context2dStub() : null,
) as unknown as HTMLCanvasElement['getContext'];
HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,');
HTMLCanvasElement.prototype.captureStream = vi.fn(() => ({ getTracks: () => [] })) as never;

// Web Audio
class AudioContextStub {
  state = 'running';
  destination = {};
  createAnalyser = vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    fftSize: 2048,
    frequencyBinCount: 1024,
    getByteFrequencyData: vi.fn(),
    getByteTimeDomainData: vi.fn(),
  }));
  createGain = vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1 } }));
  createMediaStreamSource = vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() }));
  createMediaStreamDestination = vi.fn(() => ({ stream: { getTracks: () => [] } }));
  close = vi.fn(async () => undefined);
  resume = vi.fn(async () => undefined);
}
vi.stubGlobal('AudioContext', AudioContextStub);
vi.stubGlobal('webkitAudioContext', AudioContextStub);

// rAF: jsdom has it, but back it with a timer so loops are drainable via fake timers.
if (!window.requestAnimationFrame) {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16) as unknown as number);
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
}

vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() }));

// --- global component config ---
// Real messages (not a stub t()) so tests catch missing keys and the shadowed-`t`
// class of bug rather than silently rendering the key back.
config.global.plugins = [
  createI18n({
    legacy: false,
    locale: 'en',
    fallbackLocale: 'en',
    messages: {
      en: { ...en, ...workspaceAgentToolsEn },
      es: { ...es, ...workspaceAgentToolsEs },
    },
  }),
];
config.global.stubs = { 'iconify-icon': true };
config.global.mocks = { $toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } };

vi.mock('vue-toastification', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-toastification')>();
  return {
    ...actual,
    useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), clear: vi.fn() }),
  };
});

// --- MSW lifecycle ---
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  resetKwamiStub();
  localStorage.clear();
  sessionStorage.clear();
  document.documentElement.removeAttribute('style');
  document.documentElement.removeAttribute('data-theme');
});
afterAll(() => server.close());
