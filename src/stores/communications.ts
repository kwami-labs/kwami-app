import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

const STORAGE_KEY = 'kwami-communications-config';

type Snapshot = {
  preferredVoiceChannelId: string | null;
  preferredWhatsappChannelId: string | null;
  preferredSmsChannelId: string | null;
  numberSearch: {
    countryCode: string;
    areaCode: string;
    contains: string;
  };
  compose: {
    callTarget: string;
    messageTarget: string;
    messageBody: string;
  };
};

function defaultSnapshot(): Snapshot {
  return {
    preferredVoiceChannelId: null,
    preferredWhatsappChannelId: null,
    preferredSmsChannelId: null,
    numberSearch: {
      countryCode: 'US',
      areaCode: '',
      contains: '',
    },
    compose: {
      callTarget: '',
      messageTarget: '',
      messageBody: '',
    },
  };
}

export const useCommunicationsStore = defineStore('communications', () => {
  const preferredVoiceChannelId = ref<string | null>(null);
  const preferredWhatsappChannelId = ref<string | null>(null);
  const preferredSmsChannelId = ref<string | null>(null);
  const numberSearch = ref(defaultSnapshot().numberSearch);
  const compose = ref(defaultSnapshot().compose);
  const phoneActivatedByKwami = ref<Record<string, boolean>>({});

  function applySnapshot(snapshot: Record<string, unknown>) {
    if (!snapshot) return;
    if (typeof snapshot.preferredVoiceChannelId === 'string' || snapshot.preferredVoiceChannelId === null) {
      preferredVoiceChannelId.value = snapshot.preferredVoiceChannelId as string | null;
    }
    if (typeof snapshot.preferredWhatsappChannelId === 'string' || snapshot.preferredWhatsappChannelId === null) {
      preferredWhatsappChannelId.value = snapshot.preferredWhatsappChannelId as string | null;
    }
    if (typeof snapshot.preferredSmsChannelId === 'string' || snapshot.preferredSmsChannelId === null) {
      preferredSmsChannelId.value = snapshot.preferredSmsChannelId as string | null;
    }
    if (snapshot.numberSearch && typeof snapshot.numberSearch === 'object') {
      numberSearch.value = { ...numberSearch.value, ...snapshot.numberSearch };
    }
    if (snapshot.compose && typeof snapshot.compose === 'object') {
      compose.value = { ...compose.value, ...snapshot.compose };
    }
  }

  function getSnapshot(): Snapshot {
    return {
      preferredVoiceChannelId: preferredVoiceChannelId.value,
      preferredWhatsappChannelId: preferredWhatsappChannelId.value,
      preferredSmsChannelId: preferredSmsChannelId.value,
      numberSearch: { ...numberSearch.value },
      compose: { ...compose.value },
    };
  }

  function loadSettings() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      applySnapshot(JSON.parse(saved) as Record<string, unknown>);
    } catch {
      /* ignore malformed local state */
    }
  }

  function saveSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(getSnapshot()));
  }

  function setKwamiPhoneActivated(kwamiId: string, activated: boolean) {
    if (!kwamiId) return;
    phoneActivatedByKwami.value[kwamiId] = activated;
  }

  function isKwamiPhoneActivated(kwamiId: string): boolean {
    if (!kwamiId) return false;
    return phoneActivatedByKwami.value[kwamiId] === true;
  }

  loadSettings();

  watch([preferredVoiceChannelId, preferredWhatsappChannelId, preferredSmsChannelId, numberSearch, compose], saveSettings, {
    deep: true,
  });

  return {
    preferredVoiceChannelId,
    preferredWhatsappChannelId,
    preferredSmsChannelId,
    numberSearch,
    compose,
    phoneActivatedByKwami,
    applySnapshot,
    getSnapshot,
    saveSettings,
    setKwamiPhoneActivated,
    isKwamiPhoneActivated,
  };
});
