<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from 'vue-toastification';
import { useKwami } from '@/composables/useKwami';
import { useSceneBackground } from '@/composables/useSceneBackground';
import { useUIStore } from '@/stores/ui';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';
import AuthGuard from '@/components/auth/AuthGuard.vue';
import TheSidebar from '@/components/sidebar/TheSidebar.vue';
import ControlBar from '@/components/controls/ControlBar.vue';
import EnergyBadge from '@/components/energy/EnergyBadge.vue';
import SearchOrbitCards from '@/components/search/SearchOrbitCards.vue';
import SearchPanel from '@/components/search/SearchPanel.vue';
import SidebarModeSwitch from '@/components/sidebar/SidebarModeSwitch.vue';
import BrowserPanel from '@/components/panels/BrowserPanel.vue';
import AvatarUnavailable from '@/components/AvatarUnavailable.vue';
import { isWebGLAvailable, type AvatarUnavailableReason } from '@/lib/webgl';

import { useWorkspaceStore } from '@/stores/workspace';
import { useKwamiConfigWatchers } from '@/composables/useKwamiConfigSync';
import { useSearchResults } from '@/composables/useSearchResults';
import { useNavigation } from '@/composables/useNavigation';
import { isBareShortcut, isEditableTarget } from '@/utils/keyboard';
import { useWorkspaceAgentTools } from '@/composables/useWorkspaceAgentTools';
import { useUserToolRegistration } from '@/composables/useUserToolRegistration';
import { useMcpServers } from '@/composables/useMcpServers';
import { useAvatarStore } from '@/stores/avatar';
import { useBlobXyzSync } from '@/composables/avatar/sync/useBlobXyzSync';
import { useBlackHoleSync } from '@/composables/avatar/sync/useBlackHoleSync';
import { useParticlesFaceSync } from '@/composables/avatar/sync/useParticlesFaceSync';
import { useEyeIrisSync } from '@/composables/avatar/sync/useEyeIrisSync';
import { useJarvisSync } from '@/composables/avatar/sync/useJarvisSync';
import { useJarvisSignals } from '@/composables/avatar/useJarvisSignals';
import { useBrainSync } from '@/composables/useBrainSync';
import { randomizeAvatarPanel } from '@/composables/avatar/randomizeAvatarPanel';
import { useBlobXyzStore } from '@/stores/avatar.blob-xyz';
import { useEyeIrisStore } from '@/stores/avatar.eye-iris';
import { fitKwamiInView, measureKwamiCanvas } from '@/utils/kwamiViewportFit';
import { bridgeCanvasTouch } from '@/utils/canvasTouchBridge';

const {
  kwami,
  init,
  switchRenderer,
  rendererType: kwamiRendererType,
  isConnected,
  dispose: disposeKwami,
} = useKwami();
useBrainSync(kwami, isConnected);
const { initialize: initSceneBackground } = useSceneBackground();
import { useVoiceStore } from '@/stores/voice';
import { useCreditsStore } from '@/stores/credits';
import { useUiLayoutSync } from '@/composables/useUiLayoutSync';
import { useBrowserFrames } from '@/composables/useBrowserFrames';

// Panels are lazy: none of them is needed at first paint, and eagerly
// importing all 23 put MemoryPanel (2.2k lines), SceneBackground (1.8k) and
// ThemePanel (1.3k) into the entry chunk. defineAsyncComponent splits each
// into its own chunk, fetched the first time the panel is opened.
const AvatarPanel = defineAsyncComponent(
  () => import('@/components/panels/settings/avatar/AvatarPanel.vue'),
);
const AudioPanel = defineAsyncComponent(
  () => import('@/components/panels/settings/audio/AudioPanel.vue'),
);
const ScenePanel = defineAsyncComponent(
  () => import('@/components/panels/settings/scene/ScenePanel.vue'),
);
const VoicePanel = defineAsyncComponent(
  () => import('@/components/panels/settings/voice/VoicePanel.vue'),
);
const EnhancementsPanel = defineAsyncComponent(
  () => import('@/components/panels/settings/enhancements/EnhancementsPanel.vue'),
);
const HistoryPanel = defineAsyncComponent(
  () => import('@/components/panels/settings/transcription/TranscriptionPanel.vue'),
);
const PhonePanelSettings = defineAsyncComponent(
  () => import('@/components/panels/settings/communications/PhonePanel.vue'),
);
const SoulPanel = defineAsyncComponent(
  () => import('@/components/panels/settings/soul/SoulPanel.vue'),
);
const MemoryPanel = defineAsyncComponent(
  () => import('@/components/panels/settings/memory/MemoryPanel.vue'),
);
const ToolsPanel = defineAsyncComponent(
  () => import('@/components/panels/settings/tools/ToolsPanel.vue'),
);
const InfoPanel = defineAsyncComponent(
  () => import('@/components/panels/settings/info/InfoPanel.vue'),
);
const MetricsPanel = defineAsyncComponent(
  () => import('@/components/panels/settings/metrics/MetricsPanel.vue'),
);
const AccountPanel = defineAsyncComponent(
  () => import('@/components/panels/settings/account/AccountPanel.vue'),
);
const ThemePanel = defineAsyncComponent(
  () => import('@/components/panels/settings/theme/ThemePanel.vue'),
);
const ModelsPanel = defineAsyncComponent(
  () => import('@/components/panels/settings/models/ModelsPanel.vue'),
);
const EnergyPanel = defineAsyncComponent(
  () => import('@/components/panels/settings/energy/EnergyPanel.vue'),
);
const ContactsPanel = defineAsyncComponent(
  () => import('@/components/panels/apps/contacts/ContactsPanel.vue'),
);
const EmailPanel = defineAsyncComponent(
  () => import('@/components/panels/apps/email/EmailPanel.vue'),
);
const WalletPanel = defineAsyncComponent(
  () => import('@/components/panels/apps/wallet/WalletPanel.vue'),
);
const CalendarPanel = defineAsyncComponent(
  () => import('@/components/panels/apps/calendar/CalendarPanel.vue'),
);
const PhonePanel = defineAsyncComponent(
  () => import('@/components/panels/apps/phone/PhonePanel.vue'),
);
const WhatsappPanel = defineAsyncComponent(
  () => import('@/components/panels/apps/whatsapp/WhatsappPanel.vue'),
);
const SmsPanel = defineAsyncComponent(() => import('@/components/panels/apps/sms/SmsPanel.vue'));

const uiStore = useUIStore();
const authStore = useAuthStore();
const workspaceStore = useWorkspaceStore();

const searchResults = useSearchResults();
const avatarStore = useAvatarStore();
const blobXyzStore = useBlobXyzStore();
const eyeIrisStore = useEyeIrisStore();

const splitRatio = ref(50);
const isDraggingSplitter = ref(false);

// Pointer events, not mouse events, so a finger can drag the split on a tablet.
function startDrag(e: PointerEvent) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  e.preventDefault();
  isDraggingSplitter.value = true;
  document.addEventListener('pointermove', onDrag);
  document.addEventListener('pointerup', stopDrag);
  document.addEventListener('pointercancel', stopDrag);
}

function onDrag(e: PointerEvent) {
  if (!isDraggingSplitter.value) return;
  const isRight = themeStore.sidebarPosition === 'right';
  let newRatio = (e.clientX / window.innerWidth) * 100;
  if (isRight) {
    newRatio = 100 - newRatio;
  }
  if (newRatio < 20) newRatio = 20;
  if (newRatio > 80) newRatio = 80;
  splitRatio.value = newRatio;
}

function stopDrag() {
  isDraggingSplitter.value = false;
  document.removeEventListener('pointermove', onDrag);
  document.removeEventListener('pointerup', stopDrag);
  document.removeEventListener('pointercancel', stopDrag);
}

// Navigation: extension opens tab/split; no sidebar
const navState = useNavigation();

/**
 * Whether the browser panel is taking part in the split.
 *
 * Only the docked layout does. Floating and fullscreen panels are fixed
 * overlays, so reserving half the row for them squeezed the avatar into a
 * sliver of the screen with nothing rendered beside it.
 */
const isSplitWithBrowser = computed(() => navState.hasView.value && navState.isDocked.value);
useWorkspaceAgentTools();
// The webhooks the user added to this kwami, ahead of the app's own in the list.
useUserToolRegistration();
// And the MCP servers saved on it, connected again on every load.
useMcpServers().startSync();
useUiLayoutSync();
useBrowserFrames();

// Sync per-kwami config: apply config when switching kwami, debounced save to DB
useKwamiConfigWatchers();
const voiceStore = useVoiceStore();
const creditsStore = useCreditsStore();
const themeStore = useThemeStore();
const toast = useToast();
const { t } = useI18n();

function onInsufficientCredits() {
  toast.error(t('apiErrors.insufficientCredits'));
}

// Avatar sync composables (used to apply saved state on init)
const { applyToKwami: applyBlobToKwami } = useBlobXyzSync({
  kwami,
  getBlob: () => kwami.value?.avatar.getBlob(),
});
const { applyToKwami: applyBlackHoleToKwami } = useBlackHoleSync({
  kwami,
  getBlackHole: () => kwami.value?.avatar.getBlackHole() ?? undefined,
});
const { applyToKwami: applyParticlesFaceToKwami } = useParticlesFaceSync({
  kwami,
  getParticlesFace: () => kwami.value?.avatar.getParticlesFace() ?? undefined,
});
const { applyToKwami: applyEyeIrisToKwami } = useEyeIrisSync({
  kwami,
  getEyeIris: () => kwami.value?.avatar.getEyeIris() ?? undefined,
});
const { applyToKwami: applyJarvisToKwami } = useJarvisSync({
  kwami,
  getJarvis: () => kwami.value?.avatar.getJarvis() ?? undefined,
});
// The HUD acknowledges what the session does: link, messages, tool calls, failures, balance.
const { syncStatus: syncJarvisStatus } = useJarvisSignals(
  () => kwami.value?.avatar.getJarvis() ?? undefined,
);

const canvasRef = ref<HTMLCanvasElement | null>(null);

// A slider write sets the stored scale on the live mesh. Re-frame so a phone
// still caps it instead of waiting for the next window resize.
watch(
  () => [blobXyzStore.shape.scale, eyeIrisStore.state.scale, kwamiRendererType.value] as const,
  () => handleResize(),
);

// Watch for authentication: credits, load kwamis from DB (welcome rings shown only during AuthGuard loading)
watch(
  () => authStore.isAuthenticated,
  (isAuth) => {
    if (isAuth) {
      creditsStore.init();
      const uid = authStore.userId;
      if (uid) {
        void workspaceStore.loadFromDb(uid);
      }
    }
  },
  { immediate: true },
);

// Refresh energy/credits when user disconnects from voice (usage is reported on session end)
function onKwamiDisconnected() {
  creditsStore.loadBalance();
  creditsStore.loadUsageLogs();
}
function onKwamiConfigApplied() {
  applySavedAvatarState();
  applySavedSoulState();
  initSceneBackground();
}

function onRandomizeAvatarPanel() {
  randomizeAvatarPanel({
    applyBlob: applyBlobToKwami,
    applyBlackHole: applyBlackHoleToKwami,
    applyParticles: applyParticlesFaceToKwami,
    applyEyeIris: applyEyeIrisToKwami,
    applyJarvis: applyJarvisToKwami,
  });
  window.dispatchEvent(new CustomEvent('kwami:randomized'));
}

onMounted(() => {
  window.addEventListener('kwami:disconnected', onKwamiDisconnected);
  window.addEventListener('kwami:configApplied', onKwamiConfigApplied);
  window.addEventListener('kwami:randomize-avatar-panel', onRandomizeAvatarPanel);
  window.addEventListener('kwami:insufficient-credits', onInsufficientCredits);
});
onUnmounted(() => {
  window.removeEventListener('kwami:disconnected', onKwamiDisconnected);
  window.removeEventListener('kwami:configApplied', onKwamiConfigApplied);
  window.removeEventListener('kwami:randomize-avatar-panel', onRandomizeAvatarPanel);
  window.removeEventListener('kwami:insufficient-credits', onInsufficientCredits);
});

// Track if Kwami has been initialized
const isInitialized = ref(false);
// Set when the avatar could not start; a notice replaces the black canvas.
const avatarUnavailable = ref<AvatarUnavailableReason | null>(null);

// Apply saved avatar state to kwami instance
function applySavedAvatarState() {
  const savedRenderer = avatarStore.rendererType;

  // Switch to saved renderer if different from default
  if (kwamiRendererType.value !== savedRenderer) {
    switchRenderer(savedRenderer);
  }

  // Apply the saved state for the active renderer
  switch (savedRenderer) {
    case 'blob-xyz':
      applyBlobToKwami();
      break;
    case 'black-hole':
      applyBlackHoleToKwami();
      break;
    case 'particles-face':
      applyParticlesFaceToKwami();
      break;
    case 'eye-iris':
      applyEyeIrisToKwami();
      break;
    case 'jarvis':
      applyJarvisToKwami();
      syncJarvisStatus();
      break;
  }

  // Saved scale can overflow a phone; re-frame after the store values land.
  handleResize();
}

// Apply current store soul to the Kwami instance so the live agent matches the active kwami config
function applySavedSoulState() {
  if (!kwami.value) return;
  const saved = voiceStore.soulConfig;
  const soulConfig = {
    name: saved.name,
    language: saved.language,
    personality: saved.personality,
    systemPrompt: saved.systemPrompt,
    traits: [...saved.traits],
    conversationStyle: saved.conversationStyle,
    responseLength: saved.responseLength,
    emotionalTone: saved.emotionalTone,
    emotionalTraits: { ...saved.emotionalTraits },
    // Behaviour rules and the user profile; see src/lib/charter.ts.
    charter: { ...saved.charter, watch: [...saved.charter.watch] },
  };
  kwami.value.soul.updateConfig(soulConfig);

  // Keep active backend agent in sync when switching/applying workspace config.
  if (isConnected.value) {
    kwami.value.agent.syncConfigToBackend('soul', soulConfig);
  }
}

// Initialize Kwami when canvas becomes available (after auth)
function initializeKwami() {
  if (isInitialized.value || avatarUnavailable.value || !canvasRef.value) return;

  // Default to blob renderer (will be overridden by saved state if available)
  const rendererType = 'blob-xyz';

  // Without WebGL, `new Kwami()` throws from inside Three.js. Uncaught, that
  // left a black canvas and skipped the rest of this setup, and production
  // strips console output, so nothing said why. Fail visibly instead; the
  // panels, auth and everything that does not draw keep working.
  if (!isWebGLAvailable()) {
    avatarUnavailable.value = 'webgl';
    return;
  }
  try {
    init(canvasRef.value, rendererType, {
      onSearchResults: (data) => searchResults.setResults(data),
    });
  } catch (error) {
    console.error('Kwami avatar failed to start:', error);
    avatarUnavailable.value = isWebGLAvailable() ? 'error' : 'webgl';
    return;
  }
  isInitialized.value = true;

  // Initialize scene background from saved settings
  initSceneBackground();

  // Apply saved avatar state (renderer type + settings) from localStorage
  if (avatarStore.isInitialized) {
    applySavedAvatarState();
  }

  // Apply saved soul config to kwami
  applySavedSoulState();

  // Trigger initial resize to ensure proper sizing
  requestAnimationFrame(() => {
    handleResize();
  });

  // Console info
  console.log('🎮 Kwami App (🫧 blob renderer)');
  console.log('Shortcuts: R=randomize, L=listening, T=thinking, I=idle, P=toggle panel');
  console.log('Renderer: B=blob, H=black-hole, J=jarvis');
  console.log('Access kwami via window.kwami in console');
}

// Handle window resize - trigger scene resize and recenter avatar
function handleResize() {
  if (!kwami.value || !canvasRef.value) return;

  const renderer = kwamiRendererType.value;
  if (renderer === 'blob-xyz' || renderer === 'eye-iris') {
    fitKwamiInView(kwami.value, canvasRef.value, {
      renderer,
      desiredScale: renderer === 'eye-iris' ? eyeIrisStore.state.scale : blobXyzStore.shape.scale,
    });
    return;
  }

  const { width, height } = measureKwamiCanvas(canvasRef.value);
  kwami.value.avatar.getScene()?.resize(width, height);
}

// Watch for canvas to become available (happens after auth guard shows slot)
let resizeObserver: ResizeObserver | null = null;
// Finger drags spin the avatar and a double-tap toggles the conversation, as the
// mouse does (utils/canvasTouchBridge.ts).
let releaseTouchBridge: (() => void) | null = null;
watch(canvasRef, (canvas) => {
  releaseTouchBridge?.();
  releaseTouchBridge = canvas ? bridgeCanvasTouch(canvas) : null;
  if (canvas) {
    initializeKwami();
    if (canvas.parentElement) {
      if (resizeObserver) resizeObserver.disconnect();
      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.observe(canvas.parentElement);
    }
  }
});

/**
 * Global avatar/panel shortcuts.
 *
 * Alt+1/2/3 size the panel; the rest are bare keys, so they must not fire
 * while the user is typing or when a browser/OS chord is held.
 */
function onGlobalKeydown(e: KeyboardEvent) {
  if (isEditableTarget(e.target)) return;

  // Panel size shortcuts (Alt+1/2/3)
  if (e.altKey && e.key === '1') {
    e.preventDefault();
    uiStore.setSizePreset('small');
    return;
  }
  if (e.altKey && e.key === '2') {
    e.preventDefault();
    uiStore.setSizePreset('medium');
    return;
  }
  if (e.altKey && e.key === '3') {
    e.preventDefault();
    uiStore.setSizePreset('large');
    return;
  }

  if (!isBareShortcut(e)) return;

  // NOTE: panel keys (digits, 0, -, =, and `p`) belong to usePanelShortcuts,
  // which SidebarNavigation mounts. Handling `p` here too toggled the panel
  // twice per press and cancelled itself out. Keep this switch to
  // renderer/avatar keys only.
  switch (e.key.toLowerCase()) {
    case 'b':
      switchRenderer('blob-xyz');
      break;
    case 'h':
      switchRenderer('black-hole');
      break;
    case 'j':
      avatarStore.setRendererType('jarvis');
      switchRenderer('jarvis');
      applyJarvisToKwami();
      syncJarvisStatus();
      avatarStore.saveSettings();
      break;
    case 'r':
      onRandomizeAvatarPanel();
      break;
    case 'l':
      kwami.value?.setState('listening');
      window.dispatchEvent(new CustomEvent('kwami:stateChanged', { detail: 'listening' }));
      break;
    case 't':
      kwami.value?.setState('thinking');
      window.dispatchEvent(new CustomEvent('kwami:stateChanged', { detail: 'thinking' }));
      break;
    case 'i':
      kwami.value?.setState('idle');
      window.dispatchEvent(new CustomEvent('kwami:stateChanged', { detail: 'idle' }));
      break;
  }
}

onMounted(() => {
  // Try to initialize if canvas is already available
  initializeKwami();

  // Add resize listener
  window.addEventListener('resize', handleResize);
  window.visualViewport?.addEventListener('resize', handleResize);
  window.visualViewport?.addEventListener('scroll', handleResize);

  // Shortcuts
  document.addEventListener('keydown', onGlobalKeydown);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  window.visualViewport?.removeEventListener('resize', handleResize);
  window.visualViewport?.removeEventListener('scroll', handleResize);
  document.removeEventListener('keydown', onGlobalKeydown);
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  releaseTouchBridge?.();
  releaseTouchBridge = null;
  // Releases the WebGL context, the LiveKit room and the audio graph.
  void disposeKwami();
  isInitialized.value = false;
});
</script>

<template>
  <AuthGuard>
    <div
      id="kwami-root"
      class="root-layout"
      :class="{
        'split-layout': isSplitWithBrowser,
        'sidebar-right': themeStore.sidebarPosition === 'right',
        'is-dragging': isDraggingSplitter,
      }"
    >
      <!-- Main area: canvas + overlays (no nav sidebar) -->
      <div class="main-area" :style="isSplitWithBrowser ? { flex: `0 0 ${splitRatio}%` } : {}">
        <canvas id="kwami-canvas" ref="canvasRef"></canvas>
        <AvatarUnavailable
          v-if="avatarUnavailable && authStore.isAuthenticated"
          :reason="avatarUnavailable"
        />

        <!-- UI controls only shown when authenticated and welcome complete -->
        <template v-if="authStore.isAuthenticated">
          <!-- Search results. Two presentations of the same store: the orbit
               cards around the Kwami, or a draggable window. Each hides
               itself when the other is the current layout. -->
          <SearchOrbitCards />
          <SearchPanel />
          <!-- Control Bar (top-right of main area; moves with canvas when nav opens) -->
          <div class="control-bar-container">
            <EnergyBadge />
            <ControlBar />
          </div>
          <SidebarModeSwitch />
        </template>
      </div>

      <div v-if="isSplitWithBrowser" class="layout-splitter" @pointerdown="startDrag">
        <div class="splitter-handle"></div>
      </div>

      <BrowserPanel />

      <template v-if="authStore.isAuthenticated">
        <TheSidebar>
          <AvatarPanel v-if="uiStore.activePanel === 'avatar'" />
          <AudioPanel v-if="uiStore.activePanel === 'audio'" />
          <ScenePanel v-if="uiStore.activePanel === 'scene'" />
          <VoicePanel v-if="uiStore.activePanel === 'voice'" />
          <EnhancementsPanel v-if="uiStore.activePanel === 'enhancements'" />
          <HistoryPanel v-if="uiStore.activePanel === 'history'" />
          <PhonePanelSettings v-if="uiStore.activePanel === 'communications'" />
          <SoulPanel v-if="uiStore.activePanel === 'soul'" />
          <MemoryPanel v-if="uiStore.activePanel === 'memory'" />
          <ToolsPanel v-if="uiStore.activePanel === 'tools'" />
          <InfoPanel v-if="uiStore.activePanel === 'info'" />
          <MetricsPanel v-if="uiStore.activePanel === 'metrics'" />
          <AccountPanel v-if="uiStore.activePanel === 'account'" />
          <ThemePanel v-if="uiStore.activePanel === 'theme'" />
          <ModelsPanel v-if="uiStore.activePanel === 'models'" />
          <EnergyPanel v-if="uiStore.activePanel === 'credits'" />
          <ContactsPanel v-if="uiStore.activePanel === 'contacts'" />
          <EmailPanel v-if="uiStore.activePanel === 'email'" />
          <WalletPanel v-if="uiStore.activePanel === 'wallet'" />
          <CalendarPanel v-if="uiStore.activePanel === 'calendar'" />
          <PhonePanel v-if="uiStore.activePanel === 'phone'" />
          <WhatsappPanel v-if="uiStore.activePanel === 'whatsapp'" />
          <SmsPanel v-if="uiStore.activePanel === 'sms'" />
        </TheSidebar>
      </template>
    </div>
  </AuthGuard>
</template>

<style scoped>
/* Panel inner styling */
:deep(.panel-inner) {
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Root layout: flex row for main area + nav sidebar */
.root-layout {
  display: flex;
  flex-direction: row;
  height: 100vh;
  /* Mobile browsers' 100vh is the height with their toolbars hidden, which puts
     the bottom of the layout under the toolbar while it is showing. */
  height: 100dvh;
  overflow: hidden;
}

.root-layout.split-layout.sidebar-right {
  flex-direction: row-reverse;
}

.root-layout.is-dragging,
.root-layout.is-dragging * {
  cursor: col-resize !important;
}

.root-layout.is-dragging :deep(iframe) {
  pointer-events: none !important;
}

/* Main area: canvas + overlays; always full width */
.main-area {
  flex: 1;
  min-width: 0;
  position: relative;
  overflow: hidden;
  /* Remove transition to allow smooth dragging */
}

/* Splitter */
.layout-splitter {
  width: 12px;
  background: transparent;
  cursor: col-resize;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
  /* Prevent text selection while dragging */
  user-select: none;
  /* or a touch drag scrolls instead of moving the split */
  touch-action: none;
}
.layout-splitter:hover,
.layout-splitter:active {
  background: rgba(255, 255, 255, 0.05);
}
.splitter-handle {
  width: 4px;
  height: 40px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.2);
}
.layout-splitter:hover .splitter-handle,
.layout-splitter:active .splitter-handle {
  background: rgba(255, 255, 255, 0.4);
}

/* Canvas fills main area */
.main-area canvas#kwami-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  /* Drags on the avatar spin it (canvasTouchBridge); the browser must not take
     them as a pan or a pinch-zoom of the page. */
  touch-action: none;
}

/* A portrait phone has no room for two columns: the split stacks, the avatar
   above and the browser below, and the browser stops short of the dock, which
   floats over the bottom of the screen (main.css, PHONES). Dragging the split
   sideways means nothing here, so the splitter goes. */
@media (max-width: 767px) and (orientation: portrait) {
  .root-layout.split-layout,
  .root-layout.split-layout.sidebar-right {
    flex-direction: column;
  }

  .root-layout.split-layout .main-area {
    flex: 0 0 38% !important;
  }

  .root-layout.split-layout .layout-splitter {
    display: none;
  }

  .root-layout.split-layout :deep(.browser-panel--docked) {
    height: auto;
    min-height: 0;
    border-left: none;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    padding-bottom: calc(var(--phone-bottom) + var(--phone-dock-h) + 8px);
  }
}

/* Control Bar: positioned at top-right of main area (moves with canvas) */
.control-bar-container {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
