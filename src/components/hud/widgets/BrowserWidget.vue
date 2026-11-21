<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import HudWindow from '../HudWindow.vue';
import { useHudStore, type HudWidget } from '@/stores/hud';
import { useNavigationStore } from '@/stores/navigation';
import { hostOf } from '@/lib/hud/media';
import { sendToAgent } from '@/lib/hud/agentLink';

/**
 * Jarvis's own browser, live: what it opens, reads and clicks, mirrored as it works.
 *
 * The agent sends a frame of the page whenever it changes (its Chrome on the user's
 * PC, or the built-in one). From here the user can take the page into a web window
 * of their own, close Jarvis's browser, or sign in: a site that refuses the window
 * Jarvis drives ("this browser may not be secure") opens in a clean Chrome where they
 * sign in themselves, and the session stays for Jarvis.
 */
const props = defineProps<{ widget: HudWidget; index: number }>();
const { t } = useI18n();
const hud = useHudStore();
const nav = useNavigationStore();
const { isActive, currentUrl, currentTitle, frameUrl } = storeToRefs(nav);

const code = computed(() => `NAV-${String(props.index + 1).padStart(2, '0')}`);
const signIn = computed(() => hud.browserSignIn);
const url = computed(() => currentUrl.value || signIn.value.url);

const status = computed(() => {
  if (signIn.value.state === 'open') return 'running' as const;
  return isActive.value ? ('live' as const) : ('idle' as const);
});
const statusLabel = computed(() => {
  if (signIn.value.state === 'open') return t('hud.browser.signingIn');
  return isActive.value ? t('hud.browser.live') : t('hud.browser.closed');
});

function cleanSignIn() {
  if (!url.value) return;
  sendToAgent({ type: 'browser_sign_in_request', url: url.value });
  hud.setBrowserSignIn('open', url.value);
}

function openHere() {
  if (url.value)
    hud.open({ kind: 'web', url: url.value, title: hostOf(url.value), source: 'user' });
}

function closeBrowser() {
  sendToAgent({ type: 'browser_close_request' });
  nav.end();
}
</script>

<template>
  <HudWindow
    :widget="widget"
    :code="code"
    icon="ph:browser-duotone"
    :status="status"
    :status-label="statusLabel"
  >
    <div class="browser">
      <div class="nav-bar">
        <iconify-icon icon="ph:globe-duotone"></iconify-icon>
        <span class="nav-url" :title="url">{{ url || '—' }}</span>
      </div>
      <div class="screen">
        <img v-if="frameUrl" :src="frameUrl" :alt="currentTitle || url" />
        <div v-else class="hud-empty">
          <iconify-icon icon="ph:monitor-duotone" class="empty-icon"></iconify-icon>
          <p>{{ isActive ? t('hud.browser.waiting') : t('hud.browser.closed') }}</p>
          <p v-if="isActive" class="faint">{{ t('hud.browser.desktop') }}</p>
        </div>
        <div v-if="frameUrl && isActive" class="rec" aria-hidden="true">
          <span></span>{{ t('hud.browser.live') }}
        </div>
      </div>

      <div v-if="signIn.state !== 'idle'" class="sign-in" :class="signIn.state">
        <iconify-icon
          :icon="signIn.state === 'open' ? 'ph:key-duotone' : 'ph:check-circle-duotone'"
        ></iconify-icon>
        <span>{{
          signIn.state === 'open' ? t('hud.browser.signInOpen') : t('hud.browser.signInDone')
        }}</span>
      </div>
    </div>

    <template #footer>
      <button
        type="button"
        class="hud-action-btn"
        :disabled="!url || signIn.state === 'open'"
        :title="t('hud.browser.signInHint')"
        @click="cleanSignIn"
      >
        <iconify-icon icon="ph:key-duotone"></iconify-icon>{{ t('hud.browser.signIn') }}
      </button>
      <span class="spacer"></span>
      <button
        type="button"
        class="hud-icon-btn"
        :disabled="!url"
        :title="t('hud.browser.openHere')"
        @click="openHere"
      >
        <iconify-icon icon="ph:app-window-duotone"></iconify-icon>
      </button>
      <button
        type="button"
        class="hud-icon-btn danger"
        :disabled="!isActive"
        :title="t('hud.browser.close')"
        @click="closeBrowser"
      >
        <iconify-icon icon="ph:power"></iconify-icon>
      </button>
    </template>
  </HudWindow>
</template>

<style scoped>
.browser {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.nav-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--hud-line-faint);
  color: var(--hud-accent);
}
.nav-url {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--hud-mono);
  font-size: 11.5px;
  color: var(--hud-text);
}
.screen {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #04080c;
}
.screen img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.empty-icon {
  font-size: 40px;
  color: rgba(var(--hud-rgb), 0.45);
}
.faint {
  color: var(--hud-faint);
  font-size: 12px;
}
.rec {
  position: absolute;
  top: 8px;
  left: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  font-family: var(--hud-font);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  background: rgba(0, 0, 0, 0.6);
  color: var(--hud-red);
}
.rec span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--hud-red);
  animation: hud-pulse 1.2s ease-in-out infinite;
}
.sign-in {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  font-size: 13px;
  border-top: 1px solid rgba(var(--hud-amber-rgb), 0.35);
  background: rgba(var(--hud-amber-rgb), 0.08);
  color: var(--hud-amber);
}
.sign-in.done {
  border-top-color: rgba(var(--hud-green-rgb), 0.35);
  background: rgba(var(--hud-green-rgb), 0.07);
  color: var(--hud-green);
}
.sign-in iconify-icon {
  font-size: 20px;
  flex-shrink: 0;
}
.spacer {
  flex: 1;
}
</style>
