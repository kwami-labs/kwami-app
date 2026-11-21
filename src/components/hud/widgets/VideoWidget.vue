<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import HudWindow from '../HudWindow.vue';
import { useHudStore, type HudWidget } from '@/stores/hud';
import { formatClock, youtubeEmbedUrl, youtubeId, youtubeStart } from '@/lib/hud/media';
import { openExternal } from '@/lib/hud/external';
import { HUD_MEDIA_EVENT, type HudMediaCommand } from '@/composables/useHud';

/**
 * A video on Jarvis's screen, with an editor's controls rather than a viewer's: a
 * timeline to scrub, in and out points for a selection, marks, speed, a loop over the
 * selection, and for a video file, frame-by-frame stepping, saving a frame and
 * exporting the selection as a clip. YouTube plays through its embed, driven over its
 * JS API; its frames are not ours to take, which the player says plainly.
 */
const props = defineProps<{ widget: HudWidget; index: number }>();

const { t } = useI18n();
const hud = useHudStore();

const url = computed(() => props.widget.url ?? '');
const ytId = computed(() => youtubeId(url.value));
const engine = computed<'youtube' | 'file'>(() => (ytId.value ? 'youtube' : 'file'));
const code = computed(() => `VID-${String(props.index + 1).padStart(2, '0')}`);

const stage = ref<HTMLElement | null>(null);
const video = ref<HTMLVideoElement | null>(null);
const frame = ref<HTMLIFrameElement | null>(null);

const playing = ref(false);
const current = ref(0);
const duration = ref(0);
const rate = ref(1);
const volume = ref(1);
const muted = ref(false);
const inPoint = ref<number | null>(null);
const outPoint = ref<number | null>(null);
const loopSelection = ref(false);
const marks = ref<number[]>([]);
const note = ref('');
/** False once the file had to be loaded without CORS: its frames cannot be read then. */
const framesReadable = ref(true);
const crossOrigin = ref<'anonymous' | undefined>('anonymous');
const exporting = ref<number | null>(null);

const RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
const FRAME = 1 / 30;

const embedSrc = computed(() =>
  ytId.value
    ? youtubeEmbedUrl(ytId.value, {
        start: props.widget.start || youtubeStart(url.value),
        autoplay: true,
      })
    : '',
);

const selection = computed(() => {
  if (inPoint.value === null && outPoint.value === null) return null;
  const start = inPoint.value ?? 0;
  const end = outPoint.value ?? duration.value;
  return end > start ? { start, end } : null;
});

function pct(seconds: number): string {
  return duration.value
    ? `${(Math.min(Math.max(seconds / duration.value, 0), 1) * 100).toFixed(3)}%`
    : '0%';
}

function flash(text: string) {
  note.value = text;
  setTimeout(() => {
    if (note.value === text) note.value = '';
  }, 2200);
}

// -- YouTube over its JS API ---------------------------------------------------------

function yt(func: string, args: unknown[] = []) {
  frame.value?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
}

function onYoutubeLoad() {
  frame.value?.contentWindow?.postMessage(
    JSON.stringify({ event: 'listening', id: props.widget.id, channel: 'widget' }),
    '*',
  );
}

function onMessage(event: MessageEvent) {
  if (engine.value !== 'youtube' || event.source !== frame.value?.contentWindow) return;
  if (!/^https:\/\/www\.youtube(-nocookie)?\.com$/.test(event.origin)) return;
  let data: { event?: string; info?: Record<string, unknown> };
  try {
    data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
  } catch {
    return;
  }
  const info = data?.info;
  if (!info || typeof info !== 'object') return;
  if (typeof info.currentTime === 'number') current.value = info.currentTime;
  if (typeof info.duration === 'number' && info.duration > 0) duration.value = info.duration;
  if (typeof info.playerState === 'number') playing.value = info.playerState === 1;
  if (typeof info.playbackRate === 'number') rate.value = info.playbackRate;
  if (typeof info.muted === 'boolean') muted.value = info.muted;
  if (typeof info.volume === 'number') volume.value = info.volume / 100;
  enforceLoop();
}

// -- shared controls -----------------------------------------------------------------

function play() {
  if (engine.value === 'youtube') yt('playVideo');
  else void video.value?.play();
}

function pause() {
  if (engine.value === 'youtube') yt('pauseVideo');
  else video.value?.pause();
}

function toggle() {
  if (playing.value) pause();
  else play();
}

function seek(seconds: number) {
  const target = Math.min(Math.max(seconds, 0), duration.value || seconds);
  current.value = target;
  if (engine.value === 'youtube') yt('seekTo', [target, true]);
  else if (video.value) video.value.currentTime = target;
}

function nudge(delta: number) {
  seek(current.value + delta);
}

function setRate(value: number) {
  rate.value = value;
  if (engine.value === 'youtube') yt('setPlaybackRate', [value]);
  else if (video.value) video.value.playbackRate = value;
}

function setVolume(value: number) {
  volume.value = value;
  if (engine.value === 'youtube') yt('setVolume', [Math.round(value * 100)]);
  else if (video.value) video.value.volume = value;
  if (value > 0 && muted.value) toggleMute();
}

function toggleMute() {
  muted.value = !muted.value;
  if (engine.value === 'youtube') yt(muted.value ? 'mute' : 'unMute');
  else if (video.value) video.value.muted = muted.value;
}

function markIn() {
  inPoint.value = current.value;
  if (outPoint.value !== null && outPoint.value <= current.value) outPoint.value = null;
}

function markOut() {
  outPoint.value = current.value;
  if (inPoint.value !== null && inPoint.value >= current.value) inPoint.value = null;
}

function clearSelection() {
  inPoint.value = null;
  outPoint.value = null;
  loopSelection.value = false;
}

function addMark() {
  const at = Math.round(current.value * 10) / 10;
  if (!marks.value.some((m) => Math.abs(m - at) < 0.25)) {
    marks.value = [...marks.value, at].sort((a, b) => a - b);
  }
}

function removeMark(at: number) {
  marks.value = marks.value.filter((m) => m !== at);
}

function enforceLoop() {
  const range = selection.value;
  if (!loopSelection.value || !range || !playing.value) return;
  if (current.value >= range.end - 0.05 || current.value < range.start - 0.5) seek(range.start);
}

function toggleLoop() {
  loopSelection.value = !loopSelection.value;
  const range = selection.value;
  if (loopSelection.value && range) seek(range.start);
}

async function fullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await stage.value?.requestFullscreen();
  } catch {
    // Refused by the platform: nothing to undo.
  }
}

async function pictureInPicture() {
  try {
    if (document.pictureInPictureElement) await document.exitPictureInPicture();
    else await video.value?.requestPictureInPicture();
  } catch {
    // Not offered for this video.
  }
}

function openOutside() {
  pause();
  void openExternal(url.value);
}

// -- the file engine ---------------------------------------------------------------

function onTime() {
  if (!video.value) return;
  current.value = video.value.currentTime;
  enforceLoop();
}

function onMeta() {
  if (!video.value) return;
  duration.value = Number.isFinite(video.value.duration) ? video.value.duration : 0;
  video.value.playbackRate = rate.value;
  if (props.widget.start) video.value.currentTime = props.widget.start;
}

function onVideoError() {
  // A server without CORS refuses a crossorigin request; play it without, frames locked.
  if (crossOrigin.value) {
    crossOrigin.value = undefined;
    framesReadable.value = false;
    video.value?.load();
  }
}

function snapshot() {
  const el = video.value;
  if (!el || !el.videoWidth) return;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = el.videoWidth;
    canvas.height = el.videoHeight;
    canvas.getContext('2d')?.drawImage(el, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      save(blob, `frame-${formatClock(current.value).replace(/:/g, '-')}.png`);
    }, 'image/png');
  } catch {
    flash(t('hud.video.exportFailed'));
  }
}

function save(blob: Blob, name: string) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.setAttribute('data-hud-external', '');
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 3000);
}

async function exportClip() {
  const el = video.value as (HTMLVideoElement & { captureStream?: () => MediaStream }) | null;
  const range = selection.value ?? { start: 0, end: duration.value };
  if (!el || !el.captureStream || exporting.value !== null || range.end <= range.start) return;
  let stream: MediaStream;
  try {
    stream = el.captureStream();
  } catch {
    flash(t('hud.video.exportFailed'));
    return;
  }
  const type = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(
    (candidate) => MediaRecorder.isTypeSupported(candidate),
  );
  const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const wasLooping = loopSelection.value;
  loopSelection.value = false;
  el.pause();
  el.currentTime = range.start;
  await new Promise((resolve) => el.addEventListener('seeked', resolve, { once: true }));
  exporting.value = 0;
  recorder.start(250);
  await el.play();
  await new Promise<void>((resolve) => {
    const watchEnd = () => {
      exporting.value = Math.min(
        100,
        Math.round(((el.currentTime - range.start) / (range.end - range.start)) * 100),
      );
      if (el.currentTime >= range.end || el.ended || el.paused) {
        el.removeEventListener('timeupdate', watchEnd);
        resolve();
      }
    };
    el.addEventListener('timeupdate', watchEnd);
  });
  el.pause();
  await new Promise((resolve) => {
    recorder.onstop = resolve;
    recorder.stop();
  });
  exporting.value = null;
  loopSelection.value = wasLooping;
  save(
    new Blob(chunks, { type: type ?? 'video/webm' }),
    `clip-${formatClock(range.start).replace(/:/g, '-')}.webm`,
  );
  flash(t('hud.video.exported'));
}

// -- the timeline ----------------------------------------------------------------------

const track = ref<HTMLElement | null>(null);
const hoverAt = ref<number | null>(null);
let scrubbing = false;

function timeAt(clientX: number): number {
  const box = track.value?.getBoundingClientRect();
  if (!box || !duration.value) return 0;
  return Math.min(Math.max((clientX - box.left) / box.width, 0), 1) * duration.value;
}

function scrubStart(e: PointerEvent) {
  scrubbing = true;
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  seek(timeAt(e.clientX));
}

function scrubMove(e: PointerEvent) {
  hoverAt.value = timeAt(e.clientX);
  if (scrubbing) seek(hoverAt.value);
}

function scrubEnd() {
  scrubbing = false;
}

// -- keys -----------------------------------------------------------------------------

function onKey(e: KeyboardEvent) {
  if (hud.focusedId !== props.widget.id) return;
  const target = e.target as HTMLElement | null;
  if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const fileEngine = engine.value === 'file';
  const actions: Record<string, () => void> = {
    ' ': toggle,
    k: toggle,
    j: () => nudge(-5),
    l: () => nudge(5),
    i: markIn,
    o: markOut,
    m: addMark,
    f: () => void fullscreen(),
    arrowleft: () => (fileEngine && !playing.value ? nudge(-FRAME) : nudge(-5)),
    arrowright: () => (fileEngine && !playing.value ? nudge(FRAME) : nudge(5)),
  };
  const action = actions[e.key.toLowerCase()];
  if (!action) return;
  e.preventDefault();
  action();
}

/** Jarvis's voice controls, for the window they name (the newest video on screen). */
function onVoiceCommand(event: Event) {
  const command = (event as CustomEvent<HudMediaCommand>).detail;
  if (!command || command.id !== props.widget.id) return;
  switch (command.action) {
    case 'pause':
      pause();
      break;
    case 'resume':
      play();
      break;
    case 'stop':
      pause();
      seek(0);
      break;
    case 'restart':
      seek(0);
      play();
      break;
    case 'mute':
      if (!muted.value) toggleMute();
      break;
    case 'unmute':
      if (muted.value) toggleMute();
      break;
    case 'volume':
      if (typeof command.level === 'number') setVolume(Math.min(Math.max(command.level, 0), 1));
      break;
  }
}

onMounted(() => {
  window.addEventListener('message', onMessage);
  window.addEventListener('keydown', onKey);
  window.addEventListener(HUD_MEDIA_EVENT, onVoiceCommand);
});

onBeforeUnmount(() => {
  window.removeEventListener('message', onMessage);
  window.removeEventListener('keydown', onKey);
  window.removeEventListener(HUD_MEDIA_EVENT, onVoiceCommand);
});

// Folded into the dock, behind another tab or on another screen: stop talking over
// whatever is on screen.
watch(
  () => hud.isShown(props.widget),
  (shown) => {
    if (!shown) pause();
  },
);

const status = computed(() => (playing.value ? 'live' : 'idle'));
const statusLabel = computed(() =>
  playing.value ? t('hud.video.playing') : t('hud.video.paused'),
);
</script>

<template>
  <HudWindow
    :widget="widget"
    :code="code"
    icon="ph:film-strip-duotone"
    :status="status"
    :status-label="statusLabel"
  >
    <div class="video">
      <div ref="stage" class="stage" @dblclick="fullscreen">
        <iframe
          v-if="engine === 'youtube'"
          ref="frame"
          :src="embedSrc"
          title="YouTube"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          referrerpolicy="strict-origin-when-cross-origin"
          @load="onYoutubeLoad"
        ></iframe>
        <video
          v-else-if="url"
          ref="video"
          :src="url"
          :crossorigin="crossOrigin"
          playsinline
          autoplay
          @click="toggle"
          @play="playing = true"
          @pause="playing = false"
          @timeupdate="onTime"
          @loadedmetadata="onMeta"
          @durationchange="onMeta"
          @volumechange="video && ((volume = video.volume), (muted = video.muted))"
          @error="onVideoError"
        ></video>
        <div v-else class="hud-empty">{{ t('hud.video.noSource') }}</div>
        <div class="stage-hud" aria-hidden="true">
          <span class="corner tl"></span><span class="corner tr"></span>
          <span class="corner bl"></span><span class="corner br"></span>
          <span class="stage-clock">{{ formatClock(current) }}</span>
        </div>
        <div v-if="exporting !== null" class="stage-overlay">
          <iconify-icon icon="ph:circle-notch" class="hud-spin"></iconify-icon>
          {{ t('hud.video.exporting', { p: exporting }) }}
        </div>
      </div>

      <div
        ref="track"
        class="timeline"
        role="slider"
        :aria-valuemin="0"
        :aria-valuemax="Math.round(duration)"
        :aria-valuenow="Math.round(current)"
        tabindex="0"
        @pointerdown="scrubStart"
        @pointermove="scrubMove"
        @pointerup="scrubEnd"
        @pointerleave="hoverAt = null"
      >
        <div class="tl-rail">
          <div
            v-if="selection"
            class="tl-selection"
            :style="{
              left: pct(selection.start),
              width: `calc(${pct(selection.end)} - ${pct(selection.start)})`,
            }"
          ></div>
          <div class="tl-progress" :style="{ width: pct(current) }"></div>
          <button
            v-for="mark in marks"
            :key="mark"
            type="button"
            class="tl-mark"
            :style="{ left: pct(mark) }"
            :title="formatClock(mark)"
            @pointerdown.stop
            @click.stop="seek(mark)"
            @contextmenu.prevent="removeMark(mark)"
          ></button>
          <div class="tl-head" :style="{ left: pct(current) }"></div>
        </div>
        <div v-if="hoverAt !== null" class="tl-hover" :style="{ left: pct(hoverAt) }">
          {{ formatClock(hoverAt) }}
        </div>
      </div>

      <div class="controls">
        <button
          type="button"
          class="hud-icon-btn big"
          :title="playing ? t('hud.video.pause') : t('hud.video.play')"
          @click="toggle"
        >
          <iconify-icon :icon="playing ? 'ph:pause-fill' : 'ph:play-fill'"></iconify-icon>
        </button>
        <button type="button" class="hud-icon-btn" :title="t('hud.video.back5')" @click="nudge(-5)">
          <iconify-icon icon="ph:arrow-counter-clockwise"></iconify-icon>
        </button>
        <button
          type="button"
          class="hud-icon-btn"
          :title="t('hud.video.forward5')"
          @click="nudge(5)"
        >
          <iconify-icon icon="ph:arrow-clockwise"></iconify-icon>
        </button>
        <template v-if="engine === 'file'">
          <button
            type="button"
            class="hud-icon-btn"
            :title="t('hud.video.frameBack')"
            @click="nudge(-FRAME)"
          >
            <iconify-icon icon="ph:caret-line-left"></iconify-icon>
          </button>
          <button
            type="button"
            class="hud-icon-btn"
            :title="t('hud.video.frameForward')"
            @click="nudge(FRAME)"
          >
            <iconify-icon icon="ph:caret-line-right"></iconify-icon>
          </button>
        </template>
        <span class="clock"
          >{{ formatClock(current) }} <i>/ {{ formatClock(duration) }}</i></span
        >

        <span class="hud-sep"></span>
        <button
          type="button"
          class="hud-icon-btn txt"
          :class="{ 'is-on': inPoint !== null }"
          :title="t('hud.video.setIn')"
          @click="markIn"
        >
          I
        </button>
        <button
          type="button"
          class="hud-icon-btn txt"
          :class="{ 'is-on': outPoint !== null }"
          :title="t('hud.video.setOut')"
          @click="markOut"
        >
          O
        </button>
        <button
          type="button"
          class="hud-icon-btn"
          :class="{ 'is-on': loopSelection }"
          :disabled="!selection"
          :title="t('hud.video.loop')"
          @click="toggleLoop"
        >
          <iconify-icon icon="ph:repeat"></iconify-icon>
        </button>
        <button
          type="button"
          class="hud-icon-btn"
          :disabled="!selection"
          :title="t('hud.video.clearRange')"
          @click="clearSelection"
        >
          <iconify-icon icon="ph:selection-slash"></iconify-icon>
        </button>
        <button type="button" class="hud-icon-btn" :title="t('hud.video.addMark')" @click="addMark">
          <iconify-icon icon="ph:bookmark-simple"></iconify-icon>
        </button>

        <span class="spacer"></span>

        <label class="speed" :title="t('hud.video.speed')">
          <iconify-icon icon="ph:gauge"></iconify-icon>
          <select
            class="hud-input"
            :value="rate"
            @change="setRate(Number(($event.target as HTMLSelectElement).value))"
          >
            <option v-for="r in RATES" :key="r" :value="r">{{ r }}×</option>
          </select>
        </label>
        <button
          type="button"
          class="hud-icon-btn"
          :title="muted ? t('hud.video.unmute') : t('hud.video.mute')"
          @click="toggleMute"
        >
          <iconify-icon
            :icon="muted || volume === 0 ? 'ph:speaker-slash' : 'ph:speaker-high'"
          ></iconify-icon>
        </button>
        <input
          class="vol"
          type="range"
          min="0"
          max="1"
          step="0.05"
          :value="muted ? 0 : volume"
          :aria-label="t('hud.video.volume')"
          @input="setVolume(Number(($event.target as HTMLInputElement).value))"
        />
        <span class="hud-sep"></span>
        <template v-if="engine === 'file'">
          <button
            type="button"
            class="hud-icon-btn"
            :disabled="!framesReadable"
            :title="t('hud.video.snapshot')"
            @click="snapshot"
          >
            <iconify-icon icon="ph:camera"></iconify-icon>
          </button>
          <button
            type="button"
            class="hud-icon-btn"
            :disabled="!framesReadable || exporting !== null"
            :title="t('hud.video.exportClip')"
            @click="exportClip"
          >
            <iconify-icon icon="ph:scissors"></iconify-icon>
          </button>
          <button
            type="button"
            class="hud-icon-btn"
            :title="t('hud.video.pip')"
            @click="pictureInPicture"
          >
            <iconify-icon icon="ph:picture-in-picture"></iconify-icon>
          </button>
        </template>
        <button
          type="button"
          class="hud-icon-btn"
          :title="t('hud.video.fullscreen')"
          @click="fullscreen"
        >
          <iconify-icon icon="ph:arrows-out"></iconify-icon>
        </button>
        <button
          type="button"
          class="hud-icon-btn"
          :title="t('hud.video.openOutside')"
          @click="openOutside"
        >
          <iconify-icon icon="ph:arrow-square-out"></iconify-icon>
        </button>
      </div>
    </div>

    <template #footer>
      <span v-if="note" class="note">{{ note }}</span>
      <span v-else-if="selection">
        {{ t('hud.video.selection') }} {{ formatClock(selection.start) }} →
        {{ formatClock(selection.end) }} ({{ formatClock(selection.end - selection.start) }})
      </span>
      <span v-else-if="engine === 'youtube'">{{ t('hud.video.youtubeLimits') }}</span>
      <span v-else>{{ t('hud.video.shortcuts') }}</span>
      <span class="spacer"></span>
      <span v-if="marks.length">{{ marks.length }} · {{ t('hud.video.chapters') }}</span>
    </template>
  </HudWindow>
</template>

<style scoped>
.video {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.stage {
  position: relative;
  flex: 1;
  min-height: 120px;
  background: #000;
  display: flex;
}
.stage iframe,
.stage video {
  flex: 1;
  width: 100%;
  height: 100%;
  border: 0;
  background: #000;
  object-fit: contain;
}
.stage:fullscreen {
  background: #000;
}

.stage-hud {
  position: absolute;
  inset: 8px;
  pointer-events: none;
}
.corner {
  position: absolute;
  width: 16px;
  height: 16px;
  border: 0 solid rgba(var(--hud-rgb), 0.7);
}
.corner.tl {
  top: 0;
  left: 0;
  border-top-width: 1px;
  border-left-width: 1px;
}
.corner.tr {
  top: 0;
  right: 0;
  border-top-width: 1px;
  border-right-width: 1px;
}
.corner.bl {
  bottom: 0;
  left: 0;
  border-bottom-width: 1px;
  border-left-width: 1px;
}
.corner.br {
  bottom: 0;
  right: 0;
  border-bottom-width: 1px;
  border-right-width: 1px;
}
.stage-clock {
  position: absolute;
  top: 4px;
  right: 22px;
  font-family: var(--hud-mono);
  font-size: 11px;
  color: rgba(var(--hud-rgb), 0.9);
  text-shadow: 0 0 6px rgba(0, 0, 0, 0.9);
}

.stage-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: rgba(0, 0, 0, 0.6);
  font-family: var(--hud-font);
  font-size: 16px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--hud-amber);
}

.timeline {
  position: relative;
  height: 28px;
  padding: 10px 12px;
  cursor: pointer;
  touch-action: none;
  outline: none;
}
.tl-rail {
  position: relative;
  height: 6px;
  background: repeating-linear-gradient(
    90deg,
    rgba(var(--hud-rgb), 0.16) 0 1px,
    rgba(var(--hud-rgb), 0.08) 1px 6px
  );
}
.tl-progress {
  position: absolute;
  inset: 0 auto 0 0;
  background: linear-gradient(90deg, rgba(var(--hud-rgb), 0.35), var(--hud-accent));
  box-shadow: 0 0 10px rgba(var(--hud-rgb), 0.5);
}
.tl-selection {
  position: absolute;
  top: -5px;
  bottom: -5px;
  background: rgba(var(--hud-amber-rgb), 0.18);
  border-left: 2px solid var(--hud-amber);
  border-right: 2px solid var(--hud-amber);
}
.tl-head {
  position: absolute;
  top: -6px;
  width: 2px;
  height: 18px;
  margin-left: -1px;
  background: #fff;
  box-shadow: 0 0 8px var(--hud-accent);
}
.tl-mark {
  position: absolute;
  top: -7px;
  width: 9px;
  height: 9px;
  margin-left: -4.5px;
  padding: 0;
  border: 0;
  background: var(--hud-green);
  clip-path: polygon(50% 100%, 0 0, 100% 0);
  cursor: pointer;
}
.tl-hover {
  position: absolute;
  top: -12px;
  transform: translateX(-50%);
  margin-left: 12px;
  padding: 1px 5px;
  font-family: var(--hud-mono);
  font-size: 10px;
  background: var(--hud-fill-strong);
  border: 1px solid var(--hud-line-soft);
  pointer-events: none;
}

.controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px;
  padding: 2px 10px 8px;
}
.hud-icon-btn.big {
  width: 34px;
  height: 34px;
  font-size: 19px;
  color: var(--hud-accent);
  border-color: var(--hud-line-soft);
}
.hud-icon-btn.txt {
  font-family: var(--hud-font);
  font-weight: 700;
}
.clock {
  margin: 0 8px;
  font-family: var(--hud-mono);
  font-size: 12px;
}
.clock i {
  font-style: normal;
  color: var(--hud-faint);
}
.speed {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--hud-dim);
}
.speed select {
  padding: 2px 4px;
}
.vol {
  width: 70px;
  accent-color: var(--hud-accent);
}
.spacer {
  flex: 1;
}
.note {
  color: var(--hud-amber);
}
</style>
