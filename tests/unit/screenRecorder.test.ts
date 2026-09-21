/**
 * The login screen's record button.
 *
 * Two things are worth pinning down here and neither is "MediaRecorder was
 * called". The first is the file: the ask is an .mp4, and the extension has to
 * follow the container the browser actually negotiated, because a webm payload
 * named .mp4 plays in nothing. The second is continuity: a take started before
 * signing in has to survive `AuthPage` unmounting, which is what module-level
 * recorder state buys and what a component-owned recorder would lose.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import SoundtrackPill from '@/components/auth/SoundtrackPill.vue';
import { useScreenRecorder } from '@/composables/useScreenRecorder';

// The pill also drives the crate and the avatar rate; those halves have their
// own tests, and the real ones reach for audio.
vi.mock('@/composables/useSoundtrack', async (importOriginal) => {
  const { ref, shallowRef } = await import('vue');
  const actual = await importOriginal<Record<string, unknown>>();
  const currentTrack = shallowRef(null);
  const isPlaying = ref(false);
  return {
    ...actual,
    useWelcomeSoundtrack: () => ({
      currentTrack,
      isPlaying,
      toggle: vi.fn(),
      next: vi.fn(),
      stop: vi.fn(),
      owns: () => currentTrack.value !== null,
      release: vi.fn(),
      dispose: vi.fn(),
    }),
  };
});

/** What a Chrome that can mux mp4 answers for a silent surface. */
const MP4 = ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4'];
const MP4_WITH_AUDIO = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2'];
const WEBM = ['video/webm;codecs=vp9', 'video/webm'];

class TrackStub extends EventTarget {
  kind = 'video';
  stop = vi.fn();
  /** What Chrome's "Stop sharing" bar does to the track it handed out. */
  end() {
    this.dispatchEvent(new Event('ended'));
  }
}

let track: TrackStub;
let audioTracks: TrackStub[] = [];

class MediaRecorderStub {
  static supported: string[] = MP4;
  static last: MediaRecorderStub | null = null;
  static isTypeSupported = (type: string) => MediaRecorderStub.supported.includes(type);

  state: 'inactive' | 'recording' = 'inactive';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readonly mimeType: string;

  constructor(
    public stream: MediaStream,
    options: { mimeType?: string } = {},
  ) {
    this.mimeType = options.mimeType ?? '';
    MediaRecorderStub.last = this;
  }

  start() {
    this.state = 'recording';
    this.ondataavailable?.({ data: new Blob(['frame'], { type: this.mimeType }) });
  }

  stop() {
    this.state = 'inactive';
    this.onstop?.();
  }
}

/** Filenames of every download the recorder handed to the browser. */
let downloads: string[] = [];
let getDisplayMedia: ReturnType<typeof vi.fn>;

function installCaptureStubs(options: { displayMedia?: boolean; audio?: boolean } = {}) {
  track = new TrackStub();
  audioTracks = options.audio ? [new TrackStub()] : [];
  const stream = {
    getTracks: () => [track],
    getVideoTracks: () => [track],
    // Headless or not, a shared surface often comes without audio, and the
    // container the recorder can offer depends on it.
    getAudioTracks: () => audioTracks,
  } as unknown as MediaStream;

  getDisplayMedia = vi.fn(async () => stream);
  Object.defineProperty(navigator, 'mediaDevices', {
    value: options.displayMedia === false ? {} : { getDisplayMedia },
    configurable: true,
  });
  (window as unknown as Record<string, unknown>).MediaRecorder = MediaRecorderStub;
}

beforeEach(() => {
  downloads = [];
  MediaRecorderStub.supported = MP4;
  MediaRecorderStub.last = null;
  installCaptureStubs();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push(this.download);
  });
});

afterEach(() => {
  // Module state: the recorder outlives any one component by design, so it
  // also outlives a test unless it is put back.
  useScreenRecorder().stop();
  vi.restoreAllMocks();
});

/** Click the record button and let the display-media promise settle. */
async function pressRecord(wrapper: ReturnType<typeof mount>) {
  await wrapper.get('.pill-btn--record').trigger('click');
  await nextTick();
  await nextTick();
}

describe('login screen record button', () => {
  it('is left out where the browser cannot capture a screen', () => {
    installCaptureStubs({ displayMedia: false });
    const wrapper = mount(SoundtrackPill);
    expect(wrapper.find('.pill-btn--record').exists()).toBe(false);
    wrapper.unmount();
  });

  it('sits directly after the play button', () => {
    const wrapper = mount(SoundtrackPill);
    const buttons = wrapper.findAll('.pill-btn').map((button) => button.classes().join(' '));
    expect(buttons[0]).toContain('pill-btn--main');
    expect(buttons[1]).toContain('pill-btn--record');
    wrapper.unmount();
  });

  it('records from the click and downloads an .mp4 when stopped', async () => {
    const wrapper = mount(SoundtrackPill);

    await pressRecord(wrapper);
    expect(getDisplayMedia).toHaveBeenCalledTimes(1);
    expect(wrapper.get('.pill-btn--record').classes()).toContain('pill-btn--rolling');
    expect(downloads).toEqual([]);

    await pressRecord(wrapper);
    expect(wrapper.get('.pill-btn--record').classes()).not.toContain('pill-btn--rolling');
    expect(downloads).toHaveLength(1);
    expect(downloads[0]).toMatch(/^kwami-screen-[\d-]+\.mp4$/);
    expect(track.stop).toHaveBeenCalled();
    wrapper.unmount();
  });

  it('asks for a container that can carry the surface audio', async () => {
    // A type is supported for a set of tracks, not in the abstract: naming a
    // silent container on a stream that has sound is a constructor throw, and
    // a take that never starts.
    installCaptureStubs({ audio: true });
    MediaRecorderStub.supported = [...MP4_WITH_AUDIO, ...MP4];
    const wrapper = mount(SoundtrackPill);

    await pressRecord(wrapper);

    expect(MediaRecorderStub.last?.mimeType).toBe(MP4_WITH_AUDIO[0]);
    wrapper.unmount();
  });

  it('names the file webm when the browser cannot mux mp4', async () => {
    MediaRecorderStub.supported = WEBM;
    const wrapper = mount(SoundtrackPill);

    await pressRecord(wrapper);
    await pressRecord(wrapper);

    expect(downloads[0]).toMatch(/\.webm$/);
    wrapper.unmount();
  });

  it('saves the take when the share is stopped from the browser instead', async () => {
    const wrapper = mount(SoundtrackPill);
    await pressRecord(wrapper);

    track.end();
    await nextTick();

    expect(downloads).toHaveLength(1);
    expect(wrapper.get('.pill-btn--record').classes()).not.toContain('pill-btn--rolling');
    wrapper.unmount();
  });

  it('keeps rolling once the login screen is gone, and still saves', async () => {
    const wrapper = mount(SoundtrackPill);
    await pressRecord(wrapper);

    // Signing in unmounts AuthPage, and the pill with it.
    wrapper.unmount();
    const recorder = useScreenRecorder();
    expect(recorder.isRecording.value).toBe(true);

    recorder.stop();
    expect(downloads).toHaveLength(1);
    expect(recorder.isRecording.value).toBe(false);
  });

  it('leaves nothing recording when the picker is dismissed', async () => {
    getDisplayMedia.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'));
    const wrapper = mount(SoundtrackPill);

    await pressRecord(wrapper);

    expect(useScreenRecorder().isRecording.value).toBe(false);
    expect(downloads).toEqual([]);
    wrapper.unmount();
  });
});
