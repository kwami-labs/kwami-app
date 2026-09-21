/**
 * Playing the record crate through a kwami's own audio object, so the avatar
 * moves to it.
 *
 * `KwamiAudio` already runs its `HTMLAudioElement` through a Web Audio
 * `AnalyserNode`, and `BlobXyz`'s render loop reads that analyser every frame
 * off its `audioEffects` (enabled by default). So routing music through
 * `kwami.avatar.getAudio()` — rather than a bare `new Audio()` — is the whole
 * trick: the blob reacts with no per-frame code from us. Renderers that are not
 * blob-xyz still need `setAudioLevels()` pushed at them; that is the caller's
 * job, with `@/utils/audioBands`.
 *
 * Two things about `KwamiAudio` shape this file:
 *
 * - Its `next()`/`previous()` walk the `files` array handed to its constructor,
 *   and we deliberately do not hand it one: `new Audio(files[0])` with
 *   `preload = 'auto'` would pull a ~7 MB track down on every page view before
 *   anyone pressed play. We load lazily with `loadAudioSource()` and pick
 *   tracks ourselves.
 * - It owns its audio graph and exposes only `setVolume()`, so nexow's
 *   `GainNode` crossfades are reproduced here as a rAF volume ramp.
 */

import { ref, shallowRef, watch, type Ref } from 'vue';
import type { KwamiAudio } from 'kwami';
import { useKwami } from '@/composables/useKwami';
import { pickFirstTrack, pickTrack, type Track } from '@/lib/soundtrack';

/** Nexow's fade lengths, in milliseconds. */
const FADE_IN_MS = 2_200;
const FADE_OUT_MS = 1_600;
/** A record changed by hand: out quickly, because it was asked for, but not cut. */
const FADE_SKIP_MS = 500;

/** Give up after this many unplayable files in a row rather than spin the crate. */
const MAX_CONSECUTIVE_ERRORS = 5;

const DEFAULT_LEVEL = 0.8;

export interface SoundtrackController {
  /** What is on the deck, or null when nothing is. */
  readonly currentTrack: Ref<Track | null>;
  readonly isPlaying: Ref<boolean>;
  /** Start if stopped, pause if playing. Call this straight from a click. */
  toggle: () => void;
  /** Another record, on request. */
  next: () => void;
  /** Fade out, take the record off, forget it. */
  stop: () => void;
  /** Whether a crate track owns the element right now. */
  owns: () => boolean;
  /** Hand the element back — a local file is taking over. */
  release: () => void;
  /** Drop listeners and timers. */
  dispose: () => void;
}

export interface SoundtrackOptions {
  /** Playback volume, read at each fade so a volume slider can drive it. */
  level?: () => number;
}

/**
 * A crate controller over whatever `resolveAudio` hands back.
 *
 * `resolveAudio` is a function rather than a value because the kwami it belongs
 * to is usually built after the component that drives it has mounted.
 */
export function createSoundtrack(
  resolveAudio: () => KwamiAudio | null,
  options: SoundtrackOptions = {},
): SoundtrackController {
  const currentTrack = shallowRef<Track | null>(null);
  const isPlaying = ref(false);

  const level = options.level ?? (() => DEFAULT_LEVEL);

  /** Play was pressed and nothing has stopped it since. */
  let wanted = false;
  /** Bumped by every play and stop, so a late callback can tell it is stale. */
  let turn = 0;
  let consecutiveErrors = 0;
  let fadeHandle: number | null = null;
  let swapTimer: ReturnType<typeof setTimeout> | null = null;
  let bound: HTMLAudioElement | null = null;

  function cancelFade() {
    if (fadeHandle !== null) {
      cancelAnimationFrame(fadeHandle);
      fadeHandle = null;
    }
  }

  function ramp(audio: KwamiAudio, to: number, ms: number) {
    cancelFade();
    const from = audio.getVolume();
    if (ms <= 0 || from === to) {
      audio.setVolume(to);
      return;
    }
    const startedAt = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - startedAt) / ms);
      audio.setVolume(from + (to - from) * t);
      fadeHandle = t < 1 ? requestAnimationFrame(step) : null;
    };
    fadeHandle = requestAnimationFrame(step);
  }

  function onElementPlay() {
    if (!currentTrack.value) return;
    isPlaying.value = true;
    const audio = resolveAudio();
    // Silent until sound actually flows, then a fade.
    if (audio) ramp(audio, level(), FADE_IN_MS);
  }

  function onElementPause() {
    isPlaying.value = false;
  }

  /** A record that ends before the visitor leaves hands over to the next pick. */
  function onElementEnded() {
    if (!wanted) return;
    consecutiveErrors = 0;
    spin(pickTrack(Math.random, currentTrack.value ?? undefined));
  }

  /** Offline, a missing file, a codec the browser lacks: try another record. */
  function onElementError() {
    if (!wanted || !currentTrack.value) return;
    consecutiveErrors += 1;
    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      stop(0);
      return;
    }
    spin(pickTrack(Math.random, currentTrack.value));
  }

  function bind(): KwamiAudio | null {
    const audio = resolveAudio();
    const element = audio?.getAudioElement() ?? null;
    if (element === bound) return audio;

    unbind();
    bound = element;
    if (!element) return audio;

    element.addEventListener('play', onElementPlay);
    element.addEventListener('pause', onElementPause);
    element.addEventListener('ended', onElementEnded);
    element.addEventListener('error', onElementError);
    return audio;
  }

  function unbind() {
    if (!bound) return;
    bound.removeEventListener('play', onElementPlay);
    bound.removeEventListener('pause', onElementPause);
    bound.removeEventListener('ended', onElementEnded);
    bound.removeEventListener('error', onElementError);
    bound = null;
  }

  /** Put a record on. */
  function spin(track: Track) {
    const audio = bind();
    if (!audio) return;

    turn += 1;
    currentTrack.value = track;
    audio.setVolume(0);
    audio.loadAudioSource(track.src);
    // Synchronous on purpose: `play()` builds and resumes the AudioContext, and
    // browsers only unmute one from inside a real gesture.
    void audio.play();
  }

  function start() {
    wanted = true;
    consecutiveErrors = 0;
    spin(pickFirstTrack(Math.random, currentTrack.value ?? undefined));
  }

  function toggle() {
    const audio = bind();
    if (!audio) return;

    if (isPlaying.value) {
      wanted = false;
      turn += 1;
      audio.pause();
      return;
    }

    // Paused mid-record: pick it up where it was rather than start another.
    if (currentTrack.value) {
      wanted = true;
      turn += 1;
      audio.setVolume(0);
      void audio.play();
      return;
    }

    start();
  }

  /**
   * Bumping the turn is what takes the current record off: its `ended` is stale
   * from here, so a fade out and its replacement's fade in cannot fight.
   */
  function next() {
    const audio = bind();
    if (!audio) return;

    if (!currentTrack.value) {
      start();
      return;
    }

    const upcoming = pickTrack(Math.random, currentTrack.value);
    const mine = ++turn;
    wanted = true;
    ramp(audio, 0, FADE_SKIP_MS);
    if (swapTimer) clearTimeout(swapTimer);
    swapTimer = setTimeout(() => {
      swapTimer = null;
      if (turn === mine && wanted) spin(upcoming);
    }, FADE_SKIP_MS + 40);
  }

  function stop(fadeMs = FADE_OUT_MS) {
    wanted = false;
    const mine = ++turn;
    const audio = resolveAudio();
    currentTrack.value = null;
    isPlaying.value = false;
    if (!audio) return;

    ramp(audio, 0, fadeMs);
    if (swapTimer) clearTimeout(swapTimer);
    swapTimer = setTimeout(() => {
      swapTimer = null;
      // Unless a new record has gone on since, take this one off.
      if (turn !== mine) return;
      audio.pause();
      audio.setCurrentTime(0);
    }, fadeMs + 80);
  }

  function owns() {
    return currentTrack.value !== null;
  }

  /** A local file is taking over the element; stop claiming what is playing. */
  function release() {
    wanted = false;
    turn += 1;
    cancelFade();
    if (swapTimer) {
      clearTimeout(swapTimer);
      swapTimer = null;
    }
    currentTrack.value = null;
    isPlaying.value = false;
  }

  function dispose() {
    wanted = false;
    turn += 1;
    cancelFade();
    if (swapTimer) {
      clearTimeout(swapTimer);
      swapTimer = null;
    }
    unbind();
    currentTrack.value = null;
    isPlaying.value = false;
  }

  return { currentTrack, isPlaying, toggle, next, stop, owns, release, dispose };
}

// --- The login screen's instance -------------------------------------------
//
// `WelcomeBlob` builds its own `Kwami`, separate from the `useKwami()`
// singleton, and that is the avatar a signed-out visitor is looking at. The
// pill lives in `AuthPage` and has no other way to reach it, so the blob
// registers its audio object here on mount. Module-level state, matching
// `useKwami.ts`.

const welcomeAudio = shallowRef<KwamiAudio | null>(null);

const welcomeSoundtrack = createSoundtrack(() => welcomeAudio.value);

/** Called by `WelcomeBlob` once its kwami exists. */
export function registerWelcomeAudio(audio: KwamiAudio): void {
  welcomeAudio.value = audio;
}

/** Called by `WelcomeBlob` before it disposes of its kwami. */
export function unregisterWelcomeAudio(): void {
  welcomeSoundtrack.dispose();
  welcomeAudio.value = null;
}

export function useWelcomeSoundtrack(): SoundtrackController {
  return welcomeSoundtrack;
}

// --- The workspace instance -------------------------------------------------
//
// `MusicPlayer` sits in the audio panel, and `App.vue` mounts that panel behind
// a `v-if`. A controller owned by the component therefore only existed while
// the panel was open: closing it orphaned whatever was on — the track played
// out, but nothing followed it, and reopening showed an empty deck. So the
// workspace crate is module state for the same reason the welcome one is, and
// anything outside the panel reaches it through here.

const workspaceLevel = ref(DEFAULT_LEVEL);

let workspaceSoundtrack: SoundtrackController | null = null;

export interface WorkspaceSoundtrack {
  soundtrack: SoundtrackController;
  /** Playback volume, 0..1, shared by the crate and by a local file. */
  level: Ref<number>;
}

/**
 * The one workspace crate, built on first use.
 *
 * Built lazily rather than at import: `useKwami()` reaches for Pinia stores,
 * and this module is imported before the app installs Pinia.
 */
export function useWorkspaceSoundtrack(): WorkspaceSoundtrack {
  if (!workspaceSoundtrack) {
    const { kwami } = useKwami();
    const resolveAudio = () => kwami.value?.avatar.getAudio() ?? null;

    workspaceSoundtrack = createSoundtrack(resolveAudio, { level: () => workspaceLevel.value });

    // A volume change has to reach the element with the panel closed too.
    watch(workspaceLevel, (next) => resolveAudio()?.setVolume(next));

    // A new kwami is a new audio object: stop claiming the old one's record.
    watch(kwami, () => workspaceSoundtrack?.release());
  }

  return { soundtrack: workspaceSoundtrack, level: workspaceLevel };
}
