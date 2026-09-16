<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useEmailStore } from '@/stores/email';
import BaseButton from '@/components/ui/BaseButton.vue';
import { useToast } from 'vue-toastification';

const props = defineProps<{
  replyTo?: { to: string; subject: string } | null;
}>();

const emit = defineEmits<{ (e: 'back'): void }>();
const { t } = useI18n();
const emailStore = useEmailStore();
const toast = useToast();

const to = ref(props.replyTo?.to ?? '');
const cc = ref('');
const subject = ref(props.replyTo?.subject ?? '');
const body = ref('');
const sendError = ref('');

async function send() {
  sendError.value = '';
  const toList = to.value
    .split(/[,;]\s*/)
    .map((a) => a.trim())
    .filter(Boolean);

  if (toList.length === 0) {
    sendError.value = t('email.compose.toRequired');
    return;
  }

  const ccList = cc.value
    ? cc.value.split(/[,;]\s*/).map((a) => a.trim()).filter(Boolean)
    : [];

  try {
    await emailStore.sendEmail({
      to: toList,
      cc: ccList,
      subject: subject.value,
      bodyText: body.value,
    });
    toast.success(t('email.compose.sent'));
    emit('back');
  } catch (e: unknown) {
    sendError.value =
      e instanceof Error && e.message ? e.message : t('email.compose.sendError');
  }
}
</script>

<template>
  <div class="compose">
    <div class="compose-header">
      <BaseButton size="sm" variant="ghost" icon="ph:arrow-left" @click="emit('back')" />
      <h3>{{ t('email.compose.title') }}</h3>
    </div>

    <div class="compose-form">
      <div class="form-field">
        <label>{{ t('email.compose.to') }}</label>
        <input v-model="to" type="text" :placeholder="t('email.compose.toPlaceholder')" />
      </div>

      <div class="form-field">
        <label>{{ t('email.compose.cc') }}</label>
        <input v-model="cc" type="text" :placeholder="t('email.compose.ccPlaceholder')" />
      </div>

      <div class="form-field">
        <label>{{ t('email.compose.subject') }}</label>
        <input v-model="subject" type="text" :placeholder="t('email.compose.subjectPlaceholder')" />
      </div>

      <div class="form-field body-field">
        <label>{{ t('email.compose.body') }}</label>
        <textarea
          v-model="body"
          :placeholder="t('email.compose.bodyPlaceholder')"
          rows="8"
        ></textarea>
      </div>

      <div v-if="sendError" class="send-error">
        <iconify-icon icon="ph:warning-circle-fill"></iconify-icon>
        {{ sendError }}
      </div>

      <BaseButton
        variant="primary"
        block
        icon="ph:paper-plane-tilt-duotone"
        :loading="emailStore.isSending"
        @click="send"
      >
        {{ t('email.compose.send') }}
      </BaseButton>
    </div>
  </div>
</template>

<style scoped>
.compose {
  display: flex;
  flex-direction: column;
  grid-column: 1 / -1;
}

.compose-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--glass-border);
}

.compose-header h3 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.compose-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 20px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-field label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-muted);
}

.form-field input,
.form-field textarea {
  padding: 10px 14px;
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  transition: border-color var(--duration-fast) ease;
  outline: none;
}

.form-field input:focus,
.form-field textarea:focus {
  border-color: var(--accent-primary);
  background: var(--surface-2);
}

.form-field input::placeholder,
.form-field textarea::placeholder {
  color: var(--text-muted);
}

.form-field textarea {
  resize: vertical;
  min-height: 120px;
}

.body-field {
  flex: 1;
}

.send-error {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  background: var(--error-glow, rgba(248, 113, 113, 0.1));
  border: 1px solid rgba(248, 113, 113, 0.2);
  border-radius: var(--radius-md);
  font-size: 12px;
  color: var(--error);
}
</style>
