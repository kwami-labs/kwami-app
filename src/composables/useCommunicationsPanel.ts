import { computed, ref, watch, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { panelIcons } from '@/constants/panel-icons';
import { useWorkspaceStore } from '@/stores/workspace';
import { useCommunicationsStore } from '@/stores/communications';
import {
  configureWhatsappChannel,
  fetchKwamiCommunications,
  purchaseKwamiNumber,
  releaseKwamiPhone,
  searchKwamiNumbers,
  sendSmsMessage,
  sendWhatsappMessage,
  startOutboundCall,
  startTwilioDirectTestCall,
  type ChannelRecord,
  type KwamiCommunicationsSnapshot,
  type NumberSearchResult,
} from '@/composables/useCommunicationsApi';

export type CommunicationsPanelMode = 'all' | 'phone' | 'whatsapp' | 'sms';

export function useCommunicationsPanel(mode: Ref<CommunicationsPanelMode>) {
  const workspaceStore = useWorkspaceStore();
  const communicationsStore = useCommunicationsStore();
  const { t } = useI18n();

  const loading = ref(false);
  const searching = ref(false);
  const purchasing = ref(false);
  const releasing = ref(false);
  const showReleaseConfirm = ref(false);
  const callingTwilioDirect = ref(false);
  const callingWithAgent = ref(false);
  const sending = ref(false);
  const snapshot = ref<KwamiCommunicationsSnapshot | null>(null);
  const snapshotByKwami = ref<Record<string, KwamiCommunicationsSnapshot>>({});
  const suggestedNumber = ref<NumberSearchResult | null>(null);
  const error = ref('');
  const statusMessage = ref('');
  const whatsappSender = ref('');
  let loadNonce = 0;

  const activeKwamiId = computed(() => workspaceStore.activeWorkspaceId);
  const activeKwamiName = computed(() => workspaceStore.getActiveWorkspace()?.name || 'Kwami');
  const panelTitle = computed(() => {
    if (mode.value === 'phone') return t('sidebar.panels.phone');
    if (mode.value === 'whatsapp') return t('sidebar.panels.whatsapp');
    if (mode.value === 'sms') return t('sidebar.panels.sms');
    return t('communications.title');
  });
  const panelIcon = computed(() => {
    if (mode.value === 'phone') return panelIcons.phone;
    if (mode.value === 'whatsapp') return panelIcons.whatsapp;
    if (mode.value === 'sms') return panelIcons.sms;
    return panelIcons.communications;
  });
  const showOverview = computed(() => mode.value === 'all');
  const showPhoneSections = computed(() => mode.value === 'all' || mode.value === 'phone');
  const showWhatsappSections = computed(() => mode.value === 'all' || mode.value === 'whatsapp');
  const showSmsSections = computed(() => mode.value === 'all' || mode.value === 'sms');
  const showPhoneOperations = computed(() => mode.value === 'all' || mode.value === 'phone');

  const voiceChannels = computed(() =>
    (snapshot.value?.channels || []).filter((channel) => channel.kind === 'voice_phone'),
  );
  const whatsappChannels = computed(() =>
    (snapshot.value?.channels || []).filter((channel) => channel.kind === 'whatsapp'),
  );
  const smsChannels = computed(() =>
    (snapshot.value?.channels || []).filter((channel) => channel.kind === 'sms'),
  );
  const recentCalls = computed(() => snapshot.value?.events.calls || []);
  const recentMessages = computed(() => snapshot.value?.events.messages || []);

  const selectedVoiceChannel = computed<ChannelRecord | null>(() => {
    const channels = voiceChannels.value;
    if (channels.length === 0) return null;
    const preferred = communicationsStore.preferredVoiceChannelId;
    return channels.find((channel) => channel.id === preferred) || channels[0] || null;
  });
  const selectedWhatsappChannel = computed<ChannelRecord | null>(() => {
    const channels = whatsappChannels.value;
    if (channels.length === 0) return null;
    const preferred = communicationsStore.preferredWhatsappChannelId;
    return channels.find((channel) => channel.id === preferred) || channels[0] || null;
  });
  const selectedSmsChannel = computed<ChannelRecord | null>(() => {
    const channels = smsChannels.value;
    if (channels.length === 0) return null;
    const preferred = communicationsStore.preferredSmsChannelId;
    return channels.find((channel) => channel.id === preferred) || channels[0] || null;
  });
  const isPhoneClaimed = computed(() => Boolean(selectedVoiceChannel.value));

  watch(selectedVoiceChannel, (channel) => {
    communicationsStore.preferredVoiceChannelId = channel?.id || null;
  });
  watch(selectedWhatsappChannel, (channel) => {
    communicationsStore.preferredWhatsappChannelId = channel?.id || null;
    whatsappSender.value = channel?.provider_sender || '';
  });
  watch(selectedSmsChannel, (channel) => {
    communicationsStore.preferredSmsChannelId = channel?.id || null;
  });

  watch(
    activeKwamiId,
    (kwamiId) => {
      error.value = '';
      statusMessage.value = '';
      suggestedNumber.value = null;
      if (!kwamiId) {
        snapshot.value = null;
        return;
      }
      void loadCommunications(kwamiId);
    },
    { immediate: true },
  );

  async function loadCommunications(kwamiId: string) {
    const requestNonce = ++loadNonce;
    loading.value = true;
    error.value = '';
    snapshot.value = snapshotByKwami.value[kwamiId] ?? null;
    try {
      const data = await fetchKwamiCommunications(kwamiId);
      if (requestNonce !== loadNonce) return;
      snapshotByKwami.value[kwamiId] = data;
      snapshot.value = data;
      communicationsStore.setKwamiPhoneActivated(
        kwamiId,
        data.channels.some((channel) => channel.kind === 'voice_phone'),
      );
    } catch (err) {
      if (requestNonce !== loadNonce) return;
      error.value = err instanceof Error ? err.message : String(err);
    } finally {
      if (requestNonce !== loadNonce) return;
      loading.value = false;
    }
  }

  async function searchNumbers() {
    if (!activeKwamiId.value) return;
    searching.value = true;
    error.value = '';
    statusMessage.value = '';
    try {
      const results = await searchKwamiNumbers(activeKwamiId.value, {
        countryCode: communicationsStore.numberSearch.countryCode || 'US',
        limit: 20,
      });
      if (!results.length) {
        suggestedNumber.value = null;
        statusMessage.value = '';
        error.value = `No numbers are currently available for ${communicationsStore.numberSearch.countryCode || 'US'}.`;
        return;
      }

      const index = Math.floor(Math.random() * results.length);
      // results is non-empty here (guarded above), so this always resolves.
      suggestedNumber.value = results[index] ?? results[0] ?? null;
      statusMessage.value = `Found a number for ${communicationsStore.numberSearch.countryCode || 'US'}.`;
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
    } finally {
      searching.value = false;
    }
  }

  async function refreshSuggestedNumber() {
    const previous = suggestedNumber.value?.phoneNumber;
    await searchNumbers();
    if (suggestedNumber.value && previous && suggestedNumber.value.phoneNumber === previous) {
      statusMessage.value = 'Refreshed search. Twilio returned the same top candidate; refresh again for another try.';
    }
  }

  async function buyNumber(phoneNumber?: string) {
    if (!activeKwamiId.value) return;
    const selected = (phoneNumber || suggestedNumber.value?.phoneNumber || '').trim();
    if (!selected) {
      error.value = 'Find a number first, then purchase it.';
      return;
    }
    purchasing.value = true;
    error.value = '';
    try {
      await purchaseKwamiNumber({
        kwamiId: activeKwamiId.value,
        phoneNumber: selected,
        displayName: `${activeKwamiName.value} Line`,
        countryCode: communicationsStore.numberSearch.countryCode || 'US',
      });
      statusMessage.value = `Assigned ${selected} to ${activeKwamiName.value}. WhatsApp and SMS are now active for this kwami.`;
      suggestedNumber.value = null;
      await loadCommunications(activeKwamiId.value);
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
    } finally {
      purchasing.value = false;
    }
  }

  async function enableWhatsappSender() {
    if (!selectedWhatsappChannel.value) return;
    error.value = '';
    statusMessage.value = '';
    try {
      await configureWhatsappChannel({
        channelId: selectedWhatsappChannel.value.id,
        status: 'active',
        providerSender: whatsappSender.value || selectedWhatsappChannel.value.provider_sender || undefined,
        metadata: { configuredFromPanel: true },
      });
      statusMessage.value = 'Updated WhatsApp sender configuration.';
      if (activeKwamiId.value) await loadCommunications(activeKwamiId.value);
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
    }
  }

  function openReleaseConfirm() {
    if (!activeKwamiId.value || !selectedVoiceChannel.value) return;
    error.value = '';
    showReleaseConfirm.value = true;
  }

  async function confirmReleasePhone() {
    if (!activeKwamiId.value || !selectedVoiceChannel.value) {
      showReleaseConfirm.value = false;
      return;
    }
    releasing.value = true;
    error.value = '';
    statusMessage.value = '';
    try {
      await releaseKwamiPhone({
        kwamiId: activeKwamiId.value,
        channelId: selectedVoiceChannel.value.id,
        releaseProviderResources: true,
      });
      statusMessage.value = 'Phone number released.';
      showReleaseConfirm.value = false;
      await loadCommunications(activeKwamiId.value);
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
    } finally {
      releasing.value = false;
    }
  }

  async function placeTwilioDirectCall() {
    if (!activeKwamiId.value || !canPlaceOutboundCall.value) return;
    callingTwilioDirect.value = true;
    error.value = '';
    statusMessage.value = '';
    try {
      await startTwilioDirectTestCall({
        kwamiId: activeKwamiId.value,
        toNumber: communicationsStore.compose.callTarget.trim(),
        channelId: selectedVoiceChannel.value?.id,
      });
      statusMessage.value =
        'Twilio test call started (PSTN only — no LiveKit or agent). You should hear a short voice message.';
      await loadCommunications(activeKwamiId.value);
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
    } finally {
      callingTwilioDirect.value = false;
    }
  }

  async function placeCallWithAgent() {
    if (!activeKwamiId.value || !canPlaceOutboundCall.value) return;
    callingWithAgent.value = true;
    error.value = '';
    statusMessage.value = '';
    try {
      await startOutboundCall({
        kwamiId: activeKwamiId.value,
        toNumber: communicationsStore.compose.callTarget.trim(),
        channelId: selectedVoiceChannel.value?.id,
        waitUntilAnswered: true,
      });
      statusMessage.value = 'Outbound call with Kwami agent queued (LiveKit + SIP).';
      await loadCommunications(activeKwamiId.value);
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
    } finally {
      callingWithAgent.value = false;
    }
  }

  async function sendMessage() {
    if (!activeKwamiId.value || !communicationsStore.compose.messageTarget.trim()) return;
    sending.value = true;
    error.value = '';
    statusMessage.value = '';
    try {
      await sendWhatsappMessage({
        kwamiId: activeKwamiId.value,
        toNumber: communicationsStore.compose.messageTarget.trim(),
        body: communicationsStore.compose.messageBody.trim(),
        channelId: selectedWhatsappChannel.value?.id,
      });
      statusMessage.value = 'WhatsApp message sent.';
      communicationsStore.compose.messageBody = '';
      await loadCommunications(activeKwamiId.value);
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
    } finally {
      sending.value = false;
    }
  }

  async function sendSms() {
    if (!activeKwamiId.value || !communicationsStore.compose.messageTarget.trim()) return;
    sending.value = true;
    error.value = '';
    statusMessage.value = '';
    try {
      await sendSmsMessage({
        kwamiId: activeKwamiId.value,
        toNumber: communicationsStore.compose.messageTarget.trim(),
        body: communicationsStore.compose.messageBody.trim(),
        channelId: selectedSmsChannel.value?.id,
      });
      statusMessage.value = t('communications.smsSent');
      communicationsStore.compose.messageBody = '';
      await loadCommunications(activeKwamiId.value);
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
    } finally {
      sending.value = false;
    }
  }

  function refreshCurrentKwami() {
    if (activeKwamiId.value) void loadCommunications(activeKwamiId.value);
  }

  const voiceInfrastructureNote = computed(() => {
    const metadata = (selectedVoiceChannel.value?.metadata || {}) as Record<string, unknown>;
    const sharedInfrastructure = (metadata.sharedInfrastructure || {}) as Record<string, unknown>;
    const notes = Array.isArray(sharedInfrastructure.notes) ? sharedInfrastructure.notes : [];
    if (notes.length > 0 && typeof notes[0] === 'string') return notes[0];
    if (selectedVoiceChannel.value?.status === 'routing_pending') {
      return 'The number has been purchased, but the shared LiveKit caller-ID sync is still pending.';
    }
    return 'Numbers bought here are synced onto shared platform trunks automatically. You do not need to pre-register each kwami number in the LiveKit dashboard.';
  });

  const voiceOutboundCapabilityStale = computed(() => {
    const caps = selectedVoiceChannel.value?.capabilities as Record<string, unknown> | undefined;
    return Boolean(caps && caps.outbound === false);
  });
  const canPlaceOutboundCall = computed(
    () =>
      Boolean(selectedVoiceChannel.value && communicationsStore.compose.callTarget.trim()),
  );
  const anyCallInProgress = computed(() => callingTwilioDirect.value || callingWithAgent.value);

  return {
    communicationsStore,
    activeKwamiId,
    activeKwamiName,
    panelTitle,
    panelIcon,
    showOverview,
    showPhoneSections,
    showWhatsappSections,
    showSmsSections,
    showPhoneOperations,
    loading,
    searching,
    purchasing,
    releasing,
    showReleaseConfirm,
    callingTwilioDirect,
    callingWithAgent,
    sending,
    snapshot,
    suggestedNumber,
    error,
    statusMessage,
    whatsappSender,
    voiceChannels,
    whatsappChannels,
    smsChannels,
    recentCalls,
    recentMessages,
    isPhoneClaimed,
    selectedVoiceChannel,
    selectedWhatsappChannel,
    selectedSmsChannel,
    voiceInfrastructureNote,
    voiceOutboundCapabilityStale,
    canPlaceOutboundCall,
    anyCallInProgress,
    searchNumbers,
    refreshSuggestedNumber,
    buyNumber,
    enableWhatsappSender,
    openReleaseConfirm,
    confirmReleasePhone,
    placeTwilioDirectCall,
    placeCallWithAgent,
    sendMessage,
    sendSms,
    refreshCurrentKwami,
  };
}
