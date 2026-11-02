import { useI18n } from 'vue-i18n';
import type { Kwami } from 'kwami';
import { useAgentActionState } from '@/composables/useAgentActionState';
import { api } from '@/lib/apiClient';
import { isKnownPanel } from '@/lib/panelArrangement';
import { useUIStore } from '@/stores/ui';
import { useWorkspaceStore } from '@/stores/workspace';

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** What the Theme and Communications panels edit by hand, reachable by voice too. */
export function useLayoutAgentTools() {
  const { t } = useI18n();
  const uiStore = useUIStore();
  const workspaceStore = useWorkspaceStore();
  const actionState = useAgentActionState();

  function arrangePanels(args: Record<string, unknown>) {
    const action = asText(args.action);
    const panel = asText(args.panel);
    if (action === 'reset') {
      uiStore.resetPanelArrangement();
    } else if (!isKnownPanel(panel)) {
      return { success: false, message: t('layout.unknownPanel', { panel }) };
    } else if (action === 'hide') {
      uiStore.setPanelHidden(panel, true);
    } else if (action === 'show') {
      uiStore.setPanelHidden(panel, false);
    } else if (action === 'move_up') {
      uiStore.movePanel(panel, -1);
    } else if (action === 'move_down') {
      uiStore.movePanel(panel, 1);
    } else {
      return { success: false, message: t('layout.unknownAction') };
    }
    return { success: true, arrangement: uiStore.panelArrangement };
  }

  /**
   * Always through the dialog, unlike the layout: a message that talked the model
   * into changing this number would receive every reminder and report.
   */
  async function setNotifications(args: Record<string, unknown>) {
    try {
      const kwamiId = workspaceStore.activeWorkspaceId;
      const { settings } = await api.get<{ settings: Record<string, unknown> }>(
        '/assistant/settings',
        { query: { kwami_id: kwamiId } },
      );
      const next = {
        kwami_id: kwamiId,
        notify_to: asText(args.notify_to) || settings.notify_to,
        notify_channel: asText(args.notify_channel) || settings.notify_channel,
        timezone: settings.timezone,
        reports_enabled:
          typeof args.reports_enabled === 'boolean'
            ? args.reports_enabled
            : settings.reports_enabled,
      };
      const approved = await actionState.requestConfirmation({
        title: t('layout.confirmNotifyTitle'),
        message: t('layout.confirmNotifyBody', {
          to: String(next.notify_to ?? '-'),
          channel: String(next.notify_channel),
          reports: t(next.reports_enabled ? 'layout.reportsOn' : 'layout.reportsOff'),
        }),
        confirmLabel: t('layout.confirmApply'),
        cancelLabel: t('layout.confirmCancel'),
      });
      if (!approved) return { success: false, cancelled: true };
      const saved = await api.put<{ settings: unknown }>('/assistant/settings', next);
      return { success: true, settings: saved.settings };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  function registerLayoutTools(instance: Kwami) {
    instance.registerTool({
      name: 'set_panel_arrangement',
      description: t('layout.toolArrange'),
      parameters: {
        action: { type: 'string', enum: ['hide', 'show', 'move_up', 'move_down', 'reset'] },
        panel: { type: 'string' },
      },
      handler: async (args) => arrangePanels(args),
    });

    instance.registerTool({
      name: 'set_assistant_notifications',
      description: t('layout.toolNotifications'),
      parameters: {
        reports_enabled: { type: 'boolean' },
        notify_to: { type: 'string' },
        notify_channel: { type: 'string', enum: ['whatsapp', 'sms'] },
      },
      handler: async (args) => setNotifications(args),
    });
  }

  return { registerLayoutTools };
}
