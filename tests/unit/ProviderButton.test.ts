import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProviderButton from '../../src/components/auth/ProviderButton.vue';
import { WEB2_PROVIDERS, WEB3_PROVIDERS } from '../../src/components/auth/providers';
// ProviderButton reaches the auth store through useOAuthSignIn, so it needs a Pinia.
import { mountWithPinia, flushPromises } from '../helpers/mount';

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { signInWithWeb3: vi.fn(), signInWithOAuth: vi.fn() } },
}));

const phantom = WEB3_PROVIDERS.find((p) => p.id === 'phantom')!;
const metamask = WEB3_PROVIDERS.find((p) => p.id === 'metamask')!;
const github = WEB2_PROVIDERS.find((p) => p.id === 'github')!;

const win = window as unknown as Record<string, unknown>;

beforeEach(() => {
  delete win.phantom;
  delete win.solana;
  delete win.ethereum;
  window.open = vi.fn(() => ({}) as Window) as unknown as typeof window.open;
});

describe('ProviderButton branding', () => {
  it('gives Phantom the blue brand class', () => {
    const wrapper = mountWithPinia(ProviderButton, { props: { provider: phantom } });

    expect(wrapper.find('button').classes()).toContain('provider-btn--phantom');
  });

  it('leaves the other wallet on the shared secondary style', () => {
    const wrapper = mountWithPinia(ProviderButton, { props: { provider: metamask } });

    expect(wrapper.find('button').classes()).not.toContain('provider-btn--phantom');
    expect(wrapper.find('button').classes()).toContain('variant-secondary');
  });

  it('leaves OAuth providers on the shared secondary style', () => {
    const wrapper = mountWithPinia(ProviderButton, { props: { provider: github } });

    expect(wrapper.find('button').classes()).not.toContain('provider-btn--phantom');
  });
});

describe('ProviderButton install fallback', () => {
  it('renders no install link until a click finds the wallet missing', () => {
    const wrapper = mountWithPinia(ProviderButton, { props: { provider: phantom } });

    expect(wrapper.find('.provider-install').exists()).toBe(false);
  });

  it('offers a real link to the store after a click with no extension', async () => {
    const wrapper = mountWithPinia(ProviderButton, { props: { provider: phantom } });

    await wrapper.find('button').trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    const link = wrapper.find('.provider-install');
    expect(link.attributes('href')).toBe(
      'https://chromewebstore.google.com/detail/phantom/bfnaelmomeimhlpmgjnjophhpkkoljpa',
    );
    // Opening a store page must not hand it a handle back to the app.
    expect(link.attributes('rel')).toContain('noopener');
    expect(link.attributes('target')).toBe('_blank');
  });

  it('shows no install link when the wallet is present', async () => {
    win.phantom = { solana: { isPhantom: true } };
    const wrapper = mountWithPinia(ProviderButton, { props: { provider: phantom } });

    await wrapper.find('button').trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.provider-install').exists()).toBe(false);
  });
});
