/**
 * Sign-in redirects for the Tauri desktop shell.
 *
 * In the webview `window.location.origin` is `http://tauri.localhost`, which neither Supabase's
 * redirect allow-list nor any provider knows, and Google refuses to sign in inside an embedded
 * webview at all. So the desktop app opens the provider in the system browser and gets the
 * result back through the `kwami://auth/callback` deep link, which carries a PKCE code this
 * window exchanges for a session (the verifier never left its localStorage).
 *
 * `kwami://auth/callback` must be listed under Authentication → URL Configuration → Redirect
 * URLs in the Supabase dashboard; otherwise Supabase sends the browser to the Site URL instead.
 */
import type { Provider } from '@supabase/supabase-js';
import { getCurrent, onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { openUrl } from '@tauri-apps/plugin-opener';
import { supabase } from '@/lib/supabase';
import { isTauri } from '@/lib/platform';

export const AUTH_CALLBACK_URL = 'kwami://auth/callback';

/** Window event fired once a deep-link callback has been handled; `detail.error` on failure. */
export const AUTH_CALLBACK_EVENT = 'kwami-auth-callback';

export interface AuthCallbackDetail {
  error?: string;
}

/** Where Supabase should send the user back to after OAuth or an email link. */
export function authRedirectUrl(): string {
  return isTauri() ? AUTH_CALLBACK_URL : window.location.origin;
}

/** Start an OAuth sign-in in the system browser. The session arrives via the deep link. */
export async function openOAuthInBrowser(provider: Provider): Promise<void> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: AUTH_CALLBACK_URL, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data?.url) throw new Error('Supabase returned no sign-in URL');
  await openUrl(data.url);
}

/**
 * getCurrent() keeps returning the URL that cold-started the app, so a reload of the webview
 * would replay a code that is already spent and report a bogus failure.
 */
const HANDLED_KEY = 'kwami:auth-callback-handled';

function alreadyHandled(code: string): boolean {
  try {
    if (sessionStorage.getItem(HANDLED_KEY) === code) return true;
    sessionStorage.setItem(HANDLED_KEY, code);
  } catch {
    // Storage unavailable: worst case a replay shows one stale error.
  }
  return false;
}

function emit(detail: AuthCallbackDetail) {
  window.dispatchEvent(new CustomEvent<AuthCallbackDetail>(AUTH_CALLBACK_EVENT, { detail }));
}

/** Handle one deep link. Ignores anything that is not the auth callback. */
export async function handleAuthCallback(raw: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return;
  }
  // `kwami://auth/callback` parses with host `auth` and path `/callback`.
  if (url.protocol !== 'kwami:' || url.host !== 'auth' || url.pathname !== '/callback') return;

  // Supabase reports failures in the query or the fragment depending on where it failed.
  const query = url.searchParams;
  const fragment = new URLSearchParams(url.hash.slice(1));
  const failure =
    query.get('error_description') ??
    fragment.get('error_description') ??
    query.get('error') ??
    fragment.get('error');
  if (failure) {
    emit({ error: failure });
    return;
  }

  const code = query.get('code');
  if (!code || alreadyHandled(code)) return;

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  emit(error ? { error: error.message } : {});
}

/** Route `kwami://` deep links to the auth callback. Call once, inside Tauri only. */
export async function listenForAuthCallbacks(): Promise<void> {
  const route = (urls: string[] | null) => {
    for (const url of urls ?? []) void handleAuthCallback(url);
  };
  route(await getCurrent());
  await onOpenUrl(route);
}
