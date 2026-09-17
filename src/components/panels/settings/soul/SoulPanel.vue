<script setup lang="ts">
import { ref, reactive, onMounted, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from 'vue-toastification';
import { useKwami } from '@/composables/useKwami';
import { useVoiceStore } from '@/stores/voice';
import { useWorkspaceStore } from '@/stores/workspace';
import { useAuthStore } from '@/stores/auth';
import { storeToRefs } from 'pinia';
import PanelSection from '@/components/ui/PanelSection.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseSlider from '@/components/ui/BaseSlider.vue';
import BaseTagInput from '@/components/ui/BaseTagInput.vue';
import PanelHeaderControls from '@/components/ui/PanelHeaderControls.vue';
import { soulPresets, templateCategories, type SoulPreset } from '@/presets/agent/soul-presets';
import { panelIcons } from '@/constants/panel-icons';
import { useThemeStore } from '@/stores/theme';
import { translateApiUserMessage } from '@/utils/translateApiMessage';

const toast = useToast();
const { t } = useI18n();

const { kwami, isConnected } = useKwami();
const themeStore = useThemeStore();
const isRightSidebar = computed(() => themeStore.sidebarPosition === 'right');
const voiceStore = useVoiceStore();
const workspaceStore = useWorkspaceStore();
const authStore = useAuthStore();
const { soulUI, soulConfig: savedSoulConfig } = storeToRefs(voiceStore);

// Persisted template selection state via store
const selectedCategory = computed({
  get: () => soulUI.value.selectedCategory,
  set: (v) => { soulUI.value.selectedCategory = v; }
});
const selectedTemplateId = computed({
  get: () => soulUI.value.selectedTemplateId,
  set: (v) => { soulUI.value.selectedTemplateId = v; }
});

const filteredTemplates = computed(() => {
  if (!selectedCategory.value) return soulPresets;
  return soulPresets.filter(t => t.category === selectedCategory.value);
});

const emotionalToneOptions = [
  { id: 'neutral', icon: 'ph:minus-duotone' },
  { id: 'warm', icon: 'ph:sun-duotone' },
  { id: 'enthusiastic', icon: 'ph:lightning-duotone' },
  { id: 'calm', icon: 'ph:moon-stars-duotone' },
  { id: 'playful', icon: 'ph:confetti-duotone' },
  { id: 'confident', icon: 'ph:shield-check-duotone' },
  { id: 'serious', icon: 'ph:scales-duotone' },
  { id: 'compassionate', icon: 'ph:hands-praying-duotone' },
] as const;

function selectCategory(categoryId: string | null) {
  selectedCategory.value = selectedCategory.value === categoryId ? null : categoryId;
}

function applyTemplate(template: SoulPreset) {
  if (!kwami.value) return;

  selectedTemplateId.value = template.id;

  const soulConfig = {
    name: template.name,
    personality: template.personality,
    systemPrompt: template.systemPrompt,
    traits: [...template.traits],
    conversationStyle: template.conversationStyle,
    responseLength: template.responseLength,
    emotionalTone: template.emotionalTone as
      | 'neutral'
      | 'warm'
      | 'enthusiastic'
      | 'calm'
      | 'playful'
      | 'confident'
      | 'serious'
      | 'compassionate',
    emotionalTraits: { ...template.emotionalTraits },
  };

  kwami.value.soul.updateConfig(soulConfig);
  syncSoulToBackend(soulConfig);
  syncFromKwami();
}

/**
 * Sync soul changes to the backend agent (if connected)
 */
function syncSoulToBackend(soulConfig?: Record<string, unknown>) {
  if (!kwami.value || !isConnected.value) return;

  const configToSync = soulConfig ?? {
    name: config.name,
    personality: config.personality,
    systemPrompt: config.systemPrompt,
    traits: traits.value,
    conversationStyle: config.conversationStyle,
    responseLength: config.responseLength,
    emotionalTone: config.emotionalTone,
    emotionalTraits: { ...emotionalTraits },
  };

  kwami.value.agent.syncConfigToBackend('soul', configToSync);
  console.log('📤 Synced soul to backend:', configToSync);
}

// State
const config = reactive({
  name: '',
  personality: '',
  conversationStyle: '',
  responseLength: 'medium' as 'short' | 'medium' | 'long',
  emotionalTone: 'neutral' as
    | 'neutral'
    | 'warm'
    | 'enthusiastic'
    | 'calm'
    | 'playful'
    | 'confident'
    | 'serious'
    | 'compassionate',
  systemPrompt: '',
});

const traits = ref<string[]>([]);

const emotionalTraits = reactive({
  happiness: 0,
  energy: 0,
  confidence: 0,
  calmness: 0,
  optimism: 0,
  socialness: 0,
  patience: 0,
  empathy: 0,
  curiosity: 0,
  creativity: 0,
});

const emotionalTraitDefs = computed(() => ([
  { key: 'happiness', label: t('soulPanel.happinessPair'), leftLabel: t('soulPanel.sadness'), rightLabel: t('soulPanel.happiness') },
  { key: 'energy', label: t('soulPanel.energyPair'), leftLabel: t('soulPanel.exhausted'), rightLabel: t('soulPanel.energized') },
  { key: 'confidence', label: t('soulPanel.confidencePair'), leftLabel: t('soulPanel.insecure'), rightLabel: t('soulPanel.confident') },
  { key: 'calmness', label: t('soulPanel.calmnessPair'), leftLabel: t('soulPanel.anxious'), rightLabel: t('soulPanel.calm') },
  { key: 'optimism', label: t('soulPanel.optimismPair'), leftLabel: t('soulPanel.pessimistic'), rightLabel: t('soulPanel.optimistic') },
  { key: 'socialness', label: t('soulPanel.socialnessPair'), leftLabel: t('soulPanel.reserved'), rightLabel: t('soulPanel.social') },
  { key: 'empathy', label: t('soulPanel.empathyPair'), leftLabel: t('soulPanel.detached'), rightLabel: t('soulPanel.empathic') },
  { key: 'curiosity', label: t('soulPanel.curiosityPair'), leftLabel: t('soulPanel.indifferent'), rightLabel: t('soulPanel.curious') },
  { key: 'creativity', label: t('soulPanel.creativityPair'), leftLabel: t('soulPanel.rigid'), rightLabel: t('soulPanel.creative') },
  { key: 'patience', label: t('soulPanel.patiencePair'), leftLabel: t('soulPanel.irritable'), rightLabel: t('soulPanel.patient') },
]) as const);

// Sync from Kwami and mirror to persisted store
function syncFromKwami() {
  if (!kwami.value) return;
  
  // Prevent watchers from firing during sync
  isSyncing = true;
  
  try {
    const pConfig = kwami.value.soul.getConfig();

    config.name = pConfig.name || 'Kwami';
    config.personality = pConfig.personality || '';
    config.conversationStyle = pConfig.conversationStyle || 'friendly';
    config.responseLength = pConfig.responseLength || 'medium';
    config.emotionalTone = pConfig.emotionalTone || 'neutral';
    config.systemPrompt = pConfig.systemPrompt || '';

    traits.value = [...kwami.value.soul.getTraits()];

    if (pConfig.emotionalTraits) {
      Object.assign(emotionalTraits, pConfig.emotionalTraits);
    }

    // Mirror to store for persistence across reloads
    saveToStore();
  } finally {
    // Re-enable watchers after sync completes (use setTimeout to ensure all reactive updates are processed)
    setTimeout(() => { isSyncing = false; }, 0);
  }
}

// Save current local state to the persisted store
function saveToStore() {
  savedSoulConfig.value = {
    // Spread first so fields this panel does not own (currently `language`,
    // which is edited from the models panel) survive a save instead of being
    // silently reset to the store default.
    ...savedSoulConfig.value,
    name: config.name,
    personality: config.personality,
    conversationStyle: config.conversationStyle,
    responseLength: config.responseLength,
    emotionalTone: config.emotionalTone,
    systemPrompt: config.systemPrompt,
    traits: [...traits.value],
    emotionalTraits: { ...emotionalTraits },
  };
}

// Restore saved soul config to kwami (on page reload)
function restoreSavedSoulToKwami() {
  if (!kwami.value) return;
  const saved = savedSoulConfig.value;
  // Only restore if it looks like a non-default config
  if (!saved.personality && saved.name === 'Kwami' && saved.traits.length === 0) return;

  kwami.value.soul.updateConfig({
    name: saved.name,
    personality: saved.personality,
    systemPrompt: saved.systemPrompt,
    traits: [...saved.traits],
    conversationStyle: saved.conversationStyle,
    responseLength: saved.responseLength,
    emotionalTone: saved.emotionalTone,
    emotionalTraits: { ...saved.emotionalTraits },
  });
}

// Live sync watchers - sync changes to kwami automatically
let isSyncing = false; // Prevent infinite loops during sync

watch(() => config.name, (v) => {
  if (!isSyncing && kwami.value) {
    kwami.value.soul.setName(v);
    syncSoulToBackend();
    saveToStore();
    const activeId = workspaceStore.activeWorkspaceId;
    if (activeId && v.trim()) {
      workspaceStore.updateKwami(activeId, { name: v.trim() }, authStore.userId);
    }
  }
});

watch(() => config.personality, (v) => {
  if (!isSyncing && kwami.value) {
    kwami.value.soul.updateConfig({ personality: v });
    syncSoulToBackend();
    saveToStore();
  }
});

watch(() => config.conversationStyle, (v) => {
  if (!isSyncing && kwami.value) {
    kwami.value.soul.setConversationStyle(v);
    syncSoulToBackend();
    saveToStore();
  }
});

watch(() => config.responseLength, (v) => {
  if (!isSyncing && kwami.value) {
    kwami.value.soul.setResponseLength(v);
    syncSoulToBackend();
    saveToStore();
  }
});

watch(() => config.emotionalTone, (v) => {
  if (!isSyncing && kwami.value) {
    kwami.value.soul.setEmotionalTone(v);
    syncSoulToBackend();
    saveToStore();
  }
});

watch(() => config.systemPrompt, (v) => {
  if (!isSyncing && kwami.value) {
    kwami.value.soul.updateConfig({ systemPrompt: v });
    syncSoulToBackend();
    saveToStore();
  }
});

watch(emotionalTraits, (v) => {
  if (!isSyncing && kwami.value) {
    Object.keys(v).forEach((key) => {
      kwami.value?.soul.setEmotionalTrait(
        key as keyof typeof emotionalTraits, 
        v[key as keyof typeof v]
      );
    });
    syncSoulToBackend();
    saveToStore();
  }
}, { deep: true });

function updateTraits(newTraits: string[]) {
  kwami.value?.soul.updateConfig({ traits: newTraits });
  syncFromKwami();
  syncSoulToBackend();
}

function previewPrompt() {
  if (!kwami.value) return;
  console.log('📝 Full System Prompt:\n', kwami.value.soul.getSystemPrompt());
  toast.info(t('soulPanel.promptLogged'));
}

function exportSoul() {
  if (!kwami.value) return;
  const json = kwami.value.soul.exportAsJSON();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'kwami-soul.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importSoul() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      kwami.value?.soul.importFromJSON(await file.text());
      toast.success(t('soulPanel.soulImported'));
      syncFromKwami();
      syncSoulToBackend();
    } catch (error) {
      toast.error(
        t('soulPanel.soulImportFailed', { message: translateApiUserMessage((error as Error).message, t) }),
      );
    }
  };
  input.click();
}

function resetSoul() {
  if (!kwami.value) return;
  if (confirm(t('soulPanel.resetConfirm'))) {
    selectedTemplateId.value = null;
    kwami.value.soul.updateConfig({
      name: 'Kwami',
      personality: 'A friendly and helpful AI companion',
      traits: ['friendly', 'helpful', 'curious'],
      conversationStyle: 'friendly',
      responseLength: 'medium',
      emotionalTone: 'warm',
    });
    toast.success(t('soulPanel.soulReset'));
    syncFromKwami();
    syncSoulToBackend();
  }
}

// Auto-sync when connection state changes
watch(isConnected, (connected) => {
  syncFromKwami();
  // When becoming connected, also push soul config to the backend agent
  if (connected) {
    syncSoulToBackend();
  }
});

onMounted(() => {
  // Restore saved soul to kwami before syncing (handles page reload)
  restoreSavedSoulToKwami();
  syncFromKwami();
});
</script>

<template>
  <div class="panel-inner">
    <div class="panel-header">
      <iconify-icon :icon="panelIcons.soul" class="panel-icon"></iconify-icon>
      <h2>{{ t('soulPanel.title') }}</h2>
      <template v-if="isRightSidebar">
        <PanelHeaderControls :show-divider="true" />
        <button class="refresh-btn" @click="syncFromKwami" :title="t('soulPanel.refreshFromKwami')">
          <iconify-icon icon="ph:arrows-clockwise-duotone"></iconify-icon>
        </button>
      </template>
      <template v-else>
        <button class="refresh-btn" @click="syncFromKwami" :title="t('soulPanel.refreshFromKwami')">
          <iconify-icon icon="ph:arrows-clockwise-duotone"></iconify-icon>
        </button>
        <PanelHeaderControls :show-divider="true" />
      </template>
    </div>

    <div class="panel-body">
      <!-- Presets -->
      <PanelSection :title="t('soulPanel.presets')">
        <div class="template-categories">
          <button
            v-for="cat in templateCategories"
            :key="cat.id"
            class="category-chip"
            :class="{ active: selectedCategory === cat.id }"
            :style="{ '--cat-color': cat.color }"
            @click="selectCategory(cat.id)"
          >
            <iconify-icon :icon="cat.icon"></iconify-icon>
            <span>{{ cat.label }}</span>
          </button>
        </div>
        <div class="template-grid">
          <div
            v-for="template in filteredTemplates"
            :key="template.id"
            class="template-card"
            :class="{ selected: selectedTemplateId === template.id }"
            :style="{ '--template-color': template.color }"
            @click="applyTemplate(template)"
          >
            <div class="template-icon">
              <iconify-icon :icon="template.icon"></iconify-icon>
            </div>
            <div class="template-info">
              <span class="template-name">{{ template.name }}</span>
              <span class="template-desc">{{ template.personality.substring(0, 50) }}...</span>
            </div>
          </div>
        </div>
      </PanelSection>

      <!-- Identity -->
      <PanelSection :title="t('soulPanel.identity')">
        <BaseInput
           :label="t('soulPanel.name')"
           v-model="config.name"
           icon="ph:identification-badge-duotone"
           :placeholder="t('soulPanel.namePlaceholder')"
        />
        <!-- TextArea not yet primitive, keep native or make Primitive? Native is fine for now but styled -->
        <div class="form-group" style="margin-top: 8px">
          <label style="font-size: 11px; color: var(--text-tertiary); margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
            <iconify-icon icon="ph:sparkle-duotone" style="font-size: 14px; color: var(--text-tertiary);"></iconify-icon>
            {{ t('soulPanel.personality') }}
          </label>
          <textarea
            v-model="config.personality"
            rows="2"
            :placeholder="t('soulPanel.personalityPlaceholder')"
          ></textarea>
        </div>
        <div class="form-group" style="margin-top: 8px">
          <label style="font-size: 11px; color: var(--text-tertiary); margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
            <iconify-icon icon="ph:terminal-window-duotone" style="font-size: 14px; color: var(--text-tertiary);"></iconify-icon>
            {{ t('soulPanel.systemPrompt') }}
          </label>
          <textarea
            v-model="config.systemPrompt"
            rows="4"
            :placeholder="t('soulPanel.systemPromptPlaceholder')"
          ></textarea>
          <BaseButton size="sm" icon="ph:eye-duotone" @click="previewPrompt" style="margin-top: 8px"
            >{{ t('soulPanel.previewFullPrompt') }}</BaseButton
          >
        </div>
      </PanelSection>

      <!-- Traits -->
      <PanelSection :title="t('soulPanel.traits')">
        <BaseTagInput
          :modelValue="traits"
          @update:modelValue="updateTraits"
          :placeholder="t('soulPanel.addTrait')"
        />
      </PanelSection>

      <!-- Conversation Style -->
      <PanelSection :title="t('soulPanel.conversationStyle')">
        <BaseInput
          :label="t('soulPanel.style')"
          v-model="config.conversationStyle"
          icon="ph:chat-teardrop-duotone"
          :placeholder="t('soulPanel.stylePlaceholder')"
        />
      </PanelSection>

      <!-- Response Settings -->
      <PanelSection :title="t('soulPanel.responseSettings')">
        <div class="option-group">
          <span class="option-label">{{ t('soulPanel.responseLength') }}</span>
          <div class="toggle-group">
            <button
              class="toggle-btn"
              :class="{ active: config.responseLength === 'short' }"
              @click="config.responseLength = 'short'"
            >
              {{ t('soulPanel.short') }}
            </button>
            <button
              class="toggle-btn"
              :class="{ active: config.responseLength === 'medium' }"
              @click="config.responseLength = 'medium'"
            >
              {{ t('soulPanel.medium') }}
            </button>
            <button
              class="toggle-btn"
              :class="{ active: config.responseLength === 'long' }"
              @click="config.responseLength = 'long'"
            >
              {{ t('soulPanel.long') }}
            </button>
          </div>
        </div>
        <div class="option-group">
          <span class="option-label">{{ t('soulPanel.emotionalTone') }}</span>
          <p class="tone-hint">{{ t('soulPanel.emotionalToneHint') }}</p>
          <div class="tone-selector">
            <div
              v-for="tone in emotionalToneOptions"
              :key="tone.id"
              class="tone-option"
              :class="{ active: config.emotionalTone === tone.id }"
              @click="config.emotionalTone = tone.id"
            >
              <iconify-icon :icon="tone.icon"></iconify-icon>
              <span>{{ t(`soulPanel.${tone.id}`) }}</span>
            </div>
          </div>
        </div>
      </PanelSection>

      <!-- Emotional Traits -->
      <PanelSection :title="t('soulPanel.emotionalTraits')">
        <p class="traits-hint">{{ t('soulPanel.emotionalTraitsHint') }}</p>
        <div class="slider-group">
          <div v-for="trait in emotionalTraitDefs" :key="trait.key" class="trait-slider">
            <BaseSlider
              :label="trait.label"
              :min="-100"
              :max="100"
              :step="1"
              v-model="emotionalTraits[trait.key]"
            />
            <div class="trait-range-labels">
              <span class="trait-negative">{{ trait.leftLabel }} (-100)</span>
              <span class="trait-neutral">{{ t('soulPanel.neutralPoint') }} (0)</span>
              <span class="trait-positive">{{ trait.rightLabel }} (+100)</span>
            </div>
          </div>
        </div>
      </PanelSection>

      <!-- Actions -->
      <PanelSection :title="t('soulPanel.actions')">
        <div class="action-buttons">
          <div class="row">
            <BaseButton variant="secondary" icon="ph:export-duotone" @click="exportSoul"
              >{{ t('soulPanel.exportJson') }}</BaseButton
            >
            <BaseButton variant="secondary" icon="ph:download-duotone" @click="importSoul"
              >{{ t('soulPanel.importJson') }}</BaseButton
            >
          </div>
          <BaseButton
            variant="secondary"
            icon="ph:arrow-counter-clockwise-duotone"
            @click="resetSoul"
            block
            style="margin-top: 8px"
            >{{ t('soulPanel.resetDefault') }}</BaseButton
          >
        </div>
      </PanelSection>
    </div>
  </div>
</template>

<style scoped>
.refresh-btn {
  margin-left: auto;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-2);
  border: 1px solid var(--glass-border);
  border-radius: 6px;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all 0.2s;
}

.refresh-btn:hover {
  background: var(--surface-3);
  color: var(--text-primary);
  border-color: var(--accent-primary);
}

.refresh-btn:active {
  transform: rotate(180deg);
}

.refresh-btn iconify-icon {
  font-size: 16px;
}

textarea {
  width: 100%;
  padding: 8px 12px;
  background: var(--surface-2);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  resize: vertical;
}

.option-group {
  margin-bottom: 12px;
}
.option-label {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
  margin-bottom: 8px;
}

.toggle-group {
  display: flex;
  background: var(--surface-2);
  padding: 2px;
  border-radius: 8px;
}
.toggle-btn {
  flex: 1;
  padding: 6px 10px;
  background: transparent;
  border: none;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
}
.toggle-btn.active {
  background: var(--accent-primary);
  color: white;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.tone-selector {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.tone-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 10px;
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}
.tone-option.active {
  background: var(--surface-3);
  border-color: var(--accent-primary);
  color: var(--text-primary);
}
.tone-option iconify-icon {
  font-size: 20px;
}
.tone-option span {
  font-size: 11px;
}

.tone-hint,
.traits-hint {
  margin: 0 0 8px 0;
  font-size: 11px;
  color: var(--text-tertiary);
  line-height: 1.35;
}

.trait-slider {
  margin-bottom: 8px;
}

.trait-range-labels {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin-top: 4px;
  font-size: 10px;
}

.trait-range-labels span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.trait-negative {
  color: #ef4444;
  text-align: left;
}

.trait-neutral {
  color: var(--text-tertiary);
  text-align: center;
}

.trait-positive {
  color: #22c55e;
  text-align: right;
}
.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

/* Template Selector Styles */
.template-categories {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.category-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  background: var(--surface-2);
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  font-size: 11px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.category-chip:hover {
  background: var(--surface-3);
  border-color: var(--cat-color, var(--accent-primary));
}

.category-chip.active {
  background: color-mix(in srgb, var(--cat-color, var(--accent-primary)) 15%, transparent);
  border-color: var(--cat-color, var(--accent-primary));
  color: var(--text-primary);
}

.category-chip iconify-icon {
  font-size: 14px;
  color: var(--cat-color, var(--text-tertiary));
}

.template-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  max-height: 280px;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;
}

.template-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px;
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 0;
  overflow: hidden;
}

.template-card:hover {
  background: var(--surface-2);
  border-color: var(--template-color, var(--accent-primary));
  transform: translateY(-1px);
}

.template-card.selected {
  background: color-mix(in srgb, var(--template-color, var(--accent-primary)) 12%, transparent);
  border-color: var(--template-color, var(--accent-primary));
  box-shadow: 0 0 12px color-mix(in srgb, var(--template-color, var(--accent-primary)) 25%, transparent);
}

.template-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--template-color, var(--accent-primary)) 15%, transparent);
  border-radius: 8px;
  flex-shrink: 0;
}

.template-icon iconify-icon {
  font-size: 18px;
  color: var(--template-color, var(--accent-primary));
}

.template-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.template-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.template-desc {
  font-size: 10px;
  color: var(--text-tertiary);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
