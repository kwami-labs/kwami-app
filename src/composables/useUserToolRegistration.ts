import { watch } from 'vue';
import type { Kwami } from 'kwami';
import { useKwami } from '@/composables/useKwami';
import { useToolCatalogStore } from '@/stores/toolCatalog';
import { useUserToolsStore } from '@/stores/userTools';
import { moveToolsToFront, registerToolBatch } from '@/lib/toolRegistration';
import { createWebhookHandler, toParametersSchema } from '@/lib/userTools';

/**
 * Keep the live instance's tools in step with the user's saved webhooks.
 *
 * Runs for every new instance and every change to the list: tools that were
 * removed or renamed are unregistered, the rest (re)registered, and the agent
 * hears about it once.
 *
 * User tools also go to the front of the list. The agent sends the model at
 * most 128 tools and, when the app's ~100 plus its own built-ins go over, cuts
 * from the tail -- where a tool registered after the app's always landed. So a
 * webhook the user had just added was the first thing the model lost.
 */
export function useUserToolRegistration() {
  const { kwami } = useKwami();
  const catalog = useToolCatalogStore();
  const store = useUserToolsStore();

  /** Names this composable registered on each instance, to know what to take back. */
  const ours = new WeakMap<Kwami, Set<string>>();

  function sync(live: Kwami) {
    const previous = ours.get(live) ?? new Set<string>();
    const wanted = new Map(store.webhooks.map((tool) => [tool.name, tool]));

    for (const name of previous) {
      if (wanted.has(name)) continue;
      live.tools.unregister(name);
      live.agent.unregisterTool(name);
      catalog.forget(name);
    }

    const registered = new Set<string>();
    registerToolBatch(
      live,
      ({ instance, group }) => {
        group('custom');
        for (const tool of wanted.values()) {
          // Never shadow one of the app's own tools. Validation already refuses
          // the name, but a saved tool can predate an app tool of that name.
          const existing = live.tools.get(tool.name);
          if (existing && !previous.has(tool.name)) continue;
          instance.registerTool({
            name: tool.name,
            description: tool.description,
            parameters: toParametersSchema(tool),
            handler: createWebhookHandler(tool),
          });
          registered.add(tool.name);
        }
        moveToolsToFront(live, registered);
      },
      catalog.record,
    );
    ours.set(live, registered);
    catalog.touch();
  }

  watch(
    [kwami, () => JSON.stringify(store.webhooks)],
    ([instance]) => {
      if (instance) sync(instance);
    },
    { immediate: true },
  );
}
