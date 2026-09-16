/**
 * Supabase OAuth sign-in with popup, and redirect fallback when blocked.
 *
 * Extracted from GoogleButton so the other providers do not each re-implement
 * the popup / blocked-popup / poll-for-close / timeout dance.
 */
import { onUnmounted, ref } from 'vue';
import type { Provider } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';

const POPUP_WIDTH = 500;
const POPUP_HEIGHT = 600;
const POPUP_POLL_MS = 500;
const POPUP_TIMEOUT_MS = 300_000;
/** Some browsers hand back a window reference and still block the popup. */
const BLOCKED_POPUP_GRACE_MS = 250;

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

  async function signIn(provider: Provider) {
    isLoading.value = true;
    error.value = null;

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

  window.addEventListener('message', handleMessage);
  onUnmounted(() => {
    window.removeEventListener('message', handleMessage);
    clearTimers();
  });

  return { signIn, isLoading, error };
}
