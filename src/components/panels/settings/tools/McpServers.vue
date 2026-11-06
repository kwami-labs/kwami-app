<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from 'vue-toastification';
import BaseButton from '@/components/ui/BaseButton.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import { useMcpServers, type McpServerState } from '@/composables/useMcpServers';
import { useUserToolsStore } from '@/stores/userTools';
import { summarize } from '@/lib/toolSchema';
import {
  isMcpKeyRemembered,
  setMcpKey,
  validateMcpServer,
  type SavedMcpServer,
} from '@/lib/mcpServers';

/**
 * The MCP tab: the servers saved on this kwami, their state and tools, and a
 * form that only saves a server once it has actually connected.
 */
const { t } = useI18n();
const toast = useToast();
const userTools = useUserToolsStore();
const { states, connect, disconnect } = useMcpServers();

const EXAMPLES = [
  { name: 'deepwiki', url: 'https://mcp.deepwiki.com/mcp', hint: 'exampleDeepwiki' },
  { name: 'gitmcp', url: 'https://gitmcp.io/docs', hint: 'exampleGitmcp' },
] as const;

const form = ref({ name: '', url: '', key: '', remember: false });
const attempted = ref(false);
const adding = ref(false);
const formError = ref<McpServerState['error'] | null>(null);
const openTools = ref<string | null>(null);
const pendingRemoval = ref<string | null>(null);
const keyDrafts = ref<Record<string, string>>({});

const takenNames = computed(() => new Set(userTools.mcpServers.map((s) => s.name)));
const issues = computed(() =>
  validateMcpServer({ name: form.value.name, url: form.value.url }, takenNames.value),
);

function useExample(example: (typeof EXAMPLES)[number]) {
  form.value = { name: example.name, url: example.url, key: '', remember: false };
  attempted.value = false;
  formError.value = null;
}

function errorText(error: McpServerState['error']) {
  if (!error) return '';
  if (['network', 'unauthorized', 'legacy', 'timeout'].includes(error.kind)) {
    return t(`toolsPanel.mcp.errors.${error.kind}`);
  }
  return t('toolsPanel.mcp.errors.other', { message: error.message });
}

async function add() {
  attempted.value = true;
  formError.value = null;
  if (issues.value.length) return;
  const server: SavedMcpServer = { name: form.value.name.trim(), url: form.value.url.trim() };
  setMcpKey(server.url, form.value.key.trim(), form.value.remember);
  adding.value = true;
  await connect(server);
  adding.value = false;
  const state = states[server.name];
  if (state?.status === 'connected') {
    userTools.saveServer(server);
    toast.success(t('toolsPanel.mcp.saved', { name: server.name, count: state.tools.length }));
    form.value = { name: '', url: '', key: '', remember: false };
    attempted.value = false;
  } else {
    formError.value = state?.error ?? { kind: 'unknown', message: '' };
    // Not saved: leave nothing registered or listed for it.
    disconnect(server.name);
  }
}

function reconnect(server: SavedMcpServer) {
  void connect(server);
}

async function useKey(server: SavedMcpServer) {
  const key = (keyDrafts.value[server.name] ?? '').trim();
  setMcpKey(server.url, key, isMcpKeyRemembered(server.url));
  keyDrafts.value[server.name] = '';
  await connect(server);
}

function remove() {
  const name = pendingRemoval.value;
  pendingRemoval.value = null;
  if (!name) return;
  userTools.removeServer(name); // the sync disconnects it
}

function enabledCount(server: SavedMcpServer) {
  const total = states[server.name]?.tools.length ?? 0;
  return (
    total -
    (server.disabledTools?.filter((name) =>
      states[server.name]?.tools.some((tool) => tool.name === name),
    ).length ?? 0)
  );
}

function isEnabled(server: SavedMcpServer, tool: string) {
  return !(server.disabledTools ?? []).includes(tool);
}
</script>

<template>
  <div class="mcp">
    <p class="intro">{{ t('toolsPanel.mcp.intro') }}</p>

    <p v-if="!userTools.mcpServers.length" class="empty">{{ t('toolsPanel.mcp.empty') }}</p>

    <ul v-else class="servers">
      <li
        v-for="server in userTools.mcpServers"
        :key="server.name"
        class="server"
        :class="states[server.name]?.status ?? 'connecting'"
      >
        <div class="server-head">
          <span class="server-icon" aria-hidden="true">
            <iconify-icon icon="ph:plugs-connected-duotone"></iconify-icon>
          </span>
          <span class="server-text">
            <span class="server-name" translate="no">{{ server.name }}</span>
            <span class="server-url" translate="no">{{ server.url }}</span>
          </span>
          <button
            type="button"
            class="icon-button"
            :title="t('toolsPanel.mcp.reconnect')"
            :aria-label="t('toolsPanel.mcp.reconnect')"
            :disabled="states[server.name]?.status === 'connecting'"
            @click="reconnect(server)"
          >
            <iconify-icon icon="ph:arrows-clockwise-bold"></iconify-icon>
          </button>
          <button
            type="button"
            class="icon-button danger"
            :title="t('toolsPanel.mcp.remove')"
            :aria-label="t('toolsPanel.mcp.remove')"
            @click="pendingRemoval = server.name"
          >
            <iconify-icon icon="ph:trash-duotone"></iconify-icon>
          </button>
        </div>

        <div class="server-status">
          <template v-if="states[server.name]?.status === 'connected'">
            <span class="chip ok">
              <iconify-icon icon="ph:check-circle-fill"></iconify-icon>
              {{ t('toolsPanel.mcp.connected') }}
            </span>
            <span class="muted">
              {{ t('toolsPanel.mcp.toolCount', states[server.name].tools.length) }} ·
              {{
                t('toolsPanel.mcp.enabledCount', {
                  enabled: enabledCount(server),
                  total: states[server.name].tools.length,
                })
              }}
            </span>
          </template>
          <template v-else-if="states[server.name]?.status === 'error'">
            <span class="chip bad">
              <iconify-icon icon="ph:warning-circle-fill"></iconify-icon>
              {{ t('toolsPanel.mcp.failed') }}
            </span>
          </template>
          <span v-else class="chip busy">
            <iconify-icon icon="ph:circle-notch-bold" class="spin"></iconify-icon>
            {{ t('toolsPanel.mcp.connecting') }}
          </span>
        </div>

        <p v-if="states[server.name]?.status === 'error'" class="error">
          {{ errorText(states[server.name].error) }}
        </p>
        <div v-if="states[server.name]?.error?.kind === 'unauthorized'" class="key-row">
          <input
            v-model="keyDrafts[server.name]"
            class="control"
            type="password"
            autocomplete="off"
            :aria-label="t('toolsPanel.mcp.key')"
            :placeholder="t('toolsPanel.mcp.key')"
          />
          <BaseButton size="sm" @click="useKey(server)">{{
            t('toolsPanel.mcp.setKey')
          }}</BaseButton>
        </div>

        <template
          v-if="states[server.name]?.status === 'connected' && states[server.name].tools.length"
        >
          <button
            type="button"
            class="link"
            :aria-expanded="openTools === server.name"
            @click="openTools = openTools === server.name ? null : server.name"
          >
            {{
              openTools === server.name
                ? t('toolsPanel.mcp.hideTools')
                : t('toolsPanel.mcp.showTools')
            }}
          </button>
          <ul v-if="openTools === server.name" class="server-tools">
            <li v-for="tool in states[server.name].tools" :key="tool.name">
              <label class="server-tool">
                <input
                  type="checkbox"
                  :checked="isEnabled(server, tool.name)"
                  @change="
                    userTools.setServerToolEnabled(
                      server.name,
                      tool.name,
                      ($event.target as HTMLInputElement).checked,
                    )
                  "
                />
                <span class="server-tool-text">
                  <code translate="no">{{ tool.name }}</code>
                  <span v-if="tool.description" class="muted">{{
                    summarize(tool.description, 110)
                  }}</span>
                </span>
              </label>
            </li>
          </ul>
        </template>
      </li>
    </ul>

    <section class="add">
      <h3 class="add-title">{{ t('toolsPanel.mcp.add') }}</h3>

      <div class="examples">
        <span class="muted">{{ t('toolsPanel.mcp.examples') }}</span>
        <button
          v-for="example in EXAMPLES"
          :key="example.name"
          type="button"
          class="example"
          :title="t(`toolsPanel.mcp.${example.hint}`)"
          :disabled="takenNames.has(example.name)"
          @click="useExample(example)"
        >
          <iconify-icon icon="ph:lightning-duotone"></iconify-icon>
          <span translate="no">{{ example.name }}</span>
        </button>
      </div>

      <div class="field">
        <label class="label" for="mcp-name">{{ t('toolsPanel.mcp.name') }}</label>
        <input
          id="mcp-name"
          v-model="form.name"
          class="control mono"
          :placeholder="t('toolsPanel.mcp.namePlaceholder')"
          autocomplete="off"
          spellcheck="false"
          translate="no"
        />
      </div>
      <div class="field">
        <label class="label" for="mcp-url">{{ t('toolsPanel.mcp.url') }}</label>
        <input
          id="mcp-url"
          v-model="form.url"
          class="control mono"
          type="url"
          placeholder="https://example.com/mcp"
          autocomplete="off"
          spellcheck="false"
          translate="no"
        />
        <p class="hint">{{ t('toolsPanel.mcp.urlHint') }}</p>
      </div>
      <div class="field">
        <label class="label" for="mcp-key">{{ t('toolsPanel.mcp.key') }}</label>
        <input id="mcp-key" v-model="form.key" class="control" type="password" autocomplete="off" />
        <p class="hint">{{ t('toolsPanel.mcp.keyHint') }}</p>
        <label v-if="form.key" class="check">
          <input v-model="form.remember" type="checkbox" />
          {{ t('toolsPanel.mcp.remember') }}
        </label>
      </div>

      <p v-for="issue in attempted ? issues : []" :key="issue" class="error">
        {{ t(`toolsPanel.mcp.issues.${issue}`) }}
      </p>
      <p v-if="formError" class="error">{{ errorText(formError) }}</p>

      <BaseButton
        variant="primary"
        icon="ph:plugs-connected-duotone"
        :loading="adding"
        :disabled="adding"
        @click="add"
      >
        {{ adding ? t('toolsPanel.mcp.connecting') : t('toolsPanel.mcp.connect') }}
      </BaseButton>
    </section>

    <ConfirmDialog
      :open="pendingRemoval !== null"
      :title="t('toolsPanel.mcp.remove')"
      icon="ph:trash-duotone"
      :confirm-label="t('toolsPanel.mcp.remove')"
      confirm-icon="ph:trash-duotone"
      confirm-variant="danger"
      @confirm="remove"
      @cancel="pendingRemoval = null"
    >
      <p class="confirm-text">
        {{ t('toolsPanel.mcp.removeConfirm', { name: pendingRemoval ?? '' }) }}
      </p>
    </ConfirmDialog>
  </div>
</template>

<style scoped>
.mcp {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.intro {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-secondary);
}
.empty {
  margin: 0;
  padding: 16px 12px;
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
  border: 1px dashed var(--glass-border);
  border-radius: var(--radius-md);
}
.servers {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.server {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
  background: var(--surface-1);
}
.server.connected {
  border-color: color-mix(in srgb, var(--success) 30%, var(--glass-border));
}
.server.error {
  border-color: color-mix(in srgb, var(--error) 35%, var(--glass-border));
}
.server-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.server-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm);
  font-size: 17px;
  color: #2dd4bf;
  background: color-mix(in srgb, #2dd4bf 14%, transparent);
}
.server-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.server-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.server-url {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.server-status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 11px;
}
.chip.ok {
  color: var(--success);
  background: var(--success-glow);
}
.chip.bad {
  color: var(--error);
  background: var(--error-glow);
}
.chip.busy {
  color: var(--text-secondary);
  background: var(--surface-3);
}
.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.muted {
  font-size: 11px;
  color: var(--text-muted);
}
.error {
  margin: 0;
  font-size: 11px;
  line-height: 1.4;
  color: var(--error);
}
.key-row {
  display: flex;
  gap: 6px;
}
.link {
  align-self: flex-start;
  border: none;
  background: none;
  padding: 0;
  color: var(--accent-primary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.server-tools {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 260px;
  overflow: auto;
}
.server-tool {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px;
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.server-tool:hover {
  background: var(--surface-2);
}
.server-tool input,
.check input {
  margin-top: 2px;
  accent-color: var(--accent-primary);
}
.server-tool-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.server-tool-text code {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-primary);
}
.icon-button {
  display: grid;
  place-items: center;
  flex: none;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}
.icon-button:hover:not(:disabled) {
  color: var(--text-primary);
  background: var(--surface-3);
}
.icon-button.danger:hover {
  color: var(--error);
}
.icon-button:disabled {
  opacity: 0.4;
  cursor: default;
}
.icon-button:focus-visible,
.example:focus-visible,
.link:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 1px;
}
.add {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid var(--glass-border);
}
.add-title {
  margin: 0;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.examples {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.example {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border: 1px solid var(--glass-border);
  border-radius: 999px;
  background: var(--surface-1);
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 11px;
  cursor: pointer;
}
.example:hover:not(:disabled) {
  color: var(--accent-primary);
  border-color: var(--accent-primary);
}
.example:disabled {
  opacity: 0.4;
  cursor: default;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.control {
  width: 100%;
  padding: 8px 10px;
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font: inherit;
  font-size: 13px;
}
.control:focus {
  outline: none;
  border-color: var(--accent-primary);
}
.control.mono {
  font-family: var(--font-mono);
  font-size: 12px;
}
.hint {
  margin: 0;
  font-size: 11px;
  line-height: 1.4;
  color: var(--text-muted);
}
.check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
}
.confirm-text {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
}
</style>
