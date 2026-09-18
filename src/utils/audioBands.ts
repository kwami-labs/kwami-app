/**
 * Splitting an analyser's byte-frequency data into the three bands the avatar
 * renderers speak.
 *
 * `BlobXyz` reads the analyser itself, inside the SDK, so it never needs this.
 * Black-hole, particles-face and eye-iris do not: they want
 * `setAudioLevels(bass, mid, high)` pushed at them once a frame. Both the
 * settings panel's music player and the login screen do that pushing, and they
 * have to split the spectrum the same way or the same track would move the two
 * avatars differently.
 */

export interface BandLevels {
  /** 0–1. */
  bass: number;
  /** 0–1. */
  mid: number;
  /** 0–1. */
  high: number;
}

export const SILENCE: BandLevels = { bass: 0, mid: 0, high: 0 };

/**
 * Mean magnitude of the low tenth, the next three tenths, and the rest of the
 * spectrum, each normalised to 0–1.
 *
 * @param frequencyData - As handed back by `AnalyserNode.getByteFrequencyData`.
 */
export function getBandLevels(frequencyData: Uint8Array): BandLevels {
  if (!frequencyData.length) {
    return { ...SILENCE };
  }

  const length = frequencyData.length;
  const bassEnd = Math.max(1, Math.floor(length * 0.1));
  const midEnd = Math.max(bassEnd + 1, Math.floor(length * 0.4));

  let bassSum = 0;
  let midSum = 0;
  let highSum = 0;

  for (let i = 0; i < bassEnd; i += 1) bassSum += frequencyData[i] ?? 0;
  for (let i = bassEnd; i < midEnd; i += 1) midSum += frequencyData[i] ?? 0;
  for (let i = midEnd; i < length; i += 1) highSum += frequencyData[i] ?? 0;

  return {
    bass: bassSum / bassEnd / 255,
    mid: midSum / Math.max(1, midEnd - bassEnd) / 255,
    high: highSum / Math.max(1, length - midEnd) / 255,
  };
}
