<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import PanelSection from '@/components/ui/PanelSection.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import { panelIcon } from '@/constants/panel-icons';
import { orderPanels, PANEL_GROUPS, PROTECTED_PANELS } from '@/lib/panelArrangement';
import { useUIStore } from '@/stores/ui';

const { t } = useI18n();
const uiStore = useUIStore();

const groups = computed(() =>
  PANEL_GROUPS.map((group) => orderPanels(group, uiStore.panelArrangement)),
);

function isHidden(panel: string) {
  return uiStore.panelArrangement.hidden.includes(panel);
}
</script>

<template>
  <PanelSection :title="t('layout.title')" icon="ph:layout-duotone" collapsible>
    <p class="layout-hint">{{ t('layout.hint') }}</p>
    <ul v-for="(group, index) in groups" :key="index" class="layout-group">
      <li v-for="(panel, position) in group" :key="panel" class="layout-row">
        <iconify-icon :icon="panelIcon(panel)"></iconify-icon>
        <span class="layout-name" :class="{ 'is-hidden': isHidden(panel) }">
          {{ t(`sidebar.panels.${panel}`) }}
        </span>
        <button
          class="layout-action"
          :disabled="position === 0"
          :aria-label="t('layout.moveUp', { panel: t(`sidebar.panels.${panel}`) })"
          @click="uiStore.movePanel(panel, -1)"
        >
          <iconify-icon icon="ph:arrow-up"></iconify-icon>
        </button>
        <button
          class="layout-action"
          :disabled="position === group.length - 1"
          :aria-label="t('layout.moveDown', { panel: t(`sidebar.panels.${panel}`) })"
          @click="uiStore.movePanel(panel, 1)"
        >
          <iconify-icon icon="ph:arrow-down"></iconify-icon>
        </button>
        <button
          class="layout-action"
          :disabled="PROTECTED_PANELS.has(panel)"
          :aria-label="
            t(isHidden(panel) ? 'layout.show' : 'layout.hide', {
              panel: t(`sidebar.panels.${panel}`),
            })
          "
          @click="uiStore.setPanelHidden(panel, !isHidden(panel))"
        >
          <iconify-icon :icon="isHidden(panel) ? 'ph:eye-slash' : 'ph:eye'"></iconify-icon>
        </button>
      </li>
    </ul>
    <BaseButton variant="secondary" size="sm" @click="uiStore.resetPanelArrangement()">
      {{ t('layout.reset') }}
    </BaseButton>
  </PanelSection>
</template>

<style scoped>
.layout-hint {
  margin: 0 0 0.5rem;
  opacity: 0.75;
  font-size: 0.85rem;
}
.layout-group {
  list-style: none;
  margin: 0 0 0.75rem;
  padding: 0;
}
.layout-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.2rem 0;
}
.layout-name {
  flex: 1;
}
.layout-name.is-hidden {
  opacity: 0.45;
  text-decoration: line-through;
}
.layout-action {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 0.2rem;
}
.layout-action:disabled {
  opacity: 0.3;
  cursor: default;
}
</style>
