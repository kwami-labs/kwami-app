/**
 * MCP servers as saved on a kwami, and their keys, which are not.
 *
 * The server list is part of the kwami's config and goes to the user's
 * account row. An API key does not: it is a credential for someone else's
 * service, and the config is also what a theme export or a support dump would
 * copy. So keys live in memory for the session, and in this browser's storage
 * only when the user ticks "remember on this device".
 */

export interface SavedMcpServer {
  /** Shown in the panel and used as the prefix of its tools' names. */
  name: string;
  url: string;
  /** Tools the user switched off for the agent. */
  disabledTools?: string[];
}

export const MCP_SERVER_NAME_MAX = 40;

export type McpServerIssue = 'nameRequired' | 'nameTaken' | 'urlInvalid' | 'urlInsecure';

function isLocalHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname.endsWith('.localhost')
  );
}

export function validateMcpServer(
  server: Pick<SavedMcpServer, 'name' | 'url'>,
  takenNames: ReadonlySet<string>,
): McpServerIssue[] {
  const issues: McpServerIssue[] = [];
  const name = server.name.trim();
  if (!name || name.length > MCP_SERVER_NAME_MAX) issues.push('nameRequired');
  else if (takenNames.has(name)) issues.push('nameTaken');
  let url: URL | null = null;
  try {
    url = new URL(server.url.trim());
  } catch {
    url = null;
  }
  if (!url || !/^https?:$/.test(url.protocol)) issues.push('urlInvalid');
  else if (url.protocol === 'http:' && !isLocalHost(url.hostname)) issues.push('urlInsecure');
  return issues;
}

/** Read saved servers back, dropping entries that would not validate. */
export function parseMcpServers(raw: unknown): SavedMcpServer[] {
  if (!Array.isArray(raw)) return [];
  const servers: SavedMcpServer[] = [];
  const names = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.name !== 'string' || typeof e.url !== 'string') continue;
    const server: SavedMcpServer = { name: e.name.trim(), url: e.url.trim() };
    if (validateMcpServer(server, names).length) continue;
    if (Array.isArray(e.disabledTools)) {
      const disabled = e.disabledTools.filter((t): t is string => typeof t === 'string');
      if (disabled.length) server.disabledTools = disabled;
    }
    names.add(server.name);
    servers.push(server);
  }
  return servers;
}

const KEY_PREFIX = 'kwami.mcpKey:';
const sessionKeys = new Map<string, string>();

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** The key for a server address: this session's, else the one remembered here. */
export function getMcpKey(url: string): string | undefined {
  return sessionKeys.get(url) ?? storage()?.getItem(KEY_PREFIX + url) ?? undefined;
}

export function setMcpKey(url: string, key: string, remember: boolean): void {
  if (!key) {
    forgetMcpKey(url);
    return;
  }
  sessionKeys.set(url, key);
  if (remember) storage()?.setItem(KEY_PREFIX + url, key);
  else storage()?.removeItem(KEY_PREFIX + url);
}

export function forgetMcpKey(url: string): void {
  sessionKeys.delete(url);
  storage()?.removeItem(KEY_PREFIX + url);
}

export function isMcpKeyRemembered(url: string): boolean {
  return storage()?.getItem(KEY_PREFIX + url) != null;
}
