/**
 * The login screen has to get out of the way of a wallet.
 *
 * Phantom and MetaMask both relay their requests through `postMessage` and need
 * the page's main thread to deliver the reply. Measured against the SDK's own
 * `animateBlobXyz` at the resolution this screen pins, one frame of the avatar
 * costs ~19ms — more than a whole 60Hz frame, back to back — so for as long as
 * an approval was open the thread never went idle, both wallets timed their
 * pending request out, and the page showed "could not finish signing" for a
 * signature the visitor had approved.
 *
 * What is pinned here is the yield: while a wallet holds the floor the avatar
 * stops, and when it lets go the avatar starts again. The expensive loop is the
 * SDK's own, so stopping this component's `requestAnimationFrame` is not
 * enough on its own and neither half is sufficient alone.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { resetWalletApproval, useWalletApproval } from '@/composables/useWalletApproval';

const BIN_COUNT = 1_024;

const mesh = { rotation: { x: 0, y: 0, z: 0 }, position: { x: 0, y: 0, z: 0 } };
const audioEffects: Record<string, number> = {};
let spectrum = new Uint8Array(BIN_COUNT);

const context = {
  sampleRate: 44_100,
  createAnalyser: () => ({
    fftSize: 2_048,
    smoothingTimeConstant: 0.35,
    minDecibels: -90,
    maxDecibels: -10,
    get frequencyBinCount() {
      return this.fftSize / 2;
    },
    context,
    getByteFrequencyData: (out: Uint8Array) => out.set(spectrum),
  }),
};

const analyser = { smoothingTimeConstant: 0.35, context, connect: vi.fn(), disconnect: vi.fn() };

/** The renderer's own loop controls, which is where the expensive frame lives. */
const blob = {
  audioEffects,
  liquidPhysics: { stretch: 0, velocityX: 0, velocityY: 0 },
  getMesh: () => mesh,
  startAnimation: vi.fn(),
  stopAnimation: vi.fn(),
  setResolution: vi.fn(),
  setRotation: vi.fn(),
  setTouchStrength: vi.fn(),
  setTouchDuration: vi.fn(),
  setMaxTouchPoints: vi.fn(),
  setColors: vi.fn(),
  setSpikes: vi.fn(),
  setAmplitude: vi.fn(),
  setTime: vi.fn(),
};

const avatar = {
  randomize: vi.fn(),
  switchRenderer: vi.fn(),
  setSkin: vi.fn(),
  setScale: vi.fn(),
  setShininess: vi.fn(),
  setWireframe: vi.fn(),
  getEyeIris: vi.fn(() => null),
  getAudio: vi.fn(() => ({
    getAudioElement: () => ({ paused: false }),
    getFrequencyData: () => new Uint8Array(0),
    getAnalyser: () => analyser,
  })),
  getBlob: vi.fn(() => blob),
};

vi.mock('kwami', () => ({
  Kwami: vi.fn(function Kwami() {
    return { avatar, dispose: vi.fn(async () => undefined) };
  }),
  randomBlobSkinType: () => 'radial',
}));

const BIN_HZ = 44_100 / 2_048;
function bed(level: number) {
  const out = new Uint8Array(BIN_COUNT);
  for (let i = Math.round(30 / BIN_HZ); i < Math.round(7_000 / BIN_HZ); i += 1) {
    out[i] = Math.round(level * 255);
  }
  return out;
}

const mounted: { unmount: () => void }[] = [];

async function mountBlob() {
  const WelcomeBlob = (await import('@/components/auth/WelcomeBlob.vue')).default;
  const wrapper = mount(WelcomeBlob, { attachTo: document.body });
  mounted.push(wrapper);
  await vi.advanceTimersByTimeAsync(50);
  return wrapper;
}

/** Advance frames while the pointer travels, and report how far yaw moved. */
async function movementOver(frames: number) {
  const before = mesh.rotation.y;
  let moved = 0;
  for (let i = 0; i < frames; i += 1) {
    window.dispatchEvent(new MouseEvent('mousemove', {
      clientX: 80 + i * 12,
      clientY: 120,
    }));
    await vi.advanceTimersByTimeAsync(16);
    moved = Math.max(moved, Math.abs(mesh.rotation.y - before));
  }
  return moved;
}

beforeEach(() => {
  vi.useFakeTimers();
  mesh.rotation.x = 0;
  mesh.rotation.y = 0;
  mesh.rotation.z = 0;
  mesh.position.y = 0;
  spectrum = bed(0.5);
  blob.startAnimation.mockClear();
  blob.stopAnimation.mockClear();
  resetWalletApproval();
});

afterEach(async () => {
  while (mounted.length) mounted.pop()?.unmount();
  await vi.advanceTimersByTimeAsync(0);
  vi.useRealTimers();
  resetWalletApproval();
});

describe('the login avatar while a wallet is being asked to sign', () => {
  it('stops the renderer the SDK is driving, not only its own frame loop', async () => {
    await mountBlob();
    await movementOver(10);
    expect(blob.stopAnimation).not.toHaveBeenCalled();

    const { holdForWallet } = useWalletApproval();
    let release: (() => void) | null = null;
    const pending = holdForWallet(() => new Promise<void>((resolve) => { release = resolve; }));
    await nextTick();

    expect(blob.stopAnimation).toHaveBeenCalled();

    // And the component's own loop is down too: the mesh stops moving.
    const movedWhileHeld = await movementOver(30);
    expect(movedWhileHeld).toBe(0);

    release!();
    await pending;
    await nextTick();

    expect(blob.startAnimation).toHaveBeenCalled();
    expect(await movementOver(30)).toBeGreaterThan(0);
  });

  it('gets back up after a wallet that throws', async () => {
    await mountBlob();
    const { holdForWallet } = useWalletApproval();

    await holdForWallet(async () => {
      throw new Error('Unexpected error');
    }).catch(() => undefined);
    await nextTick();

    expect(blob.startAnimation).toHaveBeenCalled();
    expect(await movementOver(30)).toBeGreaterThan(0);
  });

  it('does not re-roll the avatar while the wallet has the floor', async () => {
    // A re-roll can switch renderers, and a new renderer starts its own loop —
    // which would put the main thread back under load behind the suspension's
    // back, with nothing to show for it.
    await mountBlob();
    const { holdForWallet } = useWalletApproval();
    let release: (() => void) | null = null;
    const pending = holdForWallet(() => new Promise<void>((resolve) => { release = resolve; }));
    await nextTick();

    avatar.switchRenderer.mockClear();
    // Several seconds, which is several ticks of the randomize timer.
    await vi.advanceTimersByTimeAsync(5_000);

    expect(avatar.switchRenderer).not.toHaveBeenCalled();

    release!();
    await pending;
  });
});
