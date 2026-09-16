import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { supabase } from '@/lib/supabase';
import type { User, Session, AuthError } from '@supabase/supabase-js';


export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const session = ref<Session | null>(null);
  const loading = ref(true);
  const error = ref<string | null>(null);

  // Getters
  const isAuthenticated = computed(() => !!user.value);
  const userId = computed(() => user.value?.id || null);
  const userEmail = computed(() => user.value?.email || null);

  // Check if we're running in a popup window (opened for OAuth)
  function isInPopup(): boolean {
    return !!(window.opener && window.opener !== window);
  }

  // Handle popup OAuth callback - notify parent and close
  function handlePopupCallback(session: Session) {
    if (window.opener) {
      // Send session info to parent window
      window.opener.postMessage(
        { type: 'supabase-auth-callback', session },
        window.location.origin
      );
      // Close popup after small delay to ensure message is sent
      setTimeout(() => window.close(), 100);
    }
  }

  // Initialize auth state listener
  function initAuth() {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      session.value = initialSession;
      user.value = initialSession?.user ?? null;
      loading.value = false;
      
      // If we're in a popup and have a session, notify parent and close
      if (isInPopup() && initialSession) {
        handlePopupCallback(initialSession);
        return;
      }
      
      // Clean up URL hash after OAuth callback (Supabase returns tokens in hash)
      if (window.location.hash && window.location.hash.includes('access_token')) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    });

    // Listen for auth changes
    supabase.auth.onAuthStateChange((event, newSession) => {
      session.value = newSession;
      user.value = newSession?.user ?? null;
      loading.value = false;
      
      // If we're in a popup and just signed in, notify parent and close
      if (isInPopup() && event === 'SIGNED_IN' && newSession) {
        handlePopupCallback(newSession);
        return;
      }
      
      // Clean up URL hash after auth state change
      if (window.location.hash) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    });

    // Listen for messages from OAuth popup (if we're the parent)
    window.addEventListener('message', (event) => {
      // Verify origin for security
      if (event.origin !== window.location.origin) return;
      
      if (event.data?.type === 'supabase-auth-callback' && event.data?.session) {
        // Update our session from the popup's callback
        session.value = event.data.session;
        user.value = event.data.session.user;
        loading.value = false;
      }
    });
  }

  // Sign in with Google ID token (for popup flow)
  async function signInWithGoogleIdToken(idToken: string) {
    loading.value = true;
    error.value = null;

    try {
      const { data, error: authError } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (authError) {
        error.value = authError.message;
        return { success: false, error: authError };
      }

      user.value = data.user;
      session.value = data.session;
      return { success: true, data };
    } catch (e) {
      const err = e as AuthError;
      error.value = err.message;
      return { success: false, error: err };
    } finally {
      loading.value = false;
    }
  }

  // Sign out
  async function signOut() {
    loading.value = true;
    error.value = null;

    try {
      const { error: authError } = await supabase.auth.signOut();

      if (authError) {
        error.value = authError.message;
        return { success: false, error: authError };
      }

      user.value = null;
      session.value = null;
      return { success: true };
    } catch (e) {
      const err = e as AuthError;
      error.value = err.message;
      return { success: false, error: err };
    } finally {
      loading.value = false;
    }
  }

  // Get current access token (for API calls)
  async function getAccessToken(): Promise<string | null> {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  // Clear error
  function clearError() {
    error.value = null;
  }

  return {
    // State
    user,
    session,
    loading,
    error,
    // Getters
    isAuthenticated,
    userId,
    userEmail,
    // Actions
    initAuth,
    signInWithGoogleIdToken,
    signOut,
    getAccessToken,
    clearError,
  };
});
