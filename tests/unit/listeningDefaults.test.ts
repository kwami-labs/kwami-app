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
      minEndpointingDelay: 0.8,
      maxEndpointingDelay: 4,
    });
    expect(e.interruptions).toMatchObject({ enabled: true, minDuration: 0.4, minWords: 0 });
    expect(e.noiseCancellation).toMatchObject({ enabled: true, mode: 'bvc' });
    expect(e.vad).toMatchObject({ threshold: 0.5, minSpeech: 0.1, minSilence: 0.3 });
    expect(e.performance.preemptiveGeneration).toBe(true);
    // The agent's thinking sound is opt-in.
    expect(e.performance.thinkingSound).toBe(false);
  });

  it('keeps a thinking sound the user switched on with the saved settings', () => {
    const store = useVoiceStore();
    store.applySnapshot({ enhancementsState: { performance: { thinkingSound: true } } });
    expect(store.enhancementsState.performance.thinkingSound).toBe(true);
    expect(store.enhancementsState.performance.preemptiveGeneration).toBe(true);
    const saved = store.getSnapshot().enhancementsState as {
      performance: { thinkingSound: boolean };
    };
    expect(saved.performance.thinkingSound).toBe(true);
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

  it('raises the waits saved before they cut people off, once', () => {
    const store = useVoiceStore();
    const saved = { turnDetection: { minEndpointingDelay: 0.5, maxEndpointingDelay: 3 } };
    store.applySnapshot({ enhancementsState: saved });
    expect(store.enhancementsState.turnDetection.minEndpointingDelay).toBe(0.8);
    expect(store.enhancementsState.turnDetection.maxEndpointingDelay).toBe(4);
    const version = (store.getSnapshot().enhancementsState as { listeningVersion: number })
      .listeningVersion;
    store.applySnapshot({
      enhancementsState: { ...saved, listeningVersion: version },
    });
    expect(store.enhancementsState.turnDetection.minEndpointingDelay).toBe(0.5);
  });

  it('keeps the vocabulary with the saved settings', () => {
    const store = useVoiceStore();
    store.applySnapshot({ enhancementsState: { vocabulary: ['Nexow', 3] } });
    expect(store.enhancementsState.vocabulary).toEqual(['Nexow']);
    expect((store.getSnapshot().enhancementsState as { vocabulary: string[] }).vocabulary).toEqual([
      'Nexow',
    ]);
  });
});
