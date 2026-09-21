<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { panelIcons } from '@/constants/panel-icons';
import { useToast } from 'vue-toastification';
import { useKwami } from '@/composables/useKwami';
import type { ToolDefinition } from 'kwami';
import PanelSection from '@/components/ui/PanelSection.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import PanelHeaderControls from '@/components/ui/PanelHeaderControls.vue';
import { translateApiUserMessage } from '@/utils/translateApiMessage';

const toast = useToast();
const { t } = useI18n();

const { kwami } = useKwami();

// State
const tools = ref<ToolDefinition[]>([]);
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

function refreshTools() {
  if (kwami.value) tools.value = kwami.value.tools.getAll();
}

function removeTool(name: string) {
  if (confirm(t('tools.removeToolConfirm', { name }))) {
    kwami.value?.unregisterTool(name);
    refreshTools();
  }
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
  newTool.value = { name: '', description: '', parameters: '', url: '', method: 'POST' };
  refreshTools();
}

async function connectMCP() {
  if (!mcp.value.name || !mcp.value.url) return;
  try {
    await kwami.value?.tools.connectMCP({
      name: mcp.value.name,
      url: mcp.value.url,
      apiKey: mcp.value.apiKey || undefined,
    });
    mcps.value.push({ name: mcp.value.name, url: mcp.value.url });
    mcp.value = { name: '', url: '', apiKey: '' };
    // connectMCP registers into the ToolRegistry but never announces the new
    // definitions, so a server connected after the initial connect stayed
    // invisible to the agent until the next reconnect.
    if (kwami.value?.agent) {
      kwami.value.agent.syncConfigToBackend('tools', kwami.value.tools.getToolDefinitions());
    }
    refreshTools();
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

onMounted(refreshTools);
</script>

<template>
  <div class="panel-inner">
    <div class="panel-header">
      <iconify-icon :icon="panelIcons.tools" class="panel-icon"></iconify-icon>
      <h2>{{ t('tools.title') }}</h2>
      <PanelHeaderControls />
    </div>

    <div class="panel-body">
      <!-- Registered -->
      <PanelSection :title="t('tools.registeredTools')">
        <div class="tools-list">
          <div v-if="!tools.length" class="empty">{{ t('tools.noToolsRegistered') }}</div>
          <div v-for="tool in tools" :key="tool.name" class="card">
            <div class="head">
              <iconify-icon icon="ph:function-duotone"></iconify-icon>
              <span class="name">{{ tool.name }}</span>
              <button
                class="remove"
                :title="t('tools.removeTool')"
                :aria-label="t('tools.removeTool')"
                @click="removeTool(tool.name)"
              >
                ×
              </button>
            </div>
            <p class="desc">{{ tool.description }}</p>
            <details v-if="tool.parameters" class="params">
              <summary>{{ t('tools.params') }}</summary>
              <pre>{{ JSON.stringify(tool.parameters, null, 2) }}</pre>
            </details>
          </div>
        </div>
        <BaseButton
          size="sm"
          icon="ph:arrows-clockwise-duotone"
          @click="refreshTools"
          style="margin-top: 8px"
          >{{ t('tools.refresh') }}</BaseButton
        >
      </PanelSection>

      <!-- Add Tool -->
      <PanelSection :title="t('tools.addCustomTool')">
        <div class="form">
          <BaseInput :label="t('tools.name')" v-model="newTool.name" placeholder="my_tool" />
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
            ><textarea v-model="newTool.parameters" rows="3" placeholder="{}"></textarea>
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

      <!-- MCP -->
      <PanelSection :title="t('tools.mcpServers')">
        <div class="tools-list">
          <div v-if="!mcps.length" class="empty">{{ t('tools.noMcpServers') }}</div>
          <div v-for="s in mcps" :key="s.name" class="card">
            <div class="head">
              <iconify-icon icon="ph:plugs-connected-duotone"></iconify-icon>
              <span class="name">{{ s.name }}</span>
              <span class="badg">{{ t('tools.connected') }}</span>
            </div>
            <span class="url">{{ s.url }}</span>
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

      <!-- Test -->
      <PanelSection :title="t('tools.testToolExecution')">
        <div class="form">
          <BaseSelect
            :label="t('tools.tool')"
            v-model="exec.toolName"
            :options="tools.map((tool) => ({ label: tool.name, value: tool.name }))"
          />
          <div class="group">
            <label>{{ t('tools.parametersJson') }}</label
            ><textarea v-model="exec.params" rows="2" placeholder="{}"></textarea>
          </div>
          <BaseButton :disabled="exec.loading" icon="ph:play-duotone" @click="executeTool">{{
            exec.loading ? t('tools.running') : t('tools.execute')
          }}</BaseButton>

          <div v-if="exec.result" class="res success">
            <pre>{{ exec.result }}</pre>
          </div>
          <div v-if="exec.error" class="res error">{{ exec.error }}</div>
        </div>
      </PanelSection>
    </div>
  </div>
</template>

<style scoped>
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
.remove {
  background: none;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  font-size: 16px;
  padding: 0;
}
.remove:hover {
  color: var(--accent-error);
}
.desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0 0 6px 0;
  line-height: 1.3;
}
.params {
  font-size: 11px;
}
.params pre {
  background: var(--surface-2);
  padding: 8px;
  border-radius: 4px;
  overflow-x: auto;
  margin: 4px 0 0 0;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 10px;
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
