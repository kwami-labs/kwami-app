<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { panelIcons } from '@/constants/panel-icons';
import { useToast } from 'vue-toastification';
import { useKwami } from '@/composables/useKwami';
import type { ToolDefinition } from 'kwami';
import PanelSection from '@/components/ui/PanelSection.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import PanelHeaderControls from '@/components/ui/PanelHeaderControls.vue';
import { translateApiUserMessage } from '@/utils/translateApiMessage';
import { useToolCatalogStore } from '@/stores/toolCatalog';
import { USER_TOOL_GROUPS } from '@/lib/toolRegistration';
import ToolCatalog from './ToolCatalog.vue';

const toast = useToast();
const { t } = useI18n();

const { kwami } = useKwami();
const catalog = useToolCatalogStore();

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

const groupCount = computed(() => new Set(tools.value.map((t) => catalog.groupOf(t.name))).size);
const yourCount = computed(
  () => tools.value.filter((tool) => USER_TOOL_GROUPS.has(catalog.groupOf(tool.name))).length,
);

// State
const newTool = ref({
  name: '',
  description: '',
  parameters: '',
  url: '',
  method: 'POST' as 'GET' | 'POST',
});

const HTTP_METHOD_OPTIONS = [
  { label: 'POST', value: 'POST' },
  { label: 'GET', value: 'GET' },
];

/** A user-defined tool call should not hang the agent turn. */
const TOOL_TIMEOUT_MS = 15_000;

/**
 * Build the handler the agent will invoke.
 *
 * Calls the user's webhook with the tool arguments. Deliberately a plain fetch
 * rather than the app's api client: the target is an arbitrary third-party URL,
 * not the Kwami backend, so it must not receive the user's bearer token.
 */
function createWebhookHandler(url: string, method: 'GET' | 'POST') {
  return async (params: Record<string, unknown>) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TOOL_TIMEOUT_MS);
    try {
      const target =
        method === 'GET'
          ? `${url}${url.includes('?') ? '&' : '?'}${new URLSearchParams(
              Object.entries(params).map(([k, v]) => [k, String(v)]),
            )}`
          : url;

      const res = await fetch(target, {
        method,
        headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
        body: method === 'POST' ? JSON.stringify(params) : undefined,
        signal: controller.signal,
      });

      const text = await res.text();
      let data: unknown = text;
      try {
        data = JSON.parse(text);
      } catch {
        // Not JSON; hand the agent the raw body.
      }
      return { ok: res.ok, status: res.status, data };
    } catch (e: unknown) {
      const aborted = e instanceof DOMException && e.name === 'AbortError';
      return {
        ok: false,
        error: aborted ? `Tool timed out after ${TOOL_TIMEOUT_MS}ms` : String(e),
      };
    } finally {
      clearTimeout(timer);
    }
  };
}
const mcp = ref({ name: '', url: '', apiKey: '' });
const mcps = ref<Array<{ name: string; url: string }>>([]);
interface ToolTemplate {
  name: string;
  description: string;
  parameters: Record<string, { type: string; enum?: string[] }>;
}

const exec = ref({ toolName: '', params: '', result: '', loading: false, error: '' });

const templates: Record<string, ToolTemplate> = {
  weather: {
    name: 'get_weather',
    description: t('tools.templateWeatherDescription'),
    parameters: {
      location: { type: 'string' },
      units: { type: 'string', enum: ['metric', 'imperial'] },
    },
  },
  search: {
    name: 'web_search',
    description: t('tools.templateSearchDescription'),
    parameters: { query: { type: 'string' }, limit: { type: 'number' } },
  },
  calc: {
    name: 'calculate',
    description: t('tools.templateCalcDescription'),
    parameters: { expression: { type: 'string' } },
  },
};

// Removal goes through a dialog, and only for tools the user added: the catalog
// offers no remove action on the app's own.
const pendingRemoval = ref<string | null>(null);

function removeTool() {
  const name = pendingRemoval.value;
  pendingRemoval.value = null;
  if (!name || !kwami.value) return;
  kwami.value.unregisterTool(name);
  catalog.forget(name);
}

function testTool(name: string) {
  exec.value = { ...exec.value, toolName: name, result: '', error: '' };
  activeTab.value = 'test';
}

function useTemplate(key: string) {
  const tmpl = templates[key];
  if (tmpl) {
    newTool.value = {
      ...newTool.value,
      name: tmpl.name,
      description: tmpl.description,
      parameters: JSON.stringify(tmpl.parameters, null, 2),
    };
  }
}

function addTool() {
  if (!newTool.value.name || !newTool.value.description) {
    toast.warning(t('tools.requiredNameDescription'));
    return;
  }
  let parsedParams;
  try {
    if (newTool.value.parameters) parsedParams = JSON.parse(newTool.value.parameters);
  } catch {
    toast.error(t('tools.invalidJsonParams'));
    return;
  }

  const url = newTool.value.url.trim();
  if (!/^https?:\/\//i.test(url)) {
    toast.error(t('tools.invalidUrl'));
    return;
  }

  // kwami.registerTool(), NOT kwami.tools.register(). The latter only writes
  // the local ToolRegistry; registerTool additionally populates the agent's
  // clientTools dispatch table and syncs the definition to the backend, which
  // is what tells the model the tool exists. Tools created here were
  // previously invisible to the LLM and undispatchable even if it knew.
  kwami.value?.registerTool({
    name: newTool.value.name,
    description: newTool.value.description,
    parameters: parsedParams,
    handler: createWebhookHandler(url, newTool.value.method),
  });
  catalog.record(newTool.value.name, 'custom');
  catalog.touch();
  newTool.value = { name: '', description: '', parameters: '', url: '', method: 'POST' };
  activeTab.value = 'catalog';
}

async function connectMCP() {
  if (!mcp.value.name || !mcp.value.url) return;
  try {
    const before = new Set(kwami.value?.tools.getAll().map((tool) => tool.name));
    await kwami.value?.tools.connectMCP({
      name: mcp.value.name,
      url: mcp.value.url,
      apiKey: mcp.value.apiKey || undefined,
    });
    for (const tool of kwami.value?.tools.getAll() ?? []) {
      if (!before.has(tool.name)) catalog.record(tool.name, 'mcp');
    }
    mcps.value.push({ name: mcp.value.name, url: mcp.value.url });
    mcp.value = { name: '', url: '', apiKey: '' };
    // connectMCP registers into the ToolRegistry but never announces the new
    // definitions, so a server connected after the initial connect stayed
    // invisible to the agent until the next reconnect.
    if (kwami.value?.agent) {
      kwami.value.agent.syncConfigToBackend('tools', kwami.value.tools.getToolDefinitions());
    }
    catalog.touch();
  } catch (e) {
    toast.error(
      t('tools.mcpConnectionFailed', {
        message: translateApiUserMessage((e as Error).message, t),
      }),
    );
  }
}

async function executeTool() {
  if (!exec.value.toolName) return;
  exec.value.loading = true;
  exec.value.result = '';
  exec.value.error = '';
  let params = {};
  try {
    if (exec.value.params) params = JSON.parse(exec.value.params);
  } catch {
    exec.value.error = t('tools.invalidJson');
    exec.value.loading = false;
    return;
  }
  try {
    exec.value.result = JSON.stringify(
      await kwami.value?.executeTool(exec.value.toolName, params),
      null,
      2,
    );
  } catch (e) {
    exec.value.error = (e as Error).message;
  } finally {
    exec.value.loading = false;
  }
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
              <strong>{{ tools.length }}</strong>
              <span>{{
                t(tools.length === 1 ? 'toolsPanel.summary.tool' : 'toolsPanel.summary.tools')
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
          <ToolCatalog
            :tools="tools"
            :group-of="catalog.groupOf"
            @test="testTool"
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
        <PanelSection :title="t('tools.addCustomTool')">
          <div class="form">
            <BaseInput :label="t('tools.name')" v-model="newTool.name" placeholder="my_tool" mono />
            <BaseInput
              :label="t('tools.webhookUrl')"
              v-model="newTool.url"
              placeholder="https://example.com/hook"
            />
            <BaseSelect
              :label="t('tools.httpMethod')"
              v-model="newTool.method"
              :options="HTTP_METHOD_OPTIONS"
            />
            <p class="hint">{{ t('tools.webhookHint') }}</p>
            <div class="group">
              <label>{{ t('tools.description') }}</label
              ><textarea v-model="newTool.description" rows="2"></textarea>
            </div>
            <div class="group">
              <label>{{ t('tools.parametersJson') }}</label
              ><textarea
                v-model="newTool.parameters"
                rows="3"
                placeholder="{}"
                translate="no"
              ></textarea>
            </div>
            <BaseButton variant="primary" icon="ph:plus-duotone" @click="addTool">{{
              t('tools.addTool')
            }}</BaseButton>
          </div>
          <div class="tmpls">
            <span class="tmpl-label">{{ t('tools.templates') }}</span>
            <button v-for="(_, k) in templates" :key="k" @click="useTemplate(k as string)">
              {{ k }}
            </button>
          </div>
        </PanelSection>
      </div>

      <!-- MCP -->
      <div
        v-else-if="activeTab === 'mcp'"
        id="tools-tabpanel-mcp"
        role="tabpanel"
        aria-labelledby="tools-tab-mcp"
      >
        <PanelSection :title="t('tools.mcpServers')">
          <div class="tools-list">
            <div v-if="!mcps.length" class="empty">{{ t('tools.noMcpServers') }}</div>
            <div v-for="s in mcps" :key="s.name" class="card">
              <div class="head">
                <iconify-icon icon="ph:plugs-connected-duotone"></iconify-icon>
                <span class="name" translate="no">{{ s.name }}</span>
                <span class="badg">{{ t('tools.connected') }}</span>
              </div>
              <span class="url" translate="no">{{ s.url }}</span>
            </div>
          </div>
          <div class="form" style="margin-top: 12px">
            <BaseInput :label="t('tools.name')" v-model="mcp.name" placeholder="my-mcp" />
            <BaseInput
              :label="t('tools.url')"
              v-model="mcp.url"
              placeholder="http://localhost:3001"
            />
            <BaseInput :label="t('tools.apiKey')" v-model="mcp.apiKey" type="password" />
            <BaseButton icon="ph:plugs-connected-duotone" @click="connectMCP">{{
              t('tools.connectMcp')
            }}</BaseButton>
          </div>
        </PanelSection>
      </div>

      <!-- Test -->
      <div v-else id="tools-tabpanel-test" role="tabpanel" aria-labelledby="tools-tab-test">
        <PanelSection :title="t('tools.testToolExecution')">
          <div class="form">
            <BaseSelect
              :label="t('tools.tool')"
              v-model="exec.toolName"
              :options="tools.map((tool) => ({ label: tool.name, value: tool.name }))"
            />
            <div class="group">
              <label>{{ t('tools.parametersJson') }}</label
              ><textarea v-model="exec.params" rows="2" placeholder="{}" translate="no"></textarea>
            </div>
            <BaseButton :disabled="exec.loading" icon="ph:play-duotone" @click="executeTool">{{
              exec.loading ? t('tools.running') : t('tools.execute')
            }}</BaseButton>

            <div v-if="exec.result" class="res success">
              <pre translate="no">{{ exec.result }}</pre>
            </div>
            <div v-if="exec.error" class="res error">{{ exec.error }}</div>
          </div>
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

.tools-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.empty {
  text-align: center;
  padding: 12px;
  color: var(--text-tertiary);
  font-size: 13px;
  background: var(--surface-1);
  border-radius: 8px;
}
.card {
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  padding: 10px;
}
.head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.name {
  font-weight: 600;
  font-size: 13px;
  flex: 1;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.hint {
  margin: 0;
  font-size: 11px;
  line-height: 1.4;
  color: var(--text-muted);
}
.group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.group label {
  font-size: 11px;
  color: var(--text-tertiary);
}
textarea {
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
  padding: 8px;
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 12px;
  resize: vertical;
}

.tmpls {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  align-items: center;
}
.tmpl-label {
  font-size: 11px;
  color: var(--text-tertiary);
}
.tmpls button {
  background: var(--surface-2);
  border: 1px solid var(--glass-border);
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 10px;
  cursor: pointer;
  color: var(--text-secondary);
}
.tmpls button:hover {
  color: var(--text-primary);
  border-color: var(--text-secondary);
}

.badg {
  font-size: 10px;
  color: var(--accent-success);
  background: rgba(var(--accent-success-rgb), 0.1);
  padding: 2px 6px;
  border-radius: 10px;
}
.url {
  font-size: 11px;
  color: var(--text-tertiary);
  word-break: break-all;
}

.res {
  margin-top: 8px;
  padding: 8px;
  border-radius: 6px;
  font-size: 12px;
}
.res.success {
  background: rgba(0, 255, 100, 0.1);
  color: var(--text-primary);
}
.res.success pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}
.res.error {
  background: rgba(255, 0, 0, 0.1);
  color: var(--accent-error);
}
</style>
