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

export type Web3Wallet = 'phantom' | 'metamask';

export function useWeb3SignIn() {
  const { t } = useI18n();
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  function isAvailable(wallet: Web3Wallet): boolean {
    return wallet === 'phantom'
      ? Boolean(window.solana?.isPhantom)
      : Boolean(window.ethereum);
  }

  async function signIn(wallet: Web3Wallet) {
    // Check before calling Supabase so a missing extension reads as "install
    // Phantom" rather than an opaque SDK error.
    if (!isAvailable(wallet)) {
      error.value = t('auth.walletNotFound', { wallet: walletLabel(wallet) });
      return;
    }

    isLoading.value = true;
    error.value = null;
    try {
      // The statement must not contain newlines; Phantom requires one.
      const statement = t('auth.web3Statement');
      const { error: authError } =
        wallet === 'phantom'
          ? await supabase.auth.signInWithWeb3({ chain: 'solana', statement })
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

  return { signIn, isAvailable, isLoading, error };
}
