<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseColorPicker from '@/components/ui/BaseColorPicker.vue';
import { getGradient, randomizeGradientColors } from '@/composables/useKwamiGradient';

const props = defineProps<{
  open: boolean;
  kwami: { id: string; name: string; colors: { x: string; y: string; z: string } } | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', payload: { name: string; colors: { x: string; y: string; z: string } }): void;
  (e: 'delete'): void;
}>();
const { t } = useI18n();

const name = ref('');
const colors = ref<{ x: string; y: string; z: string }>({
  x: '#00d9ff',
  y: '#a855f7',
  z: '#22c55e',
});

watch(
  () => [props.open, props.kwami] as const,
  ([isOpen, kwami]) => {
    if (isOpen && kwami) {
      name.value = kwami.name;
      colors.value = { ...kwami.colors };
    }
  },
);

function onConfirm() {
  const trimmed = name.value.trim();
  if (!trimmed || !props.kwami) {
    emit('close');
    return;
  }
  emit('save', { name: trimmed, colors: { ...colors.value } });
  emit('close');
}

function onCancel() {
  emit('close');
}

function onDelete() {
  emit('delete');
  emit('close');
}

function onRandomize() {
  randomizeGradientColors(colors.value);
}
</script>

<template>
  <ConfirmDialog
    :open="open"
    :title="t('sidebarModals.editKwamiTitle')"
    icon="ph:pencil-simple-duotone"
    :confirm-label="t('sidebarModals.save')"
    confirm-variant="accent"
    @confirm="onConfirm"
    @cancel="onCancel"
  >
    <p>{{ t('sidebarModals.editKwamiHint') }}</p>
    <BaseInput
      v-model="name"
      :placeholder="t('sidebarModals.kwamiNamePlaceholder')"
      :label="t('sidebarModals.name')"
      class="kwami-name-input"
      @keydown.enter.prevent="onConfirm"
    />
    <div class="kwami-gradient-section">
      <div class="gradient-section-header">
        <span class="gradient-label">{{ t('sidebarModals.avatarGradient') }}</span>
        <button
          type="button"
          class="gradient-dice-btn"
          :title="t('sidebarModals.randomizeColors')"
          @click="onRandomize"
        >
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
    <template #footerLeft>
      <button type="button" class="delete-kwami-btn" @click="onDelete">
        <iconify-icon icon="ph:trash-duotone"></iconify-icon>
        {{ t('sidebarModals.deleteKwami') }}
      </button>
    </template>
  </ConfirmDialog>
</template>

<style scoped>
.kwami-name-input {
  margin-top: 8px;
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
.delete-kwami-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: transparent;
  border: 1px solid var(--error, #ef4444);
  border-radius: var(--radius-md);
  color: var(--error, #ef4444);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}
.delete-kwami-btn:hover {
  background: var(--error-glow, rgba(239, 68, 68, 0.15));
}
.delete-kwami-btn iconify-icon {
  font-size: 18px;
}
</style>
