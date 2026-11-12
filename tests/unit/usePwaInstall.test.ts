import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import {
  detectIosBrowser,
  detectIosVersion,
  detectPwaPlatform,
  detectStandaloneDisplay,
  initPwaInstall,
  pickInstallMode,
  promptPwaInstall,
  resetPwaInstallState,
  usePwaInstall,
} from '../../src/composables/usePwaInstall';
import AppInstallSection from '../../src/components/panels/settings/account/AppInstallSection.vue';
import { flushPromises } from '../helpers/mount';

function fakeInstallEvent(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: ReturnType<typeof vi.fn>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  };
  event.prompt = vi.fn(async () => undefined);
  event.userChoice = Promise.resolve({ outcome });
  return event;
}

function mountInstallHook() {
  return mount(
    defineComponent({
      setup() {
        return usePwaInstall();
      },
      template: '<div />',
    }),
  );
}

afterEach(() => {
  resetPwaInstallState();
});

describe('detectPwaPlatform', () => {
  it('detects iOS phones and iPadOS', () => {
    expect(detectPwaPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('ios');
    expect(
      detectPwaPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5, 'MacIntel'),
    ).toBe('ios');
  });

  it('detects Android and desktop', () => {
    expect(detectPwaPlatform('Mozilla/5.0 (Linux; Android 14) Chrome/120.0.0.0')).toBe('android');
    expect(detectPwaPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0')).toBe(
      'desktop',
    );
  });
});

describe('detectStandaloneDisplay', () => {
  it('is true when display-mode is standalone', () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('standalone'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    try {
      expect(detectStandaloneDisplay()).toBe(true);
    } finally {
      window.matchMedia = original;
    }
  });
});

describe('usePwaInstall', () => {
  it('captures beforeinstallprompt and prompts the browser install UI', async () => {
    initPwaInstall();
    const event = fakeInstallEvent('accepted');
    window.dispatchEvent(event);

    const wrapper = mountInstallHook();
    expect(wrapper.vm.canPrompt).toBe(true);

    await expect(wrapper.vm.install()).resolves.toBe('accepted');
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(wrapper.vm.isInstalled).toBe(true);
    expect(wrapper.vm.canPrompt).toBe(false);
  });

  it('returns unavailable when no install prompt was captured', async () => {
    await expect(promptPwaInstall()).resolves.toBe('unavailable');
  });

  it('marks itself installed after appinstalled', () => {
    initPwaInstall();
    window.dispatchEvent(new Event('appinstalled'));

    const wrapper = mountInstallHook();
    expect(wrapper.vm.isInstalled).toBe(true);
    expect(wrapper.vm.canPrompt).toBe(false);
  });
});

describe('AppInstallSection (PWA option)', () => {
  it('renders the download button when the app is not installed', () => {
    const wrapper = mount(AppInstallSection);
    expect(wrapper.get('[data-testid="pwa-download"]').text()).toContain('Install PWA');
    expect(wrapper.text()).toContain('Web app (PWA)');
  });

  it('shows the installed state after a successful prompt', async () => {
    initPwaInstall();
    window.dispatchEvent(fakeInstallEvent('accepted'));

    const wrapper = mount(AppInstallSection);
    await wrapper.get('[data-testid="pwa-download"]').trigger('click');
    await flushPromises();

    expect(wrapper.get('[data-testid="pwa-installed"]').text()).toContain(
      'Installed on this device',
    );
  });
});

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)';
const IOS_SAFARI = `${IPHONE} Version/17.5 Mobile/15E148 Safari/604.1`;
const IOS_CHROME = `${IPHONE} CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1`;
const IOS_CHROME_OLD =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/110.0 Mobile/15E148 Safari/604.1';
const IOS_INSTAGRAM = `${IPHONE} Mobile/15E148 Instagram 330.0.0.0`;

function setUserAgent(ua: string) {
  return vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua);
}

describe('detectIosBrowser and detectIosVersion', () => {
  it('tells Safari, Chrome, Edge, Firefox and in-app browsers apart', () => {
    expect(detectIosBrowser(IOS_SAFARI)).toBe('safari');
    expect(detectIosBrowser(IOS_CHROME)).toBe('chrome');
    expect(detectIosBrowser(`${IPHONE} EdgiOS/126.0 Mobile Safari/604.1`)).toBe('edge');
    expect(detectIosBrowser(`${IPHONE} FxiOS/127.0 Mobile Safari/604.1`)).toBe('firefox');
    expect(detectIosBrowser(IOS_INSTAGRAM)).toBe('inapp');
    expect(detectIosBrowser(`${IPHONE} Mobile/15E148`)).toBe('other');
  });

  it('reads the iOS version, or null without one', () => {
    expect(detectIosVersion(IOS_SAFARI)).toEqual([17, 5]);
    expect(detectIosVersion('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBeNull();
    expect(detectIosVersion('Mozilla/5.0 (Windows NT 10.0)')).toBeNull();
  });
});

describe('pickInstallMode', () => {
  it('prefers the browser prompt when there is one', () => {
    expect(pickInstallMode('android', true, '')).toBe('prompt');
  });

  it('uses the menu on Android and desktop without a prompt', () => {
    expect(pickInstallMode('android', false, '')).toBe('android-menu');
    expect(pickInstallMode('desktop', false, '')).toBe('desktop-menu');
  });

  it('uses Share on Safari and on Chrome from iOS 16.4', () => {
    expect(pickInstallMode('ios', false, IOS_SAFARI)).toBe('ios-share');
    expect(pickInstallMode('ios', false, IOS_CHROME)).toBe('ios-share');
    expect(pickInstallMode('ios', false, `${IPHONE.replace('17_5', '16_4')} CriOS/112`)).toBe(
      'ios-share',
    );
    expect(pickInstallMode('ios', false, `${IPHONE} Mobile/15E148`.replace(/OS 17_5 /, ''))).toBe(
      'ios-share',
    );
  });

  it('sends in-app browsers and older iOS to Safari', () => {
    expect(pickInstallMode('ios', false, IOS_INSTAGRAM)).toBe('ios-open-safari');
    expect(pickInstallMode('ios', false, IOS_CHROME_OLD)).toBe('ios-open-safari');
  });
});

describe('AppInstallSection (install guide)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens the Share steps on iPhone Chrome instead of doing nothing', async () => {
    setUserAgent(IOS_CHROME);
    const wrapper = mount(AppInstallSection);
    expect(wrapper.find('[data-testid="pwa-guide"]').exists()).toBe(false);

    await wrapper.get('[data-testid="pwa-download"]').trigger('click');
    await flushPromises();

    const steps = wrapper.get('[data-testid="pwa-guide-ios"]').text();
    expect(steps).toContain('next to the address bar');
    expect(steps).toContain('Add to Home Screen');
    expect(wrapper.find('[data-testid="pwa-copy-link"]').exists()).toBe(false);
  });

  it('uses the Safari toolbar wording in Safari', async () => {
    setUserAgent(IOS_SAFARI);
    const wrapper = mount(AppInstallSection);
    await wrapper.get('[data-testid="pwa-download"]').trigger('click');
    await flushPromises();
    expect(wrapper.get('[data-testid="pwa-guide-ios"]').text()).toContain('Safari toolbar');
  });

  it('offers to copy the link from an in-app browser', async () => {
    setUserAgent(IOS_INSTAGRAM);
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const wrapper = mount(AppInstallSection);
    await wrapper.get('[data-testid="pwa-download"]').trigger('click');
    await flushPromises();

    expect(wrapper.get('[data-testid="pwa-guide-safari-only"]').text()).toContain('Safari');
    await wrapper.get('[data-testid="pwa-copy-link"]').trigger('click');
    await flushPromises();
    expect(writeText).toHaveBeenCalledWith(window.location.origin);
    expect(wrapper.get('[data-testid="pwa-copy-link"]').text()).toContain('Link copied');
  });

  it('keeps the copy button usable when the clipboard is refused', async () => {
    setUserAgent(IOS_INSTAGRAM);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn(async () => Promise.reject(new Error('denied'))) },
      configurable: true,
    });
    const wrapper = mount(AppInstallSection);
    await wrapper.get('[data-testid="pwa-download"]').trigger('click');
    await wrapper.get('[data-testid="pwa-copy-link"]').trigger('click');
    await flushPromises();
    expect(wrapper.get('[data-testid="pwa-copy-link"]').text()).toContain('Copy link');
  });

  it('shows the Android menu steps and toggles closed on a second click', async () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 14) Chrome/126.0.0.0 Mobile');
    const wrapper = mount(AppInstallSection);
    const button = wrapper.get('[data-testid="pwa-download"]');
    await button.trigger('click');
    await flushPromises();
    expect(wrapper.get('[data-testid="pwa-guide-android"]').text()).toContain('Install app');

    await button.trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="pwa-guide"]').exists()).toBe(false);
  });

  it('shows the desktop hint after the browser prompt is dismissed', async () => {
    setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0');
    initPwaInstall();
    window.dispatchEvent(fakeInstallEvent('dismissed'));
    const wrapper = mount(AppInstallSection);

    await wrapper.get('[data-testid="pwa-download"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="pwa-guide"]').exists()).toBe(false);

    await wrapper.get('[data-testid="pwa-download"]').trigger('click');
    await flushPromises();
    expect(wrapper.get('[data-testid="pwa-guide-desktop"]').text()).toContain('address bar');
  });
});
