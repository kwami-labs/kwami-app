/**
 * The Enhancements panel's defaults are what the agent listens with.
 *
 * The agent used to ignore the panel and run its own Spanish tuning; now it
 * applies whatever the app sends on every connect, so a default here that
 * differs from that tuning silently replaces it.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useVoiceStore } from '@/stores/voice';

describe('listening defaults', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('match the agent tuning for Spanish conversation', () => {
    const e = useVoiceStore().enhancementsState;
    expect(e.turnDetection).toMatchObject({
      enabled: true,
      mode: 'model',
      minEndpointingDelay: 0.4,
      maxEndpointingDelay: 2.5,
    });
    expect(e.interruptions).toMatchObject({ enabled: true, minDuration: 0.4, minWords: 0 });
    expect(e.noiseCancellation).toMatchObject({ enabled: true, mode: 'bvc' });
    expect(e.vad).toMatchObject({ threshold: 0.5, minSpeech: 0.1, minSilence: 0.3 });
    expect(e.performance.preemptiveGeneration).toBe(true);
  });

  it('turn a saved manual turn mode into the model detector', () => {
    const store = useVoiceStore();
    store.applySnapshot({ enhancementsState: { turnDetection: { mode: 'manual' } } });
    expect(store.enhancementsState.turnDetection.mode).toBe('model');
  });

  it('keep the other saved turn modes', () => {
    const store = useVoiceStore();
    store.applySnapshot({ enhancementsState: { turnDetection: { mode: 'stt' } } });
    expect(store.enhancementsState.turnDetection.mode).toBe('stt');
  });
});
