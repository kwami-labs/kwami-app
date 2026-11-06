import { onBeforeUnmount, onMounted } from 'vue';
import { useToolInventoryStore } from '@/stores/toolInventory';

/**
 * Keep the agent's latest `tool_inventory` report in the store.
 *
 * Kept after the session ends, with the time it arrived: the Tools panel is
 * mostly opened between calls, and the last report is still the best account
 * of what the model gets.
 */
export function useToolInventorySync() {
  const store = useToolInventoryStore();

  function onAgentMessage(event: Event) {
    const detail = (event as CustomEvent).detail as { type?: string } | undefined;
    if (detail?.type === 'tool_inventory') store.apply(detail);
  }

  onMounted(() => window.addEventListener('kwami:agent_message', onAgentMessage));
  onBeforeUnmount(() => window.removeEventListener('kwami:agent_message', onAgentMessage));
}
