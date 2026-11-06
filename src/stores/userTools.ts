import { defineStore } from 'pinia';
import { ref } from 'vue';
import { parseUserTools, type UserWebhookTool } from '@/lib/userTools';

export interface UserToolsSnapshot {
  webhooks: UserWebhookTool[];
}

/**
 * The tools a user added to the active kwami.
 *
 * Part of the kwami's config, like its theme or voice: it follows the same
 * draft-then-save flow (the sidebar's save button), switches with the kwami,
 * and is stored on the user's own `user_kwamis` row.
 */
export const useUserToolsStore = defineStore('userTools', () => {
  const webhooks = ref<UserWebhookTool[]>([]);

  function getSnapshot(): UserToolsSnapshot {
    return { webhooks: webhooks.value.map((tool) => toPlain(tool)) };
  }

  /** `null` clears: a kwami with no tools must not inherit the previous one's. */
  function applySnapshot(snapshot: unknown) {
    const raw = snapshot && typeof snapshot === 'object' ? snapshot : {};
    webhooks.value = parseUserTools((raw as Record<string, unknown>).webhooks);
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

  return { webhooks, getSnapshot, applySnapshot, save, remove, find };
});

/** A JSON copy: the snapshot goes to the account row and must hold no reactive proxies. */
function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
