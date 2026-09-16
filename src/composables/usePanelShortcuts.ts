import { onMounted, onUnmounted } from 'vue';
import { useUIStore } from '@/stores/ui';
import { isBareShortcut } from '@/utils/keyboard';

const SETTINGS_PANEL_KEYS: (string | null)[] = [
  'avatar',
  'scene',
  'audio',
  'voice',
  'enhancements',
  'metrics',
  'soul',
  'memory',
  'tools',
  'info',
  'account',
];

const APPS_PANEL_KEYS: (string | null)[] = [
  'contacts',
  'email',
  'phone',
  'whatsapp',
  'sms',
  'history',
  'wallet',
  'calendar',
];

export function usePanelShortcuts() {
  const uiStore = useUIStore();

  function handleKeydown(e: KeyboardEvent) {
    if (!isBareShortcut(e)) return;
    const panelKeys = uiStore.sidebarMode === 'apps' ? APPS_PANEL_KEYS : SETTINGS_PANEL_KEYS;
    if (e.key >= '1' && e.key <= '9') {
      const idx = parseInt(e.key) - 1;
      const panel = panelKeys[idx];
      if (panel) uiStore.setPanel(panel);
    } else if (e.key === '0') {
      if (uiStore.sidebarMode === 'settings') uiStore.setPanel('memory');
    } else if (e.key === '-') {
      if (uiStore.sidebarMode === 'settings') uiStore.setPanel('tools');
    } else if (e.key === '=') {
      if (uiStore.sidebarMode === 'settings') uiStore.setPanel('info');
    } else if (e.key.toLowerCase() === 'p') {
      uiStore.togglePanel();
    }
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
