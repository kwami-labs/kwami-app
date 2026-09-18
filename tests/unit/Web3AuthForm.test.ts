import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import Web3AuthForm from '../../src/components/auth/Web3AuthForm.vue';
import { en } from '../../src/i18n/translations/en';
import { flushPromises } from '../helpers/mount';

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { signInWithWeb3: vi.fn() } },
}));

const { supabase } = await import('@/lib/supabase');
const signInWithWeb3 = vi.mocked(supabase.auth.signInWithWeb3);

const win = window as unknown as Record<string, unknown>;

beforeEach(() => {
  delete win.phantom;
  delete win.solana;
  delete win.ethereum;
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
    expect(wrapper.get('[aria-label="Continue with Phantom"]').text()).toContain('Solana');
    expect(wrapper.get('[aria-label="Continue with MetaMask"]').text()).toContain('Ethereum');
    expect(wrapper.text()).toContain(en.auth.walletMissing);
  });

  it('marks Phantom as detected when the namespaced provider is present', async () => {
    win.phantom = { solana: { isPhantom: true } };
    const wrapper = mount(Web3AuthForm);
    await wrapper.vm.$nextTick();

    const phantom = wrapper.get('[aria-label="Continue with Phantom"]');
    expect(phantom.text()).toContain(en.auth.walletDetected);
    expect(phantom.classes()).toContain('wallet-card--ready');
    expect(wrapper.get('[aria-label="Continue with MetaMask"]').text()).toContain(en.auth.walletMissing);
  });

  it('opens the store from the Phantom card when the extension is missing', async () => {
    const wrapper = mount(Web3AuthForm);

    await wrapper.get('[aria-label="Continue with Phantom"]').trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.get('.provider-error').text()).toContain('Phantom is not installed');
    expect(wrapper.get('.provider-install').attributes('href')).toBe(
      'https://chromewebstore.google.com/detail/phantom/bfnaelmomeimhlpmgjnjophhpkkoljpa',
    );
    expect(signInWithWeb3).not.toHaveBeenCalled();
  });
});
