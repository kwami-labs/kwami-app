<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import RecordingRegionPicker from './RecordingRegionPicker.vue';
import { useRecording } from '@/composables/useRecording';
import type { ViewportRegion, RecordingReadyDetail } from '@/composables/useRecording';

type VideoFormat = 'fullscreen' | 'mobile' | 'square';

interface FormatOption {
  id: VideoFormat;
  label: string;
  icon: string;
  aspectRatio: string;
  ratio: number;
  outW: number;
  outH: number;
}

const { startCanvasRecording } = useRecording();
const { t } = useI18n();

const isOpen = ref(false);
const selectedFormat = ref<VideoFormat>('fullscreen');
const isRecording = ref(false);
const isSaving = ref(false);
const recordingSeconds = ref(0);
const showPicker = ref(false);
const includeMic = ref(false);

const previewUrl = ref<string | null>(null);
const previewFilename = ref('kwami-recording.webm');

let durationInterval: ReturnType<typeof setInterval> | null = null;
let stopFn: (() => void) | null = null;

const formatOptions: FormatOption[] = [
  {
    id: 'fullscreen',
    label: 'Full Screen',
    icon: 'ph:monitor-bold',
    aspectRatio: '16:9',
    ratio: 16 / 9,
    outW: 1280,
    outH: 720,
  },
  {
    id: 'mobile',
    label: 'Mobile',
    icon: 'ph:device-mobile-bold',
    aspectRatio: '9:16',
    ratio: 9 / 16,
    outW: 720,
    outH: 1280,
  },
  {
    id: 'square',
    label: 'Square',
    icon: 'ph:square-bold',
    aspectRatio: '1:1',
    ratio: 1,
    outW: 720,
    outH: 720,
  },
];

const selectedOption = computed(() => formatOptions.find((o) => o.id === selectedFormat.value));

const formattedDuration = computed(() => {
  const m = Math.floor(recordingSeconds.value / 60);
  const s = recordingSeconds.value % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
});

function togglePopover() {
  isOpen.value = !isOpen.value;
}
function closePopover() {
  isOpen.value = false;
}
function selectFormat(format: VideoFormat) {
  selectedFormat.value = format;
}

// ── Recording flow ────────────────────────────────────────────

function openPicker() {
  closePopover();
  showPicker.value = true;
}

function onPickerConfirm(region: ViewportRegion) {
  showPicker.value = false;
  const opt = selectedOption.value;
  if (!opt) return;

  isRecording.value = true;
  recordingSeconds.value = 0;
  durationInterval = setInterval(() => recordingSeconds.value++, 1000);

  stopFn = startCanvasRecording(
    region,
    opt.outW,
    opt.outH,
    `kwami-${opt.id}-${Date.now()}.webm`,
    includeMic.value,
    onRecordingReady,
  );
}

function onPickerCancel() {
  showPicker.value = false;
}

function stopRecording() {
  isRecording.value = false;
  isSaving.value = true;
  if (durationInterval) {
    clearInterval(durationInterval);
    durationInterval = null;
  }
  stopFn?.();
  stopFn = null;
}

function onRecordingReady(detail: RecordingReadyDetail) {
  isSaving.value = false;
  recordingSeconds.value = 0;
  previewUrl.value = detail.url;
  previewFilename.value = detail.filename;
}

// ── Preview modal ─────────────────────────────────────────────

function downloadRecording() {
  if (!previewUrl.value) return;
  const a = document.createElement('a');
  a.href = previewUrl.value;
  a.download = previewFilename.value;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function closePreview() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = null;
}

// ── Click outside to close popover ───────────────────────────

function handleClickOutside(e: MouseEvent) {
  if (!(e.target as HTMLElement).closest('.record-control')) closePopover();
}

watch(isOpen, (open) => {
  if (open) document.addEventListener('click', handleClickOutside);
  else document.removeEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  if (durationInterval) clearInterval(durationInterval);
  closePreview();
  stopFn?.();
});
</script>

<template>
  <div class="record-control">
    <!-- Main record button + duration label -->
    <div class="record-btn-wrap">
      <button
        class="record-btn"
        :class="{ active: isOpen, recording: isRecording, saving: isSaving }"
        :disabled="isSaving"
        :title="
          isRecording
            ? t('recording.stopRecording')
            : isSaving
              ? t('recording.saving')
              : t('recording.record')
        "
        @click="isRecording ? stopRecording() : !isSaving && togglePopover()"
      >
        <iconify-icon
          :icon="isSaving ? 'ph:spinner-bold' : isRecording ? 'ph:stop-fill' : 'ph:record-fill'"
          :class="{ pulse: isRecording, spin: isSaving }"
        ></iconify-icon>
      </button>
      <span v-if="isRecording" class="recording-duration">{{ formattedDuration }}</span>
      <span v-if="isSaving" class="recording-duration saving-label">{{
        t('recording.saving')
      }}</span>
    </div>

    <!-- Format popover -->
    <transition name="popover">
      <div v-if="isOpen && !isRecording" class="popover">
        <div class="popover-arrow"></div>

        <div class="popover-header">
          <iconify-icon icon="ph:video-camera-bold"></iconify-icon>
          <span>{{ t('recording.recordVideo') }}</span>
        </div>

        <div class="format-tabs">
          <button
            v-for="option in formatOptions"
            :key="option.id"
            class="format-tab"
            :class="{ active: selectedFormat === option.id }"
            @click="selectFormat(option.id)"
          >
            <iconify-icon :icon="option.icon"></iconify-icon>
            <span class="format-label">{{ option.label }}</span>
            <span class="format-ratio">{{ option.aspectRatio }}</span>
          </button>
        </div>

        <div class="format-preview">
          <div class="preview-box" :class="selectedFormat">
            <iconify-icon icon="ph:camera-bold"></iconify-icon>
          </div>
        </div>

        <!-- Mic toggle -->
        <div class="mic-row">
          <div class="mic-label">
            <iconify-icon
              :icon="includeMic ? 'ph:microphone-bold' : 'ph:microphone-slash-bold'"
            ></iconify-icon>
            <span>{{ t('recording.microphone') }}</span>
          </div>
          <button
            class="mic-toggle"
            :class="{ on: includeMic }"
            :title="includeMic ? t('recording.disableMic') : t('recording.enableMic')"
            @click="includeMic = !includeMic"
          >
            <span class="mic-toggle-knob"></span>
          </button>
        </div>

        <button class="start-btn" @click="openPicker">
          <iconify-icon icon="ph:record-fill"></iconify-icon>
          <span>{{ t('recording.startRecording') }}</span>
        </button>
      </div>
    </transition>

    <!-- Region picker (full-screen, teleported) -->
    <teleport to="body">
      <RecordingRegionPicker
        v-if="showPicker"
        :aspect-ratio="selectedOption?.ratio ?? 16 / 9"
        :format-label="selectedOption?.label ?? ''"
        @confirm="onPickerConfirm"
        @cancel="onPickerCancel"
      />
    </teleport>

    <!-- Preview modal (teleported) -->
    <teleport to="body">
      <transition name="preview-modal">
        <div v-if="previewUrl" class="preview-backdrop" @click.self="closePreview">
          <div class="preview-modal">
            <div class="preview-header">
              <div class="preview-title">
                <iconify-icon icon="ph:film-strip-bold"></iconify-icon>
                <span>{{ t('recording.recordingPreview') }}</span>
              </div>
              <button class="preview-close" title="Discard" @click="closePreview">
                <iconify-icon icon="ph:x-bold"></iconify-icon>
              </button>
            </div>

            <div class="preview-video-wrap">
              <video :src="previewUrl" class="preview-video" controls autoplay loop></video>
            </div>

            <div class="preview-actions">
              <button class="preview-discard-btn" @click="closePreview">
                <iconify-icon icon="ph:trash-bold"></iconify-icon>
                <span>{{ t('recording.discard') }}</span>
              </button>
              <button class="preview-download-btn" @click="downloadRecording">
                <iconify-icon icon="ph:download-bold"></iconify-icon>
                <span>{{ t('recording.download') }}</span>
              </button>
            </div>
          </div>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<style scoped>
.record-control {
  position: relative;
}

.record-btn-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.recording-duration {
  font-size: 10px;
  font-weight: 600;
  color: #ef4444;
  font-family: 'JetBrains Mono', monospace;
  letter-spacing: 0.03em;
  line-height: 1;
  animation: fadeIn 0.2s ease;
}

.recording-duration.saving-label {
  color: var(--text-muted);
  animation: none;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* ── Main Button ────────────────────────────────────────────── */
.record-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
}

.record-btn iconify-icon {
  font-size: 18px;
  color: var(--text-secondary);
  transition: all 0.2s ease;
}

.record-btn:hover:not(:disabled) {
  transform: scale(1.05);
  border-color: var(--surface-4);
  background: var(--surface-2);
}

.record-btn:hover:not(:disabled) iconify-icon {
  color: var(--text-primary);
}

.record-btn.active {
  border-color: var(--accent-primary);
  background: var(--accent-glow);
}

.record-btn.active iconify-icon {
  color: var(--accent-primary);
}

.record-btn.recording {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  border-color: transparent;
  box-shadow:
    0 4px 20px rgba(239, 68, 68, 0.4),
    0 0 0 0 rgba(239, 68, 68, 0);
}

.record-btn.recording iconify-icon {
  color: white;
}

.record-btn.recording:hover {
  box-shadow:
    0 6px 28px rgba(239, 68, 68, 0.5),
    0 0 0 4px rgba(239, 68, 68, 0.15);
}

.record-btn.saving {
  background: var(--surface-2);
  border-color: var(--glass-border);
  cursor: not-allowed;
  opacity: 0.7;
}

.record-btn.saving iconify-icon {
  color: var(--text-muted);
}

.pulse {
  animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* ── Popover ────────────────────────────────────────────────── */
.popover {
  position: absolute;
  top: calc(100% + 12px);
  right: 0;
  width: 200px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  box-shadow: var(--glass-shadow);
  overflow: hidden;
  z-index: 1000;
}

.popover-arrow {
  position: absolute;
  top: -6px;
  right: 14px;
  width: 12px;
  height: 12px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-bottom: none;
  border-right: none;
  transform: rotate(45deg);
}

.popover-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--glass-border);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.popover-header iconify-icon {
  font-size: 16px;
  color: var(--accent-primary);
}

.format-tabs {
  display: flex;
  flex-direction: column;
  padding: 8px;
  gap: 4px;
}

.format-tab {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.format-tab iconify-icon {
  font-size: 16px;
  color: var(--text-muted);
  flex-shrink: 0;
}
.format-label {
  flex: 1;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}
.format-ratio {
  font-size: 10px;
  font-weight: 500;
  color: var(--text-muted);
  font-family: 'JetBrains Mono', monospace;
}

.format-tab:hover {
  background: var(--surface-2);
}
.format-tab:hover iconify-icon,
.format-tab:hover .format-label {
  color: var(--text-primary);
}

.format-tab.active {
  background: var(--accent-glow);
  border-color: rgba(0, 217, 255, 0.2);
}
.format-tab.active iconify-icon {
  color: var(--accent-primary);
}
.format-tab.active .format-label {
  color: var(--text-primary);
}
.format-tab.active .format-ratio {
  color: var(--accent-primary);
}

.format-preview {
  display: flex;
  justify-content: center;
  padding: 12px 14px;
}

.preview-box {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-2);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.preview-box iconify-icon {
  font-size: 20px;
  color: var(--text-muted);
}
.preview-box.fullscreen {
  width: 80px;
  height: 45px;
}
.preview-box.mobile {
  width: 36px;
  height: 64px;
}
.preview-box.square {
  width: 56px;
  height: 56px;
}

/* ── Mic toggle row ─────────────────────────────────────────── */
.mic-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  border-top: 1px solid var(--glass-border);
}

.mic-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}

.mic-label iconify-icon {
  font-size: 14px;
  color: var(--text-muted);
}

.mic-toggle {
  position: relative;
  width: 32px;
  height: 18px;
  border-radius: 9px;
  border: none;
  cursor: pointer;
  transition: background 0.2s ease;
  background: var(--surface-3, #333);
  flex-shrink: 0;
}

.mic-toggle.on {
  background: var(--accent-primary, #00d9ff);
}

.mic-toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: white;
  transition: transform 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  display: block;
}

.mic-toggle.on .mic-toggle-knob {
  transform: translateX(14px);
}

/* ── Start button ───────────────────────────────────────────── */
.start-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: calc(100% - 16px);
  margin: 8px;
  margin-top: 4px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 16px rgba(239, 68, 68, 0.3);
}

.start-btn iconify-icon {
  font-size: 16px;
  color: white;
}
.start-btn span {
  font-size: 12px;
  font-weight: 600;
  color: white;
}
.start-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(239, 68, 68, 0.4);
}
.start-btn:active {
  transform: translateY(0);
}

/* Popover transition */
.popover-enter-active,
.popover-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.popover-enter-from,
.popover-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
}

/* ── Preview Modal ────────────────────────────────────────────── */
.preview-backdrop {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.preview-modal {
  width: min(680px, 94vw);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  box-shadow: var(--glass-shadow);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--glass-border);
}

.preview-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.preview-title iconify-icon {
  font-size: 16px;
  color: var(--accent-primary);
}

.preview-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--text-muted);
}

.preview-close:hover {
  background: var(--surface-2);
  border-color: var(--glass-border);
  color: var(--text-primary);
}
.preview-close iconify-icon {
  font-size: 14px;
}

.preview-video-wrap {
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  max-height: 60vh;
}
.preview-video {
  display: block;
  width: 100%;
  max-height: 60vh;
  object-fit: contain;
}

.preview-actions {
  display: flex;
  gap: 10px;
  padding: 14px 16px;
  border-top: 1px solid var(--glass-border);
}

.preview-discard-btn,
.preview-download-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.preview-discard-btn {
  flex: 0 0 auto;
  background: transparent;
  border-color: var(--glass-border);
  color: var(--text-muted);
}

.preview-discard-btn:hover {
  background: var(--surface-2);
  color: var(--text-primary);
}
.preview-discard-btn iconify-icon {
  font-size: 15px;
}

.preview-download-btn {
  flex: 1;
  background: linear-gradient(135deg, var(--accent-primary) 0%, #00a8c8 100%);
  color: #000;
  box-shadow: 0 4px 16px rgba(0, 217, 255, 0.25);
}

.preview-download-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 24px rgba(0, 217, 255, 0.35);
}
.preview-download-btn iconify-icon {
  font-size: 15px;
}

/* Preview modal transition */
.preview-modal-enter-active,
.preview-modal-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.preview-modal-enter-from,
.preview-modal-leave-to {
  opacity: 0;
}
.preview-modal-enter-from .preview-modal,
.preview-modal-leave-to .preview-modal {
  transform: scale(0.95) translateY(12px);
}
</style>
