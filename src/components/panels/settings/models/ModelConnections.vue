<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { useVoiceStore } from '@/stores/voice';
import { useAuthStore } from '@/stores/auth';
import PanelSection from '@/components/ui/PanelSection.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import { openExternal, useProviderConnections } from '@/composables/useProviderConnections';
import {
  BRAIN_PROVIDERS,
  MODEL_SUGGESTIONS,
  PROVIDER_ICONS,
  PROVIDER_KEY_PAGES,
  type BrainProvider,
} from '@/lib/brain';

/**
 * Every provider the brain can use, how it is reached today, and the way to connect
 * it: the provider's own page to make a key, then paste it here. Nothing here asks
 * for a password, and OpenRouter, which can, signs in on its own site.
 */
const emit = defineEmits<{ add: [provider: BrainProvider] }>();
const { t } = useI18n();
const { brain, brainStatus } = storeToRefs(useVoiceStore());
const auth = useAuthStore();
const { connections, refresh, saveKey, disconnect, signInOpenRouter } = useProviderConnections();

const providers = BRAIN_PROVIDERS.filter((p) => p !== 'local');
/** The API was asked and could not say. */
const unreachable = ref(false);
onMounted(async () => {
  if (!auth.userId) return;
  await refresh();
  unreachable.value = connections.value === null;
});

function stateOf(p: BrainProvider): { kind: 'on' | 'off'; text: string } {
  const own = connections.value?.connected?.[p];
  if (own) return { kind: 'on', text: t('mind.onYourKey', { hint: own.hint }) };
  const status = brainStatus.value;
  if (p === 'anthropic' && status?.account?.loggedIn) {
    return { kind: 'on', text: t('mind.onAccount') };
  }
  if (status?.apiKeys?.[p] ?? status?.providers?.[p]) {
    return { kind: 'on', text: t('mind.onServer') };
  }
  return { kind: 'off', text: t('mind.notConnected') };
}
const canAdd = (p: BrainProvider) =>
  stateOf(p).kind === 'on' && !brain.value.models.some((m) => m.provider === p);

const canConnect = computed(() => connections.value?.enabled === true);

const open = ref<BrainProvider | null>(null);
const key = ref('');
const busy = ref(false);
const error = ref('');
function toggle(p: BrainProvider) {
  open.value = open.value === p ? null : p;
  key.value = '';
  error.value = '';
}
/** What cannot be done from here is said here: the buttons have nowhere else to fail. */
async function attempt(action: () => Promise<void>) {
  error.value = '';
  try {
    await action();
  } catch {
    error.value = t('mind.keyFailed');
  }
}
async function save(p: BrainProvider) {
  busy.value = true;
  error.value = '';
  const result = await saveKey(p, key.value);
  busy.value = false;
  key.value = '';
  if (result === 'ok') {
    open.value = null;
    // Connected and nothing of it on the roster yet: straight to giving it a job.
    if (!brain.value.models.some((m) => m.provider === p)) emit('add', p);
  } else {
    error.value = result === 'refused' ? t('mind.keyRefused') : t('mind.keyFailed');
  }
}
</script>

<template>
  <PanelSection :title="t('mind.connectionsTitle')" icon="ph:plugs-connected-duotone" collapsible>
    <p class="hint">{{ t('mind.connectionsHint') }}</p>
    <p v-if="!auth.userId" class="hint warn">{{ t('mind.connectionsLogin') }}</p>
    <p v-else-if="unreachable" class="hint warn">{{ t('mind.connectionsDown') }}</p>
    <p v-else-if="connections && !connections.enabled" class="hint warn">
      {{ t('mind.connectionsOff') }}
    </p>
    <p v-if="error && !open" class="hint warn">{{ error }}</p>
    <ul class="providers">
      <li v-for="p in providers" :key="p" class="provider">
        <div class="row">
          <iconify-icon :icon="PROVIDER_ICONS[p]" class="icon" />
          <div class="names">
            <span class="name">{{ t(`brainPanel.providers.${p}`) }}</span>
            <span class="state" :class="stateOf(p).kind">{{ stateOf(p).text }}</span>
          </div>
          <div class="actions">
            <button v-if="canAdd(p)" class="link" @click="emit('add', p)">
              {{ t('mind.addItsModels') }}
            </button>
            <button
              v-if="connections?.connected?.[p]"
              class="link danger"
              @click="attempt(() => disconnect(p))"
            >
              {{ t('mind.disconnect') }}
            </button>
            <button v-else-if="canConnect" class="link" @click="toggle(p)">
              {{ open === p ? t('mind.cancel') : t('mind.connect') }}
            </button>
          </div>
        </div>
        <div v-if="open === p" class="connect">
          <p v-if="p === 'anthropic'" class="hint">{{ t('mind.claudeSubscription') }}</p>
          <BaseButton v-if="p === 'openrouter'" size="sm" @click="attempt(signInOpenRouter)">
            {{ t('mind.signIn') }}
          </BaseButton>
          <template v-else>
            <BaseButton
              size="sm"
              variant="secondary"
              icon="ph:arrow-square-out"
              @click="attempt(() => openExternal(PROVIDER_KEY_PAGES[p] ?? ''))"
            >
              {{ t('mind.openKeysPage') }}
            </BaseButton>
            <input
              v-model="key"
              class="key"
              type="password"
              autocomplete="off"
              spellcheck="false"
              :aria-label="t('mind.pasteKey')"
              :placeholder="t('mind.pasteKey')"
            />
            <BaseButton size="sm" :disabled="!key.trim() || busy" @click="save(p)">
              {{ t('mind.saveKey') }}
            </BaseButton>
          </template>
          <p v-if="error" class="hint warn">{{ error }}</p>
          <p class="hint small" v-if="MODEL_SUGGESTIONS[p].length">
            {{ MODEL_SUGGESTIONS[p].map((s) => s.label).join(' · ') }}
          </p>
        </div>
      </li>
    </ul>
  </PanelSection>
</template>

<style scoped>
.hint {
  margin: 0 0 8px;
  font-size: 11px;
  line-height: 1.4;
  color: var(--text-tertiary);
}
.hint.small {
  margin: 0;
  font-size: 10px;
}
.hint.warn {
  color: #fbbf24;
}
.providers {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.provider {
  padding: 6px 2px;
  border-bottom: 1px solid var(--surface-2);
}
.provider:last-child {
  border-bottom: none;
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.icon {
  font-size: 15px;
  color: var(--text-secondary);
  flex-shrink: 0;
}
.names {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 90px;
}
.actions {
  display: flex;
  gap: 10px;
  margin-left: auto;
}
.name {
  font-size: 12px;
  color: var(--text-primary);
}
.state {
  font-size: 10px;
  color: var(--text-muted);
}
.state.on {
  color: #4ade80;
}
.link {
  padding: 0;
  border: none;
  background: none;
  font-size: 11px;
  color: var(--accent-primary);
  cursor: pointer;
  white-space: nowrap;
}
.link.danger {
  color: #f87171;
}
.connect {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}
.key {
  width: 100%;
  box-sizing: border-box;
  padding: 6px 8px;
  font-size: 12px;
  font-family: var(--font-mono, monospace);
  color: var(--text-primary);
  background: var(--surface-1);
  border: 1px solid var(--surface-2);
  border-radius: 6px;
}
</style>
