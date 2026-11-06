import { reactive, watch } from 'vue';
import type { Kwami } from 'kwami';
import { useKwami } from '@/composables/useKwami';
import { useToolCatalogStore } from '@/stores/toolCatalog';
import { useUserToolsStore } from '@/stores/userTools';
import { moveToolsToFront, registerToolBatch } from '@/lib/toolRegistration';
import {
  McpClient,
  McpError,
  exposedToolName,
  flattenCallResult,
  sanitizeInputSchema,
  type McpErrorKind,
  type McpServerInfo,
  type McpTool,
} from '@/lib/mcpClient';
import { getMcpKey, type SavedMcpServer } from '@/lib/mcpServers';

export type McpStatus = 'connecting' | 'connected' | 'error';

export interface McpServerState {
  status: McpStatus;
  error?: { kind: McpErrorKind | 'unknown'; message: string };
  serverInfo?: McpServerInfo;
  /** Every tool the server offers, enabled or not. */
  tools: McpTool[];
  /** Exposed (registered) name per server tool name, for the enabled ones. */
  exposed: Record<string, string>;
}

/** Longest description handed to the model per MCP tool: they cost tokens every turn. */
const MAX_DESCRIPTION = 1024;

// Module scope: one set of connections for the app, shared by the App-level
// sync and the panel's buttons.
const states = reactive<Record<string, McpServerState>>({});
const clients = new Map<
  string,
  { client: McpClient; url: string; signature: string; registered: Set<string> }
>();
/** Bumped per connect, so a slow answer from a superseded attempt is dropped. */
const attempts = new Map<string, number>();

/** What, of a saved server, decides which tools are registered. */
function signatureOf(server: SavedMcpServer): string {
  return JSON.stringify([server.url, [...(server.disabledTools ?? [])].sort()]);
}

function describeError(e: unknown): { kind: McpErrorKind | 'unknown'; message: string } {
  if (e instanceof McpError) return { kind: e.kind, message: e.message };
  return { kind: 'unknown', message: e instanceof Error ? e.message : String(e) };
}

/**
 * Connect the MCP servers saved on the kwami, and register their tools.
 *
 * Tools are exposed as `server__tool`: unique across servers, safe for every
 * provider's name rules, and telling the model where each comes from. Their
 * schemas are reduced to the subset every provider accepts.
 */
export function useMcpServers() {
  const { kwami } = useKwami();
  const catalog = useToolCatalogStore();
  const userTools = useUserToolsStore();

  function unregister(live: Kwami | null | undefined, names: Iterable<string>) {
    for (const name of names) {
      if (live) {
        live.tools.unregister(name);
        live.agent.unregisterTool(name);
      }
      catalog.forget(name);
    }
  }

  function register(
    live: Kwami,
    server: SavedMcpServer,
    client: McpClient,
    tools: McpTool[],
  ): Record<string, string> {
    const disabled = new Set(server.disabledTools ?? []);
    const exposed: Record<string, string> = {};
    registerToolBatch(
      live,
      ({ instance, group }) => {
        group('mcp');
        for (const tool of tools) {
          if (disabled.has(tool.name)) continue;
          let name = exposedToolName(server.name, tool.name);
          // Never take a name something else holds: an app tool, or a tool of
          // another server that cleaned up to the same string.
          for (let n = 2; live.tools.get(name) && catalog.groupOf(name) !== 'mcp'; n += 1) {
            name = `${exposedToolName(server.name, tool.name).slice(0, 60)}_${n}`;
          }
          exposed[tool.name] = name;
          const description = `[${server.name}] ${tool.description?.trim() || tool.name}`;
          instance.registerTool({
            name,
            description:
              description.length > MAX_DESCRIPTION
                ? `${description.slice(0, MAX_DESCRIPTION - 1)}…`
                : description,
            parameters: sanitizeInputSchema(tool.inputSchema ?? { type: 'object' }),
            handler: async (args) => {
              try {
                const result = flattenCallResult(await client.callTool(tool.name, args));
                return result.ok ? result.text : { ok: false, error: result.text };
              } catch (e) {
                return { ok: false, error: describeError(e).message };
              }
            },
          });
        }
        moveToolsToFront(live, new Set(Object.values(exposed)));
      },
      catalog.record,
    );
    catalog.touch();
    return exposed;
  }

  /** Connect (or reconnect) one server and register its enabled tools. */
  async function connect(server: SavedMcpServer, live: Kwami | null = kwami.value ?? null) {
    const attempt = (attempts.get(server.name) ?? 0) + 1;
    attempts.set(server.name, attempt);
    const previous = clients.get(server.name);
    states[server.name] = {
      status: 'connecting',
      tools: states[server.name]?.tools ?? [],
      exposed: {},
    };

    const client = new McpClient({ url: server.url, apiKey: getMcpKey(server.url) });
    try {
      await client.connect();
      const tools = await client.listTools();
      if (attempts.get(server.name) !== attempt) return; // superseded

      if (previous) {
        unregister(live, previous.registered);
        void previous.client.close();
      }
      const exposed = live ? register(live, server, client, tools) : {};
      clients.set(server.name, {
        client,
        url: server.url,
        signature: signatureOf(server),
        registered: new Set(Object.values(exposed)),
      });
      states[server.name] = {
        status: 'connected',
        serverInfo: client.serverInfo,
        tools,
        exposed,
      };
    } catch (e) {
      if (attempts.get(server.name) !== attempt) return;
      states[server.name] = {
        status: 'error',
        error: describeError(e),
        tools: [],
        exposed: {},
      };
    }
  }

  function disconnect(name: string, live: Kwami | null = kwami.value ?? null) {
    attempts.set(name, (attempts.get(name) ?? 0) + 1);
    const entry = clients.get(name);
    if (entry) {
      unregister(live, entry.registered);
      void entry.client.close();
      clients.delete(name);
    }
    delete states[name];
  }

  /**
   * Re-register a connected server's tools after its on/off choices changed,
   * without reconnecting.
   */
  function refreshTools(server: SavedMcpServer, live: Kwami | null = kwami.value ?? null) {
    const entry = clients.get(server.name);
    const state = states[server.name];
    if (!entry || !state || state.status !== 'connected' || !live) return;
    unregister(live, entry.registered);
    const exposed = register(live, server, entry.client, state.tools);
    entry.registered = new Set(Object.values(exposed));
    entry.signature = signatureOf(server);
    state.exposed = exposed;
  }

  /**
   * Keep connections in step with the saved list and the live instance: new
   * servers connect, removed ones disconnect, changed addresses reconnect, and
   * a new instance (a kwami switch, a reconnect) gets every server again.
   */
  function startSync() {
    let lastLive: Kwami | null = null;
    watch(
      [kwami, () => JSON.stringify(userTools.mcpServers)],
      ([live]) => {
        const instance = (live as Kwami | null) ?? null;
        const saved = new Map(userTools.mcpServers.map((s) => [s.name, s]));
        const newInstance = instance !== lastLive;
        lastLive = instance;

        for (const name of [...clients.keys(), ...Object.keys(states)]) {
          if (!saved.has(name)) disconnect(name, instance);
        }
        if (!instance) return;
        for (const server of saved.values()) {
          const entry = clients.get(server.name);
          const state = states[server.name];
          if (newInstance || !state || (entry && entry.url !== server.url)) {
            void connect(server, instance);
          } else if (entry && entry.signature !== signatureOf(server)) {
            refreshTools(server, instance);
          }
        }
      },
      { immediate: true },
    );
  }

  return { states, connect, disconnect, refreshTools, startSync };
}
