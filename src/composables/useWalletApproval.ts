/**
 * Whether the page is currently waiting on a wallet extension.
 *
 * An injected wallet provider is not a direct call. Phantom and MetaMask both
 * relay every request from the page to their extension over `postMessage`, and
 * the reply has to be delivered back on the page's own main thread — so a page
 * that never yields is a page the wallet cannot answer.
 *
 * That is what the login screen was doing. Measured against the SDK's real
 * `animateBlobXyz` at the resolution `WelcomeBlob` pins (160, which is 25,921
 * vertices), one frame of the avatar costs about 19 ms of main thread, with a
 * 95th percentile near 28 ms — 118% of a 60 Hz frame, back to back, before
 * Three.js draws anything or the video backdrop decodes. While an approval is
 * open the visitor is looking at the wallet, not at the avatar, and the page is
 * spending every millisecond it has on the one thing nobody is watching. Both
 * wallets eventually give up on the pending request and report it as a JSON-RPC
 * internal error, which is the "could not finish signing" both cards showed.
 *
 * So the page stands down while a wallet has the floor. This is the signal:
 * `useWeb3SignIn` raises it around the wallet call, and `WelcomeBlob` suspends
 * its animation for as long as it is up.
 *
 * A count rather than a flag. Nothing today can open two approvals at once —
 * the cards disable themselves — but a hold that is released by whoever
 * finishes first is a hold that lets the avatar back in while the other
 * approval is still open, and that failure would look exactly like the bug
 * this exists to fix.
 */
import { computed, readonly, ref } from 'vue';

const holds = ref(0);
const isAwaitingWallet = computed(() => holds.value > 0);

export interface WalletApproval {
  /** True while any wallet request is in flight. */
  isAwaitingWallet: Readonly<import('vue').Ref<boolean>>;
  /**
   * Run `work` with the page stood down.
   *
   * The hold is released in a `finally`, so a wallet that throws — or one the
   * visitor never answers — cannot leave the avatar frozen.
   */
  holdForWallet<T>(work: () => Promise<T>): Promise<T>;
}

async function holdForWallet<T>(work: () => Promise<T>): Promise<T> {
  holds.value += 1;
  try {
    return await work();
  } finally {
    holds.value = Math.max(0, holds.value - 1);
  }
}

export function useWalletApproval(): WalletApproval {
  return { isAwaitingWallet: readonly(isAwaitingWallet), holdForWallet };
}

/** Test seam: the count is module-scoped and would leak between specs. */
export function resetWalletApproval(): void {
  holds.value = 0;
}
