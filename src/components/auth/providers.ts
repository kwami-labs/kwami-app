/**
 * Which sign-in providers this build offers.
 *
 * Gated by env rather than hardcoded: a provider that is not enabled in the
 * Supabase dashboard returns a 400, so rendering a button for it is worse than
 * not rendering it at all. Defaults to google, which is the one configured.
 *
 * Set VITE_AUTH_PROVIDERS to a comma-separated list, e.g.
 *   VITE_AUTH_PROVIDERS=google,github,phantom
 */
import type { Provider } from '@supabase/supabase-js';

export type Web2ProviderId = 'google' | 'apple' | 'azure' | 'github';
export type Web3ProviderId = 'phantom' | 'metamask';
export type ProviderId = Web2ProviderId | Web3ProviderId;

export interface ProviderDef {
  id: ProviderId;
  /** Supabase provider name; absent for wallet providers. */
  oauth?: Provider;
  icon: string;
  /** i18n key for the provider's display name. */
  labelKey: string;
}

export const WEB2_PROVIDERS: ProviderDef[] = [
  { id: 'google', oauth: 'google', icon: 'logos:google-icon', labelKey: 'auth.providerGoogle' },
  { id: 'apple', oauth: 'apple', icon: 'logos:apple', labelKey: 'auth.providerApple' },
  { id: 'azure', oauth: 'azure', icon: 'logos:microsoft-icon', labelKey: 'auth.providerMicrosoft' },
  { id: 'github', oauth: 'github', icon: 'mdi:github', labelKey: 'auth.providerGithub' },
];

export const WEB3_PROVIDERS: ProviderDef[] = [
  { id: 'metamask', icon: 'simple-icons:metamask', labelKey: 'auth.providerMetaMask' },
  { id: 'phantom', icon: 'simple-icons:phantom', labelKey: 'auth.providerPhantom' },
];

function enabledIds(): Set<string> {
  const raw = (import.meta.env.VITE_AUTH_PROVIDERS as string | undefined) ?? 'google';
  return new Set(
    raw
      .split(',')
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean),
  );
}

const enabled = enabledIds();

export const enabledWeb2Providers = WEB2_PROVIDERS.filter((p) => enabled.has(p.id));
export const enabledWeb3Providers = WEB3_PROVIDERS.filter((p) => enabled.has(p.id));
export const hasWeb3Providers = enabledWeb3Providers.length > 0;
