import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import Web3AuthForm from '../../src/components/auth/Web3AuthForm.vue';
import { resetEthereumProviders } from '../../src/composables/useWeb3SignIn';
import { en } from '../../src/i18n/translations/en';
import { flushPromises } from '../helpers/mount';

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { signInWithWeb3: vi.fn() } },
}));

const { supabase } = await import('@/lib/supabase');
const signInWithWeb3 = vi.mocked(supabase.auth.signInWithWeb3);

const win = window as unknown as Record<string, unknown>;

/** Phantom as the app meets it: connected on request, then handed to Supabase. */
function phantomStub() {
  const stub: Record<string, unknown> = {
    isPhantom: true,
    isConnected: false,
    connect: vi.fn(async () => {
      stub.isConnected = true;
      return { publicKey: { toString: () => 'stub' } };
    }),
  };
  return stub;
}

const realMatchMedia = window.matchMedia;

/** Pretend to be a phone: no hover, coarse pointer, therefore no extensions. */
function pretendHandheld() {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('coarse'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  window.matchMedia = realMatchMedia;
  resetEthereumProviders();
});

beforeEach(() => {
  delete win.phantom;
  delete win.solana;
  delete win.ethereum;
  resetEthereumProviders();
  window.open = vi.fn(() => ({}) as Window) as unknown as typeof window.open;
  signInWithWeb3.mockReset();
  signInWithWeb3.mockResolvedValue({ data: { user: {}, session: {} }, error: null } as never);
});

describe('Web3AuthForm', () => {
  it('renders a card for each enabled wallet with chain and status', () => {
    const wrapper = mount(Web3AuthForm);

    expect(wrapper.attributes('aria-label')).toBe(en.auth.web3FormLabel);
    expect(wrapper.text()).toContain(en.auth.web3Hint);
    expect(wrapper.text()).toContain(en.auth.web3Note);
    expect(wrapper.get('.wallet-card--phantom').text()).toContain('Solana');
    expect(wrapper.get('.wallet-card--metamask').text()).toContain('Ethereum');
    expect(wrapper.text()).toContain(en.auth.walletMissing);
  });

  it('marks Phantom as detected when the namespaced provider is present', async () => {
    win.phantom = { solana: phantomStub() };
    const wrapper = mount(Web3AuthForm);
    await wrapper.vm.$nextTick();

    const phantom = wrapper.get('.wallet-card--phantom');
    expect(phantom.text()).toContain(en.auth.walletDetected);
    expect(phantom.classes()).toContain('wallet-card--ready');
    expect(wrapper.get('.wallet-card--metamask').text()).toContain(en.auth.walletMissing);
  });

  it('opens the store from the Phantom card when the extension is missing', async () => {
    const wrapper = mount(Web3AuthForm);

    await wrapper.get('.wallet-card--phantom').trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.get('.provider-error').text()).toContain('Phantom is not installed');
    expect(wrapper.get('.provider-install').attributes('href')).toBe(
      'https://chromewebstore.google.com/detail/phantom/bfnaelmomeimhlpmgjnjophhpkkoljpa',
    );
    expect(signInWithWeb3).not.toHaveBeenCalled();
  });
});

describe('Web3AuthForm while a wallet is deciding', () => {
  it('names the wallet it is waiting on and leaves that card lit', async () => {
    win.phantom = { solana: phantomStub() };
    // Never settles: the panel has to say something for as long as the wallet
    // pop-up is open, which is the whole point of the pending state.
    signInWithWeb3.mockReturnValue(new Promise(() => {}) as never);
    const wrapper = mount(Web3AuthForm);

    await wrapper.get('.wallet-card--phantom').trigger('click');
    await wrapper.vm.$nextTick();

    const phantom = wrapper.get('.wallet-card--phantom');
    expect(phantom.text()).toContain('Approve in Phantom');
    expect(phantom.classes()).toContain('wallet-card--pending');
    expect(phantom.attributes('aria-busy')).toBe('true');
    expect(phantom.find('.wallet-card__spinner').exists()).toBe(true);

    // The other card is out of play, and says so by being disabled — not by
    // also claiming to be connecting.
    const metamask = wrapper.get('.wallet-card--metamask');
    expect(metamask.classes()).not.toContain('wallet-card--pending');
    expect(metamask.attributes('disabled')).toBeDefined();
  });

  it('drops the pending state once the attempt settles', async () => {
    win.phantom = { solana: phantomStub() };
    const wrapper = mount(Web3AuthForm);

    await wrapper.get('.wallet-card--phantom').trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.wallet-card--pending').exists()).toBe(false);
    expect(wrapper.find('.wallet-card__spinner').exists()).toBe(false);
  });
});

describe('Web3AuthForm on a handheld browser', () => {
  beforeEach(pretendHandheld);

  it('offers the wallet app rather than an extension it cannot install', () => {
    const wrapper = mount(Web3AuthForm);

    const phantom = wrapper.get('.wallet-card--phantom');
    expect(phantom.attributes('aria-label')).toBe('Open in Phantom');
    expect(phantom.text()).toContain(en.auth.walletActionOpenApp);
    // An extension can never exist here, so "Not installed" is not a status —
    // it is noise that wrapped the row onto four lines.
    expect(phantom.text()).not.toContain(en.auth.walletMissing);
  });

  it('links the fallback into the wallet app too', async () => {
    const wrapper = mount(Web3AuthForm);

    await wrapper.get('.wallet-card--phantom').trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    const fallback = wrapper.get('.provider-install');
    expect(fallback.attributes('href')).toContain('https://phantom.app/ul/browse/');
    expect(fallback.text()).toBe('Open in Phantom');
  });
});

describe('Web3AuthForm wallet detection', () => {
  it('does not call MetaMask detected when another wallet owns window.ethereum', async () => {
    win.ethereum = { isPhantom: true, request: vi.fn() };
    const wrapper = mount(Web3AuthForm);
    await wrapper.vm.$nextTick();

    expect(wrapper.get('.wallet-card--metamask').text()).toContain(
      en.auth.walletMissing,
    );
  });

  it('flips the card when a wallet announces itself late', async () => {
    const wrapper = mount(Web3AuthForm);
    await wrapper.vm.$nextTick();
    expect(wrapper.get('.wallet-card--metamask').text()).toContain(
      en.auth.walletMissing,
    );

    // A content script that finished after first paint: no poll, no focus, the
    // announcement alone has to be enough.
    window.dispatchEvent(
      new CustomEvent('eip6963:announceProvider', {
        detail: {
          info: { uuid: 'mm', name: 'MetaMask', icon: '', rdns: 'io.metamask' },
          provider: { request: vi.fn() },
        },
      }),
    );
    await wrapper.vm.$nextTick();

    const metamask = wrapper.get('.wallet-card--metamask');
    expect(metamask.text()).toContain(en.auth.walletDetected);
    expect(metamask.classes()).toContain('wallet-card--ready');
  });
});

describe('Web3AuthForm card labelling', () => {
  it('names the card after what pressing it does', async () => {
    const wrapper = mount(Web3AuthForm);

    expect(wrapper.get('.wallet-card--phantom').attributes('aria-label')).toBe('Install Phantom');

    win.phantom = { solana: phantomStub() };
    await wrapper.vm.$nextTick();
    // The poll is what re-reads window; nudge it the way a returning tab does.
    window.dispatchEvent(new Event('focus'));
    await wrapper.vm.$nextTick();

    expect(wrapper.get('.wallet-card--phantom').attributes('aria-label')).toBe(
      'Connect Phantom with Solana',
    );
  });

  it('keeps the visible chip short enough to sit beside the status', () => {
    const wrapper = mount(Web3AuthForm);

    const action = wrapper.get('.wallet-card--metamask .wallet-card__action');
    expect(action.text()).toBe(en.auth.walletActionInstall);
  });

  it('offers MetaMask as an Ethereum connect once the wallet is present', async () => {
    const wrapper = mount(Web3AuthForm);
    window.dispatchEvent(
      new CustomEvent('eip6963:announceProvider', {
        detail: {
          info: { uuid: 'mm', name: 'MetaMask', icon: '', rdns: 'io.metamask' },
          provider: { request: vi.fn() },
        },
      }),
    );
    await wrapper.vm.$nextTick();

    const metamask = wrapper.get('.wallet-card--metamask');
    expect(metamask.attributes('aria-label')).toBe('Connect MetaMask with Ethereum');
    expect(metamask.get('.wallet-card__badge').text()).toBe(en.auth.chainEthereum);
    expect(metamask.get('.wallet-card__cta').text()).toBe(en.auth.walletActionConnect);
  });
});
