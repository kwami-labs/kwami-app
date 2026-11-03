<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import PanelSection from '@/components/ui/PanelSection.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import {
  openExternal,
  useProviderConnections,
  type VoiceKeyProvider,
} from '@/composables/useProviderConnections';

/**
 * The providers that only hear and speak. With a key here, and with the model
 * accounts above, a call runs on the user's own accounts: they pay those providers
 * directly, and the energy only pays for the platform.
 */
const PROVIDERS: { id: VoiceKeyProvider; name: string; page: string }[] = [
  { id: 'deepgram', name: 'Deepgram', page: 'https://console.deepgram.com' },
  { id: 'elevenlabs', name: 'ElevenLabs', page: 'https://elevenlabs.io/app/settings/api-keys' },
  { id: 'cartesia', name: 'Cartesia', page: 'https://play.cartesia.ai/keys' },
  { id: 'assemblyai', name: 'AssemblyAI', page: 'https://www.assemblyai.com/app/api-keys' },
];

const { t } = useI18n();
const { connections, saveKey, disconnect } = useProviderConnections();

const open = ref<VoiceKeyProvider | null>(null);
const key = ref('');
const busy = ref(false);
const error = ref('');

function toggle(p: VoiceKeyProvider) {
  open.value = open.value === p ? null : p;
  key.value = '';
  error.value = '';
}
async function save(p: VoiceKeyProvider) {
  busy.value = true;
  error.value = '';
  const result = await saveKey(p, key.value);
  busy.value = false;
  key.value = '';
  if (result === 'ok') open.value = null;
  else error.value = result === 'refused' ? t('mind.keyRefused') : t('mind.keyFailed');
}
async function remove(p: VoiceKeyProvider) {
  error.value = '';
  try {
    await disconnect(p);
  } catch {
    error.value = t('mind.keyFailed');
  }
}
</script>

<template>
  <PanelSection
    v-if="connections?.enabled"
    :title="t('mind.voiceKeysTitle')"
    icon="ph:microphone-duotone"
    collapsible
  >
    <p class="hint">{{ t('mind.voiceKeysHint') }}</p>
    <p v-if="error && !open" class="hint warn">{{ error }}</p>
    <ul class="providers">
      <li v-for="p in PROVIDERS" :key="p.id" class="provider">
        <div class="row">
          <span class="name">{{ p.name }}</span>
          <span v-if="connections.connected?.[p.id]" class="state on">
            {{ t('mind.onYourKey', { hint: connections.connected[p.id]?.hint ?? '' }) }}
          </span>
          <button v-if="connections.connected?.[p.id]" class="link danger" @click="remove(p.id)">
            {{ t('mind.disconnect') }}
          </button>
          <button v-else class="link" @click="toggle(p.id)">
            {{ open === p.id ? t('mind.cancel') : t('mind.connect') }}
          </button>
        </div>
        <div v-if="open === p.id" class="connect">
          <BaseButton
            size="sm"
            variant="secondary"
            icon="ph:arrow-square-out"
            @click="openExternal(p.page)"
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
          <BaseButton size="sm" :disabled="!key.trim() || busy" @click="save(p.id)">
            {{ t('mind.saveKey') }}
          </BaseButton>
          <p v-if="error" class="hint warn">{{ error }}</p>
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
.name {
  flex: 1;
  font-size: 12px;
  color: var(--text-primary);
}
.state {
  font-size: 10px;
  color: var(--text-muted);
}
.state.on {
  color: var(--success);
}
.link {
  padding: 0;
  border: none;
  background: none;
  color: var(--accent-primary);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}
.link.danger {
  color: var(--danger, #f87171);
}
.connect {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 6px;
}
.key {
  padding: 6px 8px;
  border: 1px solid var(--surface-2);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  font-size: 12px;
}
</style>
