/**
 * Whether the login screen is painted with a video, and which one.
 *
 * `AuthPreferencesPill` owns the button that picks; `WelcomeVideoBackground`
 * owns the element that plays. They are siblings under `AuthPage` with no props
 * between them, so the choice lives here -- module-level state, matching
 * `useWelcomeRandomizer` and the welcome audio registration in `useSoundtrack`.
 *
 * Deliberately NOT the scene store. That drives the signed-in workspace by
 * compositing media onto a canvas texture and assigning it to the avatar's
 * Three.js `scene.background`, which needs a live kwami instance and a WebGL
 * context. The login screen wants a `<video>` behind some text; borrowing that
 * pipeline would drag Three.js and the whole background config onto a screen
 * whose job is to show one clip. The *catalogue* is shared, though --
 * `sceneVideoPresets` is the same curated list the workspace picks from, so a
 * clip added there shows up here for free.
 */

import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { sceneVideoPresets, type SceneVideoPreset } from '@/presets/scene/video-presets';

const STORAGE_KEY = 'kwami.welcomeBackground';

/** `null` means the painted gradient the screen ships with. */
const videoId = ref<string | null>(readStoredId());

function readStoredId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    // A clip dropped from the presets must not leave the screen on a dead URL.
    return sceneVideoPresets.some((preset) => preset.id === stored) ? stored : null;
  } catch {
    // Private mode / blocked storage: fall back to the gradient.
    return null;
  }
}

function persist(id: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Not worth failing the click over; the choice just will not outlive the tab.
  }
}

export interface WelcomeBackground {
  /** The chosen preset id, or `null` for the gradient. */
  videoId: Ref<string | null>;
  /** The chosen preset, or `null`. `WelcomeVideoBackground` renders from this. */
  video: ComputedRef<SceneVideoPreset | null>;
  /** Every clip on offer, in catalogue order. */
  presets: readonly SceneVideoPreset[];
  /** Pick a clip, or `null` to go back to the gradient. Remembered. */
  setVideo: (id: string | null) => void;
  /** A clip that is not the one already on. Remembered. */
  shuffle: () => void;
}

export function useWelcomeBackground(): WelcomeBackground {
  const video = computed(
    () => sceneVideoPresets.find((preset) => preset.id === videoId.value) ?? null,
  );

  function setVideo(id: string | null) {
    const next = id && sceneVideoPresets.some((preset) => preset.id === id) ? id : null;
    videoId.value = next;
    persist(next);
  }

  function shuffle() {
    // Drawn from the clips that are not already on, so "another one" always is
    // one -- a plain random index repeats the current clip 1 time in 72, which
    // reads as a button that did nothing.
    const others = sceneVideoPresets.filter((preset) => preset.id !== videoId.value);
    const pool = others.length ? others : sceneVideoPresets;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) setVideo(pick.id);
  }

  return { videoId, video, presets: sceneVideoPresets, setVideo, shuffle };
}
