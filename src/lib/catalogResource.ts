/**
 * Cached, de-duplicated catalogue fetches (models, voices, languages).
 *
 * These endpoints return static-ish provider catalogues that several panels
 * request at once. The previous implementation repeated the same
 * fetch-cache-swallow block 19 times across three composables and shared one
 * module-level `isLoading` per file, which produced two real bugs:
 *
 *  - The first request's `finally` cleared the flag while its siblings were
 *    still in flight, so the four model tabs flashed "loaded" and rendered
 *    empty lists.
 *  - The cache was written after `await`, so four tabs mounting together fired
 *    four identical requests for the same URL.
 *
 * Loading is ref-counted rather than boolean because fetchProvider('openai')
 * and fetchProvider('deepgram') legitimately overlap within one resource.
 */
import { computed, ref, type ComputedRef } from 'vue';
import { api, ApiError } from '@/lib/apiClient';

const CATALOG_TIMEOUT_MS = 10_000;

interface LoadingCounter {
  readonly flag: ComputedRef<boolean>;
  begin(): void;
  end(): void;
}

function createLoadingCounter(): LoadingCounter {
  const pending = ref(0);
  return {
    flag: computed(() => pending.value > 0),
    begin: () => {
      pending.value += 1;
    },
    end: () => {
      pending.value = Math.max(0, pending.value - 1);
    },
  };
}

export interface SimpleResource<T> {
  data: ComputedRef<T | null>;
  isLoading: ComputedRef<boolean>;
  error: ComputedRef<string | null>;
  fetch(): Promise<T | null>;
  clear(): void;
}

/**
 * A single cached GET.
 *
 * Failures resolve to `null` rather than throwing: every caller renders a
 * bundled fallback catalogue, so throwing would blank the panel.
 */
export function createSimpleResource<T>(opts: {
  path: string;
  label: string;
  timeoutMs?: number;
}): SimpleResource<T> {
  const data = ref<T | null>(null) as { value: T | null };
  const errorRef = ref<string | null>(null);
  const loading = createLoadingCounter();
  let inflight: Promise<T | null> | null = null;

  async function load(): Promise<T | null> {
    if (data.value) return data.value;
    if (inflight) return inflight;

    loading.begin();
    errorRef.value = null;
    inflight = api
      .get<T>(opts.path, { timeoutMs: opts.timeoutMs ?? CATALOG_TIMEOUT_MS })
      .then((result) => {
        data.value = result;
        return result;
      })
      .catch((e: unknown) => {
        errorRef.value = `Failed to fetch ${opts.label}: ${
          e instanceof Error ? e.message : String(e)
        }`;
        console.error(errorRef.value);
        return null;
      })
      .finally(() => {
        loading.end();
        inflight = null;
      });

    return inflight;
  }

  return {
    data: computed(() => data.value),
    isLoading: loading.flag,
    error: computed(() => errorRef.value),
    fetch: load,
    clear() {
      data.value = null;
      errorRef.value = null;
    },
  };
}

export interface CatalogResource<TAll, TOne> {
  all: ComputedRef<TAll | null>;
  isLoading: ComputedRef<boolean>;
  error: ComputedRef<string | null>;
  fetchAll(): Promise<TAll | null>;
  fetchProvider(provider: string): Promise<TOne | null>;
  clear(): void;
}

/**
 * A catalogue with both an all-providers endpoint and per-provider detail.
 *
 * `fetchProvider` hydrates from the already-loaded `all` payload when it can,
 * and treats a 404 as "this provider has no entry" rather than an error —
 * matching the behaviour the hand-written copies had.
 */
export function createCatalogResource<TAll extends object, TOne>(opts: {
  path: string;
  label: string;
  providerPath?: (provider: string) => string;
  pickProvider?: (all: TAll, provider: string) => TOne | undefined;
  timeoutMs?: number;
}): CatalogResource<TAll, TOne> {
  const timeoutMs = opts.timeoutMs ?? CATALOG_TIMEOUT_MS;
  const providerPath = opts.providerPath ?? ((p: string) => `${opts.path}/${p}`);
  const pickProvider =
    opts.pickProvider ??
    ((all: TAll, provider: string) =>
      (all as { providers?: Record<string, TOne> }).providers?.[provider]);

  const all = ref<TAll | null>(null) as { value: TAll | null };
  const byProvider = ref<Record<string, TOne>>({}) as { value: Record<string, TOne> };
  const errorRef = ref<string | null>(null);
  const loading = createLoadingCounter();
  const inflight = new Map<string, Promise<unknown>>();

  function track<T>(key: string, run: () => Promise<T>): Promise<T> {
    const existing = inflight.get(key) as Promise<T> | undefined;
    if (existing) return existing;
    loading.begin();
    const p = run().finally(() => {
      loading.end();
      inflight.delete(key);
    });
    inflight.set(key, p);
    return p;
  }

  async function fetchAll(): Promise<TAll | null> {
    if (all.value) return all.value;
    return track('__all__', async () => {
      errorRef.value = null;
      try {
        const result = await api.get<TAll>(opts.path, { timeoutMs });
        all.value = result;
        return result;
      } catch (e: unknown) {
        errorRef.value = `Failed to fetch ${opts.label}: ${
          e instanceof Error ? e.message : String(e)
        }`;
        console.error(errorRef.value);
        return null;
      }
    });
  }

  async function fetchProvider(provider: string): Promise<TOne | null> {
    const cached = byProvider.value[provider];
    if (cached) return cached;

    if (all.value) {
      const fromAll = pickProvider(all.value, provider);
      if (fromAll) {
        byProvider.value = { ...byProvider.value, [provider]: fromAll };
        return fromAll;
      }
    }

    return track(provider, async () => {
      try {
        const result = await api.get<TOne>(providerPath(provider), { timeoutMs });
        byProvider.value = { ...byProvider.value, [provider]: result };
        return result;
      } catch (e: unknown) {
        // A 404 means the provider simply has no catalogue entry — expected,
        // not an error state the UI should surface.
        if (ApiError.is(e) && e.status === 404) {
          console.warn(`No ${opts.label} entry for provider "${provider}"`);
          return null;
        }
        errorRef.value = `Failed to fetch ${opts.label} for ${provider}: ${
          e instanceof Error ? e.message : String(e)
        }`;
        console.error(errorRef.value);
        return null;
      }
    });
  }

  return {
    all: computed(() => all.value),
    isLoading: loading.flag,
    error: computed(() => errorRef.value),
    fetchAll,
    fetchProvider,
    clear() {
      all.value = null;
      byProvider.value = {};
      errorRef.value = null;
    },
  };
}
