import { computed, readonly, ref } from 'vue';

export type PwaPlatform = 'ios' | 'android' | 'desktop';
export type PwaInstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const canPrompt = ref(false);
const isInstalled = ref(false);
const isPrompting = ref(false);

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let listenersBound = false;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined';
}

export function detectPwaPlatform(
  userAgent = isBrowser() ? navigator.userAgent : '',
  maxTouchPoints = isBrowser() ? navigator.maxTouchPoints : 0,
  platform = isBrowser() ? navigator.platform : '',
): PwaPlatform {
  const ua = userAgent.toLowerCase();
  const ipadOs = platform === 'MacIntel' && maxTouchPoints > 1;
  if (/iphone|ipad|ipod/.test(ua) || ipadOs) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'desktop';
}

/** Which browser is showing the page on iOS, as far as installing goes. */
export type IosBrowser = 'safari' | 'chrome' | 'edge' | 'firefox' | 'inapp' | 'other';

/**
 * How this device installs the PWA when the browser offers no install prompt.
 * - `prompt`: the browser fired beforeinstallprompt; the button opens its dialog.
 * - `ios-share`: Share, then Add to Home Screen (Safari; other iOS browsers from 16.4).
 * - `ios-open-safari`: an in-app browser (Instagram, WhatsApp...) or an older iOS,
 *   where only Safari can add it; the guide offers to copy the link.
 * - `android-menu` / `desktop-menu`: the browser menu or the address bar icon.
 */
export type PwaInstallMode =
  'prompt' | 'ios-share' | 'ios-open-safari' | 'android-menu' | 'desktop-menu';

export function detectIosBrowser(userAgent = isBrowser() ? navigator.userAgent : ''): IosBrowser {
  // In-app browsers first: they also carry Safari's tokens.
  if (
    /fban|fbav|instagram|whatsapp|line\/|musical_ly|bytedance|snapchat|twitter|gsa\//i.test(
      userAgent,
    )
  )
    return 'inapp';
  if (/crios/i.test(userAgent)) return 'chrome';
  if (/edgios/i.test(userAgent)) return 'edge';
  if (/fxios/i.test(userAgent)) return 'firefox';
  if (/safari/i.test(userAgent) && /version\//i.test(userAgent)) return 'safari';
  return 'other';
}

/** iOS major and minor from the user agent, or null (iPadOS reports itself as a Mac). */
export function detectIosVersion(
  userAgent = isBrowser() ? navigator.userAgent : '',
): [number, number] | null {
  const match = /OS (\d+)[_.](\d+)/.exec(userAgent);
  return match ? [Number(match[1]), Number(match[2])] : null;
}

export function pickInstallMode(
  platform: PwaPlatform,
  canPromptNow: boolean,
  userAgent = isBrowser() ? navigator.userAgent : '',
): PwaInstallMode {
  if (canPromptNow) return 'prompt';
  if (platform === 'android') return 'android-menu';
  if (platform === 'desktop') return 'desktop-menu';

  const browser = detectIosBrowser(userAgent);
  if (browser === 'safari') return 'ios-share';
  if (browser === 'inapp') return 'ios-open-safari';
  // Chrome, Edge and Firefox on iOS can add to the Home Screen since iOS 16.4.
  const version = detectIosVersion(userAgent);
  if (!version) return 'ios-share';
  const [major, minor] = version;
  return major > 16 || (major === 16 && minor >= 4) ? 'ios-share' : 'ios-open-safari';
}

export function detectStandaloneDisplay(): boolean {
  if (!isBrowser()) return false;
  const mediaStandalone = window.matchMedia?.('(display-mode: standalone)')?.matches ?? false;
  const iosStandalone =
    'standalone' in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return mediaStandalone || iosStandalone;
}

function onBeforeInstallPrompt(event: Event) {
  event.preventDefault();
  deferredPrompt = event as BeforeInstallPromptEvent;
  canPrompt.value = true;
}

function onAppInstalled() {
  deferredPrompt = null;
  canPrompt.value = false;
  isInstalled.value = true;
}

/** Bind once at app startup so the install event is not missed before Settings opens. */
export function initPwaInstall() {
  if (!isBrowser() || listenersBound) return;

  listenersBound = true;
  isInstalled.value = detectStandaloneDisplay();

  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  window.addEventListener('appinstalled', onAppInstalled);
}

export async function promptPwaInstall(): Promise<PwaInstallOutcome> {
  if (!deferredPrompt) return 'unavailable';

  isPrompting.value = true;
  try {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    canPrompt.value = false;
    if (outcome === 'accepted') isInstalled.value = true;
    return outcome;
  } catch {
    return 'unavailable';
  } finally {
    isPrompting.value = false;
  }
}

export function usePwaInstall() {
  initPwaInstall();

  const platform = computed(() => detectPwaPlatform());
  const mode = computed(() => pickInstallMode(platform.value, canPrompt.value));
  const iosBrowser = computed(() => detectIosBrowser());

  return {
    canPrompt: readonly(canPrompt),
    isInstalled: readonly(isInstalled),
    isPrompting: readonly(isPrompting),
    platform,
    mode,
    iosBrowser,
    install: promptPwaInstall,
  };
}

/** Test-only: restore module state between cases. */
export function resetPwaInstallState() {
  if (listenersBound && typeof window !== 'undefined') {
    window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.removeEventListener('appinstalled', onAppInstalled);
  }
  deferredPrompt = null;
  canPrompt.value = false;
  isInstalled.value = false;
  isPrompting.value = false;
  listenersBound = false;
}
