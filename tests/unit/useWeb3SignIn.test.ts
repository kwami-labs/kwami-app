import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import {
  requestEthereumProviders,
  resetEthereumProviders,
  useWeb3SignIn,
} from '../../src/composables/useWeb3SignIn';
import { en } from '../../src/i18n/translations/en';

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { signInWithWeb3: vi.fn() } },
}));

const { supabase } = await import('@/lib/supabase');
const signInWithWeb3 = vi.mocked(supabase.auth.signInWithWeb3);

/** Mounts the composable in a throwaway component so useI18n has an app context. */
function harness() {
  const Host = defineComponent({
    setup: () => ({ web3: useWeb3SignIn() }),
    template: '<div />',
  });
  return mount(Host).vm.web3;
}

const win = window as unknown as Record<string, unknown>;
let openSpy: ReturnType<typeof vi.fn>;
const announcers: Array<() => void> = [];

/**
 * Impersonate an EIP-6963 wallet: reply to the discovery request the way a real
 * extension does, by announcing itself synchronously.
 */
function announceWallet(rdns: string, provider: Record<string, unknown>) {
  const reply = () =>
    window.dispatchEvent(
      new CustomEvent('eip6963:announceProvider', {
        detail: { info: { uuid: rdns, name: rdns, icon: '', rdns }, provider },
      }),
    );
  window.addEventListener('eip6963:requestProvider', reply);
  announcers.push(() => window.removeEventListener('eip6963:requestProvider', reply));
}

/**
 * A Solana wallet without SIWS: no `signIn`, so the app has to connect it
 * before auth-js can fall back to `signMessage`.
 *
 * Not what Phantom is any more — see the `signIn` cases below and
 * `web3SignInIntegration.test.ts` — but still the path an older wallet takes,
 * and a stub without `connect` would pass a test the app cannot.
 */
function phantomStub(overrides: Record<string, unknown> = {}) {
  const stub: Record<string, unknown> = {
    isPhantom: true,
    isConnected: false,
    connect: vi.fn(async () => {
      stub.isConnected = true;
      return { publicKey: { toString: () => 'stub' } };
    }),
    ...overrides,
  };
  return stub;
}

/** Pretend to be a phone: no hover, coarse pointer, therefore no extensions. */
function pretendHandheld(handheld: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: handheld && query.includes('coarse'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  announcers.splice(0).forEach((off) => off());
  resetEthereumProviders();
});

beforeEach(() => {
  delete win.phantom;
  delete win.solana;
  delete win.ethereum;
  resetEthereumProviders();
  signInWithWeb3.mockReset();
  signInWithWeb3.mockResolvedValue({ data: { user: {}, session: {} }, error: null } as never);
  openSpy = vi.fn(() => ({}) as Window);
  window.open = openSpy as unknown as typeof window.open;
});

describe('useWeb3SignIn when the wallet is missing', () => {
  it('opens the Phantom download page instead of dead-ending on an error', async () => {
    const web3 = harness();

    await web3.signIn('phantom');

    expect(openSpy).toHaveBeenCalledWith(
      'https://chromewebstore.google.com/detail/phantom/bfnaelmomeimhlpmgjnjophhpkkoljpa',
      '_blank',
      'noopener,noreferrer',
    );
    expect(signInWithWeb3).not.toHaveBeenCalled();
  });

  it('exposes the install URL so a blocked pop-up still leaves a usable link', async () => {
    const web3 = harness();

    await web3.signIn('phantom');

    expect(web3.installUrl.value).toBe(
      'https://chromewebstore.google.com/detail/phantom/bfnaelmomeimhlpmgjnjophhpkkoljpa',
    );
    expect(web3.error.value).toBe(
      en.auth.walletNotFound.replace('{wallet}', 'Phantom'),
    );
  });

  it('sends MetaMask to its own download page', async () => {
    const web3 = harness();

    await web3.signIn('metamask');

    expect(openSpy).toHaveBeenCalledWith(
      'https://metamask.io/download/',
      '_blank',
      'noopener,noreferrer',
    );
    expect(web3.installUrl.value).toBe('https://metamask.io/download/');
  });

  it('treats a foreign window.solana as Phantom being absent', async () => {
    // Backpack or Solflare injected first; Phantom really is not installed.
    win.solana = phantomStub({ isPhantom: false });
    const web3 = harness();

    await web3.signIn('phantom');

    expect(openSpy).toHaveBeenCalledOnce();
    expect(signInWithWeb3).not.toHaveBeenCalled();
  });
});

describe('useWeb3SignIn when the wallet is present', () => {
  it('signs in through the Phantom namespace and opens nothing', async () => {
    const phantom = phantomStub();
    win.phantom = { solana: phantom };
    const web3 = harness();

    await web3.signIn('phantom');

    expect(openSpy).not.toHaveBeenCalled();
    expect(signInWithWeb3).toHaveBeenCalledWith({
      chain: 'solana',
      statement: en.auth.web3Statement,
      wallet: phantom,
    });
    expect(web3.installUrl.value).toBeNull();
  });

  it('prefers window.phantom.solana over a foreign window.solana', async () => {
    const phantom = phantomStub();
    win.solana = phantomStub({ isPhantom: false });
    win.phantom = { solana: phantom };
    const web3 = harness();

    await web3.signIn('phantom');

    expect(signInWithWeb3).toHaveBeenCalledWith(
      expect.objectContaining({ wallet: phantom }),
    );
  });

  it('falls back to window.solana when it is Phantom itself', async () => {
    const phantom = phantomStub();
    win.solana = phantom;
    const web3 = harness();

    await web3.signIn('phantom');

    expect(signInWithWeb3).toHaveBeenCalledWith(
      expect.objectContaining({ wallet: phantom }),
    );
  });

  it('clears a previous install prompt on a later successful attempt', async () => {
    const web3 = harness();
    await web3.signIn('phantom');
    expect(web3.installUrl.value).not.toBeNull();

    win.phantom = { solana: phantomStub() };
    await web3.signIn('phantom');

    expect(web3.installUrl.value).toBeNull();
    expect(web3.error.value).toBeNull();
  });

  it('maps a disabled Web3 provider to the dashboard copy, not the raw SDK string', async () => {
    win.phantom = { solana: phantomStub() };
    signInWithWeb3.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Web3 provider is disabled', code: 'web3_provider_disabled' },
    } as never);
    const web3 = harness();

    await web3.signIn('phantom');

    expect(web3.error.value).toBe(en.auth.web3ProviderDisabled);
  });

  it('maps a cancelled wallet signature', async () => {
    win.phantom = { solana: phantomStub() };
    signInWithWeb3.mockRejectedValue(new Error('User rejected the request'));
    const web3 = harness();

    await web3.signIn('phantom');

    expect(web3.error.value).toBe(en.auth.web3Rejected);
  });

  it('connects a wallet that cannot sign in before handing it to Supabase', async () => {
    const phantom = phantomStub();
    win.phantom = { solana: phantom };
    const web3 = harness();

    await web3.signIn('phantom');

    expect(phantom.connect).toHaveBeenCalledOnce();
    expect(phantom.isConnected).toBe(true);
    expect(signInWithWeb3).toHaveBeenCalledWith(expect.objectContaining({ wallet: phantom }));
  });

  it('leaves the connecting to SIWS when the wallet can sign in', async () => {
    // One click is one approval. `signIn` connects and signs together, so
    // connecting first is a second request to the same extension for the same
    // click — which is what a wallet reports as an internal error rather than
    // as anything the page can act on.
    const phantom = phantomStub({ signIn: vi.fn(), isConnected: false });
    win.phantom = { solana: phantom };
    const web3 = harness();

    await web3.signIn('phantom');

    expect(phantom.connect).not.toHaveBeenCalled();
    expect(signInWithWeb3).toHaveBeenCalledWith(expect.objectContaining({ wallet: phantom }));
  });

  it('does not reconnect a wallet that is already connected', async () => {
    const phantom = phantomStub({ isConnected: true });
    win.phantom = { solana: phantom };
    const web3 = harness();

    await web3.signIn('phantom');

    expect(phantom.connect).not.toHaveBeenCalled();
    expect(signInWithWeb3).toHaveBeenCalledOnce();
  });

  it('names the wallet when its own handler throws instead of echoing "Unexpected error"', async () => {
    win.phantom = { solana: phantomStub() };
    signInWithWeb3.mockRejectedValue(
      Object.assign(new Error('Unexpected error'), { code: -32603 }),
    );
    const web3 = harness();

    await web3.signIn('phantom');

    expect(web3.error.value).toBe(
      en.auth.web3WalletError.replace('{wallet}', 'Phantom'),
    );
  });

  it('maps a fetch that never reached the auth server', async () => {
    win.ethereum = { isMetaMask: true, request: vi.fn() };
    signInWithWeb3.mockRejectedValue(new TypeError('Failed to fetch'));
    const web3 = harness();

    await web3.signIn('metamask');

    expect(web3.error.value).toBe(en.auth.web3NetworkFailed);
  });
});

describe('useWeb3SignIn MetaMask detection', () => {
  it('does not mistake another wallet on window.ethereum for MetaMask', () => {
    // Phantom injects an EVM provider too. Before EIP-6963 this read as
    // "MetaMask: Detected" and then signed you in through Phantom.
    win.ethereum = { isPhantom: true, request: vi.fn() };
    const web3 = harness();

    expect(web3.isAvailable('metamask')).toBe(false);
  });

  it('finds MetaMask through its EIP-6963 announcement', () => {
    const provider = { request: vi.fn() };
    announceWallet('io.metamask', provider);
    const web3 = harness();

    requestEthereumProviders();

    expect(web3.isAvailable('metamask')).toBe(true);
  });

  it('finds MetaMask behind a wallet that claimed window.ethereum first', () => {
    const metamask = { isMetaMask: true, request: vi.fn() };
    announceWallet('io.metamask', metamask);
    announceWallet('app.phantom', { isPhantom: true, request: vi.fn() });
    win.ethereum = { isPhantom: true, request: vi.fn() };
    const web3 = harness();

    requestEthereumProviders();

    expect(web3.isAvailable('metamask')).toBe(true);
  });

  it('still falls back to the legacy providers stack', () => {
    const metamask = { isMetaMask: true, request: vi.fn() };
    win.ethereum = { isPhantom: true, request: vi.fn(), providers: [metamask] };
    const web3 = harness();

    expect(web3.isAvailable('metamask')).toBe(true);
  });

  it('hands the discovered provider to Supabase rather than window.ethereum', async () => {
    const metamask = { request: vi.fn() };
    announceWallet('io.metamask', metamask);
    // The global belongs to someone else; auth-js would have used it.
    win.ethereum = { isPhantom: true, request: vi.fn() };
    const web3 = harness();
    requestEthereumProviders();

    await web3.signIn('metamask');

    expect(signInWithWeb3).toHaveBeenCalledWith({
      chain: 'ethereum',
      statement: en.auth.web3Statement,
      wallet: metamask,
    });
  });
});

describe('useWeb3SignIn on a handheld browser', () => {
  beforeEach(() => pretendHandheld(true));

  it('reopens the page in the Phantom app instead of the extension store', async () => {
    const web3 = harness();

    await web3.signIn('phantom');

    const expected = `https://phantom.app/ul/browse/${encodeURIComponent(
      window.location.href,
    )}?ref=${encodeURIComponent(window.location.origin)}`;
    expect(web3.installUrl.value).toBe(expected);
    expect(openSpy).toHaveBeenCalledWith(expected, '_blank', 'noopener,noreferrer');
    expect(web3.installLink.value?.mode).toBe('app');
  });

  it('reopens the page in the MetaMask app', async () => {
    const web3 = harness();

    await web3.signIn('metamask');

    const { host, pathname, search } = window.location;
    expect(web3.installUrl.value).toBe(`https://link.metamask.io/dapp/${host}${pathname}${search}`);
  });

  it('says the app is what is missing, not a browser extension', async () => {
    const web3 = harness();

    await web3.signIn('phantom');

    expect(web3.error.value).toBe(en.auth.walletOpenAppHint.replace('{wallet}', 'Phantom'));
  });

  it('keeps the extension store on a desktop pointer', async () => {
    pretendHandheld(false);
    const web3 = harness();

    await web3.signIn('phantom');

    expect(web3.installLink.value?.mode).toBe('install');
  });
});
