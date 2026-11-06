/**
 * The levels of access Jarvis can have on a website, in order: each includes the
 * ones before it. The API (`site_access_service.py`) and the agent
 * (`browser/access.py`) keep the same list; a level they do not know allows
 * nothing.
 */
export const SITE_ACCESS_LEVELS = ['blocked', 'read', 'browse', 'write', 'account'] as const;

export type SiteAccessLevel = (typeof SITE_ACCESS_LEVELS)[number];

/** What every site gets until the user sets something: how Jarvis worked before. */
export const DEFAULT_SITE_ACCESS: SiteAccessLevel = 'account';

export interface SiteAccessLevelMeta {
  icon: string;
  /** A CSS colour, used for the chip, the meter and the glow. */
  color: string;
}

export const SITE_ACCESS_META: Record<SiteAccessLevel, SiteAccessLevelMeta> = {
  blocked: { icon: 'ph:prohibit-duotone', color: '#f87171' },
  read: { icon: 'ph:eye-duotone', color: '#38bdf8' },
  browse: { icon: 'ph:cursor-click-duotone', color: '#22d3ee' },
  write: { icon: 'ph:pencil-simple-line-duotone', color: '#fbbf24' },
  account: { icon: 'ph:key-duotone', color: '#a78bfa' },
};

/** Sites people most often set, offered as one-tap shortcuts. */
export const SITE_SUGGESTIONS: readonly { host: string; level: SiteAccessLevel }[] = [
  { host: 'google.com', level: 'browse' },
  { host: 'mail.google.com', level: 'account' },
  { host: 'github.com', level: 'write' },
  { host: 'youtube.com', level: 'browse' },
  { host: 'wikipedia.org', level: 'read' },
  { host: 'amazon.es', level: 'browse' },
  { host: 'linkedin.com', level: 'read' },
  { host: 'x.com', level: 'read' },
];

export function isSiteAccessLevel(value: unknown): value is SiteAccessLevel {
  return (SITE_ACCESS_LEVELS as readonly unknown[]).includes(value);
}

/** Whether `level` covers what `needed` asks for. */
export function siteAccessAllows(level: SiteAccessLevel, needed: SiteAccessLevel): boolean {
  return SITE_ACCESS_LEVELS.indexOf(level) >= SITE_ACCESS_LEVELS.indexOf(needed);
}

/**
 * The host a rule is kept for, as the API will store it: `https://www.GitHub.com/x`
 * becomes `github.com`. Null when it cannot be a site. A preview only; the API
 * has the last word.
 */
export function siteHost(address: string): string | null {
  const raw = address.trim();
  if (!raw || /\s/.test(raw)) return null;
  let host: string;
  try {
    host = new URL(raw.includes('://') ? raw : `https://${raw}`).hostname;
  } catch {
    return null;
  }
  host = host.toLowerCase().replace(/\.$/, '');
  if (host.startsWith('*.')) host = host.slice(2);
  if (host.startsWith('www.')) host = host.slice(4);
  if (!host.includes('.') || host.startsWith('.') || host.includes('..')) return null;
  return host;
}

/** A steady hue for a site's monogram, so the same site always looks the same. */
export function siteHue(host: string): number {
  let hash = 0;
  for (let i = 0; i < host.length; i++) hash = (hash * 31 + host.charCodeAt(i)) >>> 0;
  return hash % 360;
}
