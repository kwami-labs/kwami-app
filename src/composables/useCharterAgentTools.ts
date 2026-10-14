import { useI18n } from 'vue-i18n';
import type { Kwami } from 'kwami';
import { useVoiceStore } from '@/stores/voice';
import { useAgentActionState } from '@/composables/useAgentActionState';
import {
  appendProfileNote,
  removeProfileNotes,
  CHARTER_PROFILE_MAX_CHARS,
  type CharterConfig,
} from '@/lib/charter';

/**
 * Let the agent keep the user profile its charter reads.
 *
 * The charter (Soul panel) tells the agent to note durable things it learns
 * about the user -- preferences, routines, goals -- and to stop repeating an
 * objection the user has overruled. Those notes live in the profile the user
 * can read and edit in the same panel, so nothing the agent believes about
 * them is hidden state.
 *
 * Writing goes through the store, which persists it like every other soul
 * setting, and then straight back to the running agent as a charter-only soul
 * update: the agent layers it on its current charter, so the next turn already
 * knows. Classed as a reversible action -- the user's own notes about
 * themselves, removable from the panel or with `forget_about_user`.
 */
export function useCharterAgentTools() {
  const { t } = useI18n();
  const voiceStore = useVoiceStore();
  const actionState = useAgentActionState();

  function currentCharter(): CharterConfig {
    return voiceStore.soulConfig.charter;
  }

  function writeProfile(instance: Kwami, profile: string) {
    const charter: CharterConfig = { ...currentCharter(), userProfile: profile };
    voiceStore.soulConfig = { ...voiceStore.soulConfig, charter };
    // The SDK spreads unknown soul fields through, which is how `charter`
    // reaches the agent in the initial config message too.
    instance.soul.updateConfig({ charter } as Record<string, unknown>);
    instance.agent.syncConfigToBackend('soul', { charter: { userProfile: profile } });
  }

  function rememberAboutUser(instance: Kwami, note: unknown) {
    const charter = currentCharter();
    if (!charter.enabled) {
      return { success: false, message: t('charterTools.disabled') };
    }
    const result = appendProfileNote(charter.userProfile, note);
    if (result.status === 'empty') {
      return { success: false, message: t('charterTools.emptyNote') };
    }
    if (result.status === 'duplicate') {
      return { success: true, changed: false, message: t('charterTools.alreadyKnown') };
    }
    if (result.status === 'full') {
      return {
        success: false,
        message: t('charterTools.profileFull', { max: CHARTER_PROFILE_MAX_CHARS }),
      };
    }
    writeProfile(instance, result.profile);
    actionState.recordAction(t('charterTools.actionRemembered'), result.note);
    return { success: true, changed: true, message: t('charterTools.remembered') };
  }

  function forgetAboutUser(instance: Kwami, text: unknown) {
    const charter = currentCharter();
    if (!charter.enabled) {
      return { success: false, message: t('charterTools.disabled') };
    }
    const result = removeProfileNotes(charter.userProfile, text);
    if (result.removed === 0) {
      return { success: false, message: t('charterTools.nothingToForget') };
    }
    writeProfile(instance, result.profile);
    actionState.recordAction(t('charterTools.actionForgot'), String(result.removed));
    return {
      success: true,
      removed: result.removed,
      message: t('charterTools.forgot', { count: result.removed }),
    };
  }

  function readUserProfile() {
    const charter = currentCharter();
    return {
      success: true,
      enabled: Boolean(charter.enabled),
      profile: charter.userProfile,
    };
  }

  function registerCharterTools(instance: Kwami) {
    instance.registerTool({
      name: 'remember_about_user',
      description: t('charterTools.toolDescRemember'),
      parameters: {
        note: { type: 'string', description: t('charterTools.paramNote') },
      },
      handler: async ({ note }) => rememberAboutUser(instance, note),
    });

    instance.registerTool({
      name: 'forget_about_user',
      description: t('charterTools.toolDescForget'),
      parameters: {
        text: { type: 'string', description: t('charterTools.paramText') },
      },
      handler: async ({ text }) => forgetAboutUser(instance, text),
    });

    instance.registerTool({
      name: 'read_user_profile',
      description: t('charterTools.toolDescRead'),
      parameters: {},
      handler: async () => readUserProfile(),
    });
  }

  return { rememberAboutUser, forgetAboutUser, readUserProfile, registerCharterTools };
}
