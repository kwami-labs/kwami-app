import { onBeforeUnmount, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from 'vue-toastification';
import { isTauri } from '@/lib/platform';
import {
  jarvisDownload,
  onSavedDownload,
  revealDownload,
  type SavedDownload,
} from '@/lib/downloads';

/**
 * A notice for each download: where the file went, and in the desktop app a click on the
 * notice opens its folder. Both the user's downloads (the app's buttons, pages in the HUD)
 * and Jarvis's (his browser, into Documents\Jarvis\descargas).
 */
export function useDownloadNotices() {
  const toast = useToast();
  const { t } = useI18n();
  const desktop = isTauri();
  let stop: (() => void) | null = null;
  let closed = false;

  function open(path: string) {
    return desktop && path ? { onClick: () => void revealDownload(path) } : {};
  }

  function onSaved(download: SavedDownload) {
    if (!download.success) {
      toast.error(t('hud.downloads.failed', { name: download.name }));
      return;
    }
    toast.success(
      t(desktop ? 'hud.downloads.savedOpen' : 'hud.downloads.saved', {
        name: download.name,
        folder: download.folder,
      }),
      open(download.path),
    );
  }

  function onAgentMessage(event: Event) {
    const download = jarvisDownload((event as CustomEvent).detail);
    if (!download) return;
    if (download.state !== 'completed') {
      toast.warning(t('hud.downloads.jarvisFailed', { name: download.name }));
      return;
    }
    toast.info(
      t(desktop ? 'hud.downloads.jarvisOpen' : 'hud.downloads.jarvis', { name: download.name }),
      open(download.path),
    );
  }

  onMounted(async () => {
    window.addEventListener('kwami:agent_message', onAgentMessage);
    const unlisten = await onSavedDownload(onSaved);
    if (closed) unlisten();
    else stop = unlisten;
  });

  onBeforeUnmount(() => {
    closed = true;
    window.removeEventListener('kwami:agent_message', onAgentMessage);
    stop?.();
    stop = null;
  });

  return { onSaved, onAgentMessage };
}
