import { useI18n } from 'vue-i18n';
import type { Kwami } from 'kwami';
import { useThemeStore } from '@/stores/theme';
import { useWalletStore } from '@/stores/wallet';
import { useMetricsState } from '@/composables/useMetricsState';
import { useAgentActionState } from '@/composables/useAgentActionState';

/**
 * The last of the panel actions that had no tool behind them: exporting and
 * importing a theme, reading and resetting the live pipeline metrics, and
 * creating a wallet.
 *
 * These are the remainder of a sweep through every `@click` handler in every
 * component. Three things that sweep turned up are deliberately NOT here, and
 * the reasons are in the tool descriptions where the model can see them
 * rather than only in this comment:
 *
 * - **Releasing a phone number.** It destroys a paid resource and is not
 *   idempotent, which is the same class as buying one -- and buying already
 *   stays a deliberate click by agreement. A retried tool call releases a
 *   second number.
 * - **Connecting an MCP server or executing an arbitrary tool** from the
 *   tools panel. That lets a spoken sentence add a tool server to the
 *   session, which is a different kind of power from changing a colour.
 * - **Screen recording.** Its state lives inside `RecordControl.vue` rather
 *   than a store, and browsers only reliably grant capture from a real user
 *   gesture -- so an agent-started recording would be the soundtrack autoplay
 *   problem again, reporting "recording" over nothing.
 */

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  return fallback;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'unknown error';
}

export function useWorkspaceExtrasAgentTools() {
  const { t } = useI18n();
  const themeStore = useThemeStore();
  const walletStore = useWalletStore();
  const metrics = useMetricsState();
  const actionState = useAgentActionState();

  // ---------------------------------------------------------------------------
  // Theme transfer
  // ---------------------------------------------------------------------------

  function exportTheme() {
    const json = themeStore.exportTheme();
    return {
      success: true,
      theme: json,
      // Long enough that reading it aloud would be absurd; the model should
      // offer it rather than recite it.
      length: json.length,
      message: t('extras.themeExported'),
    };
  }

  function importTheme(theme: unknown) {
    const json = asString(theme).trim();
    if (!json) return { success: false, applied: false, message: t('extras.themeJsonRequired') };

    // `importTheme` returns false on malformed input rather than throwing, so
    // reporting off the call rather than the result would claim a theme was
    // applied while the screen stayed exactly as it was.
    const applied = themeStore.importTheme(json);
    if (!applied) {
      return { success: false, applied: false, message: t('extras.themeImportRejected') };
    }
    actionState.recordAction(t('extras.actionImportedTheme'), undefined, { announce: true });
    return { success: true, applied: true, message: t('extras.themeImported') };
  }

  // ---------------------------------------------------------------------------
  // Pipeline metrics
  // ---------------------------------------------------------------------------

  function getPerformanceMetrics() {
    return {
      success: true,
      live: metrics.isLive.value,
      latency: {
        speechToText: metrics.latency.stt,
        endOfTurn: metrics.latency.eot,
        model: metrics.latency.llm,
        textToSpeech: metrics.latency.tts,
        overall: metrics.latency.overall,
      },
      turns: metrics.stats.turns,
      interruptions: metrics.stats.interruptions,
      // An em dash is what the panel shows before any turn has completed;
      // saying "the latency is dash" would be worse than saying nothing yet.
      hasData: metrics.latency.overall !== '—',
      message: metrics.latency.overall === '—'
        ? t('extras.metricsNotYet')
        : t('extras.metricsOverall', { overall: metrics.latency.overall }),
    };
  }

  function resetPerformanceMetrics() {
    metrics.resetMetrics();
    return { success: true, message: t('extras.metricsReset') };
  }

  // ---------------------------------------------------------------------------
  // Wallet creation
  // ---------------------------------------------------------------------------

  /**
   * Create the Kwami's wallet.
   *
   * Ungated on purpose, and it is worth being clear why given how carefully
   * everything else that touches the wallet is fenced off: creating one moves
   * no money, spends nothing and takes nothing away. It is the empty
   * container. Funding it and spending from it remain out of reach entirely.
   */
  async function createWallet() {
    if (walletStore.wallet) {
      return {
        success: true,
        created: false,
        network: walletStore.wallet.network,
        message: t('extras.walletExists'),
      };
    }
    try {
      await walletStore.createWallet();
      // Re-read rather than reuse the narrowed reference: the early return
      // above told the compiler this was null, and the store filled it in
      // through a call it cannot see through.
      const created = walletStore.wallet as { network: string } | null;
      if (!created) {
        return { success: false, created: false, message: t('extras.walletCreateNoResult') };
      }
      actionState.recordAction(t('extras.actionCreatedWallet'), undefined, { announce: true });
      return {
        success: true,
        created: true,
        network: created.network,
        canSpend: false,
        message: t('extras.walletCreated', { network: created.network }),
      };
    } catch (error) {
      return {
        success: false,
        created: false,
        message: t('extras.walletCreateFailed', { error: getErrorMessage(error) }),
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  function registerWorkspaceExtrasTools(instance: Kwami) {
    instance.registerTool({
      name: 'export_theme',
      description: t('extras.toolDescExportTheme'),
      parameters: {},
      handler: async () => exportTheme(),
    });

    instance.registerTool({
      name: 'import_theme',
      description: t('extras.toolDescImportTheme'),
      parameters: { theme: { type: 'string' } },
      handler: async ({ theme }) => importTheme(theme),
    });

    instance.registerTool({
      name: 'get_performance_metrics',
      description: t('extras.toolDescGetPerformanceMetrics'),
      parameters: {},
      handler: async () => getPerformanceMetrics(),
    });

    instance.registerTool({
      name: 'reset_performance_metrics',
      description: t('extras.toolDescResetPerformanceMetrics'),
      parameters: {},
      handler: async () => resetPerformanceMetrics(),
    });

    instance.registerTool({
      name: 'create_wallet',
      description: t('extras.toolDescCreateWallet'),
      parameters: {},
      handler: async () => createWallet(),
    });
  }

  return {
    exportTheme,
    importTheme,
    getPerformanceMetrics,
    resetPerformanceMetrics,
    createWallet,
    registerWorkspaceExtrasTools,
  };
}
