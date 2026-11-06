import { defineStore } from 'pinia';
import { ref } from 'vue';
import { parseUserTools, type UserWebhookTool } from '@/lib/userTools';
import { parseMcpServers, type SavedMcpServer } from '@/lib/mcpServers';
import { OPTIONAL_TOOL_GROUPS, type ToolGroupId } from '@/lib/toolRegistration';

export interface UserToolsSnapshot {
  webhooks: UserWebhookTool[];
  mcpServers: SavedMcpServer[];
  /** App tool groups the user switched off for this kwami. */
  disabledGroups: ToolGroupId[];
}

/**
 * The tools a user added to the active kwami: webhooks and MCP servers.
 *
 * Part of the kwami's config, like its theme or voice: it follows the same
 * draft-then-save flow (the sidebar's save button), switches with the kwami,
 * and is stored on the user's own `user_kwamis` row. MCP keys are not part of
 * it; they stay on the device (lib/mcpServers).
 */
export const useUserToolsStore = defineStore('userTools', () => {
  const webhooks = ref<UserWebhookTool[]>([]);
  const mcpServers = ref<SavedMcpServer[]>([]);
  const disabledGroups = ref<ToolGroupId[]>([]);

  function getSnapshot(): UserToolsSnapshot {
    return {
      webhooks: webhooks.value.map((tool) => toPlain(tool)),
      mcpServers: mcpServers.value.map((server) => toPlain(server)),
      disabledGroups: [...disabledGroups.value],
    };
  }

  /** `null` clears: a kwami with no tools must not inherit the previous one's. */
  function applySnapshot(snapshot: unknown) {
    const raw = (snapshot && typeof snapshot === 'object' ? snapshot : {}) as Record<
      string,
      unknown
    >;
    webhooks.value = parseUserTools(raw.webhooks);
    mcpServers.value = parseMcpServers(raw.mcpServers);
    disabledGroups.value = Array.isArray(raw.disabledGroups)
      ? [...new Set(raw.disabledGroups)].filter((g): g is ToolGroupId =>
          OPTIONAL_TOOL_GROUPS.has(g as ToolGroupId),
        )
      : [];
  }

  /** Switch one of the app's tool groups on or off for the agent. */
  function setGroupEnabled(group: ToolGroupId, enabled: boolean) {
    if (!OPTIONAL_TOOL_GROUPS.has(group)) return;
    const next = new Set(disabledGroups.value);
    if (enabled) next.delete(group);
    else next.add(group);
    disabledGroups.value = [...next].sort();
  }

  /** Add, or replace the tool called `previousName` (a rename keeps its place). */
  function save(tool: UserWebhookTool, previousName?: string) {
    const key = previousName ?? tool.name;
    const index = webhooks.value.findIndex((t) => t.name === key);
    if (index === -1) webhooks.value = [...webhooks.value, tool];
    else webhooks.value = webhooks.value.map((t, i) => (i === index ? tool : t));
  }

  function remove(name: string) {
    webhooks.value = webhooks.value.filter((t) => t.name !== name);
  }

  function find(name: string): UserWebhookTool | undefined {
    return webhooks.value.find((t) => t.name === name);
  }

  function saveServer(server: SavedMcpServer) {
    const index = mcpServers.value.findIndex((s) => s.name === server.name);
    if (index === -1) mcpServers.value = [...mcpServers.value, server];
    else mcpServers.value = mcpServers.value.map((s, i) => (i === index ? server : s));
  }

  function removeServer(name: string) {
    mcpServers.value = mcpServers.value.filter((s) => s.name !== name);
  }

  /** Switch one of a server's tools on or off for the agent. */
  function setServerToolEnabled(serverName: string, tool: string, enabled: boolean) {
    mcpServers.value = mcpServers.value.map((server) => {
      if (server.name !== serverName) return server;
      const disabled = new Set(server.disabledTools ?? []);
      if (enabled) disabled.delete(tool);
      else disabled.add(tool);
      return { ...server, disabledTools: [...disabled].sort() };
    });
  }

  return {
    webhooks,
    mcpServers,
    disabledGroups,
    setGroupEnabled,
    getSnapshot,
    applySnapshot,
    save,
    remove,
    find,
    saveServer,
    removeServer,
    setServerToolEnabled,
  };
});

/** A JSON copy: the snapshot goes to the account row and must hold no reactive proxies. */
function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
