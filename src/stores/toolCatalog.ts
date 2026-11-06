import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { ToolDefinition } from 'kwami';
import type { ToolGroupId } from '@/lib/toolRegistration';

/**
 * Which group each registered client tool belongs to, for the Tools panel.
 *
 * The SDK's registry knows a tool's name, description and schema, not where it
 * came from or what it is for. The app does, at the moment it registers it, so
 * it is recorded here then rather than guessed later from the name.
 */
export const useToolCatalogStore = defineStore('toolCatalog', () => {
  const groups = ref<Record<string, ToolGroupId>>({});
  /**
   * Tools of groups the user switched off: not in the registry, so kept here
   * (without their handlers) for the panel to list and switch back on.
   */
  const off = ref<Record<string, ToolDefinition>>({});
  /** Bumped whenever the set of registered tools may have changed. */
  const revision = ref(0);

  function record(name: string, group: ToolGroupId) {
    groups.value[name] = group;
    delete off.value[name];
  }

  function recordOff(tool: ToolDefinition, group: ToolGroupId) {
    groups.value[tool.name] = group;
    off.value[tool.name] = {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    };
  }

  function forget(name: string) {
    delete groups.value[name];
    delete off.value[name];
    revision.value += 1;
  }

  function touch() {
    revision.value += 1;
  }

  function groupOf(name: string): ToolGroupId {
    return groups.value[name] ?? 'other';
  }

  return { groups, off, revision, record, recordOff, forget, touch, groupOf };
});
