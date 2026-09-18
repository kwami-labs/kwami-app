<script setup lang="ts">
/**
 * The login screen's video backdrop, when one is chosen.
 *
 * A plain `<video>`, not the workspace's Three.js composite -- see
 * `useWelcomeBackground` for why the two paths are separate.
 *
 * No `crossorigin`: unlike the workspace's composite, which reads frames into
 * a canvas and so needs an untainted source, this element only ever paints
 * itself. Asking for CORS anyway would buy nothing and would narrow the clip
 * list to hosts that send the headers.
 *
 * The scrim above it is not decoration. The clips are arbitrary photography:
 * a snowy peak is near-white, a night city is near-black, and the wordmark,
 * the tagline and the glass card all have to stay readable over either. The
 * scrim pins the backdrop to a known luminance so the `--auth-*` text tokens
 * keep the contrast they were chosen for.
 */
import { onBeforeUnmount, ref, watch } from 'vue';
import { useWelcomeBackground } from '@/composables/useWelcomeBackground';

const { video } = useWelcomeBackground();

const videoEl = ref<HTMLVideoElement | null>(null);
/** A clip that will not load must not leave a half-painted screen behind. */
const failed = ref(false);

/**
 * A full-bleed moving backdrop is the clearest case there is for honouring
 * `prefers-reduced-motion`, so the clip holds on its first frame instead. The
 * picture the user asked for is still there; only the motion is dropped.
 */
const reducedMotion =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

const stillOnly = ref(reducedMotion?.matches ?? false);

function onMotionPreferenceChange(event: MediaQueryListEvent) {
  stillOnly.value = event.matches;
  const el = videoEl.value;
  if (!el) return;
  if (event.matches) el.pause();
  else void el.play().catch(() => {});
}

reducedMotion?.addEventListener('change', onMotionPreferenceChange);
onBeforeUnmount(() => reducedMotion?.removeEventListener('change', onMotionPreferenceChange));

watch(
  () => video.value?.url,
  () => {
    failed.value = false;
    // `src` is bound, but a `<video>` already holding a failed source needs an
    // explicit load() before it will try the new one.
    void videoEl.value?.load();
  },
);

function onLoadedData() {
  if (stillOnly.value) videoEl.value?.pause();
}
</script>

<template>
  <div v-if="video && !failed" class="video-bg" aria-hidden="true">
    <video
      ref="videoEl"
      class="video-bg__clip"
      :src="video.url"
      :autoplay="!stillOnly"
      loop
      muted
      playsinline
      preload="auto"
      @loadeddata="onLoadedData"
      @error="failed = true"
    ></video>
    <div class="video-bg__scrim"></div>
  </div>
</template>

<style scoped>
.video-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

.video-bg__clip {
  width: 100%;
  height: 100%;
  object-fit: cover;
  /* The clips are 24-30fps stock footage; a short fade hides the first frame
     landing before the decoder has settled. */
  animation: video-bg-in 700ms ease both;
}

.video-bg__scrim {
  position: absolute;
  inset: 0;
  background: var(--auth-video-scrim);
}

@keyframes video-bg-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .video-bg__clip {
    animation: none;
  }
}
</style>
