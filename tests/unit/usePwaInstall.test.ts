import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import {
  detectPwaPlatform,
  detectStandaloneDisplay,
  initPwaInstall,
  promptPwaInstall,
  resetPwaInstallState,
  usePwaInstall,
} from '../../src/composables/usePwaInstall';
import PwaInstallSection from '../../src/components/panels/settings/account/PwaInstallSection.vue';
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
    expect(detectPwaPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5, 'MacIntel')).toBe('ios');
  });

  it('detects Android and desktop', () => {
    expect(detectPwaPlatform('Mozilla/5.0 (Linux; Android 14) Chrome/120.0.0.0')).toBe('android');
    expect(detectPwaPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0')).toBe('desktop');
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

describe('PwaInstallSection', () => {
  it('renders the download button when the app is not installed', () => {
    const wrapper = mount(PwaInstallSection);
    expect(wrapper.get('[data-testid="pwa-download"]').text()).toContain('Download app');
    expect(wrapper.text()).toContain('Use as a native app');
  });

  it('shows the installed state after a successful prompt', async () => {
    initPwaInstall();
    window.dispatchEvent(fakeInstallEvent('accepted'));

    const wrapper = mount(PwaInstallSection);
    await wrapper.get('[data-testid="pwa-download"]').trigger('click');
    await flushPromises();

    expect(wrapper.get('[data-testid="pwa-installed"]').text()).toContain('Installed on this device');
  });
});
