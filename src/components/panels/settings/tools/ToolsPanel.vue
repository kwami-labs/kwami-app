<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { panelIcons } from '@/constants/panel-icons';
import { useToast } from 'vue-toastification';
import { useKwami } from '@/composables/useKwami';
import type { ToolDefinition } from 'kwami';
import PanelSection from '@/components/ui/PanelSection.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import PanelHeaderControls from '@/components/ui/PanelHeaderControls.vue';
import { useToolCatalogStore } from '@/stores/toolCatalog';
import { USER_TOOL_GROUPS, type ToolGroupId } from '@/lib/toolRegistration';
import { useToolInventoryStore } from '@/stores/toolInventory';
import ToolBudget from './ToolBudget.vue';
import ToolCatalog from './ToolCatalog.vue';
import CustomToolEditor from './CustomToolEditor.vue';
import McpServers from './McpServers.vue';
import ToolTester from './ToolTester.vue';
import { useMcpServers } from '@/composables/useMcpServers';
import { useUserToolsStore } from '@/stores/userTools';
import type { UserWebhookTool } from '@/lib/userTools';

const toast = useToast();
const { t } = useI18n();

const { kwami } = useKwami();
const catalog = useToolCatalogStore();
const userTools = useUserToolsStore();

type Tab = 'catalog' | 'create' | 'mcp' | 'test';
const activeTab = ref<Tab>('catalog');

const TABS: { id: Tab; icon: string }[] = [
  { id: 'catalog', icon: 'ph:books-duotone' },
  { id: 'create', icon: 'ph:plus-circle-duotone' },
  { id: 'mcp', icon: 'ph:plugs-connected-duotone' },
  { id: 'test', icon: 'ph:play-circle-duotone' },
];

/**
 * The registry is not reactive; the catalog store's revision is bumped whenever
 * the app registers its tools (connect, language switch) or this panel adds or
 * removes one, and that is what makes the list follow.
 */
const tools = computed<ToolDefinition[]>(() => {
  void catalog.revision;
  return kwami.value?.tools.getAll() ?? [];
});

const inventoryStore = useToolInventoryStore();
const inventory = computed(() => inventoryStore.inventory);
const agentNames = computed(() => new Set(inventory.value?.builtin ?? []));

/**
 * Everything the catalog lists: the registered tools, the app tools whose
 * group is switched off (kept by the catalog store) and, once the agent has
 * reported them, its own server-side tools.
 */
const catalogTools = computed<ToolDefinition[]>(() => [
  ...tools.value,
  ...Object.values(catalog.off),
  ...[...agentNames.value].map((name) => ({ name, description: '' })),
]);

function groupOfAny(name: string): ToolGroupId {
  return agentNames.value.has(name) ? 'agent' : catalog.groupOf(name);
}

const offGroups = computed(() => new Set<ToolGroupId>(userTools.disabledGroups));
const dropped = computed(() => new Set(inventory.value?.dropped ?? []));

const groupCount = computed(() => new Set(catalogTools.value.map((t) => groupOfAny(t.name))).size);
const yourCount = computed(
  () => tools.value.filter((tool) => USER_TOOL_GROUPS.has(catalog.groupOf(tool.name))).length,
);

function toggleGroup(group: ToolGroupId, enabled: boolean) {
  userTools.setGroupEnabled(group, enabled);
}

// The Test tab's selection, so the catalog's Test button can hand a tool over.
const testToolName = ref('');

function runTool(name: string, args: Record<string, unknown>) {
  if (!kwami.value) return Promise.reject(new Error('No companion is loaded'));
  return kwami.value.executeTool(name, args);
}

// Your tools: created and edited in the Create tab, kept on the kwami's config.
const mcp = useMcpServers();
const editingTool = ref<UserWebhookTool | null>(null);
const takenNames = computed(() => new Set(tools.value.map((tool) => tool.name)));

function saveUserTool(tool: UserWebhookTool, previousName?: string) {
  userTools.save(tool, previousName);
  toast.success(
    t(previousName ? 'toolsPanel.create.updated' : 'toolsPanel.create.saved', { name: tool.name }),
  );
  editingTool.value = null;
  activeTab.value = 'catalog';
}

function editTool(name: string) {
  const tool = userTools.find(name);
  if (!tool) return;
  editingTool.value = tool;
  activeTab.value = 'create';
}

// Removal goes through a dialog, and only for tools the user added: the catalog
// offers no remove action on the app's own.
const pendingRemoval = ref<string | null>(null);

function removeTool() {
  const name = pendingRemoval.value;
  pendingRemoval.value = null;
  if (!name || !kwami.value) return;
  if (userTools.find(name)) {
    // The registration composable unregisters it and tells the agent.
    userTools.remove(name);
    return;
  }
  // An MCP tool is switched off on its server, so it stays off after a reload.
  for (const [server, state] of Object.entries(mcp.states)) {
    const original = Object.entries(state.exposed).find(([, exposed]) => exposed === name)?.[0];
    if (original) {
      userTools.setServerToolEnabled(server, original, false);
      return;
    }
  }
  kwami.value.unregisterTool(name);
  catalog.forget(name);
}

function testTool(name: string) {
  testToolName.value = name;
  activeTab.value = 'test';
}
</script>

<template>
  <div class="panel-inner">
    <div class="panel-header">
      <iconify-icon :icon="panelIcons.tools" class="panel-icon"></iconify-icon>
      <h2>{{ t('tools.title') }}</h2>
      <PanelHeaderControls />
    </div>

    <div class="tabs" role="tablist">
      <button
        v-for="tab in TABS"
        :id="`tools-tab-${tab.id}`"
        :key="tab.id"
        type="button"
        role="tab"
        class="tab"
        :class="{ active: activeTab === tab.id }"
        :aria-selected="activeTab === tab.id"
        :aria-controls="`tools-tabpanel-${tab.id}`"
        @click="activeTab = tab.id"
      >
        <iconify-icon :icon="tab.icon" class="tab-icon" aria-hidden="true"></iconify-icon>
        {{ t(`toolsPanel.tabs.${tab.id}`) }}
      </button>
    </div>

    <div class="panel-body">
      <!-- Catalog -->
      <div
        v-if="activeTab === 'catalog'"
        id="tools-tabpanel-catalog"
        role="tabpanel"
        aria-labelledby="tools-tab-catalog"
      >
        <PanelSection>
          <div class="summary">
            <div class="stat">
              <strong>{{ catalogTools.length }}</strong>
              <span>{{
                t(
                  catalogTools.length === 1
                    ? 'toolsPanel.summary.tool'
                    : 'toolsPanel.summary.tools',
                )
              }}</span>
            </div>
            <div class="stat">
              <strong>{{ groupCount }}</strong>
              <span>{{
                t(groupCount === 1 ? 'toolsPanel.summary.group' : 'toolsPanel.summary.groups')
              }}</span>
            </div>
            <div class="stat" :class="{ dim: !yourCount }">
              <strong>{{ yourCount }}</strong>
              <span>{{ t('toolsPanel.catalog.filterYours') }}</span>
            </div>
          </div>
          <p class="intro">{{ t('toolsPanel.summary.intro') }}</p>
          <ToolBudget :inventory="inventory" :client-tools="tools" :group-of="catalog.groupOf" />
          <ToolCatalog
            :tools="catalogTools"
            :group-of="groupOfAny"
            :off-groups="offGroups"
            :dropped="dropped"
            :limit="inventory?.limit ?? 128"
            @toggle-group="toggleGroup"
            @test="testTool"
            @edit="editTool"
            @remove="pendingRemoval = $event"
          />
        </PanelSection>
      </div>

      <!-- Add Tool -->
      <div
        v-else-if="activeTab === 'create'"
        id="tools-tabpanel-create"
        role="tabpanel"
        aria-labelledby="tools-tab-create"
      >
        <PanelSection>
          <CustomToolEditor
            :editing="editingTool"
            :taken-names="takenNames"
            @save="saveUserTool"
            @cancel="editingTool = null"
          />
        </PanelSection>
      </div>

      <!-- MCP -->
      <div
        v-else-if="activeTab === 'mcp'"
        id="tools-tabpanel-mcp"
        role="tabpanel"
        aria-labelledby="tools-tab-mcp"
      >
        <PanelSection>
          <McpServers />
        </PanelSection>
      </div>

      <!-- Test -->
      <div v-else id="tools-tabpanel-test" role="tabpanel" aria-labelledby="tools-tab-test">
        <PanelSection>
          <ToolTester
            v-model="testToolName"
            :tools="tools"
            :group-of="catalog.groupOf"
            :run="runTool"
          />
        </PanelSection>
      </div>
    </div>

    <ConfirmDialog
      :open="pendingRemoval !== null"
      :title="t('toolsPanel.catalog.remove')"
      icon="ph:trash-duotone"
      :confirm-label="t('toolsPanel.catalog.remove')"
      confirm-icon="ph:trash-duotone"
      confirm-variant="danger"
      @confirm="removeTool"
      @cancel="pendingRemoval = null"
    >
      <p class="confirm-text">
        {{ t('toolsPanel.catalog.removeConfirm', { name: pendingRemoval ?? '' }) }}
      </p>
    </ConfirmDialog>
  </div>
</template>

<style scoped>
/* Tabs — the Energy panel's idiom, so the two read as one app. */
.tabs {
  display: flex;
  gap: 2px;
  padding: 4px 20px;
  border-bottom: 1px solid var(--glass-border);
}
.tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 10px 6px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  font-size: 11px;
  font-weight: 500;
  font-family: inherit;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s ease;
}
.tab:hover {
  color: var(--text-primary);
}
.tab.active {
  color: var(--accent-primary);
  border-bottom-color: var(--accent-primary);
}
.tab:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: -2px;
}
.tab-icon {
  font-size: 14px;
}

/* Catalog summary */
.summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 10px;
}
.stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
}
.stat strong {
  font-size: 20px;
  font-weight: 600;
  line-height: 1.1;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.stat span {
  font-size: 11px;
  color: var(--text-muted);
}
.stat.dim strong {
  color: var(--text-muted);
}
.intro {
  margin: 0 0 12px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-secondary);
}
.confirm-text {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
}
</style>
