<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { useAvatarStore } from '@/stores/avatar';
import BasePanel from '@/components/ui/BasePanel.vue';
import PanelSection from '@/components/ui/PanelSection.vue';
import MusicPlayer from '@/components/controls/MusicPlayer.vue';
import BlobXyzSettings from './BlobXyzSettings.vue';
import BlackHoleSettings from './BlackHoleSettings.vue';
import { panelIcons } from '@/constants/panel-icons';

const panelIcon = panelIcons.audio ?? 'ph:waveform-duotone';
const { t } = useI18n();
const avatarStore = useAvatarStore();
const { rendererType } = storeToRefs(avatarStore);
</script>

<template>
  <BasePanel :icon="panelIcon" :title="t('audioPanel.title')">
    <BlobXyzSettings v-if="rendererType === 'blob-xyz'" />
    <BlackHoleSettings v-else-if="rendererType === 'black-hole'" />

    <PanelSection v-else :title="t('audioPanel.unavailableTitle')" icon="ph:warning-circle-duotone" collapsible>
      <p class="section-desc">{{ t('audioPanel.unavailableDesc') }}</p>
    </PanelSection>

    <PanelSection :title="t('audioPanel.playerTitle')" icon="ph:music-notes-duotone">
      <p class="section-desc">{{ t('audioPanel.playerDesc') }}</p>
      <div class="music-player-host">
        <MusicPlayer />
      </div>
    </PanelSection>
  </BasePanel>
</template>

<style scoped>
@import '@/styles/avatar-settings.css';

.music-player-host {
  position: relative;
}
</style>
