import { isTauri } from '@/lib/platform';

export type DeviceOs = 'windows' | 'macos' | 'linux' | 'android' | 'ios' | 'other';
export type DeviceArch = 'x64' | 'arm64' | 'unknown';

export interface DeviceInfo {
  os: DeviceOs;
  arch: DeviceArch;
}

export interface NativeBuild {
  os: Exclude<DeviceOs, 'ios' | 'other'>;
  /** Processors this file runs on natively, best first. */
  arch: DeviceArch[];
  /** Served from public/, so it ships with the same deploy as this code. */
  url: string;
  fileName: string;
  /** Shown on the button: `.exe`, `.apk`, `.dmg`… */
  format: string;
  /** First bytes of a real file of this kind: Cloudflare answers a missing path with HTML. */
  magic: string;
}

/**
 * Every native build kwami.io serves. Add a row when its file lands in public/downloads/;
 * the unit test refuses a row whose file is missing or is not that kind of file.
 */
export const NATIVE_BUILDS: NativeBuild[] = [
  {
    os: 'windows',
    arch: ['x64'],
    url: '/downloads/KWAMI-setup.exe',
    fileName: 'KWAMI-setup.exe',
    format: '.exe',
    magic: 'MZ',
  },
];

/** Kept for callers of the first version, which only knew Windows. */
export const WINDOWS_INSTALLER_URL = '/downloads/KWAMI-setup.exe';

function lower(value: string | undefined | null): string {
  return (value ?? '').toLowerCase();
}

/** What the user agent string alone tells: enough for the OS, a guess for the processor. */
export function detectDevice(
  userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '',
  platform = typeof navigator !== 'undefined' ? navigator.platform : '',
  maxTouchPoints = typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0,
): DeviceInfo {
  const ua = lower(userAgent);
  const plat = lower(platform);

  let os: DeviceOs = 'other';
  // iPadOS asks for the desktop site and says "Macintosh"; only the touch screen gives it away.
  if (/iphone|ipad|ipod/.test(ua) || (plat === 'macintel' && maxTouchPoints > 1)) os = 'ios';
  else if (/android/.test(ua)) os = 'android';
  else if (/windows nt/.test(ua)) os = 'windows';
  else if (/macintosh|mac os x/.test(ua)) os = 'macos';
  else if (/linux|x11|cros/.test(ua)) os = 'linux';

  let arch: DeviceArch = 'unknown';
  if (/arm64|aarch64|armv8|armv7|\barm\b/.test(ua) || /arm|aarch64/.test(plat)) arch = 'arm64';
  else if (/x86_64|x64|win64|wow64|amd64|x86-64|i686/.test(ua) || /win32|x86_64/.test(plat))
    arch = 'x64';
  // Phones are ARM; the rare x86 Android is an emulator, and the APK carries that too.
  if (os === 'android' && arch === 'unknown') arch = 'arm64';
  return { os, arch };
}

interface UADataValues {
  architecture?: string;
  bitness?: string;
  platform?: string;
}

interface NavigatorUAData {
  platform?: string;
  getHighEntropyValues?: (hints: string[]) => Promise<UADataValues>;
}

/**
 * Chromium browsers hide the processor in the user agent (Windows on ARM says "Win64; x64"),
 * but tell it through client hints. Falls back to the user agent anywhere else.
 */
export async function detectDeviceAccurately(
  nav: (Navigator & { userAgentData?: NavigatorUAData }) | undefined = typeof navigator !==
  'undefined'
    ? (navigator as Navigator & { userAgentData?: NavigatorUAData })
    : undefined,
): Promise<DeviceInfo> {
  const base = detectDevice(nav?.userAgent ?? '', nav?.platform ?? '', nav?.maxTouchPoints ?? 0);
  const hints = nav?.userAgentData?.getHighEntropyValues;
  if (!hints || base.os === 'ios') return base;
  try {
    const values = await hints.call(nav!.userAgentData, ['architecture', 'bitness']);
    const architecture = lower(values.architecture);
    if (architecture === 'arm') return { ...base, arch: 'arm64' };
    if (architecture === 'x86' && values.bitness === '64') return { ...base, arch: 'x64' };
  } catch {
    // Hints refused (privacy setting): the user agent guess stands.
  }
  return base;
}

/**
 * The file that runs best on this device: one built for its processor, else one the system
 * runs through emulation (Windows and macOS on ARM run x64 programs). Null means no native
 * build exists for it yet (iPhone and iPad cannot install apps from outside the App Store).
 */
export function pickNativeBuild(
  device: DeviceInfo,
  builds: NativeBuild[] = NATIVE_BUILDS,
): NativeBuild | null {
  const forOs = builds.filter((build) => build.os === device.os);
  if (forOs.length === 0) return null;
  const exact = forOs.find((build) => build.arch.includes(device.arch));
  if (exact) return exact;
  const emulates = device.os === 'windows' || device.os === 'macos';
  if (device.arch === 'unknown' || emulates) {
    return forOs.find((build) => build.arch.includes('x64')) ?? forOs[0] ?? null;
  }
  return null;
}

/** `running`: this is already the native app. `available`: there is a file for this device. */
export type NativeInstallState = 'running' | 'available' | 'unsupported';

export function detectNativeInstall(
  device: DeviceInfo = detectDevice(),
  running = isTauri(),
  builds: NativeBuild[] = NATIVE_BUILDS,
): NativeInstallState {
  if (running) return 'running';
  return pickNativeBuild(device, builds) ? 'available' : 'unsupported';
}

export function downloadNativeBuild(build: NativeBuild) {
  const link = document.createElement('a');
  link.href = build.url;
  link.download = build.fileName;
  link.click();
}

/** Kept for callers of the first version, which only knew Windows. */
export function downloadWindowsInstaller() {
  downloadNativeBuild(NATIVE_BUILDS[0]!);
}
