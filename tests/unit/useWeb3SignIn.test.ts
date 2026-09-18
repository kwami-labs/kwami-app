import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import { useWeb3SignIn } from '../../src/composables/useWeb3SignIn';
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

beforeEach(() => {
  delete win.phantom;
  delete win.solana;
  delete win.ethereum;
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
    win.solana = { isPhantom: false };
    const web3 = harness();

    await web3.signIn('phantom');

    expect(openSpy).toHaveBeenCalledOnce();
    expect(signInWithWeb3).not.toHaveBeenCalled();
  });
});

describe('useWeb3SignIn when the wallet is present', () => {
  it('signs in through the Phantom namespace and opens nothing', async () => {
    const phantom = { isPhantom: true };
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
    const phantom = { isPhantom: true };
    win.solana = { isPhantom: false };
    win.phantom = { solana: phantom };
    const web3 = harness();

    await web3.signIn('phantom');

    expect(signInWithWeb3).toHaveBeenCalledWith(
      expect.objectContaining({ wallet: phantom }),
    );
  });

  it('falls back to window.solana when it is Phantom itself', async () => {
    const phantom = { isPhantom: true };
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

    win.phantom = { solana: { isPhantom: true } };
    await web3.signIn('phantom');

    expect(web3.installUrl.value).toBeNull();
    expect(web3.error.value).toBeNull();
  });
});
