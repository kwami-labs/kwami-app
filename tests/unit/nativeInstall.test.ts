import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { flushPromises, mount } from '@vue/test-utils';
import AppInstallSection from '../../src/components/panels/settings/account/AppInstallSection.vue';
import { resetPwaInstallState } from '../../src/composables/usePwaInstall';
import {
  detectDevice,
  detectDeviceAccurately,
  detectNativeInstall,
  downloadWindowsInstaller,
  NATIVE_BUILDS,
  pickNativeBuild,
  WINDOWS_INSTALLER_URL,
  type DeviceInfo,
  type NativeBuild,
} from '../../src/lib/nativeInstall';

const WINDOWS_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0';
const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14) Chrome/120.0.0.0';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1';
const LINUX_UA = 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0.0.0';
const LINUX_ARM_UA = 'Mozilla/5.0 (X11; Linux aarch64) Chrome/120.0.0.0';

function build(os: NativeBuild['os'], arch: NativeBuild['arch'], url: string): NativeBuild {
  return {
    os,
    arch,
    url,
    fileName: url.slice(1),
    format: url.slice(url.lastIndexOf('.')),
    magic: '',
  };
}

const ALL_BUILDS: NativeBuild[] = [
  build('windows', ['x64'], '/w.exe'),
  build('windows', ['arm64'], '/wa.exe'),
  build('macos', ['arm64', 'x64'], '/m.dmg'),
  build('linux', ['x64'], '/l.AppImage'),
  build('android', ['arm64', 'x64'], '/a.apk'),
];

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

describe('detectDevice', () => {
  it('tells the system and processor from the user agent', () => {
    expect(detectDevice(WINDOWS_UA, 'Win32', 0)).toEqual({ os: 'windows', arch: 'x64' });
    expect(detectDevice(MAC_UA, 'MacIntel', 0)).toEqual({ os: 'macos', arch: 'unknown' });
    expect(detectDevice(ANDROID_UA, 'Linux armv8l', 5)).toEqual({ os: 'android', arch: 'arm64' });
    expect(detectDevice(ANDROID_UA, '', 5)).toEqual({ os: 'android', arch: 'arm64' });
    expect(detectDevice(IPHONE_UA, 'iPhone', 5).os).toBe('ios');
    expect(detectDevice(LINUX_UA, 'Linux x86_64', 0)).toEqual({ os: 'linux', arch: 'x64' });
    expect(detectDevice(LINUX_ARM_UA, 'Linux aarch64', 0)).toEqual({ os: 'linux', arch: 'arm64' });
  });

  it('sees an iPad that asks for the desktop site', () => {
    expect(detectDevice(MAC_UA, 'MacIntel', 5).os).toBe('ios');
  });

  it('takes the processor from client hints, which see through Windows on ARM', async () => {
    const nav = {
      userAgent: WINDOWS_UA,
      platform: 'Win32',
      maxTouchPoints: 0,
      userAgentData: {
        getHighEntropyValues: async () => ({ architecture: 'arm', bitness: '64' }),
      },
    } as unknown as Navigator;
    expect(await detectDeviceAccurately(nav)).toEqual({ os: 'windows', arch: 'arm64' });
  });

  it('keeps the user agent guess when client hints are refused', async () => {
    const nav = {
      userAgent: WINDOWS_UA,
      platform: 'Win32',
      maxTouchPoints: 0,
      userAgentData: {
        getHighEntropyValues: async () => {
          throw new Error('denied');
        },
      },
    } as unknown as Navigator;
    expect(await detectDeviceAccurately(nav)).toEqual({ os: 'windows', arch: 'x64' });
  });
});

describe('pickNativeBuild', () => {
  const pick = (device: DeviceInfo, builds = ALL_BUILDS) =>
    pickNativeBuild(device, builds)?.url ?? null;

  it('gives each device the file built for it', () => {
    expect(pick({ os: 'windows', arch: 'x64' })).toBe('/w.exe');
    expect(pick({ os: 'windows', arch: 'arm64' })).toBe('/wa.exe');
    expect(pick({ os: 'macos', arch: 'unknown' })).toBe('/m.dmg');
    expect(pick({ os: 'linux', arch: 'x64' })).toBe('/l.AppImage');
    expect(pick({ os: 'android', arch: 'arm64' })).toBe('/a.apk');
    expect(pick({ os: 'ios', arch: 'arm64' })).toBeNull();
  });

  it('falls back to the x64 build where the system emulates it, and nowhere else', () => {
    const onlyX64 = [ALL_BUILDS[0]!, ALL_BUILDS[3]!];
    expect(pick({ os: 'windows', arch: 'arm64' }, onlyX64)).toBe('/w.exe');
    // Linux on ARM cannot run an x64 AppImage.
    expect(pick({ os: 'linux', arch: 'arm64' }, onlyX64)).toBeNull();
  });
});

describe('detectNativeInstall', () => {
  it('offers a file only where one ships', () => {
    expect(detectNativeInstall({ os: 'windows', arch: 'x64' }, false)).toBe('available');
    expect(detectNativeInstall({ os: 'ios', arch: 'arm64' }, false, ALL_BUILDS)).toBe(
      'unsupported',
    );
    expect(detectNativeInstall({ os: 'android', arch: 'arm64' }, false, ALL_BUILDS)).toBe(
      'available',
    );
  });

  it('knows when it already runs inside the native app', () => {
    expect(detectNativeInstall({ os: 'windows', arch: 'x64' }, true)).toBe('running');
  });
});

describe('the files the button points at', () => {
  // A missing file would not fail loudly: Cloudflare falls back to the app's HTML for it.
  it.each(NATIVE_BUILDS.map((entry) => [entry.url, entry] as const))(
    '%s ships in public/ as the right kind of file, under the size Cloudflare accepts',
    (_url, entry) => {
      const file = join('public', entry.url);
      expect(existsSync(file)).toBe(true);
      const head = readFileSync(file).subarray(0, entry.magic.length).toString('latin1');
      expect(head).toBe(entry.magic);
      expect(statSync(file).size).toBeLessThan(25 * 1024 * 1024);
    },
  );

  it('keeps the Windows URL the first version published', () => {
    expect(NATIVE_BUILDS.some((entry) => entry.url === WINDOWS_INSTALLER_URL)).toBe(true);
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
    expect(native.text()).toContain('Native app (Tauri)');
    expect(native.text()).toContain('Rust · Tauri');
    expect(native.get('[data-testid="native-download"]').text()).toContain(
      'Download for Windows (.exe)',
    );
    expect(native.get('[data-testid="native-steps"]').text()).toContain('Run anyway');
  });

  it('starts the download when the native button is pressed', async () => {
    setUserAgent(WINDOWS_UA);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const wrapper = mount(AppInstallSection);
    await flushPromises();

    await wrapper.get('[data-testid="native-download"]').trigger('click');

    expect(click).toHaveBeenCalledTimes(1);
  });

  it('has no native button where there is no build, and keeps the PWA', async () => {
    setUserAgent(LINUX_ARM_UA);
    const wrapper = mount(AppInstallSection);
    await flushPromises();

    expect(wrapper.find('[data-testid="native-download"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="native-unsupported"]').text()).toContain(
      'no native build for Linux',
    );
    expect(wrapper.find('[data-testid="pwa-download"]').exists()).toBe(true);
  });

  it('sends iPhone users to the PWA, since Apple allows nothing else', async () => {
    setUserAgent(IPHONE_UA);
    const wrapper = mount(AppInstallSection);
    await flushPromises();

    expect(wrapper.find('[data-testid="native-download"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="native-unsupported"]').text()).toContain('App Store');
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
