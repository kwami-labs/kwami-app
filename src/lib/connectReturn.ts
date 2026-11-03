/**
 * What comes back from a consent, on its way to the signed-in app.
 *
 * A consent link can be sent to someone else, so the API's callback connects nothing: it
 * passes the result to the app in that same browser, here or through `kwami://`, and
 * `connectFinish` completes it. The API then compares who is signed in with who started it,
 * so a stranger's account never ends up on whoever sent them the link.
 */
import { ref } from 'vue';

export interface ConnectReturn {
  provider: 'google' | 'openrouter';
  state: string;
  grant: string;
}

/** Waiting for someone to be signed in. */
export const pendingConnections = ref<ConnectReturn[]>([]);

/**
 * getCurrent() keeps returning the link that cold-started the app, so a reload of the
 * webview would replay a code that is already spent and report a bogus failure.
 */
const HANDLED_KEY = 'kwami:connect-handled';

function alreadyHandled(grant: string): boolean {
  try {
    if (sessionStorage.getItem(HANDLED_KEY) === grant) return true;
    sessionStorage.setItem(HANDLED_KEY, grant);
  } catch {
    // Storage unavailable: worst case a replay shows one stale error.
  }
  return false;
}

export function queueConnectReturn(found: ConnectReturn): void {
  if (!alreadyHandled(found.grant)) pendingConnections.value.push(found);
}

export function parseConnectFragment(fragment: string): ConnectReturn | null {
  const params = new URLSearchParams(fragment.replace(/^#/, ''));
  const provider = params.get('connect');
  const state = params.get('state');
  const grant = params.get('grant');
  if ((provider !== 'google' && provider !== 'openrouter') || !state || !grant) return null;
  return { provider, state, grant };
}

/** The result in this page's address, if any, and out of the address for good. */
export function takeConnectReturnFromLocation(): ConnectReturn | null {
  const found = parseConnectFragment(window.location.hash);
  if (found) window.history.replaceState({}, '', window.location.pathname);
  return found;
}

/** The result in a `kwami://connect/callback` deep link, or null for any other link. */
export function connectReturnFromDeepLink(raw: string): ConnectReturn | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'kwami:' || url.host !== 'connect' || url.pathname !== '/callback') {
    return null;
  }
  return parseConnectFragment(url.hash);
}
