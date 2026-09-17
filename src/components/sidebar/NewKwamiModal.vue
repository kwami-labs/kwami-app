<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseToggle from '@/components/ui/BaseToggle.vue';
import BaseColorPicker from '@/components/ui/BaseColorPicker.vue';
import { defaultGradient, getGradient, randomizeGradientColors } from '@/composables/useKwamiGradient';

const props = withDefaults(
  defineProps<{
    open: boolean;
    initialColors?: { x: string; y: string; z: string };
  }>(),
  { initialColors: () => ({ ...defaultGradient }) }
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'confirm', payload: { name: string; randomize: boolean; colors: { x: string; y: string; z: string } }): void;
}>();
const { t } = useI18n();

const name = ref('');
const randomize = ref(false);
const colors = ref<{ x: string; y: string; z: string }>({ ...defaultGradient });

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      name.value = '';
      randomize.value = false;
      colors.value = props.initialColors ? { ...props.initialColors } : { ...defaultGradient };
    }
  }
);

function onConfirm() {
  emit('confirm', {
    name: name.value.trim(),
    randomize: randomize.value,
    colors: { ...colors.value },
  });
  emit('close');
}

function onCancel() {
  emit('close');
}

function onRandomize() {
  randomizeGradientColors(colors.value);
}
</script>

<template>
  <ConfirmDialog
    :open="open"
    :title="t('sidebarModals.newKwamiTitle')"
    icon="ph:sparkle-duotone"
    :confirm-label="t('sidebarModals.create')"
    confirm-variant="accent"
    @confirm="onConfirm"
    @cancel="onCancel"
  >
    <p>{{ t('sidebarModals.newKwamiHint') }}</p>
    <BaseInput
      v-model="name"
      :placeholder="t('sidebarModals.namePlaceholder')"
      :label="t('sidebarModals.name')"
      class="kwami-name-input"
      @keydown.enter.prevent="onConfirm"
    />
    <div class="kwami-modal-toggle">
      <BaseToggle v-model="randomize" :label="t('sidebarModals.randomize')" />
      <span class="toggle-hint">{{ t('sidebarModals.randomizeHint') }}</span>
    </div>
    <div class="kwami-gradient-section">
      <div class="gradient-section-header">
        <span class="gradient-label">{{ t('sidebarModals.avatarGradient') }}</span>
        <button type="button" class="gradient-dice-btn" :title="t('sidebarModals.randomizeColors')" @click="onRandomize">
          <iconify-icon icon="ph:dice-five-duotone"></iconify-icon>
          <span>{{ t('sidebarModals.random') }}</span>
        </button>
      </div>
      <div class="gradient-block">
        <div class="gradient-preview-square" :style="{ background: getGradient(colors) }"></div>
        <div class="gradient-pickers">
          <BaseColorPicker v-model="colors.x" label="X" />
          <BaseColorPicker v-model="colors.y" label="Y" />
          <BaseColorPicker v-model="colors.z" label="Z" />
        </div>
      </div>
    </div>
  </ConfirmDialog>
</template>

<style scoped>
.kwami-name-input {
  margin-top: 8px;
}
.kwami-modal-toggle {
  margin-top: 14px;
}
.kwami-modal-toggle .toggle-hint {
  display: block;
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 4px;
}
.kwami-gradient-section {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--glass-border);
}
.gradient-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}
.gradient-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.gradient-dice-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--surface-2);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}
.gradient-dice-btn:hover {
  background: var(--surface-3);
  color: var(--accent-primary);
  border-color: var(--accent-primary);
}
.gradient-dice-btn iconify-icon {
  font-size: 16px;
}
.gradient-block {
  display: flex;
  align-items: stretch;
  gap: 14px;
}
.gradient-preview-square {
  width: 72px;
  height: 72px;
  flex-shrink: 0;
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
}
.gradient-pickers {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  flex: 1;
  min-width: 0;
}
.gradient-pickers :deep(.base-input) {
  min-width: 0;
}
.gradient-pickers :deep(.color-picker-wrapper) {
  min-width: 0;
}
.gradient-pickers :deep(.color-label) {
  font-size: 9px;
}
.gradient-pickers :deep(.color-preview) {
  height: 28px;
  border-radius: var(--radius-sm);
}
.gradient-pickers :deep(.color-value) {
  font-size: 8px;
  padding: 1px 4px;
}
</style>
