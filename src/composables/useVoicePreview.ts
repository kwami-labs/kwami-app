import { onBeforeUnmount, ref } from 'vue';
import { ApiError, api } from '@/lib/apiClient';
import { canHear, type PickableVoice } from '@/lib/voiceChoice';

/** Spoken samples, kept for the session: asking again would only wait on the network. */
const spoken = new Map<string, string>();

export type PreviewProblem = 'noKey' | 'failed';

async function sampleUrl(provider: string, voice: PickableVoice, lang: string): Promise<string> {
  if (voice.preview_url) return voice.preview_url;
  const key = `${provider}:${voice.id}:${lang}`;
  const known = spoken.get(key);
  if (known) return known;
  const audio = await api.get<Blob>('/voices/preview', {
    query: { provider, voice: voice.id, lang },
    parse: 'blob',
    // A sample is made once, by a provider that may take its time, and never retried.
    timeoutMs: 30_000,
    retry: false,
  });
  const url = URL.createObjectURL(audio);
  spoken.set(key, url);
  return url;
}

/** One voice at a time: its own sample, or one the API speaks for it. */
export function useVoicePreview() {
  const playing = ref<string | null>(null);
  const waiting = ref<string | null>(null);
  const problem = ref<{ voice: string; kind: PreviewProblem } | null>(null);
  let audio: HTMLAudioElement | null = null;
  /** A newer click wins: an older sample that arrives late stays silent. */
  let asked = 0;

  function stop() {
    asked += 1;
    audio?.pause();
    audio = null;
    playing.value = null;
    waiting.value = null;
  }

  async function toggle(provider: string, voice: PickableVoice, lang: string) {
    const again = playing.value === voice.id || waiting.value === voice.id;
    stop();
    problem.value = null;
    if (again || !canHear(provider, voice)) return;
    const ticket = asked;
    waiting.value = voice.id;
    try {
      const url = await sampleUrl(provider, voice, lang);
      if (ticket !== asked) return;
      audio = new Audio(url);
      audio.onended = stop;
      audio.onerror = () => {
        stop();
        problem.value = { voice: voice.id, kind: 'failed' };
      };
      waiting.value = null;
      playing.value = voice.id;
      await audio.play();
    } catch (e) {
      if (ticket !== asked) return;
      stop();
      const noKey = e instanceof ApiError && e.status === 503;
      problem.value = { voice: voice.id, kind: noKey ? 'noKey' : 'failed' };
    }
  }

  onBeforeUnmount(stop);
  return { playing, waiting, problem, toggle, stop };
}
