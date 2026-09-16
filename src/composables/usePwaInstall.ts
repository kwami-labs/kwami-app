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

export function detectStandaloneDisplay(): boolean {
  if (!isBrowser()) return false;
  const mediaStandalone = window.matchMedia?.('(display-mode: standalone)')?.matches ?? false;
  const iosStandalone = 'standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
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
  const showManualSteps = computed(() => !isInstalled.value && !canPrompt.value);

  return {
    canPrompt: readonly(canPrompt),
    isInstalled: readonly(isInstalled),
    isPrompting: readonly(isPrompting),
    platform,
    showManualSteps,
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
