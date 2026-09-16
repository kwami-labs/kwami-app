import { storeToRefs } from 'pinia';
import { useNavigationStore } from '@/stores/navigation';

let navigationListenerAttached = false;

export function useNavigation() {
  const store = useNavigationStore();
  const { isActive, currentUrl, currentTitle, isLoading, liveUrl, hasNavigation } =
    storeToRefs(store);

  if (!navigationListenerAttached) {
    navigationListenerAttached = true;

    // -----------------------------------------------------------------------
    // Browser Use Cloud: browser_session events (new flow)
    // -----------------------------------------------------------------------
    window.addEventListener('kwami:browser_session', (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        action?: string;
        liveUrl?: string;
        url?: string;
        title?: string;
      };
      console.log('[Kwami] Received kwami:browser_session event:', detail);
      if (!detail?.action) return;

      switch (detail.action) {
        case 'open':
          console.log('[Kwami] useNavigation handling "open", setting state:', detail);
          store.updateState({
            url: detail.url || '',
            title: detail.title || '',
            liveUrl: detail.liveUrl || '',
            isLoading: false,
          });
          // Force isActive to true even if url is empty
          store.isActive = true;
          break;
        case 'update':
          store.updateState({
            url: detail.url,
            title: detail.title,
            isLoading: false,
          });
          break;
        case 'close':
          store.end();
          break;
      }
    });

    // -----------------------------------------------------------------------
    // Legacy: extension-based nav_command events (kept for backward compat)
    // -----------------------------------------------------------------------
    window.addEventListener('kwami:nav_command', (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        action?: string;
        url?: string;
        description?: string;
        text?: string;
      };
      if (!detail?.action) return;

      window.postMessage(
        { source: 'kwami-app', type: 'kwami:nav_command', detail },
        '*'
      );

      switch (detail.action) {
        case 'navigate':
          if (detail.url) {
            store.updateState({ url: detail.url, title: '', isLoading: true });
          }
          break;
        case 'close':
          store.end();
          break;
      }
    });

    window.addEventListener('message', (e: MessageEvent) => {
      if (e.source !== window || !e.data?.source) return;
      if (e.data.source !== 'kwami-extension') return;
      const { type, url, title, isLoading: loading, ...rest } = e.data;
      if (type === 'kwami:ext_nav_state') {
        store.updateState({ url, title, isLoading: loading });
      }
      if (type === 'kwami:ext_nav_ended') {
        store.end();
      }
      if (type === 'kwami:ext_disconnected') {
        console.warn('[Kwami] Extension bridge disconnected. Reload this page after reloading the extension.');
      }
      if (type === 'kwami:ext_page_content') {
        const msg = {
          type: 'nav_page_content',
          title: rest.title,
          text: rest.text,
          elements: rest.elements,
          html: rest.html,
        };
        const payload = new TextEncoder().encode(JSON.stringify(msg));
        window.dispatchEvent(new CustomEvent('kwami:send_data', { detail: payload }));
      }
      if (type === 'kwami:ext_command_result') {
        const msg = { type: 'nav_command_result', id: rest.id, result: rest.result };
        const payload = new TextEncoder().encode(JSON.stringify(msg));
        window.dispatchEvent(new CustomEvent('kwami:send_data', { detail: payload }));
        if (rest.title != null || rest.text != null || rest.elements != null || rest.html != null) {
          const contentMsg = { type: 'nav_page_content', title: rest.title, text: rest.text, elements: rest.elements, html: rest.html };
          const contentPayload = new TextEncoder().encode(JSON.stringify(contentMsg));
          window.dispatchEvent(new CustomEvent('kwami:send_data', { detail: contentPayload }));
        }
      }
    });
  }

  /**
   * Request the agent to close the cloud browser session.
   * Sends a message via the LiveKit data channel.
   */
  function requestBrowserClose() {
    const msg = { type: 'browser_close_request' };
    const payload = new TextEncoder().encode(JSON.stringify(msg));
    window.dispatchEvent(new CustomEvent('kwami:send_data', { detail: payload }));
    store.end();
  }

  return {
    isActive,
    currentUrl,
    currentTitle,
    isLoading,
    liveUrl,
    hasNavigation,
    end: store.end,
    requestBrowserClose,
  };
}
