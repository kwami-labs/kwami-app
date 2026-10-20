/**
 * Supabase OAuth sign-in with popup, and redirect fallback when blocked.
 *
 * Shared by every OAuth button so none re-implements the popup / blocked-popup /
 * poll-for-close / timeout dance. Inside the Tauri desktop shell neither works (see
 * desktopAuth.ts): the provider opens in the system browser and the deep link returns.
 */
import { onUnmounted, ref } from 'vue';
import type { Provider } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { isTauri } from '@/lib/platform';
import {
  AUTH_CALLBACK_EVENT,
  openOAuthInBrowser,
  type AuthCallbackDetail,
} from '@/lib/desktopAuth';
import { useAuthStore } from '@/stores/auth';

const POPUP_WIDTH = 500;
const POPUP_HEIGHT = 600;
const POPUP_POLL_MS = 500;
const POPUP_TIMEOUT_MS = 300_000;
/** Some browsers hand back a window reference and still block the popup. */
const BLOCKED_POPUP_GRACE_MS = 250;
/**
 * Back in the desktop window with no session yet: the deep link, if one is coming, focuses
 * the window before its code is exchanged, so wait that long before calling it abandoned.
 */
const DESKTOP_RETURN_GRACE_MS = 3_000;

export function useOAuthSignIn() {
  const authStore = useAuthStore();
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  let popupRef: Window | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

  function clearTimers() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
      timeoutTimer = null;
    }
  }

  async function fallbackToRedirect(provider: Provider, oauthUrl?: string) {
    if (oauthUrl) {
      window.location.assign(oauthUrl);
      return;
    }
    const { error: redirectError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (redirectError) throw redirectError;
  }

  function onDesktopFocus() {
    setTimeout(() => {
      if (!authStore.isAuthenticated) isLoading.value = false;
    }, DESKTOP_RETURN_GRACE_MS);
  }

  async function signInDesktop(provider: Provider) {
    try {
      await openOAuthInBrowser(provider);
      // Closing the browser tab sends nothing back; returning to the window ends the wait.
      window.addEventListener('focus', onDesktopFocus, { once: true });
      timeoutTimer = setTimeout(() => {
        clearTimers();
        isLoading.value = false;
      }, POPUP_TIMEOUT_MS);
    } catch (e) {
      console.error(`${provider} desktop sign-in error:`, e);
      error.value = 'Unable to start sign-in. Please try again.';
      isLoading.value = false;
    }
  }

  async function signIn(provider: Provider) {
    isLoading.value = true;
    error.value = null;

    if (isTauri()) {
      await signInDesktop(provider);
      return;
    }

    try {
      const { data, error: authError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin,
          skipBrowserRedirect: true,
        },
      });

      if (authError) {
        error.value = authError.message;
        isLoading.value = false;
        return;
      }
      if (!data?.url) {
        isLoading.value = false;
        return;
      }

      const left = window.screenX + (window.outerWidth - POPUP_WIDTH) / 2;
      const top = window.screenY + (window.outerHeight - POPUP_HEIGHT) / 2;
      popupRef = window.open(
        data.url,
        `${provider}-auth-popup`,
        `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},popup=true`,
      );

      if (!popupRef) {
        await fallbackToRedirect(provider, data.url);
        return;
      }

      setTimeout(async () => {
        if (popupRef?.closed && !authStore.isAuthenticated && isLoading.value) {
          try {
            await fallbackToRedirect(provider, data.url);
          } catch (e) {
            console.error(`${provider} redirect fallback failed:`, e);
            error.value = 'Unable to start sign-in. Please try again.';
            isLoading.value = false;
          }
        }
      }, BLOCKED_POPUP_GRACE_MS);

      pollTimer = setInterval(() => {
        if (popupRef?.closed) {
          clearTimers();
          // Give the auth state a moment to arrive before declaring failure.
          setTimeout(() => {
            if (!authStore.isAuthenticated) isLoading.value = false;
          }, POPUP_POLL_MS);
        }
      }, POPUP_POLL_MS);

      timeoutTimer = setTimeout(() => {
        clearTimers();
        if (popupRef && !popupRef.closed) popupRef.close();
        isLoading.value = false;
      }, POPUP_TIMEOUT_MS);
    } catch (e) {
      console.error(`${provider} sign-in error:`, e);
      error.value = 'An error occurred. Please try again.';
      isLoading.value = false;
    }
  }

  function handleMessage(event: MessageEvent) {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type === 'supabase-auth-callback') {
      isLoading.value = false;
      clearTimers();
    }
  }

  function handleDesktopCallback(event: Event) {
    const { error: callbackError } = (event as CustomEvent<AuthCallbackDetail>).detail;
    isLoading.value = false;
    clearTimers();
    window.removeEventListener('focus', onDesktopFocus);
    if (callbackError) error.value = callbackError;
  }

  window.addEventListener('message', handleMessage);
  window.addEventListener(AUTH_CALLBACK_EVENT, handleDesktopCallback);
  onUnmounted(() => {
    window.removeEventListener('message', handleMessage);
    window.removeEventListener(AUTH_CALLBACK_EVENT, handleDesktopCallback);
    window.removeEventListener('focus', onDesktopFocus);
    clearTimers();
  });

  return { signIn, isLoading, error };
}
