<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { supabase } from '@/lib/supabase';
import BaseButton from '@/components/ui/BaseButton.vue';

const authStore = useAuthStore();
const isLoading = ref(false);
const error = ref<string | null>(null);
let popupRef: Window | null = null;

async function fallbackToRedirect(oauthUrl?: string) {
  // Keep UX clear when popup is blocked: continue with redirect auth.
  error.value = 'Popup blocked. Redirecting to Google sign-in...';

  if (oauthUrl) {
    window.location.assign(oauthUrl);
    return;
  }

  const { error: redirectError } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  });

  if (redirectError) {
    throw redirectError;
  }
}

// Use Supabase OAuth with popup by default, fallback to redirect if blocked
async function handleGoogleClick() {
  isLoading.value = true;
  error.value = null;

  try {
    const { data, error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        skipBrowserRedirect: true, // Don't redirect, we'll handle it
      },
    });

    if (authError) {
      error.value = authError.message;
      isLoading.value = false;
      return;
    }

    if (data?.url) {
      // Open Google auth in a popup window
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      popupRef = window.open(
        data.url,
        'google-auth-popup',
        `width=${width},height=${height},left=${left},top=${top},popup=true`,
      );

      if (!popupRef) {
        await fallbackToRedirect(data.url);
        return;
      }

      // Some browsers return a reference but still block the popup.
      setTimeout(async () => {
        if (popupRef && popupRef.closed && !authStore.isAuthenticated && isLoading.value) {
          try {
            await fallbackToRedirect(data.url);
          } catch (fallbackError) {
            console.error('Google redirect fallback error:', fallbackError);
            error.value = 'Unable to start Google sign-in. Please try again.';
            isLoading.value = false;
          }
        }
      }, 250);

      // Poll for popup close (as backup if message passing fails)
      const checkPopup = setInterval(() => {
        if (popupRef?.closed) {
          clearInterval(checkPopup);
          // Give a moment for auth state to update
          setTimeout(() => {
            if (!authStore.isAuthenticated) {
              isLoading.value = false;
            }
          }, 500);
        }
      }, 500);

      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(checkPopup);
        if (popupRef && !popupRef.closed) {
          popupRef.close();
        }
        isLoading.value = false;
      }, 300000);
    }
  } catch (e) {
    console.error('Google sign-in error:', e);
    error.value = 'An error occurred. Please try again.';
    isLoading.value = false;
  }
}

// Handle message from popup
function handleMessage(event: MessageEvent) {
  if (event.origin !== window.location.origin) return;

  if (event.data?.type === 'supabase-auth-callback') {
    isLoading.value = false;
    // Auth store will handle the session update
  }
}

onMounted(() => {
  window.addEventListener('message', handleMessage);
});

onUnmounted(() => {
  window.removeEventListener('message', handleMessage);
  if (popupRef && !popupRef.closed) {
    popupRef.close();
  }
});
</script>

<template>
  <div class="google-button-wrapper">
    <!-- Custom styled Google button -->
    <BaseButton variant="secondary" :loading="isLoading" block @click="handleGoogleClick">
      <template #default>
        <svg class="google-icon" viewBox="0 0 24 24" width="18" height="18">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        Continue with Google
      </template>
    </BaseButton>

    <!-- Error message -->
    <Transition name="fade">
      <div v-if="error" class="google-error">
        <iconify-icon icon="ph:warning-circle"></iconify-icon>
        <span>{{ error }}</span>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.google-button-wrapper {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.google-icon {
  margin-right: 10px;
  flex-shrink: 0;
}

.google-error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  background: var(--error-glow);
  border: 1px solid rgba(248, 113, 113, 0.3);
  border-radius: var(--radius-md);
  color: var(--error);
  font-size: 12px;
}

.google-error iconify-icon {
  font-size: 14px;
  flex-shrink: 0;
}

/* Fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
