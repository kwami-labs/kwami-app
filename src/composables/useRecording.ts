export interface RecordingReadyDetail {
  url: string;
  mimeType: string;
  filename: string;
}

/** Region in CSS viewport pixels, as returned by the region picker */
export interface ViewportRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

function getSupportedMimeType(hasAudio: boolean): string {
  const candidates = hasAudio
    ? [
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8',
        'video/webm',
        'video/mp4',
      ]
    : ['video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm', 'video/mp4'];
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return 'video/webm';
}

/**
 * Build a single mixed audio stream from:
 *  1. App audio: KwamiAudio analyser output (music + Kwami voice visualisation signal)
 *  2. Kwami agent voice element (the LiveKit HTML audio playback — captured separately
 *     only when it is NOT already flowing through the analyser, to avoid duplication)
 *  3. Optional microphone
 *
 * All sources are routed through the SAME existing KwamiAudio AudioContext so
 * everything ends up on one MediaStreamDestinationNode and one audio track.
 */
async function buildAudioMix(
  includeMic: boolean,
): Promise<{ tracks: MediaStreamTrack[]; cleanup: () => void }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kwamiAudio = (window as any).kwami?.avatar?.getAudio?.();
  const ctx: AudioContext | null = kwamiAudio?.getAudioContext?.() ?? null;
  const analyser: AnalyserNode | null = kwamiAudio?.getAnalyser?.() ?? null;

  const cleanups: Array<() => void> = [];

  // ── Case A: no AudioContext yet (kwami not initialised) ──────────
  if (!ctx) {
    if (!includeMic) return { tracks: [], cleanup: () => {} };
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      return {
        tracks: micStream.getAudioTracks(),
        cleanup: () => micStream.getTracks().forEach((t) => t.stop()),
      };
    } catch {
      return { tracks: [], cleanup: () => {} };
    }
  }

  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {}
  }

  const destNode = ctx.createMediaStreamDestination();

  // ── 1. App audio via analyser (music + voice visualisation mix) ──
  if (analyser) {
    analyser.connect(destNode);
    cleanups.push(() => {
      try {
        analyser.disconnect(destNode);
      } catch {}
    });
  }

  // ── 2. Kwami agent voice element ─────────────────────────────────
  // Only tap it when voice is NOT already routed through the analyser
  // (isStreamConnected() === false) to avoid double-capturing.
  const streamConnected: boolean = kwamiAudio?.isStreamConnected?.() ?? false;
  if (!streamConnected) {
    const voiceEl = document.getElementById('kwami-agent-audio') as HTMLAudioElement | null;
    if (voiceEl?.srcObject instanceof MediaStream) {
      try {
        const voiceSrc = ctx.createMediaStreamSource(voiceEl.srcObject as MediaStream);
        voiceSrc.connect(destNode);
        cleanups.push(() => {
          try {
            voiceSrc.disconnect();
          } catch {}
        });
      } catch {}
    }
  }

  // ── 3. Optional microphone ───────────────────────────────────────
  if (includeMic) {
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const micSrc = ctx.createMediaStreamSource(micStream);
      micSrc.connect(destNode);
      cleanups.push(() => {
        try {
          micSrc.disconnect();
        } catch {}
        micStream.getTracks().forEach((t) => t.stop());
      });
    } catch {
      // Mic permission denied — continue without it
    }
  }

  return {
    tracks: destNode.stream.getAudioTracks(),
    cleanup: () => cleanups.forEach((fn) => fn()),
  };
}

export function useRecording() {
  /**
   * Records the kwami canvas cropped to `viewportRegion`, with app audio
   * always included and optional mic. Returns a stop() fn synchronously;
   * recording begins once audio setup completes (imperceptible delay).
   */
  function startCanvasRecording(
    viewportRegion: ViewportRegion,
    outputWidth: number,
    outputHeight: number,
    filename: string,
    includeMic: boolean,
    onReady: (detail: RecordingReadyDetail) => void,
  ): () => void {
    const srcCanvas = document.getElementById('kwami-canvas') as HTMLCanvasElement | null;
    if (!srcCanvas) {
      console.error('[useRecording] #kwami-canvas not found');
      return () => {};
    }

    // Convert viewport CSS coords → internal canvas pixel coords
    const rect = srcCanvas.getBoundingClientRect();
    const scaleX = srcCanvas.width / rect.width;
    const scaleY = srcCanvas.height / rect.height;

    let rx = (viewportRegion.x - rect.left) * scaleX;
    let ry = (viewportRegion.y - rect.top) * scaleY;
    let rw = viewportRegion.width * scaleX;
    let rh = viewportRegion.height * scaleY;

    rx = Math.max(0, Math.min(srcCanvas.width, rx));
    ry = Math.max(0, Math.min(srcCanvas.height, ry));
    rw = Math.min(srcCanvas.width - rx, Math.max(1, rw));
    rh = Math.min(srcCanvas.height - ry, Math.max(1, rh));

    const offscreen = document.createElement('canvas');
    offscreen.width = outputWidth;
    offscreen.height = outputHeight;
    const ctx = offscreen.getContext('2d')!;

    let animFrame = 0;
    function drawFrame() {
      ctx.drawImage(srcCanvas!, rx, ry, rw, rh, 0, 0, outputWidth, outputHeight);
      animFrame = requestAnimationFrame(drawFrame);
    }
    drawFrame();

    let recorderStopFn: () => void = () => {};
    let cancelled = false;

    buildAudioMix(includeMic).then(({ tracks, cleanup: audioCleanup }) => {
      if (cancelled) {
        audioCleanup();
        cancelAnimationFrame(animFrame);
        return;
      }

      const stream = offscreen.captureStream(30);
      tracks.forEach((t) => stream.addTrack(t));

      const hasAudio = stream.getAudioTracks().length > 0;
      const mimeType = getSupportedMimeType(hasAudio);
      const chunks: Blob[] = [];

      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        cancelAnimationFrame(animFrame);
        audioCleanup();
        stream.getTracks().forEach((t) => t.stop());
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const blob = new Blob(chunks, { type: mimeType });
        onReady({
          url: URL.createObjectURL(blob),
          mimeType,
          filename: filename.replace(/\.\w+$/, `.${ext}`),
        });
      };

      recorder.start(100);
      recorderStopFn = () => {
        if (recorder.state !== 'inactive') recorder.stop();
      };
    });

    return () => {
      cancelled = true;
      recorderStopFn();
    };
  }

  return { startCanvasRecording };
}
