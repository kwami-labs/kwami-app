<script setup lang="ts">
import { ref, onMounted, onUnmounted, shallowRef, watch } from 'vue';
import type { Kwami, KwamiConfig } from 'kwami';
import { registerWelcomeAudio, unregisterWelcomeAudio } from '@/composables/useSoundtrack';
import { useWelcomeRandomizer } from '@/composables/useWelcomeRandomizer';
import { useWelcomeKwamiHit } from '@/composables/useWelcomeKwamiHit';
import { hitsKwamiMesh } from '@/utils/blobHitTest';
import {
  createBandEnvelope,
  envelopeCoefficient,
  getBandLevels,
  SILENCE,
} from '@/utils/audioBands';
import {
  blendShape,
  channelsToHex,
  cloneShape,
  randomShape,
  remixShape,
  scaleAudioSpikeEffects,
  smoothstep,
} from '@/utils/blobTween';
import { createMusicPulse } from '@/utils/musicPulse';
import { createBeatClock } from '@/utils/beatClock';

const WELCOME_RENDERER_WEIGHTS = {
  blobXyz: 19,
  eyeIris: 1,
} as const;

/**
 * Held fixed for the life of the screen.
 *
 * `avatar.randomize()` re-rolls the blob's resolution between 120 and 220, and
 * a resolution change rebuilds the geometry: a ~26k-vertex `SphereGeometry`
 * through `mergeVertices`, which is long enough to drop a frame. On top of the
 * hitch, `animateBlobXyz` keys its per-vertex audio smoothing to the vertex
 * count and refills it with 1s whenever that count moves, so every rebuild also
 * threw away the blob's audio envelope. Once a second, that was most of what
 * "not smooth" meant. The body stays spherical by holding frequency and
 * amplitude in a gelatine range, not by rebuilding the mesh. Nothing else
 * `randomize()` does to a blob survives the explicit setters below — its `dna`
 * is never read again — so the login screen drives the blob itself and leaves
 * `randomize()` to the eye.
 */
const BLOB_RESOLUTION = 160;

/**
 * `KwamiAudio` builds its analyser with `smoothingTimeConstant = 0.35`, well
 * under the Web Audio default of 0.8. That is a reasonable choice for speech,
 * where the SDK wants the mouth to track syllables, and a poor one for music:
 * the raw FFT jitters frame to frame and every consumer downstream inherits it.
 * Raising it is the one fix that reaches both renderers at once, because
 * `BlobXyz` reads this same analyser inside the SDK where app code cannot
 * intervene. Short of 0.8 so transients still read as hits.
 *
 * **This screen only — do not hoist into a shared constant.** The workspace
 * kwami's analyser is the same class but a different instance, and it carries
 * the agent's LiveKit voice as well as music. It needs the SDK's 0.35 to keep
 * the avatar moving on syllables; at 0.72 the mouth lags the speech by a couple
 * of hundred milliseconds, which reads as a broken avatar rather than a changed
 * number, and nothing fails to point at it. `MusicPlayer.vue` leaves that one
 * alone on purpose. Two intentional values, not an inconsistency.
 */
const ANALYSER_SMOOTHING = 0.72;

/**
 * How the blob sings: a held phrase, then a syllable on top.
 *
 * `animateBlobXyz` re-reads `audioEffects` every frame, so `reactivity` is the
 * one place app code can reach inside the SDK's displacement maths. Driving it
 * from onsets alone made a silent body that popped on kicks — percussion, not
 * a voice — so `level` is the phrase the blob is holding and `pulse` is the
 * word landing on top of it.
 *
 * The split between the three is the whole reason the blob reads as being *in
 * time* rather than merely loud, and it was measured rather than judged.
 * Driving the SDK's own displacement over a 120bpm track and watching the mesh,
 * the previous 0.62/1.05/1.15 moved the surface only 1.3x further on a beat
 * than between two: the standing terms were most of the reactivity, the body
 * sat permanently half-inflated, and the hit had nowhere left to go. Weighting
 * the same total towards the pulse takes that to 1.9x across most of the shape
 * band — 1.7x at the roundest rolls, where the idle swell is largest — on the
 * same track and without the peak displacement changing. The beat is not
 * bigger; the quiet between beats is smaller, which is what "synchronised"
 * actually looks like.
 *
 * The three sum to 3.11, and the SDK caps `audioPush` at 3 — but that cap is on
 * `reactivity` times the band energy, which runs around 0.35, so the real peak
 * is near 1.1 and the clamp is not what is shaping this.
 */
const RESTING_REACTIVITY = 0.34;
const LEVEL_REACTIVITY = 0.42;
const PULSE_REACTIVITY = 2.35;

/**
 * What the SDK's own audio path is for, now that the beat arrives through
 * `reactivity` instead.
 *
 * Its bands are the *how loud*, and the flatter they are the better: they are
 * multiplied by a reactivity that already carries the rhythm, and a second
 * medium-speed envelope in the product only smears the peak later. So
 * `transientBoost` comes down — it is the knob that blends the unsmoothed band
 * back in — and `responseSpeed` goes up, because it feeds two things at once
 * and the one that matters here is the per-vertex smoothing at
 * `0.3 + responseSpeed * 0.4`: that is the last envelope between a beat and the
 * mesh, and shortening it is worth a frame of lag.
 *
 * `spikeDensity` is held low, and is the husk-end value: `scaleAudioSpikeEffects`
 * walks it (and the `*Spike` weights) down for rounded rolls, because the SDK
 * samples a finer noise once sound is in. A large swing there does not make
 * the spikes grow on the beat — it slides the whole noise field to a finer
 * scale and the mesh reads as crumpled foil. Dropping it as the pulse term
 * grew keeps their product where it was, so a louder beat still grows the
 * spikes a husk already had rather than growing a coat of new ones on a drop.
 *
 * The three `*Spike` weights and `sensitivity` are spelled out rather than
 * left to the SDK's defaults because `Object.assign` below only overwrites the
 * keys it is given, and a default that moved between SDK versions would
 * quietly retune the login screen.
 */
const BLOB_AUDIO_EFFECTS = {
  reactivity: RESTING_REACTIVITY,
  bassSpike: 0.45,
  midSpike: 0.58,
  highSpike: 0.22,
  sensitivity: 0.04,
  responseSpeed: 0.6,
  transientBoost: 0.2,
  spikeDensity: 0.2,
} as const;

/**
 * The blob's own roll, in radians, and how it is driven.
 *
 * This replaces a spin burst that fired every fifth randomize. That one added
 * to a per-frame yaw delta that was itself decaying at 0.92, so the delta
 * converged on about a third of a radian *per frame* — five revolutions a
 * second — while the SDK's `cursorFollow` lerped the same property back
 * towards centre at 8% a frame. Spin, snap back, spin again: the rotation
 * everybody called crazy. It was also unscaled by frame time, so a 120 Hz
 * display span twice as fast.
 *
 * What is here instead is a sinusoid of `beatClock`'s phase, and the change of
 * shape matters more than the numbers. Leaning on the hit and back on the next
 * one — which is what this used to do — is a body that can only ever answer a
 * beat that has already happened, and it stutters through any bar where the
 * detector misses one. A lean that *runs on the clock* is in time by
 * construction: it is at the far side of its stroke exactly when the beat
 * lands, it holds the groove through a breakdown, and it fades out with the
 * clock's confidence rather than freezing mid-lean.
 *
 * The lean spans two beats rather than one. A full there-and-back inside a
 * single beat is a twitch at any danceable tempo, and at 200bpm it would also
 * be turning the mesh fast enough to read as a spin. An idle sine underneath
 * keeps a silent screen from being a still one. Nothing accumulates, so there
 * is still no value any of it can run away to.
 */
const SWAY_BEAT_RAD = 0.16;
const SWAY_IDLE_RAD = 0.07;
const SWAY_IDLE_PERIOD_MS = 11_000;

/**
 * How the lean fades in and out, rather than how it moves.
 *
 * The phase is not smoothed — smoothing a sinusoid delays it, and a lean that
 * lags the clock by a fixed angle is exactly the desynchronisation this is
 * trying to remove. What is smoothed is its *amplitude*, which changes only
 * when the groove does, so the body swells into the dance and settles out of it
 * without ever being out of time while it does.
 */
const SWAY_GROOVE_TAU_MS = 420;

/**
 * What the clock has to be sure of before the blob dances to it, and how much
 * music has to be playing.
 *
 * `beatClock` settles around 0.75 on plain four-on-the-floor, so this reaches
 * full lean on anything with a beat in it and fades away over the couple of
 * seconds a paused track takes to decay. The level gate is the second half:
 * confidence outlives the audio by design, and without this a track fading out
 * would leave the body swaying to a room that had gone quiet.
 */
const GROOVE_CONFIDENCE = 0.55;
const GROOVE_LEVEL = 0.12;

/**
 * How far a hit dips the blob, in world units against a radius of about 3.5.
 *
 * Small, and applied to the mesh position only. `BlobXyz` used to derive
 * `liquidPhysics` from that same motion and bake a non-radial stretch into
 * the vertices; a few beats later the rest pose was a cone and only a
 * refresh rebuilt the sphere. The dip still reads as dancing. The body
 * stays a blob because stretch is pinned at zero below.
 *
 * Asymmetric, unlike the lean, because this one *is* the hit: the drop has to
 * arrive with the kick and the recovery is what reads as weight. A single time
 * constant has to choose between the two, and the 105 ms it was set to spent
 * most of its budget arriving late.
 */
const BOB_DEPTH = 0.2;
const BOB_ATTACK_MS = 45;
const BOB_RELEASE_MS = 190;

/**
 * The eye collapses the three bands to one level and lerps by `1 - smoothing`,
 * so higher is slower. Above the stock 0.82 because the app pushes this one by
 * hand and the bands arrive enveloped already.
 */
const EYE_AUDIO_SMOOTHING = 0.88;

/** A short attack keeps the hit; a long release is what reads as dancing. */
const BAND_ENVELOPE = { attackMs: 45, releaseMs: 320 } as const;

/**
 * How long a renderer has to stay up before the next roll may replace it.
 *
 * A skin is a shader swap and can land on every tick — that is what the rate
 * button is promising. A renderer is a different object: flashing the eye for
 * one second at the 1s default reads as a glitch, not a new look. Skin follows
 * the pill; this floor is only for blob ↔ eye.
 */
const RENDERER_SWAP_MIN_MS = 6_000;

/**
 * A tween now fills its whole interval rather than 85% of it.
 *
 * With `remixShape` the destination is a fresh roll of spikes and amplitude,
 * so there is no longer a reason to arrive early and hold: holding is a
 * stillness between two moves, and running the morph edge to edge is what
 * makes the shape one continuous motion. The cap only bites at the slow rates
 * the pill offers, where a ten-minute tween would be indistinguishable from a
 * frozen blob anyway.
 */
const MAX_TWEEN_MS = 8_000;

const containerRef = ref<HTMLDivElement | null>(null);
const kwamiRef = shallowRef<Kwami | null>(null);
// `SoundtrackPill` sets the pace; this component keeps the timer.
const { intervalMs: randomizeIntervalMs } = useWelcomeRandomizer();
let rafId: number | null = null;
let randomizeTimer: ReturnType<typeof setInterval> | null = null;
let stopIntervalWatch: (() => void) | null = null;
let removeClickProxyHandler: (() => void) | null = null;
let removePointerMoveHandler: (() => void) | null = null;
let removeHitTest: (() => void) | null = null;
// The pulse detector taps the audio graph, so it has to be released by hand.
let disposeMusicPulse: (() => void) | null = null;

const PALETTE = ['#359EEE', '#FFC43D', '#EF476F', '#03CEA4'] as const;

/**
 * Smooth, liquid skins only. `flat`, `stepped`, `toon-matcap`, `outlined` and
 * `halftone` shade in facets or graphic steps, which is the triangle body
 * this screen is trying not to be.
 */
const ALL_SUBTYPES = [
  'radial', 'banded', 'striped', 'marble', 'fresnel', 'iridescent', 'spiral', 'plasma', 'gradient',
  'matte', 'glossy', 'metallic', 'subsurface',
  'chrome', 'clay', 'jade', 'hologram',
] as const;

type Subtype = typeof ALL_SUBTYPES[number];
type WelcomeRenderer = 'blob-xyz' | 'eye-iris';

type EyeColorPalette = {
  base: string;
  secondary: string;
  accent: string;
  limbal: string;
  collarette: string;
  crypt: string;
  streak: string;
};

/** SDK palettes are mostly brown. These cover the hues the welcome eye should cycle through. */
const EYE_COLOR_PALETTES: readonly EyeColorPalette[] = [
  { base: '#3d6ea8', secondary: '#6ea3d4', accent: '#c8e4ff', limbal: '#122033', collarette: '#8aa8c4', crypt: '#0c1624', streak: '#e8f4ff' },
  { base: '#1e4d8c', secondary: '#3d7cc9', accent: '#7eb6f0', limbal: '#0a1a30', collarette: '#4a6fa0', crypt: '#07101c', streak: '#b8d8f8' },
  { base: '#1f7a78', secondary: '#3dbeb4', accent: '#8ef0d8', limbal: '#0d3332', collarette: '#3a9a90', crypt: '#082422', streak: '#c4fff0' },
  { base: '#2d6b3a', secondary: '#4fa05a', accent: '#9de07a', limbal: '#122814', collarette: '#3d7a44', crypt: '#0a180c', streak: '#c8f0a8' },
  { base: '#2f8f84', secondary: '#4ac1aa', accent: '#a1e75c', limbal: '#12483e', collarette: '#3ea892', crypt: '#0d3129', streak: '#9fe5b2' },
  { base: '#5a3d8c', secondary: '#8a64c4', accent: '#c9a4f0', limbal: '#1c1230', collarette: '#7a5aa0', crypt: '#100a1c', streak: '#e8d4ff' },
  { base: '#6b2d7a', secondary: '#a04eb8', accent: '#e0a0f0', limbal: '#241028', collarette: '#8a4a98', crypt: '#160818', streak: '#f4d0ff' },
  { base: '#5a6570', secondary: '#8a96a0', accent: '#c8d0d6', limbal: '#1c2228', collarette: '#6e7880', crypt: '#101418', streak: '#e4e8ec' },
  { base: '#4a5560', secondary: '#708090', accent: '#b0c0cc', limbal: '#161c22', collarette: '#5a6874', crypt: '#0c1014', streak: '#d4dde4' },
  { base: '#5f7692', secondary: '#9bb6cc', accent: '#dceaf7', limbal: '#1a2533', collarette: '#9a8673', crypt: '#132338', streak: '#e8f3ff' },
  { base: '#8f4b24', secondary: '#b06a34', accent: '#e2a24d', limbal: '#3b1d10', collarette: '#a35a2c', crypt: '#2a160d', streak: '#f0b265' },
  { base: '#6b4b23', secondary: '#a37229', accent: '#d0a73c', limbal: '#2b190a', collarette: '#845223', crypt: '#1d1208', streak: '#d6b45b' },
] as const;

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function shuffleColors(): { x: string; y: string; z: string } {
  const a = [...PALETTE].sort(() => Math.random() - 0.5);
  return { x: a[0]!, y: a[1]!, z: a[2]! };
}

/** Three `#rrggbb` colours as the nine channels a tween walks. */
function paletteToChannels(colors: { x: string; y: string; z: string }): number[] {
  const rgb = (hex: string): [number, number, number] => {
    const n = Number.parseInt(hex.slice(1), 16);
    if (!Number.isFinite(n)) return [0, 0, 0];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  return [...rgb(colors.x), ...rgb(colors.y), ...rgb(colors.z)];
}

function pickRendererByProbability(): WelcomeRenderer {
  const totalWeight = WELCOME_RENDERER_WEIGHTS.blobXyz + WELCOME_RENDERER_WEIGHTS.eyeIris;
  const roll = Math.random() * totalWeight;
  if (roll < WELCOME_RENDERER_WEIGHTS.blobXyz) return 'blob-xyz';
  return 'eye-iris';
}

function pickEyeColors(previous: EyeColorPalette | null): EyeColorPalette {
  let next = EYE_COLOR_PALETTES[Math.floor(Math.random() * EYE_COLOR_PALETTES.length)]!;
  if (previous && EYE_COLOR_PALETTES.length > 1) {
    let guard = 0;
    while (next.base === previous.base && guard < 8) {
      next = EYE_COLOR_PALETTES[Math.floor(Math.random() * EYE_COLOR_PALETTES.length)]!;
      guard += 1;
    }
  }
  return next;
}

onMounted(async () => {
  if (!containerRef.value) return;

  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  containerRef.value.appendChild(canvas);

  await new Promise((r) => setTimeout(r, 10));

  const kwamiConfig: KwamiConfig = {
    avatar: {
      renderer: 'blob-xyz',
      blob: {
        resolution: BLOB_RESOLUTION,
        spikes: { x: 3.1, y: 3.6, z: 2.8 },
        time: { x: 1.2, y: 1.15, z: 1.25 },
        rotation: { x: 0, y: 0, z: 0 },
        wireframe: false,
        shininess: rand(10, 120),
        colors: shuffleColors(),
        // NOTE: no `skin` here on purpose. BlobXyzConfig.skin is a flat
        // BlobXyzSkin string used as `presets[skin]`; the object form this
        // used to pass resolved to undefined and silently fell back to
        // 'radial'. The real skin is chosen below via setSkin().
        // Off: the SDK's follow rest is π/2, so a new mesh (or a pointer
        // move) yanks the hero through a quarter-turn. Sway owns the roll.
        cursorFollow: { enabled: false, sensitivity: 0 },
      },
      scene: { enableControls: false },
    },
  };

  const { Kwami } = await import('kwami');
  const kwami = new Kwami(canvas, kwamiConfig);
  kwamiRef.value = kwami;

  // AuthPage shuffles the video on a backdrop double-click and needs to know
  // whether that click actually hit the mesh. The canvas is full-bleed, so
  // only a raycast answers that. Live getters: a renderer switch builds a
  // new mesh underneath us.
  removeHitTest = useWelcomeKwamiHit().register((clientX, clientY) => {
    const camera = kwami.avatar.getScene?.()?.camera;
    if (!camera) return false;
    const mesh = kwami.avatar.getBlob()?.getMesh() ?? kwami.avatar.getEyeIris()?.getMesh() ?? null;
    return hitsKwamiMesh(clientX, clientY, canvas, camera, mesh);
  });

  // `SoundtrackPill` drives this kwami's own audio object. Routing music
  // through it is what makes the avatar move: `KwamiAudio` runs the element
  // through a Web Audio analyser, and `BlobXyz` reads that analyser every
  // frame off its `audioEffects`, which default to enabled. Note there is no
  // `audio.files` in `kwamiConfig` on purpose — the SDK would preload the
  // first track on every page view, before anyone pressed play.
  registerWelcomeAudio(kwami.avatar.getAudio());

  const isNarrow = window.innerWidth <= 768;
  const blobHeroScale = isNarrow ? 3.2 : 3.5;
  // Eye default in the SDK is 5; keep the blob as-is and shrink only the iris.
  const eyeHeroScale = isNarrow ? 3.9 : 4.2;

  const applyHeroScale = (renderer: WelcomeRenderer) => {
    try {
      if (renderer === 'eye-iris') {
        kwami.avatar.getEyeIris()?.setScale(eyeHeroScale);
      } else {
        kwami.avatar.setScale(blobHeroScale);
      }
    } catch {}
  };

  applyHeroScale('blob-xyz');

  /**
   * The live `audioEffects` object off whichever blob is up.
   *
   * Read fresh every time rather than captured: a renderer switch builds a new
   * `BlobXyz` with its own object, and a stale reference would be written to
   * once a frame while the blob on screen ignored it.
   */
  const liveAudioEffects = () =>
    (kwami.avatar.getBlob() as unknown as {
      audioEffects?: Record<string, number>;
    } | null)?.audioEffects ?? null;

  /**
   * The blob's own band envelope is a field on the instance, so it resets
   * every time a renderer switch builds a new one. Re-applied on each tick
   * rather than only at mount.
   */
  const applyBlobAudioEffects = () => {
    const effects = liveAudioEffects();
    if (!effects) return;
    Object.assign(effects, BLOB_AUDIO_EFFECTS);
  };

  /**
   * Stop the SDK integrating a rotation of its own.
   *
   * `BlobXyz` adds `this.rotation` to the mesh every frame, forever, and the
   * login screen used to hand it a fresh `rand(0, 0.01)` per axis every few
   * seconds. On x and y that only biases a `cursorFollow` that pulls back
   * anyway, but nothing corrects z, so the roll accumulated without bound —
   * a blob slowly tumbling, on top of the spin bursts. Zero here leaves the
   * orientation to `cursorFollow` for pointing and to the sway below for
   * dancing, both of which are bounded.
   */
  const settleBlobRotation = () => {
    const activeBlob = kwami.avatar.getBlob();
    if (!activeBlob) return;
    try {
      (activeBlob as unknown as { setRotation?: (x: number, y: number, z: number) => void })
        .setRotation?.(0, 0, 0);
    } catch {}
    try {
      (activeBlob as unknown as { setCursorFollowEnabled?: (enabled: boolean) => void })
        .setCursorFollowEnabled?.(false);
    } catch {}
  };

  applyBlobAudioEffects();
  settleBlobRotation();

  const blob = kwami.avatar.getBlob();
  const blobMesh = blob?.getMesh();

  if (blob) {
    try { blob.setTouchStrength(0.7); } catch {}
    try { blob.setTouchDuration(800); } catch {}
    try { blob.setMaxTouchPoints(8); } catch {}
  }

  if (blobMesh) {
    let pointerTargetX = 0;
    let pointerTargetY = 0;
    let pointerCurrentX = 0;
    let pointerCurrentY = 0;
    let lastPointerNormX = 0;
    let lastPointerNormY = 0;
    let pupilMotionTarget = 0;
    let pupilMotionCurrent = 0;
    let eyeBasePupilRadius: number | null = null;
    let lastBlobSubtype: Subtype | null = null;
    let lastEyePalette: EyeColorPalette | null = null;
    const eyeFollowRange = 0.35;
    const eyeFollowSmoothing = 0.1;
    const pupilMaxBoost = 0.18;
    const pupilMotionDecay = 0.88;
    const pupilSmoothing = 0.12;

    let activeRenderer: WelcomeRenderer = 'blob-xyz';
    // Negative infinity, not 0: `performance.now()` is time since the page
    // loaded, so a login screen that mounted inside the first six seconds would
    // otherwise open without ever being allowed to roll the eye.
    let lastRendererSwapAt = Number.NEGATIVE_INFINITY;

    // The shape the component believes in, independent of which renderer is up.
    // Carrying it across an eye-iris round trip is what stops the blob snapping
    // back to a stranger's parameters when it returns.
    let shapeFrom = randomShape();
    const shapeLive = cloneShape(shapeFrom);
    let shapeTo = cloneShape(shapeFrom);
    let tweenElapsedMs = 0;
    let tweenDurationMs = 0;

    const bandEnvelope = createBandEnvelope(BAND_ENVELOPE);
    const musicPulse = createMusicPulse();
    // Phase-locked to the pulse, so the body keeps time between hits rather
    // than waiting for the next one.
    const beatClock = createBeatClock();
    disposeMusicPulse = () => musicPulse.dispose();
    let smoothedAnalyser: AnalyserNode | null = null;
    let lastFrameAt = performance.now();
    let musicWasPlaying = false;

    /**
     * The sway and the bob, and how much of each is currently written onto the
     * mesh.
     *
     * Both are applied as the change since last frame rather than as an
     * assignment. An assignment would be the simpler code and the wrong one:
     * the SDK's drag handler writes the same `rotation.z`, and
     * `BlobXyzPosition` writes the same `position.y` on a resize, and either
     * would be silently erased sixty times a second. Adding the delta of a
     * bounded signal composes instead — whatever else moved the blob stays
     * moved, and this contribution still cannot exceed its own amplitude.
     */
    let sway = 0;
    let swayApplied = 0;
    /** How much of `SWAY_BEAT_RAD` the groove is currently worth. */
    let grooveDepth = 0;
    let bob = 0;
    let bobApplied = 0;
    /**
     * Which mesh those two are written onto.
     *
     * A renderer switch builds a new `BlobXyz` with a new mesh at rest, so the
     * offsets have to be forgotten rather than unwound from a mesh that never
     * carried them.
     */
    let swayedMesh: object | null = null;

    /**
     * The last colours actually handed to the SDK.
     *
     * `setColors` walks all twenty-two skin materials and allocates a `Color`
     * per uniform per axis, then re-tints three lights. A tween moves the
     * channels by a fraction of one 0–255 step per frame, so most frames were
     * paying that for a value that rounded to the same six hex digits. Pushing
     * only on a real change is invisible and takes the allocations with it.
     */
    let pushedColors: [string, string, string] | null = null;

    const pushShapeToBlob = (force = false) => {
      const activeBlob = kwami.avatar.getBlob();
      if (!activeBlob) return;
      try { activeBlob.setSpikes(shapeLive.spikes[0], shapeLive.spikes[1], shapeLive.spikes[2]); } catch {}
      try { activeBlob.setAmplitude(shapeLive.amplitude[0], shapeLive.amplitude[1], shapeLive.amplitude[2]); } catch {}
      try { activeBlob.setTime(shapeLive.time[0], shapeLive.time[1], shapeLive.time[2]); } catch {}
      try { kwami.avatar.setShininess(shapeLive.shininess); } catch {}

      const colors: [string, string, string] = [
        channelsToHex(shapeLive.channels, 0),
        channelsToHex(shapeLive.channels, 3),
        channelsToHex(shapeLive.channels, 6),
      ];
      const unchanged =
        !force &&
        pushedColors !== null &&
        pushedColors[0] === colors[0] &&
        pushedColors[1] === colors[1] &&
        pushedColors[2] === colors[2];
      if (!unchanged) {
        try { activeBlob.setColors(colors[0], colors[1], colors[2]); } catch {}
        pushedColors = colors;
      }
    };

    const animate = () => {
      const now = performance.now();
      const deltaMs = Math.max(0, now - lastFrameAt);
      lastFrameAt = now;

      // `getAnalyser()` is null until the first play builds the audio graph,
      // and `connectMediaStream` can replace it later, so this re-applies on
      // identity rather than once. The blob reads this analyser inside the SDK,
      // which is why the setting lives here and not beside `setAudioLevels`.
      const audio = kwami.avatar.getAudio();
      const analyser = (audio as unknown as {
        getAnalyser?: () => AnalyserNode | null;
      }).getAnalyser?.() ?? null;
      if (analyser && analyser !== smoothedAnalyser) {
        analyser.smoothingTimeConstant = ANALYSER_SMOOTHING;
        smoothedAnalyser = analyser;
      }

      // Silence is followed rather than skipped, here and in the eye's own
      // envelope below: a pause has to fall away, not freeze where it stood.
      const audioElement = (audio as unknown as {
        getAudioElement?: () => HTMLAudioElement | null;
      }).getAudioElement?.();
      const playing = !!audioElement && !audioElement.paused;

      // Every frame, not on identity: `attach` re-asserts its tap on a cadence
      // of its own, because toggling a sound filter rebuilds the audio graph
      // and drops every edge off the analyser, this one included.
      musicPulse.attach(analyser);
      const { pulse, level } = musicPulse.read(deltaMs, playing);

      // Phrase first, syllable on top. `animateBlobXyz` re-reads this object
      // every frame, so writing `reactivity` here reaches inside the SDK's
      // displacement without a fork: its bands still say how loud, `level`
      // says the blob is singing, and `pulse` says the word landed.
      //
      // The spike field is scaled from the live shape in the same breath.
      // `applyBlobAudioEffects` writes the husk-end constants (after a
      // renderer switch, or on the first tick before this loop has run);
      // leaving them there would put the same coat of lobes on a drop that
      // a husk earns, which is the look this is undoing.
      const effects = liveAudioEffects();
      if (effects) {
        effects.reactivity =
          RESTING_REACTIVITY + LEVEL_REACTIVITY * level + PULSE_REACTIVITY * pulse;
        Object.assign(effects, scaleAudioSpikeEffects(shapeLive.spikes, BLOB_AUDIO_EFFECTS));
      }

      // `BlobXyz` measures velocity from `mesh.position` and stretches every
      // vertex along it. The bob below writes that position, so without this
      // the beat permanently leans the body into a cone. Stretch and the
      // leftover velocity have to be killed every frame: a renderer switch
      // builds a new instance with the SDK default of 0.6.
      const liquid = (kwami.avatar.getBlob() as unknown as {
        liquidPhysics?: { stretch: number; velocityX: number; velocityY: number };
      } | null)?.liquidPhysics;
      if (liquid) {
        liquid.stretch = 0;
        liquid.velocityX = 0;
        liquid.velocityY = 0;
      }

      if (musicWasPlaying && !playing) {
        try { kwami.avatar.getBlob()?.setResolution(BLOB_RESOLUTION); } catch {}
        // Whatever plays next is a different track more often than not, and a
        // clock still defending the last tempo takes a bar or two longer to
        // re-lock than one starting cold.
        beatClock.reset();
      }
      musicWasPlaying = playing;

      if (tweenElapsedMs < tweenDurationMs) {
        tweenElapsedMs = Math.min(tweenDurationMs, tweenElapsedMs + deltaMs);
        blendShape(shapeLive, shapeFrom, shapeTo, smoothstep(tweenElapsedMs / tweenDurationMs));
        if (activeRenderer === 'blob-xyz') pushShapeToBlob();
      }

      // The lean runs on the clock, not on the last hit. `barPhase` spans two
      // beats, so a full stroke is a sway rather than a twitch, and it is at
      // the end of its travel on the beat because the clock says where the beat
      // is — not because one just went past.
      const groove = beatClock.advance(deltaMs, playing ? pulse : 0);
      const grooveTarget =
        Math.min(1, groove.confidence / GROOVE_CONFIDENCE) *
        Math.min(1, level / GROOVE_LEVEL);
      grooveDepth += (grooveTarget - grooveDepth) * envelopeCoefficient(deltaMs, SWAY_GROOVE_TAU_MS);

      sway =
        Math.sin(groove.barPhase * Math.PI * 2) * SWAY_BEAT_RAD * grooveDepth +
        Math.sin((now / SWAY_IDLE_PERIOD_MS) * Math.PI * 2) * SWAY_IDLE_RAD;

      // The dip is still the hit itself, and keeps its own envelope: a beat the
      // clock did not predict should still land on the body.
      const bobTarget = pulse * BOB_DEPTH;
      bob +=
        (bobTarget - bob) *
        envelopeCoefficient(deltaMs, bobTarget > bob ? BOB_ATTACK_MS : BOB_RELEASE_MS);

      const activeBlobMesh = kwami.avatar.getBlob()?.getMesh() as
        | { rotation: { z: number }; position?: { y: number } }
        | undefined;
      if (activeBlobMesh) {
        if (activeBlobMesh !== swayedMesh) {
          swayedMesh = activeBlobMesh;
          swayApplied = 0;
          bobApplied = 0;
        }
        activeBlobMesh.rotation.z += sway - swayApplied;
        swayApplied = sway;
        // Downward: a hit pushes the blob into the beat and it draws back out,
        // which is the shape of a drop landing rather than a ball bouncing.
        if (activeBlobMesh.position) {
          activeBlobMesh.position.y -= bob - bobApplied;
          bobApplied = bob;
        }
      } else {
        // The eye is up. Drop the offsets rather than carrying them across, so
        // the blob comes back from rest and eases in instead of arriving
        // already leaning.
        swayedMesh = null;
        swayApplied = 0;
        bobApplied = 0;
        sway = 0;
        bob = 0;
        grooveDepth = 0;
      }

      const eye = (kwami.avatar as unknown as {
        getEyeIris?: () => {
          getMesh: () => { rotation: { x: number; y: number } };
          setAudioLevels?: (bass: number, mid: number, high: number) => void;
          setAudioSmoothing?: (value: number) => void;
        } | null;
      }).getEyeIris?.();
      if (eye) {
        const eyeMesh = eye.getMesh();

        // blob-xyz reads the shared analyser inside the SDK. eye-iris does not,
        // so the music's levels have to be pushed at it once a frame, the way
        // `MusicPlayer.vue` does for the renderers that are not the blob.
        // Enveloped first: the eye lerps what it is handed, but symmetrically
        // and over a single combined level, so it cannot put the attack back.
        // Silence is pushed through too, or a pause would freeze the envelope
        // at whatever it held rather than letting it fall away.
        const raw = playing ? getBandLevels(audio.getFrequencyData()) : SILENCE;
        const levels = bandEnvelope.follow(raw, deltaMs);
        eye.setAudioLevels?.(levels.bass, levels.mid, levels.high);

        if (eyeBasePupilRadius == null) {
          const base = (eye as unknown as { getConfig?: () => { geometry?: { pupilRadius?: number } } }).getConfig?.()?.geometry?.pupilRadius;
          eyeBasePupilRadius = typeof base === 'number' ? base : 0.26;
        }

        pointerCurrentX += (pointerTargetX - pointerCurrentX) * eyeFollowSmoothing;
        pointerCurrentY += (pointerTargetY - pointerCurrentY) * eyeFollowSmoothing;
        eyeMesh.rotation.y = pointerCurrentX;
        eyeMesh.rotation.x = -pointerCurrentY;

        pupilMotionTarget *= pupilMotionDecay;
        pupilMotionCurrent += (pupilMotionTarget - pupilMotionCurrent) * pupilSmoothing;
        const pupilRadius = (eyeBasePupilRadius ?? 0.26) + (pupilMotionCurrent * pupilMaxBoost);
        (eye as unknown as { setPupilRadius?: (value: number) => void }).setPupilRadius?.(pupilRadius);
      } else {
        eyeBasePupilRadius = null;
      }

      rafId = requestAnimationFrame(animate);
    };
    animate();

    const proxyClickToCanvas = (event: MouseEvent) => {
      // The forwarded event bubbles, so it reaches this same window listener
      // again; without this guard every click on the screen recursed until the
      // stack blew (RangeError). A click that is already on the canvas needs no
      // forwarding either — the SDK's own handler has it.
      if (event.target === canvas) return;

      const forwarded = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX: event.clientX,
        clientY: event.clientY,
        button: event.button,
        buttons: event.buttons,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
      });
      canvas.dispatchEvent(forwarded);
    };

    window.addEventListener('click', proxyClickToCanvas, { passive: true });
    removeClickProxyHandler = () => {
      window.removeEventListener('click', proxyClickToCanvas);
    };

    const onPointerMove = (event: MouseEvent) => {
      const x = (event.clientX / window.innerWidth) * 2 - 1;
      const y = (event.clientY / window.innerHeight) * 2 - 1;
      const movement = Math.hypot(x - lastPointerNormX, y - lastPointerNormY);
      const movementBoost = Math.min(1, movement * 4.2);
      pupilMotionTarget = Math.max(pupilMotionTarget, movementBoost);
      lastPointerNormX = x;
      lastPointerNormY = y;
      pointerTargetX = x * eyeFollowRange;
      pointerTargetY = y * eyeFollowRange;
    };
    window.addEventListener('mousemove', onPointerMove, { passive: true });
    removePointerMoveHandler = () => {
      window.removeEventListener('mousemove', onPointerMove);
    };

    const pickSubtype = (): Subtype => {
      let subtype: Subtype = ALL_SUBTYPES[Math.floor(Math.random() * ALL_SUBTYPES.length)]!;
      if (lastBlobSubtype && ALL_SUBTYPES.length > 1) {
        let guard = 0;
        while (subtype === lastBlobSubtype && guard < 8) {
          subtype = ALL_SUBTYPES[Math.floor(Math.random() * ALL_SUBTYPES.length)]!;
          guard += 1;
        }
      }
      return subtype;
    };

    const doRandomize = () => {
      const now = performance.now();
      const canSwapRenderer = now - lastRendererSwapAt >= RENDERER_SWAP_MIN_MS;
      const nextRenderer = canSwapRenderer ? pickRendererByProbability() : activeRenderer;

      // Called even when the renderer is unchanged: the SDK returns early on a
      // no-op switch, and keeping the call unconditional means one line marks
      // every tick of the timer.
      try { kwami.avatar.switchRenderer(nextRenderer as unknown as Parameters<typeof kwami.avatar.switchRenderer>[0]); } catch {}

      const switched = nextRenderer !== activeRenderer;
      activeRenderer = nextRenderer;

      if (nextRenderer === 'blob-xyz') {
        // Unconditional rather than only on a switch: both of these live on the
        // `BlobXyz` instance, and `randomize()` on the eye branch is free to
        // have rebuilt one underneath us. Re-applying is an `Object.assign` and
        // a setter.
        applyBlobAudioEffects();
        settleBlobRotation();

        // Spikes, amplitude and the palette re-roll every tick — that is the
        // look the rate button is selling — and the rAF loop walks there
        // across the interval. Time still drifts, so the surface does not boil
        // when the destination is a stranger.
        shapeFrom = cloneShape(shapeLive);
        shapeTo = remixShape(shapeLive);
        shapeTo.channels = paletteToChannels(shuffleColors());
        tweenElapsedMs = 0;
        tweenDurationMs = Math.min(MAX_TWEEN_MS, randomizeIntervalMs.value);

        const activeBlob = kwami.avatar.getBlob();
        if (activeBlob) {
          lastBlobSubtype = pickSubtype();
          try { kwami.avatar.setSkin(lastBlobSubtype as Parameters<typeof kwami.avatar.setSkin>[0]); } catch {}
          try { kwami.avatar.setWireframe(false); } catch {}
        }
        // A skin swap re-reads the blob's colours, so the tween's current
        // frame has to go back on after it — and unconditionally, since the
        // colours it just reset are the ones the change check below would
        // otherwise call unchanged.
        pushShapeToBlob(true);
      } else {
        // The eye has no geometry to rebuild, so `randomize()` is cheap here:
        // it is palette and fibre uniforms and nothing else.
        try { kwami.avatar.randomize(); } catch {}
        const eye = kwami.avatar.getEyeIris();
        if (eye) {
          lastEyePalette = pickEyeColors(lastEyePalette);
          try { eye.setColors(lastEyePalette); } catch {}
          try {
            (eye as unknown as { setAudioSmoothing?: (value: number) => void })
              .setAudioSmoothing?.(EYE_AUDIO_SMOOTHING);
          } catch {}
        }
        if (switched) bandEnvelope.reset();
      }

      if (canSwapRenderer) lastRendererSwapAt = now;

      applyHeroScale(nextRenderer);

      if (nextRenderer !== 'eye-iris') {
        pointerTargetX = 0;
        pointerTargetY = 0;
        pupilMotionTarget = 0;
      }
    };

    // Re-armed rather than reused: `setInterval` has no way to change the
    // period of a running timer, and a slower rate should take effect from the
    // change, not once the pending tick has fired.
    const armRandomizeTimer = () => {
      if (randomizeTimer !== null) clearInterval(randomizeTimer);
      randomizeTimer = setInterval(doRandomize, randomizeIntervalMs.value);
    };

    doRandomize();
    armRandomizeTimer();
    // Stopped by hand in `onUnmounted`: this is past an `await`, so the watcher
    // is no longer bound to the component and would outlive it otherwise.
    stopIntervalWatch = watch(randomizeIntervalMs, armRandomizeTimer);
  }
});

onUnmounted(async () => {
  if (stopIntervalWatch) { stopIntervalWatch(); stopIntervalWatch = null; }
  if (randomizeTimer !== null) { clearInterval(randomizeTimer); randomizeTimer = null; }
  if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  if (removeClickProxyHandler) { removeClickProxyHandler(); removeClickProxyHandler = null; }
  if (removePointerMoveHandler) { removePointerMoveHandler(); removePointerMoveHandler = null; }
  if (removeHitTest) { removeHitTest(); removeHitTest = null; }
  if (disposeMusicPulse) { disposeMusicPulse(); disposeMusicPulse = null; }
  unregisterWelcomeAudio();
  const k = kwamiRef.value;
  if (k) { await k.dispose(); kwamiRef.value = null; }
});
</script>

<template>
  <div ref="containerRef" class="welcome-blob" aria-hidden="true" />
</template>

<style scoped>
.welcome-blob {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: auto;
  opacity: 0.82;
}
</style>
