/**
 * The three voice pipelines and the combinations the panel refuses to build.
 *
 * Live + TTS needs a Live model that answers in text. Gemini's Live models
 * answer only in audio (1007 for a text session, measured with the agent's
 * voice lab on 2026-10-22), so the panel greys them out there and corrects a
 * saved or requested "Gemini Live + TTS" instead of leaving the agent silent.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { parseBrainStatus } from '@/lib/brain';
import {
  buildableMode,
  hybridModelFor,
  isPipelineMode,
  realtimeSpeaksText,
  usesLiveModel,
  usesTts,
} from '@/lib/voiceEngines';
import { engineSwitchFields } from '@/lib/agentConfigUpdate';
import { useVoiceStore } from '@/stores/voice';

const GEMINI_LIVE = { provider: 'google', model: 'gemini-3.1-flash-live-preview', voice: 'Charon' };

describe('which Live models answer in text', () => {
  it.each([
    ['openai', 'gpt-realtime'],
    ['openai', 'gpt-realtime-mini'],
    ['openai', 'openai/gpt-4o-realtime-preview'],
  ])('%s %s can speak through a TTS', (provider, model) => {
    expect(realtimeSpeaksText(provider, model)).toBe(true);
  });

  it.each([
    ['google', 'gemini-3.1-flash-live-preview'],
    ['gemini', 'gemini-3.8-live'],
    ['google', 'gemini-2.5-flash-native-audio-preview-12-2025'],
    ['openai', ''],
  ])('%s %s cannot', (provider, model) => {
    expect(realtimeSpeaksText(provider, model)).toBe(false);
  });

  it("follows the agent's own list when it sends one", () => {
    const status = parseBrainStatus({
      type: 'brain_status',
      hybridRealtime: { google: ['gemini-9'], openai: [] },
    });

    expect(realtimeSpeaksText('google', 'gemini-9-live', status)).toBe(true);
    expect(realtimeSpeaksText('openai', 'gpt-realtime', status)).toBe(false);
  });
});

describe('pipelines', () => {
  it('names the stages each one uses', () => {
    expect(usesLiveModel('hybrid')).toBe(true);
    expect(usesTts('hybrid')).toBe(true);
    expect(usesTts('realtime')).toBe(false);
    expect(usesLiveModel('stt-llm-tts')).toBe(false);
    expect(isPipelineMode('hybrid')).toBe(true);
    expect(isPipelineMode('quantum')).toBe(false);
  });

  it('builds Live + TTS on Gemini Live as Live, like the agent', () => {
    expect(buildableMode('hybrid', GEMINI_LIVE, null)).toBe('realtime');
    expect(buildableMode('hybrid', { provider: 'openai', model: 'gpt-realtime' }, null)).toBe(
      'hybrid',
    );
    expect(buildableMode('stt-llm-tts', GEMINI_LIVE, null)).toBe('stt-llm-tts');
  });

  it('offers gpt-realtime for Live + TTS unless the agent lacks its key', () => {
    expect(hybridModelFor(GEMINI_LIVE, null)?.model).toBe('gpt-realtime');
    const noOpenAI = parseBrainStatus({
      type: 'brain_status',
      voiceProviders: { realtime: { openai: false, google: true } },
    });
    expect(hybridModelFor(GEMINI_LIVE, noOpenAI)).toBeNull();
  });

  it('sends every engine field with a switch', () => {
    const fields = engineSwitchFields({
      stt: { provider: 'deepgram', model: 'nova-3', language: 'es' },
      llm: { provider: 'gemini', model: 'gemini-3.5-flash' },
      tts: { provider: 'gemini', model: 'gemini-3.1-flash-tts-preview', voice: 'Charon' },
      realtime: { provider: 'openai', model: 'gpt-realtime', voice: 'marin' },
    });

    expect(fields).toMatchObject({
      realtimeModel: 'gpt-realtime',
      tts_provider: 'gemini',
      tts_style: '',
      stt_language: 'es',
    });
  });
});

describe('the voice store', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('moves Live + TTS off Gemini Live and says so', () => {
    const store = useVoiceStore();
    store.updateRealtime({ ...GEMINI_LIVE });

    expect(store.setPipelineMode('hybrid')).toBe(true);

    expect(store.pipelineMode).toBe('hybrid');
    expect(store.realtime.model).toBe('gpt-realtime');
    expect(store.realtime.voice).toBe('marin');
    expect(store.engineNotice).toBe('hybridModelSwapped');
    expect(store.voiceConfig.type).toBe('hybrid');
  });

  it('refuses Live + TTS when no Live model can answer in text', () => {
    const store = useVoiceStore();
    store.applyBrainStatus({
      type: 'brain_status',
      voiceProviders: { realtime: { openai: false, google: true } },
    });

    expect(store.setPipelineMode('hybrid')).toBe(false);

    expect(store.pipelineMode).toBe('stt-llm-tts');
    expect(store.engineNotice).toBe('hybridUnavailable');
  });

  it('turns Live + TTS into Live when a Gemini Live model is picked', () => {
    const store = useVoiceStore();
    store.setPipelineMode('hybrid');

    store.updateRealtime({ ...GEMINI_LIVE });

    expect(store.pipelineMode).toBe('realtime');
    expect(store.engineNotice).toBe('liveAudioOnly');
  });

  it('loads a saved Gemini Live + TTS as Live', () => {
    const store = useVoiceStore();

    store.applySnapshot({ pipelineMode: 'hybrid', realtime: { ...GEMINI_LIVE } });

    expect(store.pipelineMode).toBe('realtime');
  });

  it('keeps a saved OpenAI Live + TTS', () => {
    const store = useVoiceStore();

    store.applySnapshot({
      pipelineMode: 'hybrid',
      realtime: { provider: 'openai', model: 'gpt-realtime', voice: 'marin' },
    });

    expect(store.pipelineMode).toBe('hybrid');
  });

  it('drops a cached agent report that is days old, so it cannot grey out Live + TTS', () => {
    const stale = parseBrainStatus({
      type: 'brain_status',
      voiceProviders: { realtime: { openai: false, google: true } },
    })!;
    localStorage.setItem(
      'kwami-brain-status',
      JSON.stringify({ ...stale, receivedAt: Date.now() - 9 * 24 * 3600 * 1000 }),
    );
    setActivePinia(createPinia());

    const store = useVoiceStore();

    expect(store.brainStatus).toBeNull();
    expect(store.setPipelineMode('hybrid')).toBe(true);
  });

  it('keeps a cached agent report from today', () => {
    const fresh = parseBrainStatus({
      type: 'brain_status',
      voiceProviders: { realtime: { openai: false, google: true } },
    })!;
    localStorage.setItem('kwami-brain-status', JSON.stringify(fresh));
    setActivePinia(createPinia());

    expect(useVoiceStore().brainStatus?.receivedAt).toBe(fresh.receivedAt);
  });

  it('ignores a saved pipeline it does not know', () => {
    const store = useVoiceStore();

    store.applySnapshot({ pipelineMode: 'quantum' });

    expect(store.pipelineMode).toBe('stt-llm-tts');
  });
});
