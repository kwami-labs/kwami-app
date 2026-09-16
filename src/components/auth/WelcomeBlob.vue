<script setup lang="ts">
import { ref, onMounted, onUnmounted, shallowRef } from 'vue';
import type { Kwami, KwamiConfig } from 'kwami';

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
  const totalWeight = WELCOME_RENDERER_WEIGHTS.blobXyz + WELCOME_RENDERER_WEIGHTS.eyeIris;
  const roll = Math.random() * totalWeight;
  if (roll < WELCOME_RENDERER_WEIGHTS.blobXyz) return 'blob-xyz';
  return 'eye-iris';
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

  const heroScale = window.innerWidth <= 768 ? 3.2 : 3.5;
  kwami.avatar.setScale(heroScale);

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
        getEyeIris?: () => { getMesh: () => { rotation: { x: number; y: number } } } | null;
      }).getEyeIris?.();
      if (eye) {
        const eyeMesh = eye.getMesh();
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
      }

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
