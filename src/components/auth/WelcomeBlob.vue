<script setup lang="ts">
import { ref, onMounted, onUnmounted, shallowRef } from 'vue';
import type { Kwami, KwamiConfig } from 'kwami';
import { registerWelcomeAudio, unregisterWelcomeAudio } from '@/composables/useSoundtrack';
import { getBandLevels } from '@/utils/audioBands';

const RANDOMIZE_INTERVAL_MS = 2_000;
const WELCOME_RENDERER_WEIGHTS = {
  blobXyz: 8,
  eyeIris: 2,
} as const;

const containerRef = ref<HTMLDivElement | null>(null);
const kwamiRef = shallowRef<Kwami | null>(null);
let rafId: number | null = null;
let randomizeTimer: ReturnType<typeof setInterval> | null = null;
let removeClickProxyHandler: (() => void) | null = null;
let removePointerMoveHandler: (() => void) | null = null;

const PALETTE = ['#359EEE', '#FFC43D', '#EF476F', '#03CEA4'] as const;

const ALL_SUBTYPES = [
  'radial', 'banded', 'striped', 'marble', 'fresnel', 'iridescent', 'spiral', 'plasma', 'gradient',
  'matte', 'glossy', 'metallic', 'subsurface',
  'chrome', 'clay', 'jade', 'toon-matcap', 'hologram',
  'flat', 'stepped', 'halftone', 'outlined',
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

function randColor() {
  return `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`;
}

function shuffleColors(): { x: string; y: string; z: string } {
  const a = [...PALETTE].sort(() => Math.random() - 0.5);
  return { x: a[0]!, y: a[1]!, z: a[2]! };
}

function pickRendererByProbability(): WelcomeRenderer {
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
        resolution: 160,
        spikes: { x: rand(0.15, 2.8), y: rand(0.15, 2.8), z: rand(0.15, 2.8) },
        time: { x: rand(0.8, 5.5), y: rand(0.8, 5.5), z: rand(0.8, 5.5) },
        rotation: { x: 0, y: 0, z: 0 },
        wireframe: false,
        shininess: rand(10, 120),
        colors: shuffleColors(),
        // NOTE: no `skin` here on purpose. BlobXyzConfig.skin is a flat
        // BlobXyzSkin string used as `presets[skin]`; the object form this
        // used to pass resolved to undefined and silently fell back to
        // 'radial'. The real skin is chosen below via setSkin().
        cursorFollow: { enabled: true, sensitivity: 1.0 },
      },
      scene: { enableControls: false },
    },
  };

  const { Kwami } = await import('kwami');
  const kwami = new Kwami(canvas, kwamiConfig);
  kwamiRef.value = kwami;

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

  const blob = kwami.avatar.getBlob();
  const blobMesh = blob?.getMesh();

  if (blob) {
    try { blob.setTouchStrength(0.7); } catch {}
    try { blob.setTouchDuration(800); } catch {}
    try { blob.setMaxTouchPoints(8); } catch {}
  }

  if (blobMesh) {
    let burstRemaining = 0;
    let accumulatedYawOffset = 0;
    let accumulatedPitchOffset = 0;
    let randomizeCount = 0;
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
    const animate = () => {
      const activeBlobMesh = kwami.avatar.getBlob()?.getMesh();
      if (activeBlobMesh) {
        if (burstRemaining > 0.0001) {
          const spinStep = Math.min(0.12, Math.max(0.01, burstRemaining * 0.055));
          accumulatedYawOffset += spinStep;
          accumulatedPitchOffset += spinStep * 0.04;
          burstRemaining = Math.max(0, burstRemaining - spinStep);
        }

        activeBlobMesh.rotation.y += accumulatedYawOffset;
        activeBlobMesh.rotation.x += accumulatedPitchOffset;
        accumulatedYawOffset *= 0.92;
        accumulatedPitchOffset *= 0.92;
      }

      const eye = (kwami.avatar as unknown as {
        getEyeIris?: () => {
          getMesh: () => { rotation: { x: number; y: number } };
          setAudioLevels?: (bass: number, mid: number, high: number) => void;
        } | null;
      }).getEyeIris?.();
      if (eye) {
        const eyeMesh = eye.getMesh();

        // blob-xyz reads the shared analyser inside the SDK. eye-iris does not,
        // so the music's levels have to be pushed at it once a frame, the way
        // `MusicPlayer.vue` does for the renderers that are not the blob.
        const audio = kwami.avatar.getAudio();
        if (!audio.getAudioElement().paused) {
          const { bass, mid, high } = getBandLevels(audio.getFrequencyData());
          eye.setAudioLevels?.(bass, mid, high);
        }
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

    const { randomBlobSkinType } = await import('kwami') as { randomBlobSkinType?: () => Subtype };

    const doRandomize = () => {
      const nextRenderer = pickRendererByProbability();

      try { kwami.avatar.switchRenderer(nextRenderer as unknown as Parameters<typeof kwami.avatar.switchRenderer>[0]); } catch {}

      if (nextRenderer === 'blob-xyz') {
        const activeBlob = kwami.avatar.getBlob();
        if (activeBlob) {
          let subtype: Subtype = randomBlobSkinType?.() ?? ALL_SUBTYPES[Math.floor(Math.random() * ALL_SUBTYPES.length)]!;
          if (lastBlobSubtype && ALL_SUBTYPES.length > 1) {
            let guard = 0;
            while (subtype === lastBlobSubtype && guard < 8) {
              subtype = ALL_SUBTYPES[Math.floor(Math.random() * ALL_SUBTYPES.length)]!;
              guard += 1;
            }
          }
          lastBlobSubtype = subtype;
          try { kwami.avatar.randomize(); } catch {}
          try { kwami.avatar.setSkin(subtype as Parameters<typeof kwami.avatar.setSkin>[0]); } catch {}
          try { activeBlob.setColors(randColor(), randColor(), randColor()); } catch {}
          try { kwami.avatar.setShininess(rand(10, 180)); } catch {}
          try { kwami.avatar.setWireframe(Math.random() > 0.85); } catch {}
          try { activeBlob.setSpikes(rand(0.2, 3.3), rand(0.2, 3.3), rand(0.2, 3.3)); } catch {}
          try { activeBlob.setAmplitude(rand(0.3, 1.5), rand(0.3, 1.5), rand(0.3, 1.5)); } catch {}
          try { activeBlob.setTime(rand(0.5, 8), rand(0.5, 8), rand(0.5, 8)); } catch {}
        }
      } else {
        try { kwami.avatar.randomize(); } catch {}
        const eye = kwami.avatar.getEyeIris();
        if (eye) {
          lastEyePalette = pickEyeColors(lastEyePalette);
          try { eye.setColors(lastEyePalette); } catch {}
        }
      }

      applyHeroScale(nextRenderer);

      if (nextRenderer !== 'eye-iris') {
        pointerTargetX = 0;
        pointerTargetY = 0;
        pupilMotionTarget = 0;
      }

      randomizeCount += 1;
      if (randomizeCount % 5 === 0) {
        burstRemaining = Math.PI / 4;
      }
    };

    doRandomize();
    randomizeTimer = setInterval(doRandomize, RANDOMIZE_INTERVAL_MS);
  }
});

onUnmounted(async () => {
  if (randomizeTimer !== null) { clearInterval(randomizeTimer); randomizeTimer = null; }
  if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  if (removeClickProxyHandler) { removeClickProxyHandler(); removeClickProxyHandler = null; }
  if (removePointerMoveHandler) { removePointerMoveHandler(); removePointerMoveHandler = null; }
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
