<script setup lang="ts">
import BaseButton from './BaseButton.vue';

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    icon?: string;
    confirmLabel?: string;
    confirmIcon?: string;
    confirmVariant?: 'primary' | 'danger' | 'accent' | 'secondary';
    cancelLabel?: string;
    loading?: boolean;
  }>(),
  {
    icon: 'ph:warning-duotone',
    confirmLabel: 'Confirm',
    confirmIcon: undefined,
    confirmVariant: 'primary',
    cancelLabel: 'Cancel',
    loading: false,
  },
);

const emit = defineEmits<{
  (e: 'confirm'): void;
  (e: 'cancel'): void;
}>();

function handleCancel() {
  if (!props.loading) {
    emit('cancel');
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm-dialog">
      <div v-if="open" class="confirm-dialog-overlay" @click.self="handleCancel">
        <div class="confirm-dialog">
          <div class="confirm-dialog-header">
            <iconify-icon :icon="icon" class="header-icon"></iconify-icon>
            <h3>{{ title }}</h3>
          </div>
          <div class="confirm-dialog-body">
            <slot />
          </div>
          <div class="confirm-dialog-footer">
            <div class="footer-left">
              <slot name="footerLeft" />
            </div>
            <div class="footer-actions">
              <BaseButton variant="secondary" @click="handleCancel" :disabled="loading">
                {{ cancelLabel }}
              </BaseButton>
              <BaseButton
                :variant="confirmVariant"
                :icon="confirmIcon"
                :loading="loading"
                :disabled="loading"
                @click="emit('confirm')"
              >
                {{ loading ? 'Working...' : confirmLabel }}
              </BaseButton>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.confirm-dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.confirm-dialog {
  width: 100%;
  max-width: 420px;
  background: var(--surface-1);
  border-radius: var(--radius-lg);
  border: 1px solid var(--glass-border);
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

.confirm-dialog-header {
  padding: 20px 24px;
  background: var(--surface-2);
  border-bottom: 1px solid var(--glass-border);
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  font-size: 24px;
  color: var(--accent-primary);
  flex-shrink: 0;
}

.confirm-dialog-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.confirm-dialog-body {
  padding: 20px 24px;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.confirm-dialog-body :deep(p) {
  margin: 0 0 10px 0;
}

.confirm-dialog-body :deep(p:last-child) {
  margin-bottom: 0;
}

.confirm-dialog-body :deep(strong) {
  color: var(--text-primary);
}

.confirm-dialog-body :deep(code) {
  display: block;
  padding: 10px 14px;
  background: var(--surface-2);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  font-family: monospace;
  font-size: 12px;
  color: var(--accent-primary);
  margin: 10px 0;
  word-break: break-all;
}

.confirm-dialog-body :deep(.warning-text) {
  padding: 12px;
  background: var(--error-glow, rgba(239, 68, 68, 0.08));
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: var(--error, var(--accent-error));
}

.confirm-dialog-footer {
  padding: 16px 24px;
  background: var(--surface-0);
  border-top: 1px solid var(--glass-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.footer-left {
  margin-right: auto;
}
.footer-actions {
  display: flex;
  gap: 12px;
}

/* Animations */
.confirm-dialog-enter-active {
  animation: dialogOverlayIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.confirm-dialog-leave-active {
  animation: dialogOverlayOut 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.confirm-dialog-enter-active .confirm-dialog {
  animation: dialogContentIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.confirm-dialog-leave-active .confirm-dialog {
  animation: dialogContentOut 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes dialogOverlayIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes dialogOverlayOut {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}
@keyframes dialogContentIn {
  from {
    opacity: 0;
    transform: scale(0.88) translateY(-16px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
@keyframes dialogContentOut {
  from {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
  to {
    opacity: 0;
    transform: scale(0.95) translateY(8px);
  }
}
</style>
