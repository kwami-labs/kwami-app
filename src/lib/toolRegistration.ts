import type { Kwami, ToolDefinition } from 'kwami';

/**
 * What a client tool is for, as the Tools panel groups it.
 *
 * Ordered as the panel lists them. `custom` and `mcp` are the ones a user adds;
 * `other` catches anything registered outside a labelled batch, so a tool is
 * never missing from the panel just because nobody gave it a group.
 */
export const TOOL_GROUPS = [
  'interface',
  'appearance',
  'personality',
  'search',
  'memory',
  'assistant',
  'communications',
  'email',
  'calendar',
  'google',
  'companions',
  'extras',
  'custom',
  'mcp',
  'other',
] as const;

export type ToolGroupId = (typeof TOOL_GROUPS)[number];

/** The groups whose tools a user created, as opposed to the app's own. */
export const USER_TOOL_GROUPS: ReadonlySet<ToolGroupId> = new Set<ToolGroupId>(['custom', 'mcp']);

export interface ToolBatchScope {
  /**
   * Stands in for the live instance. Registrars take it wherever they take a
   * `Kwami`: its `registerTool` files the tool under the current group and
   * defers the backend sync; everything else is the live instance's.
   */
  instance: Kwami;
  /** The group for every tool registered from here on. */
  group: (id: ToolGroupId) => void;
}

/**
 * Register a burst of tools as one change to the agent.
 *
 * `Kwami.registerTool` sends the agent the whole tool list every time it is
 * called while connected. The app registers its hundred tools in one go -- and
 * again on every language switch, because the descriptions are translated -- so
 * saying "speak English" mid-call sent a hundred copies of a ~37 KB list over
 * the data channel, and the agent rebuilt its tools a hundred times in the
 * middle of its answer. Here the registry and the dispatch table are filled
 * directly (the two halves of `registerTool`), and the list goes out once, at
 * the end, if a session is live.
 *
 * `onRegistered` hears each tool's name with the group it was filed under.
 */
export function registerToolBatch(
  live: Kwami,
  fill: (scope: ToolBatchScope) => void,
  onRegistered: (name: string, group: ToolGroupId) => void,
): void {
  let current: ToolGroupId = 'other';

  // A child of the live instance rather than a copy: `agent`, `soul` and the
  // rest resolve through the prototype to the real objects.
  const instance = Object.create(live, {
    registerTool: {
      value(tool: ToolDefinition) {
        live.tools.register(tool);
        if (tool.handler) live.agent.registerTool(tool.name, tool.handler);
        onRegistered(tool.name, current);
      },
    },
  }) as Kwami;

  try {
    fill({ instance, group: (id) => (current = id) });
  } finally {
    // Also after a registrar throws: the tools that did register must reach a
    // live agent, or it would keep offering the previous set.
    if (live.isConnected()) {
      live.agent.syncConfigToBackend('tools', live.tools.getToolDefinitions());
    }
  }
}
