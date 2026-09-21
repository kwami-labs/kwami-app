<script setup lang="ts">
/**
 * The login screen's video backdrop.
 *
 * Two pictures can sit here. A crate track with a `youtube` watch URL owns
 * the screen while it is on the deck — that is the video the visitor asked
 * the music player to play. Otherwise a clip from `useWelcomeBackground`
 * (the film-strip menu / double-click shuffle) paints as a plain `<video>`.
 *
 * The YouTube embed is muted on purpose. Audio still goes through the
 * same-origin file and `KwamiAudio`'s analyser, which is what makes the
 * avatar move. The iframe is only the picture.
 *
 * A plain `<video>` for the stock clips, not the workspace's Three.js
 * composite -- see `useWelcomeBackground` for why the two paths are separate.
 *
 * No `crossorigin` on the stock clip: unlike the workspace's composite, which
 * reads frames into a canvas and so needs an untainted source, this element
 * only ever paints itself.
 *
 * The scrim above either picture is not decoration. The clips are arbitrary
 * photography: a snowy peak is near-white, a night city is near-black, and
 * the wordmark, the tagline and the glass card all have to stay readable
 * over either. The scrim pins the backdrop to a known luminance so the
 * `--auth-*` text tokens keep the contrast they were chosen for.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useWelcomeBackground } from '@/composables/useWelcomeBackground';
import { useWelcomeSoundtrack } from '@/composables/useSoundtrack';
import { youtubeVideoId } from '@/lib/soundtrack';
import { createYoutubePlayer, type YoutubePlayer } from '@/utils/youtubeIframe';

const { video, shuffle } = useWelcomeBackground();
const { isPlaying, currentTrack } = useWelcomeSoundtrack();

const youtubeId = computed(() => youtubeVideoId(currentTrack.value?.youtube));
const thumbnailUrl = computed(() =>
  youtubeId.value ? `https://i.ytimg.com/vi/${youtubeId.value}/hqdefault.jpg` : '',
);

const videoEl = ref<HTMLVideoElement | null>(null);
const ytHost = ref<HTMLElement | null>(null);
/** A clip that will not load must not leave a half-painted screen behind. */
const failed = ref(false);
/** Embed refused (copyright, embedding disabled): keep the thumbnail. */
const ytFailed = ref(false);

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

const showYoutube = computed(() => Boolean(youtubeId.value) && !stillOnly.value && !ytFailed.value);
const showThumb = computed(() => Boolean(youtubeId.value) && (stillOnly.value || ytFailed.value));
const showStock = computed(() => !youtubeId.value && Boolean(video.value) && !failed.value);

function shouldPlayClip(): boolean {
  if (stillOnly.value) return false;
  if (isPlaying.value) return true;
  // A paused crate owns the picture: the pill is play/pause for both.
  if (currentTrack.value) return false;
  // Nothing on the deck: a chosen stock clip may move on its own.
  return true;
}

function syncStockPlayback() {
  const el = videoEl.value;
  if (!el) return;
  if (shouldPlayClip()) void el.play().catch(() => {});
  else el.pause();
}

let ytPlayer: YoutubePlayer | null = null;
let ytBoundId: string | null = null;
let ytBindTurn = 0;

function syncYoutubePlayback() {
  if (!ytPlayer) return;
  try {
    if (shouldPlayClip()) ytPlayer.playVideo();
    else ytPlayer.pauseVideo();
  } catch {
    // Player tore down between the check and the call.
  }
}

function destroyYoutube() {
  try {
    ytPlayer?.destroy();
  } catch {
    // Already gone.
  }
  ytPlayer = null;
  ytBoundId = null;
}

async function bindYoutube() {
  const mine = ++ytBindTurn;
  const id = youtubeId.value;
  const el = ytHost.value;

  if (!id || !el || stillOnly.value || ytFailed.value) {
    destroyYoutube();
    return;
  }
  if (ytPlayer && ytBoundId === id) {
    syncYoutubePlayback();
    return;
  }

  destroyYoutube();

  try {
    const player = await createYoutubePlayer(el, id, {
      onReady: () => {
        if (mine === ytBindTurn) syncYoutubePlayback();
      },
      onError: () => {
        if (mine === ytBindTurn) ytFailed.value = true;
      },
    });
    if (mine !== ytBindTurn) {
      player.destroy();
      return;
    }
    ytPlayer = player;
    ytBoundId = id;
    syncYoutubePlayback();
  } catch {
    if (mine === ytBindTurn) ytFailed.value = true;
  }
}

function onMotionPreferenceChange(event: MediaQueryListEvent) {
  stillOnly.value = event.matches;
  syncStockPlayback();
  syncYoutubePlayback();
}

reducedMotion?.addEventListener('change', onMotionPreferenceChange);
onBeforeUnmount(() => {
  reducedMotion?.removeEventListener('change', onMotionPreferenceChange);
  ytBindTurn += 1;
  destroyYoutube();
});

watch(
  () => video.value?.url,
  () => {
    failed.value = false;
    // `src` is bound, but a `<video>` already holding a failed source needs an
    // explicit load() before it will try the new one.
    void videoEl.value?.load();
  },
);

watch(
  () => youtubeId.value,
  () => {
    ytFailed.value = false;
  },
);

watch([ytHost, youtubeId, stillOnly, ytFailed], () => {
  void bindYoutube();
});

watch(
  [isPlaying, currentTrack, stillOnly],
  () => {
    // Mixkit cuts have no watch URL. Play on a gradient still rolls a stock
    // clip for those. A youtube record *is* the backdrop — do not cover it
    // with a waterfall.
    if ((isPlaying.value || currentTrack.value) && !video.value && !youtubeId.value) {
      shuffle();
    }
    syncStockPlayback();
    syncYoutubePlayback();
  },
  { immediate: true, flush: 'post' },
);

function onLoadedData() {
  syncStockPlayback();
}
</script>

<template>
  <div v-if="showYoutube" class="video-bg video-bg--youtube" aria-hidden="true">
    <div class="video-bg__yt">
      <div :key="youtubeId ?? ''" ref="ytHost" class="video-bg__yt-host"></div>
    </div>
    <div class="video-bg__scrim"></div>
  </div>

  <div v-else-if="showThumb" class="video-bg video-bg--thumb" aria-hidden="true">
    <img class="video-bg__clip" :src="thumbnailUrl" alt="" />
    <div class="video-bg__scrim"></div>
  </div>

  <div v-else-if="showStock" class="video-bg" aria-hidden="true">
    <video
      ref="videoEl"
      class="video-bg__clip"
      :src="video?.url"
      :autoplay="!stillOnly && !currentTrack"
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

.video-bg__yt {
  position: absolute;
  top: 50%;
  left: 50%;
  /* Cover a 16:9 embed the way `object-fit: cover` covers a <video>. */
  width: 100vw;
  height: 56.25vw;
  min-height: 100vh;
  min-width: 177.78vh;
  transform: translate(-50%, -50%);
}

.video-bg__yt-host,
.video-bg__yt :deep(iframe) {
  width: 100%;
  height: 100%;
  border: 0;
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
