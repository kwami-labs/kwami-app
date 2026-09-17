<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import BasePanel from '@/components/ui/BasePanel.vue';
import { panelIcons } from '@/constants/panel-icons';
import SceneBackground from './SceneBackground.vue';

const panelIcon = panelIcons.scene ?? 'ph:mountains-duotone';
const { t } = useI18n();

// Scene background logic is now handled by useSceneBackground composable
// which is initialized in App.vue when Kwami starts.
// This panel is just a UI wrapper for the SceneBackground component.
</script>

<template>
  <BasePanel :icon="panelIcon" :title="t('scene.title')">
    <SceneBackground />
  </BasePanel>
</template>
