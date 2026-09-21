/**
 * Screen capture, started from the login screen's transport pill.
 *
 * Module-level state on purpose, the same shape as `useWelcomeBackground` and
 * `useWelcomeRandomizer`: a capture started *before* signing in has to outlive
 * `AuthPage`, which unmounts the moment the session lands. The recorder is
 * owned by this module rather than by the button, so the take keeps rolling
 * across that transition and is only cut when someone stops it -- from the
 * pill, or from the browser's own "Stop sharing" bar, which ends the track and
 * is handled below as the same stop.
 *
 * Deliberately NOT `useRecording`, which is the signed-in ControlBar's
 * recorder. That one repaints a cropped region of the kwami canvas onto an
 * offscreen canvas and mixes the app's own audio graph into it -- it records
 * the avatar, and it needs a live kwami. This one asks the browser for a
 * display surface and records whatever the user picked (this tab, a window,
 * the whole screen) with no canvas and no kwami in the path.
 */

import { computed, ref, type ComputedRef, type Ref } from 'vue';

/**
 * mp4 first, because an .mp4 is what the button promises and what every
 * player, editor and phone takes without a conversion step.
 *
 * Only some browsers can mux it live: Chrome 126+ and Safari record
 * `video/mp4`, Firefox records webm only. So the list degrades to webm rather
 * than failing, and the filename follows the container that was actually
 * negotiated -- an .mp4 extension over a webm payload plays in nothing, which
 * is a worse outcome than a file named honestly.
 *
 * Split by whether the surface came with audio, because a type is supported
 * *for a set of tracks*, not in the abstract, and the constructor throws
 * NotSupportedError on the mismatch. Measured on Playwright's Chromium, which
 * is the same engine without the proprietary encoders:
 * `video/mp4;codecs=avc1` is supported and `video/mp4;codecs=avc1.42E01E,
 * mp4a.40.2` is not -- so a single list would have named an AAC track on a
 * build with no AAC encoder and taken the whole recording down with it.
 */
const MIME_CANDIDATES_WITH_AUDIO = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4;codecs=avc1,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
] as const;

const MIME_CANDIDATES_SILENT = [
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4;codecs=avc1',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
] as const;

/**
 * Cut the stream into one-second slices instead of one buffer at the end.
 * A screen recording left running through a login and a session is easily
 * minutes long, and a recorder holding it all in one blob is a tab that dies
 * quietly on a long take.
 */
const TIMESLICE_MS = 1000;

const isRecording = ref(false);
const isStarting = ref(false);
const elapsedSeconds = ref(0);

let recorder: MediaRecorder | null = null;
let stream: MediaStream | null = null;
let chunks: Blob[] = [];
let tick: ReturnType<typeof setInterval> | null = null;

/**
 * Screen capture is desktop-only and secure-context-only: there is no
 * `getDisplayMedia` on iOS Safari or Chrome for Android, and none over plain
 * http. Read at call time so the pill can leave the button out entirely
 * rather than offer a control that cannot work.
 */
function canRecordScreen(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.MediaRecorder === 'undefined') return false;
  return typeof navigator.mediaDevices?.getDisplayMedia === 'function';
}

/**
 * The best recorder this browser will give us for these tracks, or `null` if
 * it will not give us one at all.
 */
function createRecorder(captured: MediaStream): MediaRecorder | null {
  const candidates = captured.getAudioTracks().length
    ? MIME_CANDIDATES_WITH_AUDIO
    : MIME_CANDIDATES_SILENT;

  for (const mimeType of candidates) {
    if (!MediaRecorder.isTypeSupported(mimeType)) continue;
    try {
      return new MediaRecorder(captured, { mimeType });
    } catch {
      // Supported as a string, rejected for these tracks. Try the next.
    }
  }

  // Nothing on the list took: let the browser pick its own default rather
  // than drop the take.
  try {
    return new MediaRecorder(captured);
  } catch {
    return null;
  }
}

function extensionFor(mimeType: string): string {
  return mimeType.includes('mp4') ? 'mp4' : 'webm';
}

/** `kwami-screen-2026-09-21-18-04-12.mp4` -- sortable, and no colons, which Windows refuses. */
function filenameFor(mimeType: string): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  const stamp = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('-');
  return `kwami-screen-${stamp}.${extensionFor(mimeType)}`;
}

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoked on a delay, not in this tick: the browser reads the blob after the
  // click returns, and revoking immediately saves a zero-byte file.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function releaseStream() {
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
}

function stopTicking() {
  if (tick) clearInterval(tick);
  tick = null;
}

function reset() {
  stopTicking();
  releaseStream();
  recorder = null;
  isStarting.value = false;
  isRecording.value = false;
  elapsedSeconds.value = 0;
}

/**
 * Ask for a surface, then record it. Resolves once the recorder is rolling or
 * the attempt was abandoned; a dismissed picker is a normal outcome, not an
 * error, so it resolves quietly with nothing recording.
 */
async function start(): Promise<void> {
  if (isRecording.value || isStarting.value || !canRecordScreen()) return;
  isStarting.value = true;

  let captured: MediaStream;
  try {
    // This must be the first await the click handler reaches: getDisplayMedia
    // needs the gesture's transient activation, and any earlier await spends it.
    captured = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30 },
      // Tab and system audio when the picker offers it -- the login screen's
      // soundtrack is half of what anyone recording this screen is after.
      audio: true,
    });
  } catch {
    // Dismissed picker, or a denied permission. Nothing to say.
    isStarting.value = false;
    return;
  }

  stream = captured;
  chunks = [];

  const active = createRecorder(captured);
  if (!active) {
    reset();
    return;
  }
  recorder = active;

  active.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  active.onstop = () => {
    // `mimeType` on the recorder is the container it actually negotiated,
    // which is what the blob and the extension have to agree with.
    const type = active.mimeType || 'video/webm';
    const take = chunks;
    chunks = [];
    reset();
    if (take.length) save(new Blob(take, { type }), filenameFor(type));
  };

  // A recorder that errors out mid-take still holds the surface; let go of it.
  active.onerror = () => stop();

  // The browser's own "Stop sharing" bar, or closing the shared tab, ends the
  // track without telling the recorder. Treat it as the stop it is, so the
  // take is still saved when someone stops the share from outside the app --
  // which is the only stop control left once the login screen is gone.
  captured.getVideoTracks().forEach((track) => track.addEventListener('ended', () => stop()));

  try {
    active.start(TIMESLICE_MS);
  } catch {
    // A recorder that will not start holds the surface open; hand it back.
    reset();
    return;
  }
  isStarting.value = false;
  isRecording.value = true;
  elapsedSeconds.value = 0;
  tick = setInterval(() => {
    elapsedSeconds.value += 1;
  }, 1000);
}

/** Cut the take. The file is written from `onstop`, so this returns before it lands. */
function stop(): void {
  if (recorder && recorder.state !== 'inactive') {
    recorder.stop();
    return;
  }
  // Already inactive: either it never started, or `onstop` has run and saved.
  reset();
}

export interface ScreenRecorder {
  /** False where the browser has no screen capture at all; the control is then not worth showing. */
  isSupported: boolean;
  isRecording: Ref<boolean>;
  /** True between the click and the user answering the picker. */
  isStarting: Ref<boolean>;
  elapsedSeconds: Ref<number>;
  /** `m:ss`, for the face of the button while it rolls. */
  elapsedLabel: ComputedRef<string>;
  start: () => Promise<void>;
  stop: () => void;
  toggle: () => void;
}

export function useScreenRecorder(): ScreenRecorder {
  const elapsedLabel = computed(() => {
    const minutes = Math.floor(elapsedSeconds.value / 60);
    const seconds = elapsedSeconds.value % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  });

  function toggle() {
    if (isRecording.value) stop();
    else void start();
  }

  return {
    isSupported: canRecordScreen(),
    isRecording,
    isStarting,
    elapsedSeconds,
    elapsedLabel,
    start,
    stop,
    toggle,
  };
}
