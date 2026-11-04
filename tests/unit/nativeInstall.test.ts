import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { mount } from '@vue/test-utils';
import AppInstallSection from '../../src/components/panels/settings/account/AppInstallSection.vue';
import { resetPwaInstallState } from '../../src/composables/usePwaInstall';
import {
  detectNativeInstall,
  downloadWindowsInstaller,
  WINDOWS_INSTALLER_URL,
} from '../../src/lib/nativeInstall';

const WINDOWS_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0';
const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14) Chrome/120.0.0.0';

function setUserAgent(value: string) {
  vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(value);
}

function enterTauri() {
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
}

afterEach(() => {
  vi.restoreAllMocks();
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  resetPwaInstallState();
});

describe('detectNativeInstall', () => {
  it('offers the installer on Windows only', () => {
    expect(detectNativeInstall(WINDOWS_UA, false)).toBe('windows');
    expect(detectNativeInstall(MAC_UA, false)).toBe('unsupported');
    expect(detectNativeInstall(ANDROID_UA, false)).toBe('unsupported');
  });

  it('knows when it already runs inside the native app', () => {
    expect(detectNativeInstall(WINDOWS_UA, true)).toBe('running');
  });
});

describe('the installer the button points at', () => {
  // A missing file would not fail loudly: Cloudflare falls back to the app's HTML for it.
  it('ships in public/ as a real Windows program, under the size Cloudflare accepts', () => {
    const file = join('public', WINDOWS_INSTALLER_URL);
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file).subarray(0, 2).toString()).toBe('MZ');
    expect(statSync(file).size).toBeLessThan(25 * 1024 * 1024);
  });

  it('downloads rather than navigates', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const made = vi.spyOn(document, 'createElement');

    downloadWindowsInstaller();

    const link = made.mock.results[0]?.value as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe(WINDOWS_INSTALLER_URL);
    expect(link.download).toBe('KWAMI-setup.exe');
    expect(click).toHaveBeenCalledTimes(1);
  });
});

describe('AppInstallSection', () => {
  it('shows the two ways to install as two distinct options on Windows', () => {
    setUserAgent(WINDOWS_UA);
    const wrapper = mount(AppInstallSection);

    const pwa = wrapper.get('[data-testid="pwa-card"]');
    expect(pwa.text()).toContain('Web app (PWA)');
    expect(pwa.text()).toContain('JS · PWA');
    expect(pwa.get('[data-testid="pwa-download"]').text()).toContain('Install PWA');

    const native = wrapper.get('[data-testid="native-card"]');
    expect(native.text()).toContain('Desktop app (Tauri)');
    expect(native.text()).toContain('Rust · Tauri');
    expect(native.get('[data-testid="native-download"]').text()).toContain('Download for Windows');
  });

  it('starts the download when the native button is pressed', async () => {
    setUserAgent(WINDOWS_UA);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const wrapper = mount(AppInstallSection);

    await wrapper.get('[data-testid="native-download"]').trigger('click');

    expect(click).toHaveBeenCalledTimes(1);
  });

  it('has no native button where there is no installer, and keeps the PWA', () => {
    setUserAgent(ANDROID_UA);
    const wrapper = mount(AppInstallSection);

    expect(wrapper.find('[data-testid="native-download"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="native-unsupported"]').text()).toContain('Only for Windows');
    expect(wrapper.find('[data-testid="pwa-download"]').exists()).toBe(true);
  });

  it('offers neither button inside the native app, where they would do nothing', () => {
    setUserAgent(WINDOWS_UA);
    enterTauri();
    const wrapper = mount(AppInstallSection);

    expect(wrapper.find('[data-testid="native-download"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="pwa-download"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="native-running"]').text()).toContain('using this app');
    expect(wrapper.get('[data-testid="pwa-inside-native"]').text()).toContain('kwami.io');
  });
});
