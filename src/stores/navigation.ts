import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useNavigationStore = defineStore('navigation', () => {
  const isActive = ref(false);
  const currentUrl = ref('');
  const currentTitle = ref('');
  const isLoading = ref(false);
  const liveUrl = ref('');

  const hasNavigation = computed(() => isActive.value);

  function updateState(state: { url?: string; title?: string; isLoading?: boolean; liveUrl?: string }) {
    if (state.url !== undefined) {
      currentUrl.value = state.url;
      if (state.url) isActive.value = true;
    }
    if (state.title !== undefined) currentTitle.value = state.title;
    if (state.isLoading !== undefined) isLoading.value = state.isLoading;
    if (state.liveUrl !== undefined) liveUrl.value = state.liveUrl;
  }

  function end() {
    isActive.value = false;
    currentUrl.value = '';
    currentTitle.value = '';
    isLoading.value = false;
    liveUrl.value = '';
  }

  return {
    isActive,
    currentUrl,
    currentTitle,
    isLoading,
    liveUrl,
    hasNavigation,
    updateState,
    end,
  };
});
