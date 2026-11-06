import { defineStore } from 'pinia';
import { ref } from 'vue';

/**
 * What the agent last said it offers the model (`tool_inventory`).
 *
 * The agent sends the model at most `limit` tools -- its own built-ins plus
 * the client's, trimmed from the tail -- and reports the outcome so the Tools
 * panel can show which tools exist in the app but not for the model. An agent
 * that predates the message never sends it; `inventory` then stays null and
 * the panel says what it can without it.
 */
export interface ToolInventory {
  limit: number;
  total: number;
  /** The agent's own tools that are on. */
  builtin: string[];
  /** How many client tools made it. */
  client: number;
  /** Client tools the trim left out, in registration order. */
  dropped: string[];
  receivedAt: number;
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

const count = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;

/** The message, read defensively: it crosses from another process and version. */
export function parseToolInventory(message: unknown, now = Date.now()): ToolInventory | null {
  if (!message || typeof message !== 'object') return null;
  const m = message as Record<string, unknown>;
  if (m.type !== 'tool_inventory') return null;
  return {
    limit: count(m.limit) || 128,
    total: count(m.total),
    builtin: strings(m.builtin),
    client: count(m.client),
    dropped: strings(m.dropped),
    receivedAt: now,
  };
}

export const useToolInventoryStore = defineStore('toolInventory', () => {
  const inventory = ref<ToolInventory | null>(null);

  function apply(message: unknown) {
    const parsed = parseToolInventory(message);
    if (parsed) inventory.value = parsed;
  }

  function clear() {
    inventory.value = null;
  }

  return { inventory, apply, clear };
});
