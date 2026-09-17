import { onMounted, onUnmounted } from 'vue';
import { appsPanelOrder, SETTINGS_PANEL_ORDER } from '@/constants/panels';
import { useCommunicationsStore } from '@/stores/communications';
import { useUIStore } from '@/stores/ui';
import { useWorkspaceStore } from '@/stores/workspace';
import { isBareShortcut } from '@/utils/keyboard';

export function usePanelShortcuts() {
  const uiStore = useUIStore();
  const communicationsStore = useCommunicationsStore();
  const workspaceStore = useWorkspaceStore();

  /**
   * Same list the sidebar renders, including the phone-activation gate — a
   * digit key must never open a panel the sidebar is hiding.
   */
  function panelOrder(): readonly string[] {
    if (uiStore.sidebarMode !== 'apps') return SETTINGS_PANEL_ORDER;
    const phoneActivated = communicationsStore.isKwamiPhoneActivated(
      workspaceStore.activeWorkspaceId,
    );
    return appsPanelOrder(phoneActivated);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!isBareShortcut(e)) return;
    if (e.key.toLowerCase() === 'p') {
      uiStore.togglePanel();
      return;
    }

    // 1-9 then 0, -, = so the whole list stays reachable as it grows.
    const KEY_SEQUENCE = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];
    const index = KEY_SEQUENCE.indexOf(e.key);
    if (index === -1) return;

    const panel = panelOrder()[index];
    if (panel) uiStore.setPanel(panel);
  }

  function handlePanelClick(panel: string) {
    if (uiStore.activePanel === panel && uiStore.isPanelOpen) {
      uiStore.togglePanel();
    } else {
      uiStore.setPanel(panel);
    }
  }

  onMounted(() => document.addEventListener('keydown', handleKeydown));
  onUnmounted(() => document.removeEventListener('keydown', handleKeydown));

  return { handlePanelClick };
}
