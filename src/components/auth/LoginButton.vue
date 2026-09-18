<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import GoogleButton from './GoogleButton.vue';
import ProviderButton from './ProviderButton.vue';
import EmailAuthForm from './EmailAuthForm.vue';
import PhoneAuthForm from './PhoneAuthForm.vue';
import Web3AuthForm from './Web3AuthForm.vue';
import { enabledWeb2Providers, hasWeb3Providers } from './providers';

type LoginTab = 'web2' | 'web3' | 'mobile';

const props = withDefaults(defineProps<{ open?: boolean }>(), {
  open: false,
});
const emit = defineEmits<{ (e: 'update:open', value: boolean): void }>();
const isOpen = computed(() => props.open);
const panelRef = ref<HTMLElement | null>(null);
const activeTab = ref<LoginTab>('web2');
const { t } = useI18n();

const tabs = computed(() => {
  const items: { id: LoginTab; label: string }[] = [
    { id: 'web2', label: t('auth.tabWeb2') },
  ];
  if (hasWeb3Providers) items.push({ id: 'web3', label: t('auth.tabWeb3') });
  items.push({ id: 'mobile', label: t('auth.tabMobile') });
  return items;
});
const tabIndex = computed(() =>
  Math.max(0, tabs.value.findIndex((tab) => tab.id === activeTab.value)),
);

// Google keeps its own component: it carries an inline multi-colour SVG that
// Iconify cannot reproduce faithfully.
const web2Others = computed(() => enabledWeb2Providers.filter((p) => p.id !== 'google'));
const showGoogle = computed(() => enabledWeb2Providers.some((p) => p.id === 'google'));
// The divider reads "or continue with email"; with no OAuth button above it,
// there is no "or".
const hasOAuthProviders = computed(() => enabledWeb2Providers.length > 0);

function openPanel() {
  activeTab.value = 'web2';
  emit('update:open', true);
}

function closePanel() {
  emit('update:open', false);
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!isOpen.value) return;
  const target = event.target as Node | null;
  if (!target) return;
  if (panelRef.value?.contains(target)) return;
  closePanel();
}

onMounted(() => {
  window.addEventListener('pointerdown', onDocumentPointerDown);
});

onUnmounted(() => {
  window.removeEventListener('pointerdown', onDocumentPointerDown);
});
</script>

<template>
  <div
    ref="panelRef"
    class="login-entry"
    :class="{ 'login-entry--open': isOpen }"
    role="dialog"
    :aria-label="t('auth.loginOptions')"
  >
    <button
      class="login-cta"
      :class="{ 'login-cta--morphed': isOpen }"
      type="button"
      @click="!isOpen && openPanel()"
    >
      {{ t('auth.loginCta') }}
    </button>

    <div class="login-panel" :class="{ 'login-panel--open': isOpen }">
      <h1 v-if="isOpen" class="panel-brand" aria-label="kwami">
        <span class="title-main">KWAMI</span>
      </h1>
      <div
        class="tab-shell"
        role="tablist"
        :aria-label="t('auth.loginTypeTabs')"
        :style="{ '--tab-count': tabs.length, '--tab-index': tabIndex }"
      >
        <div class="tab-indicator" />
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="tab-btn"
          :class="{ 'tab-btn--active': activeTab === tab.id }"
          type="button"
          role="tab"
          :aria-selected="activeTab === tab.id"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>

      <Transition name="tab-swap" mode="out-in">
        <div v-if="isOpen && activeTab === 'web2'" key="web2" class="provider-group">
          <GoogleButton v-if="showGoogle" />
          <ProviderButton
            v-for="provider in web2Others"
            :key="provider.id"
            :provider="provider"
          />

          <div v-if="hasOAuthProviders" class="divider">
            <span>{{ t('auth.orContinueWithEmail') }}</span>
          </div>

          <EmailAuthForm />
        </div>
        <div v-else-if="isOpen && activeTab === 'web3'" key="web3" class="provider-group">
          <Web3AuthForm />
        </div>
        <div v-else-if="isOpen" key="mobile" class="provider-group">
          <PhoneAuthForm />
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.login-entry {
  position: fixed;
  left: 50%;
  top: 68%;
  transform: translateX(-50%);
  z-index: 45;
  width: min(220px, 58vw);
  border-radius: 999px;
  border: 1px solid var(--auth-glass-border);
  background: var(--auth-glass-bg);
  backdrop-filter: blur(18px) saturate(170%);
  -webkit-backdrop-filter: blur(18px) saturate(170%);
  box-shadow: var(--auth-glass-shadow);
  transition:
    width 260ms ease,
    top 300ms ease 60ms,
    transform 300ms ease 60ms,
    border-radius 300ms ease 60ms,
    background 300ms ease 60ms,
    box-shadow 300ms ease 60ms;
}

.login-entry--open {
  top: 50%;
  transform: translate(-50%, -50%);
  width: min(420px, 90vw);
  border-radius: 24px;
  border-color: var(--auth-glass-border-open);
  background: var(--auth-glass-bg-open);
  backdrop-filter: blur(28px) saturate(185%);
  -webkit-backdrop-filter: blur(28px) saturate(185%);
  box-shadow: var(--auth-glass-shadow-open);
}

.login-cta {
  width: 100%;
  border: 0;
  border-radius: 999px;
  padding: 0.9rem 2.25rem;
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--auth-text);
  cursor: pointer;
  background: transparent;
  transition:
    transform 220ms ease,
    font-size 260ms ease 440ms,
    letter-spacing 260ms ease 440ms,
    padding 260ms ease 440ms,
    opacity 220ms ease 440ms;
}

.login-cta:hover {
  transform: translateY(-2px) scale(1.02);
  filter: saturate(1.12);
}

.login-panel {
  width: 100%;
  max-height: 0;
  opacity: 0;
  overflow: hidden;
  padding: 0 1.1rem;
  transition:
    max-height 320ms ease 230ms,
    opacity 220ms ease 230ms,
    padding 260ms ease 230ms;
}

.login-panel--open {
  /* Tall enough for the sign-up form (three fields) without clipping, capped
     so the panel never outgrows a short viewport. */
  max-height: min(78vh, 620px);
  overflow-y: auto;
  opacity: 1;
  padding: 1.25rem 1.1rem 1.1rem;
}

.login-cta--morphed {
  font-size: 0;
  line-height: 0;
  letter-spacing: 0;
  padding: 0.35rem 0 0.15rem;
  cursor: default;
  opacity: 0;
  filter: none;
}

.login-cta--morphed:hover {
  transform: none;
}

.panel-brand {
  margin: 0 0 1.1rem;
  text-align: center;
  pointer-events: none;
}

.panel-brand .title-main {
  display: block;
  font-size: clamp(1.85rem, 5.4vw, 2.4rem);
  font-weight: 900;
  line-height: 1;
  letter-spacing: 0.03em;
  color: var(--auth-text);
}

.tab-shell {
  --tab-count: 2;
  --tab-index: 0;
  position: relative;
  display: grid;
  grid-template-columns: repeat(var(--tab-count), 1fr);
  border-radius: 999px;
  padding: 4px;
  margin-bottom: 0.85rem;
  background: var(--auth-tab-bg);
  border: 1px solid var(--auth-tab-border);
  overflow: hidden;
}

.tab-indicator {
  position: absolute;
  top: 4px;
  left: 4px;
  width: calc((100% - 8px) / var(--tab-count));
  height: calc(100% - 8px);
  border-radius: 999px;
  background: var(--auth-tab-indicator);
  box-shadow: var(--auth-tab-indicator-shadow);
  transform: translateX(calc(var(--tab-index) * 100%));
  transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

.tab-btn {
  position: relative;
  z-index: 1;
  border: 0;
  background: transparent;
  color: var(--auth-text-dim);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 0.6rem 0.2rem;
  cursor: pointer;
  transition: color 220ms ease;
}

.tab-btn--active {
  color: var(--auth-text);
}

.provider-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.divider {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin: 0.35rem 0 0.1rem;
  color: var(--auth-text-dim);
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--auth-rule);
}

.provider-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  border-radius: 999px;
  border: 1px solid var(--auth-field-border);
  background: var(--auth-field-bg);
  color: var(--auth-field-text);
  font-weight: 600;
  font-size: 0.9rem;
  padding: 0.72rem 0.95rem;
  cursor: pointer;
  transition: background 180ms ease, border-color 180ms ease, transform 180ms ease;
}

.provider-btn:hover {
  background: var(--auth-field-bg-hover);
  border-color: var(--auth-field-border-hover);
  transform: translateY(-1px);
}

.provider-btn iconify-icon {
  font-size: 1rem;
}

.tab-swap-enter-active,
.tab-swap-leave-active {
  transition: opacity 220ms ease, transform 220ms ease;
}

.tab-swap-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.tab-swap-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@media (max-width: 900px) {
  .login-entry {
    top: 70%;
  }

  .login-entry--open {
    top: 50%;
  }
}
</style>
