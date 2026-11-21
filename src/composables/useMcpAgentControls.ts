import { useI18n } from 'vue-i18n';
import { useMcpServers } from '@/composables/useMcpServers';
import { useAgentActionState } from '@/composables/useAgentActionState';
import { useUserToolsStore } from '@/stores/userTools';
import { useWorkspaceStore } from '@/stores/workspace';
import { useAuthStore } from '@/stores/auth';
import {
  MCP_SERVER_NAME_MAX,
  validateMcpServer,
  type McpServerIssue,
  type SavedMcpServer,
} from '@/lib/mcpServers';

/**
 * MCP servers by voice: the `tools` domain of `set_ui_control`.
 *
 * Jarvis can list the user's tool servers, connect one and take one away, as the Tools
 * panel does by hand: the same check (https, or http on this machine), the same "saved
 * only once it actually connected", the same place in the kwami's config. Asked for in
 * the user's own words, it is one more thing Jarvis can do for them; that is why the
 * description says so, and why a server a page or an email suggests is not one.
 *
 * Never a key. A server that asks for one is left for the user to paste in the panel:
 * a key said aloud is in the transcript, the memory and the provider's logs.
 */

const NAME_STOPWORDS = new Set([
  'mcp',
  'www',
  'api',
  'server',
  'com',
  'io',
  'dev',
  'app',
  'net',
  'org',
]);

function fold(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** A short name for a server from its address: `mcp.deepwiki.com/mcp` is `deepwiki`. */
export function nameFromUrl(url: string): string {
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    return '';
  }
  const words = host.split('.').filter((w) => w && !NAME_STOPWORDS.has(w));
  const name = (words[0] ?? host).replace(/[^a-z0-9_-]/gi, '').toLowerCase();
  return name.slice(0, MCP_SERVER_NAME_MAX);
}

/** What the model sent as the server: `{ name, url }`, a url, or "name url". */
export function parseServerValue(value: unknown): { name: string; url: string } {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const v = value as Record<string, unknown>;
    const url = typeof v.url === 'string' ? v.url.trim() : '';
    const name = typeof v.name === 'string' ? v.name.trim() : '';
    return { url, name: name || nameFromUrl(url) };
  }
  const text = typeof value === 'string' ? value.trim() : '';
  const url = text.split(/\s+/).find((part) => /^https?:\/\//i.test(part)) ?? '';
  const name = text
    .replace(url, '')
    .trim()
    .replace(/[^\p{L}\p{N}_ -]/gu, '')
    .trim();
  return { url, name: (name || nameFromUrl(url)).slice(0, MCP_SERVER_NAME_MAX) };
}

export function useMcpAgentControls() {
  const { t } = useI18n();
  const userTools = useUserToolsStore();
  const mcp = useMcpServers();
  const actionState = useAgentActionState();
  const workspace = useWorkspaceStore();
  const auth = useAuthStore();

  /**
   * Keep the change on the kwami at once: asked for aloud, it is meant to stay, and a
   * draft would be gone on the next reload, with a tool window waiting for it forever.
   */
  async function keep(): Promise<boolean> {
    try {
      return await workspace.saveActiveConfigPart('tools', userTools.getSnapshot(), auth.userId);
    } catch {
      return false;
    }
  }

  function find(value: unknown): SavedMcpServer | undefined {
    const wanted = fold(
      typeof value === 'string'
        ? value
        : value && typeof value === 'object'
          ? String(
              (value as Record<string, unknown>).name ??
                (value as Record<string, unknown>).url ??
                '',
            )
          : '',
    ).trim();
    if (!wanted) return undefined;
    return (
      userTools.mcpServers.find((s) => fold(s.name) === wanted || s.url === wanted) ??
      userTools.mcpServers.find(
        (s) => fold(s.name).includes(wanted) || wanted.includes(fold(s.name)),
      )
    );
  }

  function describe(server: SavedMcpServer) {
    const state = mcp.states[server.name];
    return {
      name: server.name,
      url: server.url,
      status: state?.status ?? 'off',
      tools: Object.values(state?.exposed ?? {}),
      ...(server.disabledTools?.length ? { switchedOff: server.disabledTools } : {}),
      ...(state?.error ? { error: state.error.message || state.error.kind } : {}),
    };
  }

  function list() {
    return {
      success: true,
      servers: userTools.mcpServers.map(describe),
      message: t('workspaceAgentTools.mcpListed', { n: userTools.mcpServers.length }),
    };
  }

  function issueText(issues: McpServerIssue[]): string {
    return issues.map((issue) => t(`workspaceAgentTools.mcpIssue.${issue}`)).join(' ');
  }

  async function connect(value: unknown) {
    const asked = parseServerValue(value);
    const same = userTools.mcpServers.find((s) => s.url === asked.url);
    if (same) return reconnect(same.name);

    let name = asked.name;
    const taken = new Set(userTools.mcpServers.map((s) => s.name));
    for (let n = 2; name && taken.has(name); n += 1) name = `${asked.name.slice(0, 36)}-${n}`;
    const server: SavedMcpServer = { name, url: asked.url };
    const issues = validateMcpServer(server, taken);
    if (issues.length) {
      return { success: false, message: issueText(issues) };
    }

    await mcp.connect(server);
    const state = mcp.states[server.name];
    if (state?.status !== 'connected') {
      const kind = state?.error?.kind ?? 'unknown';
      // Not saved: nothing of it stays registered or listed.
      mcp.disconnect(server.name);
      return {
        success: false,
        message:
          kind === 'unauthorized'
            ? t('workspaceAgentTools.mcpNeedsKey', { name: server.name })
            : kind === 'network'
              ? t('workspaceAgentTools.mcpUnreachable', { name: server.name })
              : t('workspaceAgentTools.mcpFailed', {
                  name: server.name,
                  reason: state?.error?.message || kind,
                }),
      };
    }
    userTools.saveServer(server);
    const kept = await keep();
    const message = t(
      kept ? 'workspaceAgentTools.mcpConnected' : 'workspaceAgentTools.mcpConnectedDraft',
      {
        name: server.name,
        n: state.tools.length,
      },
    );
    actionState.recordAction(message);
    return { success: true, message, ...describe(server) };
  }

  async function reconnect(value: unknown) {
    const server = find(value);
    if (!server) return { success: false, message: t('workspaceAgentTools.mcpNotFound') };
    await mcp.connect(server);
    const described = describe(server);
    return {
      success: described.status === 'connected',
      message: t(
        described.status === 'connected'
          ? 'workspaceAgentTools.mcpReconnected'
          : 'workspaceAgentTools.mcpStillDown',
        { name: server.name },
      ),
      ...described,
    };
  }

  async function remove(value: unknown) {
    const server = find(value);
    if (!server) return { success: false, message: t('workspaceAgentTools.mcpNotFound') };
    userTools.removeServer(server.name); // the sync disconnects it and drops its tools
    await keep();
    const message = t('workspaceAgentTools.mcpRemoved', { name: server.name });
    actionState.recordAction(message);
    return { success: true, message };
  }

  /** `set_ui_control` with domain tools: `normalizedControl` is lowercase, no separators. */
  function control(normalizedControl: string, value: unknown) {
    if (['listmcp', 'list', 'servers', 'mcp', 'status'].includes(normalizedControl)) return list();
    if (['connectmcp', 'addmcp', 'connect', 'add'].includes(normalizedControl))
      return connect(value);
    if (
      ['removemcp', 'disconnectmcp', 'remove', 'disconnect', 'delete'].includes(normalizedControl)
    ) {
      return remove(value);
    }
    if (['reconnectmcp', 'reconnect', 'retry'].includes(normalizedControl)) return reconnect(value);
    return { success: false, message: t('workspaceAgentTools.toolsControlsHint') };
  }

  return { control, list, connect, reconnect, remove };
}
