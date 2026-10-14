<script setup lang="ts">
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { useKwami } from '@/composables/useKwami';
import { useVoiceStore } from '@/stores/voice';
import PanelSection from '@/components/ui/PanelSection.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseToggle from '@/components/ui/BaseToggle.vue';
import {
  CHARTER_PROFILE_MAX_CHARS,
  CHARTER_WATCH_TOPICS,
  chiefOfStaffCharter,
  type CharterConfig,
  type CharterWatchTopic,
} from '@/lib/charter';

/**
 * The charter section of the Soul panel.
 *
 * Bound straight to the store's `soulConfig.charter` rather than to a local
 * copy, because the agent writes to it too: when `remember_about_user` adds a
 * line to the profile, this textarea shows it without a refresh.
 */
const { t } = useI18n();
const { kwami, isConnected } = useKwami();
const voiceStore = useVoiceStore();
const { soulConfig } = storeToRefs(voiceStore);

const charter = computed(() => soulConfig.value.charter);

function patch(changes: Partial<CharterConfig>) {
  soulConfig.value = {
    ...soulConfig.value,
    charter: { ...soulConfig.value.charter, ...changes },
  };
}

type Option<T extends string> = { id: T; label: string };

const witOptions = computed<Option<CharterConfig['wit']>[]>(() => [
  { id: 'none', label: t('charterPanel.witNone') },
  { id: 'subtle', label: t('charterPanel.witSubtle') },
  { id: 'marked', label: t('charterPanel.witMarked') },
]);
const pushbackOptions = computed<Option<CharterConfig['pushback']>[]>(() => [
  { id: 'off', label: t('charterPanel.pushbackOff') },
  { id: 'once', label: t('charterPanel.pushbackOnce') },
  { id: 'firm', label: t('charterPanel.pushbackFirm') },
]);
const opinionOptions = computed<Option<CharterConfig['opinions']>[]>(() => [
  { id: 'always', label: t('charterPanel.opinionsAlways') },
  { id: 'on_request', label: t('charterPanel.opinionsOnRequest') },
  { id: 'never', label: t('charterPanel.opinionsNever') },
]);
const initiativeOptions = computed<Option<CharterConfig['initiative']>[]>(() => [
  { id: 'act', label: t('charterPanel.initiativeAct') },
  { id: 'propose', label: t('charterPanel.initiativePropose') },
  { id: 'wait', label: t('charterPanel.initiativeWait') },
]);
const learnOptions = computed<Option<CharterConfig['learn']>[]>(() => [
  { id: 'announce', label: t('charterPanel.learnAnnounce') },
  { id: 'silent', label: t('charterPanel.learnSilent') },
  { id: 'off', label: t('charterPanel.learnOff') },
]);
const greetingOptions = computed<Option<CharterConfig['greeting']>[]>(() => [
  { id: 'brief_pending', label: t('charterPanel.greetingBriefPending') },
  { id: 'brief', label: t('charterPanel.greetingBrief') },
  { id: 'briefing', label: t('charterPanel.greetingBriefing') },
  { id: 'none', label: t('charterPanel.greetingNone') },
]);

const watchLabels: Record<CharterWatchTopic, string> = {
  money: 'charterPanel.watchMoney',
  privacy: 'charterPanel.watchPrivacy',
  impulse: 'charterPanel.watchImpulse',
  health: 'charterPanel.watchHealth',
  commitments: 'charterPanel.watchCommitments',
};

function toggleWatch(topic: CharterWatchTopic) {
  const current = charter.value.watch;
  patch({
    watch: current.includes(topic) ? current.filter((x) => x !== topic) : [...current, topic],
  });
}

function applyChiefOfStaff() {
  // Keeps whatever the user and the agent already wrote in the profile.
  patch({ ...chiefOfStaffCharter(), userProfile: charter.value.userProfile });
}

const addressAs = computed({
  get: () => charter.value.addressAs,
  set: (value: string) => patch({ addressAs: value }),
});

const userProfile = computed({
  get: () => charter.value.userProfile,
  set: (value: string) => patch({ userProfile: value.slice(0, CHARTER_PROFILE_MAX_CHARS) }),
});

// Push to the kwami and the live agent, debounced so typing in the profile
// does not rebuild the agent's instructions on every keystroke.
let pushTimer: ReturnType<typeof setTimeout> | null = null;
watch(
  charter,
  (value) => {
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      if (!kwami.value) return;
      const snapshot = { ...value, watch: [...value.watch] };
      kwami.value.soul.updateConfig({ charter: snapshot } as Record<string, unknown>);
      if (isConnected.value) {
        kwami.value.agent.syncConfigToBackend('soul', { charter: snapshot });
      }
    }, 600);
  },
  { deep: true },
);
</script>

<template>
  <PanelSection :title="t('charterPanel.title')">
    <p class="hint">{{ t('charterPanel.hint') }}</p>

    <BaseToggle
      :model-value="charter.enabled"
      :label="t('charterPanel.enabled')"
      @update:model-value="patch({ enabled: $event })"
    />

    <BaseButton
      size="sm"
      variant="secondary"
      icon="ph:crown-simple-duotone"
      block
      style="margin: 8px 0 12px"
      @click="applyChiefOfStaff"
      >{{ t('charterPanel.applyChiefOfStaff') }}</BaseButton
    >

    <div v-if="charter.enabled" class="charter-body">
      <BaseInput
        v-model="addressAs"
        :label="t('charterPanel.addressAs')"
        icon="ph:user-circle-duotone"
        :placeholder="t('charterPanel.addressAsPlaceholder')"
      />
      <div class="spacer" />
      <BaseToggle
        :model-value="charter.formal"
        :label="t('charterPanel.formal')"
        size="sm"
        @update:model-value="patch({ formal: $event })"
      />
      <BaseToggle
        :model-value="charter.adaptiveLength"
        :label="t('charterPanel.adaptiveLength')"
        size="sm"
        @update:model-value="patch({ adaptiveLength: $event })"
      />

      <div class="option-group">
        <span class="option-label">{{ t('charterPanel.wit') }}</span>
        <div class="toggle-group">
          <button
            v-for="o in witOptions"
            :key="o.id"
            class="toggle-btn"
            :class="{ active: charter.wit === o.id }"
            @click="patch({ wit: o.id })"
          >
            {{ o.label }}
          </button>
        </div>
      </div>

      <div class="option-group">
        <span class="option-label">{{ t('charterPanel.pushback') }}</span>
        <div class="toggle-group">
          <button
            v-for="o in pushbackOptions"
            :key="o.id"
            class="toggle-btn"
            :class="{ active: charter.pushback === o.id }"
            @click="patch({ pushback: o.id })"
          >
            {{ o.label }}
          </button>
        </div>
      </div>

      <div class="option-group">
        <span class="option-label">{{ t('charterPanel.watch') }}</span>
        <div class="chips">
          <button
            v-for="topic in CHARTER_WATCH_TOPICS"
            :key="topic"
            class="chip"
            :class="{ active: charter.watch.includes(topic) }"
            @click="toggleWatch(topic)"
          >
            {{ t(watchLabels[topic]) }}
          </button>
        </div>
      </div>

      <div class="option-group">
        <span class="option-label">{{ t('charterPanel.opinions') }}</span>
        <div class="toggle-group">
          <button
            v-for="o in opinionOptions"
            :key="o.id"
            class="toggle-btn"
            :class="{ active: charter.opinions === o.id }"
            @click="patch({ opinions: o.id })"
          >
            {{ o.label }}
          </button>
        </div>
      </div>

      <div class="option-group">
        <span class="option-label">{{ t('charterPanel.initiative') }}</span>
        <div class="toggle-group">
          <button
            v-for="o in initiativeOptions"
            :key="o.id"
            class="toggle-btn"
            :class="{ active: charter.initiative === o.id }"
            @click="patch({ initiative: o.id })"
          >
            {{ o.label }}
          </button>
        </div>
      </div>

      <div class="option-group">
        <span class="option-label">{{ t('charterPanel.learn') }}</span>
        <div class="toggle-group">
          <button
            v-for="o in learnOptions"
            :key="o.id"
            class="toggle-btn"
            :class="{ active: charter.learn === o.id }"
            @click="patch({ learn: o.id })"
          >
            {{ o.label }}
          </button>
        </div>
      </div>

      <div class="option-group">
        <span class="option-label">{{ t('charterPanel.greeting') }}</span>
        <div class="toggle-group wrap">
          <button
            v-for="o in greetingOptions"
            :key="o.id"
            class="toggle-btn"
            :class="{ active: charter.greeting === o.id }"
            @click="patch({ greeting: o.id })"
          >
            {{ o.label }}
          </button>
        </div>
      </div>

      <div class="option-group">
        <span class="option-label">{{ t('charterPanel.profile') }}</span>
        <textarea
          v-model="userProfile"
          rows="6"
          :maxlength="CHARTER_PROFILE_MAX_CHARS"
          :placeholder="t('charterPanel.profilePlaceholder')"
        ></textarea>
        <span class="count">{{
          t('charterPanel.profileCount', {
            count: charter.userProfile.length,
            max: CHARTER_PROFILE_MAX_CHARS,
          })
        }}</span>
      </div>
    </div>
  </PanelSection>
</template>

<style scoped>
.hint {
  font-size: 11px;
  color: var(--text-tertiary);
  margin: 0 0 10px;
  line-height: 1.4;
}
.spacer {
  height: 8px;
}
.charter-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
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
  box-sizing: border-box;
}
.count {
  display: block;
  margin-top: 4px;
  font-size: 10px;
  color: var(--text-tertiary);
  text-align: right;
}
.option-group {
  margin: 6px 0;
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
.toggle-group.wrap {
  flex-wrap: wrap;
}
.toggle-btn {
  flex: 1;
  padding: 6px 8px;
  background: transparent;
  border: none;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
  white-space: nowrap;
}
.toggle-btn.active {
  background: var(--accent-primary);
  color: white;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip {
  padding: 5px 10px;
  border-radius: 999px;
  border: 1px solid var(--glass-border);
  background: var(--surface-1);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.chip.active {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: white;
}
</style>
