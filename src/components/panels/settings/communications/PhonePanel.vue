<script setup lang="ts">
import { toRef } from 'vue';
import { useI18n } from 'vue-i18n';
import PanelSection from '@/components/ui/PanelSection.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import PanelHeaderControls from '@/components/ui/PanelHeaderControls.vue';
import {
  useCommunicationsPanel,
  type CommunicationsPanelMode,
} from '@/composables/useCommunicationsPanel';

const props = withDefaults(
  defineProps<{
    mode?: CommunicationsPanelMode;
  }>(),
  {
    mode: 'all',
  },
);

const modeRef = toRef(props, 'mode');
const { t } = useI18n();
const {
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
} = useCommunicationsPanel(modeRef);
</script>

<template>
  <div class="panel-inner">
    <div class="panel-header">
      <iconify-icon :icon="panelIcon" class="panel-icon"></iconify-icon>
      <h2>{{ panelTitle }}</h2>
      <PanelHeaderControls />
    </div>

    <div class="panel-body">
      <PanelSection v-if="showOverview" :title="t('communications.overview')" icon="ph:phone-call-duotone">
        <div class="summary-grid">
          <div class="summary-card">
            <span class="summary-label">{{ t('communications.voiceNumbers') }}</span>
            <strong>{{ voiceChannels.length }}</strong>
          </div>
          <div class="summary-card">
            <span class="summary-label">{{ t('communications.whatsappSenders') }}</span>
            <strong>{{ whatsappChannels.length }}</strong>
          </div>
          <div class="summary-card">
            <span class="summary-label">{{ t('communications.smsSenders') }}</span>
            <strong>{{ smsChannels.length }}</strong>
          </div>
          <div class="summary-card">
            <span class="summary-label">{{ t('communications.latestRuntime') }}</span>
            <strong>{{ snapshot?.kwami.name || activeKwamiName }}</strong>
          </div>
        </div>
        <p class="muted-text infra-text">
          {{ t('communications.sharedInfraSummary') }}
        </p>
        <p v-if="statusMessage" class="status-text">{{ statusMessage }}</p>
        <p v-if="error" class="error-text">{{ error }}</p>
      </PanelSection>

      <PanelSection
        v-if="showPhoneSections && !isPhoneClaimed"
        :title="t('communications.createNumber')"
        icon="ph:sim-card-duotone"
        collapsible
      >
        <p class="muted-text infra-text">
          {{ t('communications.createNumberHelp') }}
        </p>
        <div class="country-grid">
          <BaseInput
            v-model="communicationsStore.numberSearch.countryCode"
            :label="t('communications.country')"
            placeholder="US"
            mono
          />
        </div>
        <p class="muted-text infra-text">
          {{ t('communications.provisionNote') }}
        </p>
        <div class="section-actions-row">
          <BaseButton
            variant="primary"
            :loading="searching"
            icon="ph:magnifying-glass-duotone"
            :disabled="!activeKwamiId"
            @click="searchNumbers"
          >
            {{ t('communications.findAvailableNumber') }}
          </BaseButton>
          <BaseButton
            variant="secondary"
            icon="ph:shuffle-angular-duotone"
            :disabled="!activeKwamiId || !suggestedNumber"
            :loading="searching"
            @click="refreshSuggestedNumber"
          >
            {{ t('communications.refreshSuggestion') }}
          </BaseButton>
          <BaseButton
            variant="secondary"
            icon="ph:arrows-clockwise-duotone"
            @click="refreshCurrentKwami"
          >
            {{ t('communications.refresh') }}
          </BaseButton>
        </div>
        <div v-if="suggestedNumber" class="result-list">
          <div class="result-card">
            <div>
              <strong>{{ suggestedNumber.phoneNumber }}</strong>
              <p>{{ suggestedNumber.locality || suggestedNumber.region || t('communications.availableNumber') }}</p>
            </div>
          </div>
        </div>
        <BaseButton
          variant="accent"
          block
          icon="ph:shopping-cart-duotone"
          :loading="purchasing"
          :disabled="!activeKwamiId || !suggestedNumber"
          @click="buyNumber()"
        >
          {{ t('communications.purchaseSuggested') }}
        </BaseButton>
      </PanelSection>

      <PanelSection v-if="showPhoneSections && isPhoneClaimed" :title="t('communications.phoneChannel')" icon="ph:phone-duotone" collapsible>
        <div v-if="selectedVoiceChannel" class="channel-card">
          <div class="channel-row">
            <span>{{ t('communications.assignedNumber') }}</span>
            <strong>{{ selectedVoiceChannel.phone_number }}</strong>
          </div>
          <div class="channel-row">
            <span>{{ t('communications.status') }}</span>
            <strong>{{ selectedVoiceChannel.status }}</strong>
          </div>
          <div class="channel-row">
            <span>{{ t('communications.lastSyncOutbound') }}</span>
            <strong>{{ voiceOutboundCapabilityStale ? t('communications.notRecorded') : t('communications.ok') }}</strong>
          </div>
        </div>
        <i18n-t
          v-if="selectedVoiceChannel && voiceOutboundCapabilityStale"
          keypath="communications.voiceOutboundStaleWarning"
          tag="p"
          class="warning-text"
        >
          <template #callWithAgent>
            <strong>{{ t('communications.callWithAgent') }}</strong>
          </template>
          <template #code>
            <code>LIVEKIT_SIP_OUTBOUND_TRUNK_ID</code>
          </template>
        </i18n-t>
        <p v-if="selectedVoiceChannel" class="muted-text infra-text">{{ voiceInfrastructureNote }}</p>
        <p v-else class="muted-text">{{ t('communications.noVoiceChannel') }}</p>
        <p v-if="props.mode === 'phone'" class="muted-text infra-text">
          {{ t('communications.phoneClaimedDetails') }}
        </p>
        <template v-if="showPhoneOperations">
          <BaseInput
            v-model="communicationsStore.compose.callTarget"
            :label="t('communications.callRecipient')"
            placeholder="+14155550123"
            mono
          />
          <p class="muted-text infra-text">
            {{ t('communications.callModesHelp') }}
          </p>
          <div class="section-actions-row">
            <BaseButton
              variant="secondary"
              icon="ph:lightning-duotone"
              :loading="callingTwilioDirect"
              :disabled="!canPlaceOutboundCall || anyCallInProgress"
              @click="placeTwilioDirectCall"
            >
              {{ t('communications.testCallTwilio') }}
            </BaseButton>
            <BaseButton
              variant="primary"
              icon="ph:phone-outgoing-duotone"
              :loading="callingWithAgent"
              :disabled="!canPlaceOutboundCall || anyCallInProgress"
              @click="placeCallWithAgent"
            >
              {{ t('communications.callWithAgent') }}
            </BaseButton>
          </div>
        </template>
        <BaseButton
          variant="danger"
          block
          icon="ph:trash-duotone"
          :disabled="!activeKwamiId || !selectedVoiceChannel || releasing"
          @click="openReleaseConfirm"
        >
          {{ t('communications.removeNumberFromKwami') }}
        </BaseButton>
      </PanelSection>

      <PanelSection v-if="showWhatsappSections" :title="t('communications.whatsapp')" icon="ph:chat-teardrop-text-duotone" collapsible>
        <div v-if="selectedWhatsappChannel" class="channel-card">
          <div class="channel-row">
            <span>{{ t('communications.sender') }}</span>
            <strong>{{ selectedWhatsappChannel.provider_sender || selectedWhatsappChannel.phone_number }}</strong>
          </div>
          <div class="channel-row">
            <span>{{ t('communications.status') }}</span>
            <strong>{{ selectedWhatsappChannel.status }}</strong>
          </div>
        </div>
        <p v-else class="muted-text">{{ t('communications.noWhatsappSender') }}</p>
        <BaseInput
          v-model="whatsappSender"
          :label="t('communications.approvedSender')"
          placeholder="whatsapp:+14155550123"
          mono
        />
        <BaseButton
          variant="secondary"
          block
          icon="ph:check-circle-duotone"
          :disabled="!selectedWhatsappChannel"
          @click="enableWhatsappSender"
        >
          {{ t('communications.markWhatsappReady') }}
        </BaseButton>
        <BaseInput
          v-model="communicationsStore.compose.messageTarget"
          :label="t('communications.recipient')"
          placeholder="+14155550123"
          mono
        />
        <div class="message-field">
          <label>{{ t('communications.message') }}</label>
          <textarea
            v-model="communicationsStore.compose.messageBody"
            :placeholder="t('communications.messagePlaceholder')"
          ></textarea>
        </div>
        <BaseButton
          variant="primary"
          block
          icon="ph:paper-plane-tilt-duotone"
          :loading="sending"
          :disabled="!selectedWhatsappChannel || !communicationsStore.compose.messageBody.trim()"
          @click="sendMessage"
        >
          {{ t('communications.sendWhatsapp') }}
        </BaseButton>
      </PanelSection>

      <PanelSection v-if="showSmsSections" :title="t('communications.sms')" icon="ph:chat-text-duotone" collapsible>
        <div v-if="selectedSmsChannel" class="channel-card">
          <div class="channel-row">
            <span>{{ t('communications.sender') }}</span>
            <strong>{{ selectedSmsChannel.phone_number }}</strong>
          </div>
          <div class="channel-row">
            <span>{{ t('communications.status') }}</span>
            <strong>{{ selectedSmsChannel.status }}</strong>
          </div>
        </div>
        <p v-else class="muted-text">{{ t('communications.noSmsSender') }}</p>
        <BaseInput
          v-model="communicationsStore.compose.messageTarget"
          :label="t('communications.recipient')"
          placeholder="+14155550123"
          mono
        />
        <div class="message-field">
          <label>{{ t('communications.message') }}</label>
          <textarea
            v-model="communicationsStore.compose.messageBody"
            :placeholder="t('communications.smsPlaceholder')"
          ></textarea>
        </div>
        <BaseButton
          variant="primary"
          block
          icon="ph:paper-plane-tilt-duotone"
          :loading="sending"
          :disabled="!selectedSmsChannel || !communicationsStore.compose.messageBody.trim()"
          @click="sendSms"
        >
          {{ t('communications.sendSms') }}
        </BaseButton>
      </PanelSection>

      <PanelSection
        v-if="showPhoneSections"
        :title="t('communications.recentCalls')"
        icon="ph:phone-incoming-duotone"
        collapsible
        default-collapsed
      >
        <div v-if="recentCalls.length === 0" class="muted-text">{{ t('communications.noCallEvents') }}</div>
        <div v-for="call in recentCalls" :key="call.id" class="event-card">
          <strong>{{ call.to_number || call.from_number || t('communications.callFallback') }}</strong>
          <span>{{ call.status }}</span>
          <small>{{ new Date(call.created_at).toLocaleString() }}</small>
        </div>
      </PanelSection>

      <PanelSection
        v-if="showWhatsappSections"
        :title="t('communications.recentMessages')"
        icon="ph:chats-circle-duotone"
        collapsible
        default-collapsed
      >
        <div v-if="recentMessages.length === 0" class="muted-text">{{ t('communications.noMessageEvents') }}</div>
        <div v-for="message in recentMessages" :key="message.id" class="event-card">
          <strong>{{ message.to_address || message.from_address || t('communications.messageFallback') }}</strong>
          <span>{{ message.provider_status || t('communications.queued') }}</span>
          <small>{{ message.body || t('communications.noContent') }}</small>
        </div>
      </PanelSection>

      <div v-if="loading" class="muted-text loading-text">{{ t('communications.loadingCommunications') }}</div>
    </div>

    <ConfirmDialog
      :open="showReleaseConfirm"
      :title="t('communications.removePhoneTitle')"
      icon="ph:phone-slash-duotone"
      :confirm-label="t('communications.confirmRemoveRelease')"
      confirm-icon="ph:trash-duotone"
      confirm-variant="danger"
      :cancel-label="t('communications.cancel')"
      :loading="releasing"
      @confirm="confirmReleasePhone"
      @cancel="showReleaseConfirm = false"
    >
      <p>
        {{ t('communications.removePhoneDetails') }}
      </p>
      <p class="warning-text">{{ t('communications.removePhoneWarning') }}</p>
      <p v-if="selectedVoiceChannel">
        {{ t('communications.numberLabel') }}
        <strong>{{ selectedVoiceChannel.phone_number }}</strong>
      </p>
    </ConfirmDialog>
  </div>
</template>

<style scoped>
.summary-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.country-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(1, minmax(0, 1fr));
}

.summary-card,
.channel-card,
.result-card,
.event-card {
  padding: 12px;
  border-radius: 12px;
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
}

.summary-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.summary-label,
.channel-row span,
.event-card span,
.message-field label {
  font-size: 11px;
  color: var(--text-muted);
}

.channel-card,
.event-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.channel-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.section-actions-row {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}

.result-list,
.event-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.result-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.result-card p,
.status-text,
.muted-text,
.error-text {
  margin: 0;
  font-size: 12px;
}

.muted-text {
  color: var(--text-muted);
}

.status-text {
  color: var(--accent-primary);
  margin-top: 12px;
}

.error-text {
  color: var(--error);
  margin-top: 8px;
}

.warning-text {
  margin: 0 0 10px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--warning);
}

.warning-text code {
  font-size: 11px;
}

.message-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 12px 0;
}

.message-field textarea {
  min-height: 96px;
  resize: vertical;
  padding: 12px 14px;
  background: var(--surface-1);
  color: var(--text-primary);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  font: inherit;
}

.message-field textarea:focus {
  outline: none;
  border-color: var(--accent-primary);
}

.loading-text {
  padding: 16px 20px;
}

@media (max-width: 860px) {
  .summary-grid,
  .country-grid {
    grid-template-columns: 1fr;
  }

  .section-actions-row,
  .result-card {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
