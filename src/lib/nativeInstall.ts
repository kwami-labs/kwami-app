import { isTauri } from '@/lib/platform';

/** Same deploy as this code, so the button can never point at a file that is not there yet. */
export const WINDOWS_INSTALLER_URL = '/downloads/KWAMI-setup.exe';
const WINDOWS_INSTALLER_NAME = 'KWAMI-setup.exe';

/** `running`: this is already the native app. `unsupported`: no installer for this system yet. */
export type NativeInstallState = 'running' | 'windows' | 'unsupported';

export function detectNativeInstall(
  userAgent = navigator.userAgent,
  running = isTauri(),
): NativeInstallState {
  if (running) return 'running';
  return /windows nt/i.test(userAgent) ? 'windows' : 'unsupported';
}

export function downloadWindowsInstaller() {
  const link = document.createElement('a');
  link.href = WINDOWS_INSTALLER_URL;
  link.download = WINDOWS_INSTALLER_NAME;
  link.click();
}
