import { computed, ref } from 'vue';
import { ApiError, api } from '@/lib/apiClient';
import type { Voice } from '@/composables/useVoicesApi';

/** A voice of ElevenLabs' public library, with what it takes to save it. */
export interface LibraryVoice extends Voice {
  owner_id: string;
  /** The name to save it under: the catalogue splits its tagline off again. */
  full_name: string;
  in_account: boolean;
}

export interface LibraryCapacity {
  tier: string | null;
  voice_slots_used: number;
  voice_limit: number;
  adds_used: number;
  adds_limit: number | null;
}

interface LibraryPage {
  voices: LibraryVoice[];
  has_more: boolean;
  total: number;
}

export interface LibraryFilters {
  search: string;
  language: string;
  gender: string;
}

export type LibraryProblem =
  'noRoom' | 'freePlan' | 'withdrawn' | 'keyRefused' | 'noKey' | 'rateLimited' | 'failed';

const PROBLEM_BY_CODE: Record<string, LibraryProblem> = {
  voice_no_room: 'noRoom',
  voice_free_plan: 'freePlan',
  voice_withdrawn: 'withdrawn',
  voice_key_refused: 'keyRefused',
  voice_library_no_key: 'noKey',
};

function problemOf(e: unknown): LibraryProblem {
  if (!ApiError.is(e)) return 'failed';
  if (e.status === 429) return 'rateLimited';
  const code = (e.body as { error?: { code?: string } } | null | undefined)?.error?.code;
  return PROBLEM_BY_CODE[code ?? ''] ?? 'failed';
}

/** Searching ElevenLabs' library and saving voices into the account: administrators only. */
export function useVoiceLibrary() {
  const allowed = ref(false);
  const capacity = ref<LibraryCapacity | null>(null);
  const voices = ref<LibraryVoice[]>([]);
  const total = ref(0);
  const hasMore = ref(false);
  const searching = ref(false);
  const searched = ref(false);
  const problem = ref<LibraryProblem | null>(null);
  const adding = ref<string | null>(null);
  const addProblem = ref<{ voice: string; kind: LibraryProblem } | null>(null);

  const outOfAdds = computed(() => {
    const room = capacity.value;
    return room?.adds_limit != null && room.adds_used >= room.adds_limit;
  });

  /** A newer question wins: an older answer is dropped. */
  let asked = 0;
  let askedAccess = 0;
  let filters: LibraryFilters = { search: '', language: 'all', gender: 'all' };
  let page = 0;

  /** Also after each add, because the plan's figures move with it. */
  async function checkAccess() {
    const ticket = ++askedAccess;
    try {
      const access = await api.get<{ allowed?: boolean; capacity?: LibraryCapacity | null }>(
        '/voices/library/access',
        { retry: false },
      );
      if (ticket !== askedAccess) return;
      allowed.value = access?.allowed === true;
      capacity.value = access?.capacity ?? null;
    } catch {
      // Not signed in, or the API is down: the library is simply not offered.
      if (ticket !== askedAccess) return;
      allowed.value = false;
      capacity.value = null;
    }
  }

  async function fetchPage(wanted: number) {
    const ticket = ++asked;
    searching.value = true;
    problem.value = null;
    addProblem.value = null;
    try {
      const answer = await api.get<LibraryPage>('/voices/library', {
        query: {
          search: filters.search.trim() || undefined,
          language: filters.language === 'all' ? undefined : filters.language,
          gender: filters.gender === 'all' ? undefined : filters.gender,
          page: wanted,
        },
        retry: false,
      });
      if (ticket !== asked) return;
      voices.value = wanted === 0 ? answer.voices : [...voices.value, ...answer.voices];
      total.value = answer.total;
      hasMore.value = answer.has_more;
      page = wanted;
    } catch (e) {
      if (ticket !== asked) return;
      if (wanted === 0) voices.value = [];
      hasMore.value = wanted !== 0 && hasMore.value;
      problem.value = problemOf(e);
    }
    searched.value = true;
    searching.value = false;
  }

  function search(next: LibraryFilters) {
    filters = { ...next };
    return fetchPage(0);
  }

  function more() {
    return fetchPage(page + 1);
  }

  /** Saves a voice; its id in the account, or null when it was refused. */
  async function add(voice: LibraryVoice): Promise<string | null> {
    adding.value = voice.id;
    addProblem.value = null;
    try {
      const saved = await api.post<{ id: string }>(
        `/voices/library/${encodeURIComponent(voice.owner_id)}/${encodeURIComponent(voice.id)}`,
        { name: voice.full_name },
        { retry: false },
      );
      voices.value = voices.value.map((v) =>
        v.id === voice.id ? { ...v, id: saved.id, in_account: true } : v,
      );
      void checkAccess();
      return saved.id;
    } catch (e) {
      addProblem.value = { voice: voice.id, kind: problemOf(e) };
      return null;
    } finally {
      adding.value = null;
    }
  }

  function reset() {
    asked += 1;
    askedAccess += 1;
    allowed.value = false;
    capacity.value = null;
    voices.value = [];
    total.value = 0;
    hasMore.value = false;
    searching.value = false;
    searched.value = false;
    problem.value = null;
    addProblem.value = null;
  }

  return {
    allowed,
    capacity,
    outOfAdds,
    voices,
    total,
    hasMore,
    searching,
    searched,
    problem,
    adding,
    addProblem,
    checkAccess,
    search,
    more,
    add,
    reset,
  };
}
