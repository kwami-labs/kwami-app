/**
 * Sign in with an injected browser wallet.
 *
 * Supabase implements Sign-in-with-Solana / Sign-in-with-Ethereum natively, so
 * Phantom and MetaMask need no extra dependency — they default to
 * `window.solana` and `window.ethereum`, the same handles the wallet panel
 * already uses.
 *
 * WalletConnect is deliberately absent: it has no Supabase equivalent and
 * would need @reown/appkit plus a Cloud project id.
 */
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { supabase } from '@/lib/supabase';
import type { SolanaProvider } from '@/types/wallet-providers';

export type Web3Wallet = 'phantom' | 'metamask';

/**
 * Where to send someone who does not have the extension yet.
 *
 * Phantom's own docs do exactly this — `window.open(...)` when the provider is
 * missing — and give this as the install link.
 */
const WALLET_INSTALL_URLS: Record<Web3Wallet, string> = {
  phantom: 'https://phantom.app/download',
  metamask: 'https://metamask.io/download/',
};

export function useWeb3SignIn() {
  const { t } = useI18n();
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  /**
   * Set when the wallet is missing, so the button can render a real link.
   * The tab below is opened for them, but pop-up blockers get a vote; this is
   * the fallback that always works.
   */
  const installUrl = ref<string | null>(null);

  /**
   * Phantom's Solana provider, or undefined when it is not installed.
   *
   * `window.phantom.solana` first: `window.solana` is claimed by whichever
   * Solana wallet injects first, so with two extensions installed it can be
   * Backpack or Solflare while Phantom is present and perfectly usable.
   */
  function phantomProvider(): SolanaProvider | undefined {
    const namespaced = window.phantom?.solana;
    if (namespaced?.isPhantom) return namespaced;
    return window.solana?.isPhantom ? window.solana : undefined;
  }

  function isAvailable(wallet: Web3Wallet): boolean {
    return wallet === 'phantom' ? Boolean(phantomProvider()) : Boolean(window.ethereum);
  }

  async function signIn(wallet: Web3Wallet) {
    // Check before calling Supabase so a missing extension takes people to the
    // download page rather than surfacing an opaque SDK error.
    if (!isAvailable(wallet)) {
      const url = WALLET_INSTALL_URLS[wallet];
      installUrl.value = url;
      error.value = t('auth.walletNotFound', { wallet: walletLabel(wallet) });
      // Runs before any `await`, so this is still inside the click's user
      // gesture and is not treated as an unsolicited pop-up. `noopener` keeps
      // the new tab from reaching back through `window.opener`.
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    isLoading.value = true;
    error.value = null;
    installUrl.value = null;
    try {
      // The statement must not contain newlines; Phantom requires one.
      const statement = t('auth.web3Statement');
      const { error: authError } =
        wallet === 'phantom'
          ? await supabase.auth.signInWithWeb3({
              chain: 'solana',
              statement,
              // Passing the provider explicitly rather than letting auth-js fall
              // back to window.solana, which may be a different wallet.
              wallet: phantomProvider(),
            })
          : await supabase.auth.signInWithWeb3({ chain: 'ethereum', statement });

      if (authError) error.value = authError.message;
    } catch (e: unknown) {
      console.error(`${wallet} sign-in error:`, e);
      error.value = e instanceof Error ? e.message : 'Wallet sign-in failed.';
    } finally {
      isLoading.value = false;
    }
  }

  function walletLabel(wallet: Web3Wallet): string {
    return wallet === 'phantom' ? 'Phantom' : 'MetaMask';
  }

  return { signIn, isAvailable, isLoading, error, installUrl };
}
