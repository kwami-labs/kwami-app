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
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { supabase } from '@/lib/supabase';
import type { EthereumProvider, SolanaProvider } from '@/types/wallet-providers';

export type Web3Wallet = 'phantom' | 'metamask';

/**
 * Where a card without a usable wallet should send you.
 *
 * `install` is the extension listing; `app` is a universal link that reopens
 * this page inside the wallet's own in-app browser, which is the only place a
 * phone has a provider to inject.
 */
export type WalletLinkMode = 'install' | 'app';

export interface WalletLink {
  wallet: Web3Wallet;
  href: string;
  mode: WalletLinkMode;
}

/**
 * Where to send someone who does not have the extension yet.
 *
 * Phantom's own docs do exactly this — `window.open(...)` when the provider is
 * missing — but point at their download page, which is a marketing page you
 * then have to click through. This is the Chrome Web Store listing itself, so
 * the next click is Add to Chrome. On a non-Chromium browser the store cannot
 * install anything; phantom.com/download is the cross-browser page if that ever
 * matters more than the shorter path.
 */
const WALLET_INSTALL_URLS: Record<Web3Wallet, string> = {
  phantom: 'https://chromewebstore.google.com/detail/phantom/bfnaelmomeimhlpmgjnjophhpkkoljpa',
  metamask: 'https://metamask.io/download/',
};

/** MetaMask ships stable, Flask and Institutional; all announce under this. */
const METAMASK_RDNS = 'io.metamask';

/**
 * EIP-6963 discovery, module-scoped so every caller shares one listener.
 *
 * MetaMask's own docs are blunt about this: `window.ethereum` "might fail if
 * the user is running multiple wallet extensions simultaneously", because the
 * last injector wins. Phantom ships an EVM provider of its own, so the two
 * wallets this app offers are exactly the collision case — with Phantom
 * installed and MetaMask not, `window.ethereum` exists and the naive check
 * reports MetaMask as detected, then signs you in through Phantom.
 */
const announcedProviders = new Map<string, EthereumProvider>();
let listening = false;

function rememberAnnounced(event: WindowEventMap['eip6963:announceProvider']) {
  const detail = event.detail;
  if (detail?.info?.rdns && detail.provider) {
    announcedProviders.set(detail.info.rdns, detail.provider);
  }
}

/**
 * Ask every installed EVM wallet to announce itself.
 *
 * Wallets reply synchronously to the request event, but they only start
 * listening once their content script has run — so this is worth re-asking
 * rather than firing once at import time.
 */
export function requestEthereumProviders(): void {
  if (typeof window === 'undefined') return;
  if (!listening) {
    window.addEventListener('eip6963:announceProvider', rememberAnnounced);
    listening = true;
  }
  window.dispatchEvent(new Event('eip6963:requestProvider'));
}

/** Test seam: EIP-6963 state is module-scoped and would leak between specs. */
export function resetEthereumProviders(): void {
  announcedProviders.clear();
  if (listening && typeof window !== 'undefined') {
    window.removeEventListener('eip6963:announceProvider', rememberAnnounced);
  }
  listening = false;
}

export function useWeb3SignIn() {
  const { t } = useI18n();
  const isLoading = ref(false);
  /** Which wallet the current attempt is waiting on, so one card can say so. */
  const pendingWallet = ref<Web3Wallet | null>(null);
  const error = ref<string | null>(null);
  /**
   * Set when the wallet is missing, so the button can render a real link.
   * The tab below is opened for them, but pop-up blockers get a vote; this is
   * the fallback that always works.
   */
  const installLink = ref<WalletLink | null>(null);
  const installUrl = computed(() => installLink.value?.href ?? null);

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

  /**
   * MetaMask's EVM provider, or undefined. EIP-6963 first — it is the only
   * mechanism that survives two wallets — then the legacy `providers` stack,
   * then the bare global. The `isPhantom` guard on the last two is what stops
   * Phantom's EVM provider from passing as MetaMask.
   */
  function metamaskProvider(): EthereumProvider | undefined {
    for (const [rdns, provider] of announcedProviders) {
      if (rdns === METAMASK_RDNS || rdns.startsWith(`${METAMASK_RDNS}.`)) return provider;
    }
    const injected = window.ethereum;
    const stacked = injected?.providers?.find((p) => p.isMetaMask && !p.isPhantom);
    if (stacked) return stacked;
    return injected?.isMetaMask && !injected.isPhantom ? injected : undefined;
  }

  function isAvailable(wallet: Web3Wallet): boolean {
    return Boolean(wallet === 'phantom' ? phantomProvider() : metamaskProvider());
  }

  /**
   * True on a phone or tablet browser, where no extension can exist.
   *
   * `(pointer: coarse) and (hover: none)` rather than a UA sniff: a touchscreen
   * laptop still reports a fine primary pointer and hover, so it keeps the
   * desktop install path it can actually use.
   */
  function isHandheld(): boolean {
    return window.matchMedia?.('(pointer: coarse) and (hover: none)').matches ?? false;
  }

  /**
   * Reopen this page inside the wallet's in-app browser.
   *
   * Mobile Safari and mobile Chrome have no extensions, so the install link is
   * a dead end there — a Chrome Web Store page that cannot install anything.
   * Both wallets publish a universal link for exactly this, and the page that
   * opens on the other side does have an injected provider.
   */
  function inAppBrowserLink(wallet: Web3Wallet): string {
    const { href, origin, host, pathname, search } = window.location;
    return wallet === 'phantom'
      ? `https://phantom.app/ul/browse/${encodeURIComponent(href)}?ref=${encodeURIComponent(origin)}`
      : `https://link.metamask.io/dapp/${host}${pathname}${search}`;
  }

  /** Where this wallet's card should point when there is no provider to talk to. */
  function walletLink(wallet: Web3Wallet): WalletLink {
    return isHandheld()
      ? { wallet, href: inAppBrowserLink(wallet), mode: 'app' }
      : { wallet, href: WALLET_INSTALL_URLS[wallet], mode: 'install' };
  }

  async function signIn(wallet: Web3Wallet) {
    // Check before calling Supabase so a missing extension takes people to the
    // download page rather than surfacing an opaque SDK error.
    if (!isAvailable(wallet)) {
      const link = walletLink(wallet);
      installLink.value = link;
      error.value =
        link.mode === 'app'
          ? t('auth.walletOpenAppHint', { wallet: walletLabel(wallet) })
          : t('auth.walletNotFound', { wallet: walletLabel(wallet) });
      // Runs before any `await`, so this is still inside the click's user
      // gesture and is not treated as an unsolicited pop-up. `noopener` keeps
      // the new tab from reaching back through `window.opener`.
      window.open(link.href, '_blank', 'noopener,noreferrer');
      return;
    }

    isLoading.value = true;
    pendingWallet.value = wallet;
    error.value = null;
    installLink.value = null;
    try {
      // The statement must not contain newlines; Phantom requires one.
      const statement = t('auth.web3Statement');
      const { error: authError } =
        wallet === 'phantom'
          ? await signInWithPhantom(statement)
          : await supabase.auth.signInWithWeb3({
              chain: 'ethereum',
              statement,
              // Same reason, and the one that matters more: auth-js would reach
              // for window.ethereum, which is whichever wallet injected last.
              // auth-js types this as EIP1193Provider, which demands an
              // `address` field and the EIP-1193 event methods that no injected
              // provider actually exposes; it only ever calls `.request()`.
              wallet: metamaskProvider() as never,
            });

      if (authError) error.value = mapError(authError, wallet);
    } catch (e: unknown) {
      console.error(`${wallet} sign-in error:`, e);
      error.value = e instanceof Error ? mapError(e, wallet) : t('auth.web3Failed');
    } finally {
      isLoading.value = false;
      pendingWallet.value = null;
    }
  }

  /**
   * Connect, then hand Phantom to Supabase.
   *
   * `signInWithWeb3` calls the wallet's `signIn`, and Phantom's handler builds
   * the message it shows from its own state: it fills the address in from the
   * selected account, and for a site it does not trust yet it also records the
   * trust grant on the way back out. Connecting first settles both before the
   * signature, so what the user approves is a plain sign-in rather than a
   * combined connect-and-sign, and a wallet with no account selected fails here
   * — with Phantom's own reason — instead of inside the sign-in handler.
   */
  async function signInWithPhantom(statement: string) {
    const provider = phantomProvider();
    if (provider && !provider.isConnected) await provider.connect();
    return supabase.auth.signInWithWeb3({
      chain: 'solana',
      statement,
      // Passing the provider explicitly rather than letting auth-js fall back
      // to window.solana, which may be a different wallet.
      wallet: provider,
    });
  }

  function walletLabel(wallet: Web3Wallet): string {
    return wallet === 'phantom' ? 'Phantom' : 'MetaMask';
  }

  /**
   * GoTrue's "Web3 provider is disabled" is a dashboard switch, not a wallet
   * failure. Map that (and a user-cancelled signature) so the panel does not
   * dump the raw SDK string.
   */
  function mapError(err: { message?: string; code?: string | number }, wallet: Web3Wallet): string {
    const code = String(err.code ?? '');
    const message = (err.message ?? '').toLowerCase();
    if (code === 'web3_provider_disabled' || message.includes('web3 provider is disabled')) {
      return t('auth.web3ProviderDisabled');
    }
    if (
      message.includes('user rejected') ||
      message.includes('rejected the request') ||
      message.includes('user denied')
    ) {
      return t('auth.web3Rejected');
    }
    // The wallet's own handler threw. Everything the page is given is the
    // JSON-RPC internal-error code and the word "Unexpected", so say which
    // side failed rather than repeating a string that names no cause; the
    // wallet logs the real reason in its own service worker.
    if (code === '-32603' || message === 'unexpected error') {
      return t('auth.web3WalletError', { wallet: walletLabel(wallet) });
    }
    // `fetch` rejects with a bare TypeError for anything that never reached
    // the server: offline, a blocked request, or the tab reloading mid-flight.
    // The signature is already spent by then, so the retry has to be explicit.
    if (message.includes('failed to fetch') || message.includes('networkerror')) {
      return t('auth.web3NetworkFailed');
    }
    return err.message || t('auth.web3Failed');
  }

  return {
    signIn,
    isAvailable,
    isHandheld,
    walletLink,
    isLoading,
    pendingWallet,
    error,
    installLink,
    installUrl,
  };
}
