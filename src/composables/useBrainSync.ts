import { onBeforeUnmount, onMounted, watch, type Ref } from 'vue';
import type { Kwami } from 'kwami';
import { useI18n } from 'vue-i18n';
import { useToast } from 'vue-toastification';
import { brainPayload } from '@/lib/brain';
import { useVoiceStore } from '@/stores/voice';
import { sendRawConfigUpdate } from '@/lib/agentConfigUpdate';

/**
 * Keeps the agent's brain in step with the Models panel, and the panel in step
 * with what the agent reports.
 *
 * Out: the brain config goes as a `config_update` of type `brain` on connect
 * (from `useKwami`'s full sync) and again whenever it changes mid-session.
 * In: the agent publishes `brain_status` (keys present, spend, tasks), which
 * the SDK forwards as `kwami:agent_message`.
 */
export function sendBrainConfig(instance: Kwami, voiceStore: ReturnType<typeof useVoiceStore>) {
  return sendRawConfigUpdate(
    instance,
    'brain',
    brainPayload(voiceStore.brain) as unknown as Record<string, unknown>,
  );
}

export function useBrainSync(kwami: Ref<Kwami | null>, isConnected: Ref<boolean>) {
  const voiceStore = useVoiceStore();
  const toast = useToast();
  const { t } = useI18n();
  let timer: ReturnType<typeof setTimeout> | null = null;

  watch(
    () => JSON.stringify(voiceStore.brain),
    () => {
      if (timer) clearTimeout(timer);
      // Debounced: a slider or a text field changes on every keystroke.
      timer = setTimeout(() => {
        if (isConnected.value && kwami.value) sendBrainConfig(kwami.value, voiceStore);
      }, 400);
    },
  );

  function onAgentMessage(event: Event) {
    const detail = (event as CustomEvent).detail as { type?: string } | undefined;
    if (detail?.type === 'brain_status') voiceStore.applyBrainStatus(detail);
    // The user changed instructions by voice: save them and say so, since the
    // Models panel changes without anyone touching it.
    if (detail?.type === 'brain_instructions') {
      const label = voiceStore.applyBrainInstructions(detail);
      if (label !== null) {
        toast.info(
          label
            ? t('brainPanel.voiceChangedModel', { model: label })
            : t('brainPanel.voiceChangedBrain'),
        );
      }
    }
    // The realtime model failed for good and the agent moved the call to the
    // standard pipeline rather than hang up: say so, or the new voice is a mystery.
    if (detail?.type === 'voice_fallback') toast.warning(t('voicePersonas.realtimeFellBack'));
  }

  onMounted(() => window.addEventListener('kwami:agent_message', onAgentMessage));
  onBeforeUnmount(() => {
    window.removeEventListener('kwami:agent_message', onAgentMessage);
    if (timer) clearTimeout(timer);
  });
}
