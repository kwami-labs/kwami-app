/**
 * How often the login screen's avatar reinvents itself.
 *
 * `WelcomeBlob` owns the randomize loop, and `SoundtrackPill` owns the button
 * that sets its pace — they are siblings under `AuthPage` with no props
 * between them, so the rate lives here. Module-level state, matching the
 * welcome audio registration in `useSoundtrack.ts`.
 */

import { computed, ref, type ComputedRef, type Ref } from 'vue';

/** The rates the pill cycles through, in milliseconds. */
export const RANDOMIZE_INTERVALS_MS = [1_000, 2_000, 3_000, 5_000, 10_000, 30_000, 60_000] as const;

const DEFAULT_INTERVAL_MS = RANDOMIZE_INTERVALS_MS[0];

const intervalMs = ref<number>(DEFAULT_INTERVAL_MS);

export interface WelcomeRandomizer {
  /** The live rate. `WelcomeBlob` watches this and re-arms its timer. */
  intervalMs: Ref<number>;
  /** The same rate in whole seconds, for the button face and its label. */
  intervalSeconds: ComputedRef<number>;
  /** Step to the next rate, wrapping back to the fastest. */
  cycleInterval: () => void;
}

export function useWelcomeRandomizer(): WelcomeRandomizer {
  const intervalSeconds = computed(() => Math.round(intervalMs.value / 1_000));

  function cycleInterval() {
    // indexOf rather than a stored cursor: the rate is plain module state, and
    // anything may have set it to a value that is not the one we handed out.
    const current = RANDOMIZE_INTERVALS_MS.indexOf(
      intervalMs.value as (typeof RANDOMIZE_INTERVALS_MS)[number],
    );
    const next = (current + 1) % RANDOMIZE_INTERVALS_MS.length;
    intervalMs.value = RANDOMIZE_INTERVALS_MS[next]!;
  }

  return { intervalMs, intervalSeconds, cycleInterval };
}
