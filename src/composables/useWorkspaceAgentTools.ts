import { watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { i18n } from '@/i18n';
import type {
  Kwami,
  LLMProvider,
  STTProvider,
  STTLanguage,
  TTSProvider,
  RealtimeProvider,
} from 'kwami';
import { useKwami } from '@/composables/useKwami';
import { useUIStore, type PanelSizePreset } from '@/stores/ui';
import { useSearchStore } from '@/stores/search';
import { useVoiceStore } from '@/stores/voice';
import { useThemeStore, accentPresets, themePresets } from '@/stores/theme';
import { useSceneStore } from '@/stores/scene';
import { useAvatarStore } from '@/stores/avatar';
import { useBlobXyzStore } from '@/stores/avatar.blob-xyz';
import { useBlackHoleStore } from '@/stores/avatar.black-hole';
import { useParticlesFaceStore } from '@/stores/avatar.particles-face';
import { useEyeIrisStore } from '@/stores/avatar.eye-iris';
import { useTranscriptionState } from '@/composables/useTranscriptionState';
import { useAgentActionState } from '@/composables/useAgentActionState';
import { avatarPresets } from '@/presets/avatar/avatar-presets';
import { useEmailStore, type EmailCategory } from '@/stores/email';
import { useCalendarStore, type CalendarEventType } from '@/stores/calendar';
import {
  useNavigationStore,
  BROWSER_PANEL_LAYOUTS,
  type BrowserPanelLayout,
} from '@/stores/navigation';
import { useWorkspaceStore } from '@/stores/workspace';
import { useKwamiConfigSync } from '@/composables/useKwamiConfigSync';
import { useSearchPanelAgentTools } from '@/composables/useSearchPanelAgentTools';
import { useCommsAgentTools } from '@/composables/useCommsAgentTools';
import { useLocaleAgentTools } from '@/composables/useLocaleAgentTools';
import { useRecallAgentTools } from '@/composables/useRecallAgentTools';
import { useKwamiAdminAgentTools } from '@/composables/useKwamiAdminAgentTools';
import { useWorkspaceExtrasAgentTools } from '@/composables/useWorkspaceExtrasAgentTools';
import { soulPresets } from '@/presets/agent/soul-presets';
import { sceneImagePresets } from '@/presets/scene/image-presets';
import { sceneVideoPresets } from '@/presets/scene/video-presets';
import { sceneHdriPresets } from '@/presets/scene/hdri-presets';

const WORKSPACE_PANELS = [
  'avatar',
  'audio',
  'scene',
  'voice',
  'enhancements',
  'history',
  'communications',
  'soul',
  'memory',
  'tools',
  'info',
  'metrics',
  'account',
  'theme',
  'models',
  'credits',
  'email',
  'calendar',
] as const;

type WorkspacePanel = (typeof WORKSPACE_PANELS)[number];
type ResponseLength = 'short' | 'medium' | 'long';

const PANEL_ALIASES: Record<string, WorkspacePanel> = {
  account: 'account',
  audio: 'audio',
  music: 'audio',
  soundtrack: 'audio',
  player: 'audio',
  avatar: 'avatar',
  chat: 'history',
  history: 'history',
  communications: 'communications',
  credits: 'credits',
  energy: 'credits',
  enhancements: 'enhancements',
  info: 'info',
  memory: 'memory',
  metrics: 'metrics',
  model: 'models',
  models: 'models',
  scene: 'scene',
  settings: 'theme',
  soul: 'soul',
  theme: 'theme',
  tools: 'tools',
  transcript: 'history',
  transcription: 'history',
  whatsapp: 'communications',
  messages: 'communications',
  phone: 'communications',
  calls: 'communications',
  voice: 'voice',
  email: 'email',
  mail: 'email',
  inbox: 'email',
  calendar: 'calendar',
  schedule: 'calendar',
};

/**
 * Every avatar renderer the app can actually show.
 *
 * `eye-iris` was missing here while the store, its preset file and
 * `applySnapshot` have all supported it from the start -- so it was selectable
 * by hand and unreachable by voice, for no reason anyone had decided.
 */
const AVATAR_RENDERERS = ['blob-xyz', 'black-hole', 'particles-face', 'eye-iris'] as const;
type AvatarRenderer = (typeof AVATAR_RENDERERS)[number];

const ADVANCED_VOICE_CONTROLS = new Set([
  'pipelineMode',
  'llmModel',
  'sttModel',
  'ttsModel',
  'realtimeModel',
]);

const RESETTABLE_DOMAINS = ['avatar', 'theme', 'scene'] as const;
const UI_CONTROL_DOMAINS = [
  'workspace',
  'panel',
  'theme',
  'avatar',
  'scene',
  'voice',
  'enhancements',
  'memory',
  'search',
  'browser',
  'soul',
] as const;

type UiControlDomain = (typeof UI_CONTROL_DOMAINS)[number];

const UI_DOMAIN_ALIASES: Record<string, UiControlDomain> = {
  appearance: 'avatar',
  avatar: 'avatar',
  enhancement: 'enhancements',
  enhancements: 'enhancements',
  memory: 'memory',
  memoryui: 'memory',
  browser: 'browser',
  browserpanel: 'browser',
  navigation: 'browser',
  web: 'browser',
  panel: 'panel',
  panels: 'panel',
  scene: 'scene',
  search: 'search',
  soul: 'soul',
  personality: 'soul',
  persona: 'soul',
  profile: 'soul',
  theme: 'theme',
  ui: 'workspace',
  voice: 'voice',
  workspace: 'workspace',
};

function normalizePanel(panelName: unknown): WorkspacePanel | null {
  if (typeof panelName !== 'string') return null;
  const normalized = panelName.trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  return PANEL_ALIASES[normalized.replace(/_/g, '')] ?? PANEL_ALIASES[normalized] ?? null;
}

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function normalizeDomain(domain: unknown): UiControlDomain | null {
  if (typeof domain !== 'string') return null;
  return UI_DOMAIN_ALIASES[normalizeKey(domain)] ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Tool handlers receive `Record<string, unknown>` from the agent, so every
 * parameter has to be narrowed before use rather than assumed to be a string.
 */
function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'unknown error';
}

/**
 * Send a config update whose `updateType` the installed SDK does not name.
 *
 * `Agent.syncConfigToBackend`'s union is
 * `'voice' | 'soul' | 'tools' | 'full' | 'llm' | 'memory'`, and the backend
 * also understands `'pipeline'` for switching between the standard and
 * realtime pipelines mid-session. The app depends on the published `kwami`
 * package rather than the workspace source, so widening that union means
 * republishing the SDK; this reaches the same `sendConfigUpdate` the typed
 * method does, via the pipeline the SDK already exposes for exactly this.
 *
 * Returns false when there is no connected pipeline to send on, so callers can
 * tell the user the truth instead of reporting a switch that never left.
 */
function sendRawConfigUpdate(
  instance: Kwami,
  updateType: string,
  config: Record<string, unknown>,
): boolean {
  const pipeline = instance.agent.getPipeline() as {
    sendConfigUpdate?: (type: string, config: unknown) => void;
  } | null;
  if (!pipeline || typeof pipeline.sendConfigUpdate !== 'function') return false;
  try {
    pipeline.sendConfigUpdate(updateType, config);
    return true;
  } catch {
    return false;
  }
}

function buildSoulConfig(voiceStore: ReturnType<typeof useVoiceStore>) {
  const saved = voiceStore.soulConfig;
  return {
    name: saved.name,
    personality: saved.personality,
    systemPrompt: saved.systemPrompt,
    traits: [...saved.traits],
    conversationStyle: saved.conversationStyle,
    responseLength: saved.responseLength,
    emotionalTone: saved.emotionalTone,
    emotionalTraits: { ...saved.emotionalTraits },
  };
}

export function useWorkspaceAgentTools() {
  const { t } = useI18n();
  const { kwami, rendererType, isConnected } = useKwami();

  function humanizePanel(panel: WorkspacePanel): string {
    return t(`workspaceAgentTools.panels.${panel}`);
  }
  const uiStore = useUIStore();
  const searchStore = useSearchStore();
  const voiceStore = useVoiceStore();
  const themeStore = useThemeStore();
  const sceneStore = useSceneStore();
  const avatarStore = useAvatarStore();
  const blobStore = useBlobXyzStore();
  const blackHoleStore = useBlackHoleStore();
  const particlesFaceStore = useParticlesFaceStore();
  const eyeIrisStore = useEyeIrisStore();
  const navigationStore = useNavigationStore();
  const workspaceStore = useWorkspaceStore();
  const { switchToKwami } = useKwamiConfigSync();
  const { messages } = useTranscriptionState();
  const actionState = useAgentActionState();
  // The search panel's tools live in their own composable but register through
  // this one, so there is a single place the agent's tool set is assembled.
  const searchPanelTools = useSearchPanelAgentTools();
  const commsTools = useCommsAgentTools();
  const localeTools = useLocaleAgentTools();
  const recallTools = useRecallAgentTools();
  const kwamiAdminTools = useKwamiAdminAgentTools();
  const extrasTools = useWorkspaceExtrasAgentTools();

  function emitConfigApplied() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kwami:configApplied'));
    }
  }

  function persistAvatarChanges() {
    avatarStore.saveSettings();
    emitConfigApplied();
  }

  function syncSoulToAgent() {
    const soulConfig = buildSoulConfig(voiceStore);
    kwami.value?.soul.updateConfig(soulConfig);
    if (isConnected.value) {
      kwami.value?.agent.syncConfigToBackend('soul', soulConfig);
    }
  }

  function syncVoiceModelsToAgent(control: string, value: Record<string, unknown>) {
    if (!kwami.value || !isConnected.value) return;
    const agent = kwami.value.agent;

    if (control === 'llmModel') {
      agent.updateLlmLive({
        provider: typeof value.provider === 'string' ? value.provider : undefined,
        model: typeof value.model === 'string' ? value.model : undefined,
        temperature: typeof value.temperature === 'number' ? value.temperature : undefined,
      });
      return;
    }

    if (control === 'sttModel') {
      agent.updateSttLive({
        provider: typeof value.provider === 'string' ? value.provider : undefined,
        model: typeof value.model === 'string' ? value.model : undefined,
        language: typeof value.language === 'string' ? value.language : undefined,
      });
      return;
    }

    if (control === 'ttsModel') {
      agent.updateTtsLive({
        provider: typeof value.provider === 'string' ? value.provider : undefined,
        model: typeof value.model === 'string' ? value.model : undefined,
        voice: typeof value.voice === 'string' ? value.voice : undefined,
        speed: typeof value.speed === 'number' ? value.speed : undefined,
      });
      return;
    }

    if (control === 'realtimeModel') {
      agent.updateRealtimeLive({
        provider: typeof value.provider === 'string' ? value.provider : undefined,
        model: typeof value.model === 'string' ? value.model : undefined,
        voice: typeof value.voice === 'string' ? value.voice : undefined,
      });
    }
  }

  function syncEnhancementsToAgent() {
    if (!kwami.value) return;
    const agent = kwami.value.agent;
    const eState = voiceStore.enhancementsState;
    const voiceConfig = {
      enhancements: {
        turnDetection: {
          enabled: eState.turnDetection.enabled,
          mode: eState.turnDetection.mode,
          model: eState.turnDetection.model,
          minEndpointingDelay: eState.turnDetection.minEndpointingDelay,
          maxEndpointingDelay: eState.turnDetection.maxEndpointingDelay,
          allowInterruptions: eState.interruptions.enabled,
          minInterruptionDuration: eState.interruptions.minDuration,
          minInterruptionWords: eState.interruptions.minWords,
        },
        noiseCancellation: {
          enabled: eState.noiseCancellation.enabled,
          mode: eState.noiseCancellation.mode,
        },
        echoCancellation: eState.audioProcessing.echoCancellation,
        autoGainControl: eState.audioProcessing.autoGainControl,
        preemptiveGeneration: eState.performance.preemptiveGeneration,
      },
      vad: {
        provider: eState.vad.provider,
        threshold: eState.vad.threshold,
        minSpeechDuration: eState.vad.minSpeech,
        minSilenceDuration: eState.vad.minSilence,
      },
    };

    agent.updateConfig({
      livekit: {
        ...agent.getConfig().livekit,
        voice: {
          ...agent.getConfig().livekit?.voice,
          ...voiceConfig,
        },
      },
    });

    if (isConnected.value) {
      agent.syncConfigToBackend('voice', voiceConfig);
    }
  }

  /**
   * Ask the user before an expensive-to-undo UI change.
   *
   * `confirm === true` short-circuits the dialog, which means the model can
   * satisfy this gate by asserting it already asked. That is a deliberate
   * trade and it only holds for what this file does: every action here is
   * reversible, visible on screen, and self-contained, so the cost of the
   * model getting it wrong is an annoyed user pressing undo.
   *
   * It is NOT the right gate for anything irreversible or outward-facing --
   * sending a message, placing a call, moving money. Those live in
   * `useCommsAgentTools.ts` and call `requestConfirmation` unconditionally,
   * with no `confirm` parameter for the model to pass. The divergence between
   * the two files is the point, not an oversight: the test is "can the user
   * undo this unaided", not "does it feel important".
   */
  async function confirmIfNeeded(
    required: boolean,
    confirm: unknown,
    title: string,
    message: string,
  ): Promise<boolean> {
    if (!required || confirm === true) return true;
    return actionState.requestConfirmation({
      title,
      message,
      confirmLabel: t('workspaceAgentTools.confirmApply'),
      cancelLabel: t('workspaceAgentTools.confirmCancel'),
    });
  }

  async function openPanel(panelName: unknown) {
    const panel = normalizePanel(panelName);
    if (!panel) {
      const allowedPanels = WORKSPACE_PANELS.join(', ');
      actionState.recordError(
        t('workspaceAgentTools.errOpenPanel'),
        t('workspaceAgentTools.unknownPanel', { panel: String(panelName), allowed: allowedPanels }),
      );
      return {
        success: false,
        message: t('workspaceAgentTools.unknownPanel', {
          panel: String(panelName),
          allowed: allowedPanels,
        }),
      };
    }

    uiStore.setPanel(panel);
    const readablePanel = humanizePanel(panel);
    actionState.recordAction(t('workspaceAgentTools.actionOpenedPanel'), readablePanel, {
      announce: true,
    });
    return {
      success: true,
      panel,
      message: t('workspaceAgentTools.openedPanel', { panel: readablePanel }),
    };
  }

  async function closePanel() {
    if (!uiStore.isPanelOpen) {
      return { success: true, message: t('workspaceAgentTools.panelAlreadyClosed') };
    }

    uiStore.togglePanel();
    actionState.recordAction(
      t('workspaceAgentTools.actionClosedPanel'),
      humanizePanel(uiStore.activePanel as WorkspacePanel),
      {
        announce: true,
      },
    );
    return { success: true, message: t('workspaceAgentTools.closedPanel') };
  }

  async function setRenderer(renderer: unknown) {
    const requested = normalizeKey(asString(renderer));
    const match = AVATAR_RENDERERS.find((item) => normalizeKey(item) === requested);
    if (!match) {
      actionState.recordError(
        t('workspaceAgentTools.errSwitchRenderer'),
        `Unknown renderer "${String(renderer)}"`,
      );
      return {
        success: false,
        message: t('workspaceAgentTools.unknownRenderer'),
      };
    }

    avatarStore.setRendererType(match as AvatarRenderer);
    persistAvatarChanges();
    actionState.recordAction(t('workspaceAgentTools.actionSwitchedRenderer'), match, {
      announce: true,
    });
    return {
      success: true,
      renderer: match,
      message: t('workspaceAgentTools.switchedRenderer', { renderer: match }),
    };
  }

  async function setResponseLength(length: unknown, confirm: unknown) {
    if (length !== 'short' && length !== 'medium' && length !== 'long') {
      actionState.recordError(
        t('workspaceAgentTools.errResponseLength'),
        `Unknown length "${String(length)}"`,
      );
      return {
        success: false,
        message: t('workspaceAgentTools.unknownResponseLength'),
      };
    }

    const approved = await confirmIfNeeded(
      true,
      confirm,
      t('workspaceAgentTools.confirmResponseTitle'),
      t('workspaceAgentTools.confirmResponseBody', { length }),
    );
    if (!approved) {
      actionState.recordAction(t('workspaceAgentTools.actionKeptResponseLength'), undefined, {
        announce: true,
      });
      return {
        success: false,
        cancelled: true,
        message: t('workspaceAgentTools.responseLengthCancelled'),
      };
    }

    voiceStore.soulConfig.responseLength = length as ResponseLength;
    syncSoulToAgent();
    actionState.recordAction(t('workspaceAgentTools.actionUpdatedResponseLength'), length, {
      announce: true,
    });
    return {
      success: true,
      responseLength: length,
      message: t('workspaceAgentTools.changedResponseLength', { length }),
    };
  }

  async function clearSearchResults() {
    if (!searchStore.hasSearchData) {
      return { success: true, message: t('workspaceAgentTools.noSearchToClear') };
    }

    const clearedCount = searchStore.results.length;
    searchStore.clear();
    actionState.recordAction(
      t('workspaceAgentTools.actionClearedSearch'),
      t('workspaceAgentTools.searchResultsDetail', { n: clearedCount }, clearedCount),
      {
        announce: true,
      },
    );
    return {
      success: true,
      clearedCount,
      message: t('workspaceAgentTools.clearedSearch'),
    };
  }

  async function showWorkspaceStatus() {
    return {
      success: true,
      connected: isConnected.value,
      activePanel: uiStore.activePanel,
      isPanelOpen: uiStore.isPanelOpen,
      renderer: rendererType.value,
      responseLength: voiceStore.soulConfig.responseLength,
      hasSearchResults: searchStore.hasSearchData,
      themeMode: themeStore.mode,
      // `mode` can be 'system' or 'auto', neither of which answers "is the
      // screen dark right now". Without this the agent asked that question
      // replies "system", which is true and useless. `resolvedMode` is what
      // the store actually wrote to data-theme.
      resolvedThemeMode: themeStore.resolvedMode,
      sidebarPosition: themeStore.sidebarPosition,
      visibleMessages: messages.value.length,
      message: t('workspaceAgentTools.workspaceStatus', {
        panelState: uiStore.isPanelOpen
          ? t('workspaceAgentTools.panelStateOpen')
          : t('workspaceAgentTools.panelStateClosed'),
        activePanel: String(uiStore.activePanel),
        renderer: String(rendererType.value),
        theme:
          themeStore.mode === themeStore.resolvedMode
            ? String(themeStore.mode)
            : `${themeStore.mode} (${themeStore.resolvedMode})`,
        sidebar: String(themeStore.sidebarPosition),
      }),
    };
  }

  async function setPanelControl(control: unknown, value: unknown) {
    if (control === 'activePanel') {
      return openPanel(value);
    }

    if (control === 'isOpen') {
      if (typeof value !== 'boolean') {
        return { success: false, message: t('workspaceAgentTools.panelOpenBool') };
      }
      if (uiStore.isPanelOpen !== value) {
        uiStore.togglePanel();
      }
      actionState.recordAction(
        value
          ? t('workspaceAgentTools.actionOpenedPanelColumn')
          : t('workspaceAgentTools.actionClosedPanelColumn'),
        undefined,
        {
          announce: true,
        },
      );
      return {
        success: true,
        message: t('workspaceAgentTools.panelColumnState', {
          state: value
            ? t('workspaceAgentTools.panelColumnOpen')
            : t('workspaceAgentTools.panelColumnClosed'),
        }),
      };
    }

    if (control === 'sizePreset') {
      if (value !== 'small' && value !== 'medium' && value !== 'large') {
        return { success: false, message: t('workspaceAgentTools.sizePresetInvalid') };
      }
      uiStore.setSizePreset(value as PanelSizePreset);
      actionState.recordAction(t('workspaceAgentTools.actionUpdatedPanelSize'), value, {
        announce: true,
      });
      return { success: true, message: t('workspaceAgentTools.sizePresetSet', { value }) };
    }

    return {
      success: false,
      message: t('workspaceAgentTools.unknownPanelControl', { control: String(control) }),
    };
  }

  async function setThemeControl(control: unknown, value: unknown) {
    if (typeof control !== 'string') {
      return { success: false, message: t('workspaceAgentTools.themeControlString') };
    }

    const normalized = normalizeKey(control);
    if (normalized === 'preset') {
      if (typeof value !== 'string')
        return { success: false, message: t('workspaceAgentTools.themePresetName') };
      const preset = themePresets.find((item) => normalizeKey(item.name) === normalizeKey(value));
      if (!preset)
        return { success: false, message: t('workspaceAgentTools.unknownThemePreset', { value }) };
      themeStore.applyPreset(preset);
      actionState.recordAction(t('workspaceAgentTools.actionAppliedThemePreset'), preset.name, {
        announce: true,
      });
      return {
        success: true,
        message: t('workspaceAgentTools.appliedThemePreset', { name: preset.name }),
      };
    }

    if (normalized === 'accentpreset') {
      if (typeof value !== 'string')
        return { success: false, message: t('workspaceAgentTools.accentPresetName') };
      const preset = accentPresets.find((item) => normalizeKey(item.name) === normalizeKey(value));
      if (!preset)
        return { success: false, message: t('workspaceAgentTools.unknownAccentPreset', { value }) };
      themeStore.setAccentPreset(preset);
      actionState.recordAction(t('workspaceAgentTools.actionAppliedAccentPreset'), preset.name, {
        announce: true,
      });
      return {
        success: true,
        message: t('workspaceAgentTools.appliedAccentPreset', { name: preset.name }),
      };
    }

    switch (normalized) {
      case 'mode':
        if (value === 'dark' || value === 'light' || value === 'system' || value === 'auto') {
          themeStore.setMode(value);
          break;
        }
        return { success: false, message: t('workspaceAgentTools.themeModeInvalid') };
      case 'sidebarposition':
        if (value === 'left' || value === 'right') {
          themeStore.setSidebarPosition(value);
          break;
        }
        return { success: false, message: t('workspaceAgentTools.sidebarInvalid') };
      case 'compactmode':
        if (typeof value !== 'boolean')
          return { success: false, message: t('workspaceAgentTools.compactBool') };
        themeStore.setCompactMode(value);
        break;
      case 'accentprimary':
        if (typeof value !== 'string')
          return { success: false, message: t('workspaceAgentTools.accentPrimaryHex') };
        themeStore.setAccentPrimary(value);
        break;
      case 'accentsecondary':
        if (typeof value !== 'string')
          return { success: false, message: t('workspaceAgentTools.accentSecondaryHex') };
        themeStore.setAccentSecondary(value);
        break;
      case 'glassblur':
        if (typeof value !== 'number')
          return { success: false, message: t('workspaceAgentTools.glassBlurNum') };
        themeStore.setGlassBlur(value);
        break;
      case 'glassopacity':
        if (typeof value !== 'number')
          return { success: false, message: t('workspaceAgentTools.glassOpacityNum') };
        themeStore.setGlassOpacity(value);
        break;
      case 'saturation':
        if (typeof value !== 'number')
          return { success: false, message: t('workspaceAgentTools.saturationNum') };
        themeStore.setSaturation(value);
        break;
      case 'gradientdirection':
        if (typeof value !== 'number')
          return { success: false, message: t('workspaceAgentTools.gradientDirectionNum') };
        themeStore.setGradientDirection(value);
        break;
      case 'panelborder':
        if (typeof value !== 'boolean')
          return { success: false, message: t('workspaceAgentTools.panelBorderBool') };
        themeStore.setPanelBorder(value);
        break;
      case 'gloweffects':
        if (typeof value !== 'boolean')
          return { success: false, message: t('workspaceAgentTools.glowBool') };
        themeStore.setGlowEffects(value);
        break;
      case 'highcontrast':
        if (typeof value !== 'boolean')
          return { success: false, message: t('workspaceAgentTools.highContrastBool') };
        themeStore.setHighContrast(value);
        break;
      case 'focusindicators':
        if (typeof value !== 'boolean')
          return { success: false, message: t('workspaceAgentTools.focusIndicatorsBool') };
        themeStore.setFocusIndicators(value);
        break;
      case 'cursorflashlight':
        if (typeof value !== 'boolean')
          return { success: false, message: t('workspaceAgentTools.cursorFlashlightBool') };
        themeStore.setCursorFlashlight(value);
        break;
      case 'flashlightsize':
        if (typeof value !== 'number')
          return { success: false, message: t('workspaceAgentTools.flashlightSizeNum') };
        themeStore.setFlashlightSize(value);
        break;
      case 'flashlightintensity':
        if (typeof value !== 'number')
          return { success: false, message: t('workspaceAgentTools.flashlightIntensityNum') };
        themeStore.setFlashlightIntensity(value);
        break;
      case 'flashlightcolor':
        if (typeof value !== 'string')
          return { success: false, message: t('workspaceAgentTools.flashlightColorHex') };
        themeStore.setFlashlightColor(value);
        break;
      case 'borderradius':
        if (typeof value !== 'number')
          return { success: false, message: t('workspaceAgentTools.borderRadiusNum') };
        themeStore.setBorderRadius(value);
        break;
      default:
        return {
          success: false,
          message: t('workspaceAgentTools.unknownThemeControl', { control }),
        };
    }

    actionState.recordAction(t('workspaceAgentTools.actionUpdatedThemeControl'), String(control), {
      announce: true,
    });
    return { success: true, message: t('workspaceAgentTools.updatedThemeControl', { control }) };
  }

  async function setAvatarControl(control: unknown, value: unknown) {
    if (typeof control !== 'string') {
      return { success: false, message: t('workspaceAgentTools.avatarControlString') };
    }

    const normalized = normalizeKey(control);
    if (normalized === 'renderer') {
      return setRenderer(value);
    }

    if (normalized === 'preset') {
      if (typeof value !== 'string')
        return { success: false, message: t('workspaceAgentTools.avatarPresetName') };
      const preset = avatarPresets.find(
        (item) =>
          normalizeKey(item.id) === normalizeKey(value) ||
          normalizeKey(item.name) === normalizeKey(value),
      );
      if (!preset)
        return { success: false, message: t('workspaceAgentTools.unknownAvatarPreset', { value }) };
      avatarStore.applyPreset(preset.id);
      persistAvatarChanges();
      actionState.recordAction(t('workspaceAgentTools.actionAppliedAvatarPreset'), preset.name, {
        announce: true,
      });
      return {
        success: true,
        message: t('workspaceAgentTools.appliedAvatarPreset', { name: preset.name }),
      };
    }

    switch (normalized) {
      case 'blobskintype':
        {
          const validSkins = [
            'radial',
            'banded',
            'striped',
            'marble',
            'fresnel',
            'iridescent',
            'spiral',
            'plasma',
            'gradient',
            'matte',
            'glossy',
            'metallic',
            'subsurface',
            'chrome',
            'clay',
            'jade',
            'toon-matcap',
            'hologram',
            'flat',
            'stepped',
            'halftone',
            'outlined',
          ];
          if (!validSkins.includes(value as string)) {
            return {
              success: false,
              message: t('workspaceAgentTools.blobSkinInvalid', { list: validSkins.join(', ') }),
            };
          }
          blobStore.skin.type = value as typeof blobStore.skin.type;
        }
        break;
      case 'blobcolors':
        if (!isRecord(value))
          return { success: false, message: t('workspaceAgentTools.blobColorsObject') };
        blobStore.setColors(
          typeof value.x === 'string' ? value.x : blobStore.skin.colors.x,
          typeof value.y === 'string' ? value.y : blobStore.skin.colors.y,
          typeof value.z === 'string' ? value.z : blobStore.skin.colors.z,
        );
        break;
      case 'blobspikes':
        if (!isRecord(value))
          return { success: false, message: t('workspaceAgentTools.blobSpikesObject') };
        blobStore.setSpikes(
          typeof value.x === 'number' ? value.x : blobStore.shape.spikes.x,
          typeof value.y === 'number' ? value.y : blobStore.shape.spikes.y,
          typeof value.z === 'number' ? value.z : blobStore.shape.spikes.z,
        );
        break;
      case 'blobamplitude':
        if (!isRecord(value))
          return { success: false, message: t('workspaceAgentTools.blobAmplitudeObject') };
        blobStore.setAmplitude(
          typeof value.x === 'number' ? value.x : blobStore.shape.amplitude.x,
          typeof value.y === 'number' ? value.y : blobStore.shape.amplitude.y,
          typeof value.z === 'number' ? value.z : blobStore.shape.amplitude.z,
        );
        break;
      case 'blobrotation':
        if (!isRecord(value))
          return { success: false, message: t('workspaceAgentTools.blobRotationObject') };
        blobStore.setRotation(
          typeof value.x === 'number' ? value.x : blobStore.animation.rotation.x,
          typeof value.y === 'number' ? value.y : blobStore.animation.rotation.y,
          typeof value.z === 'number' ? value.z : blobStore.animation.rotation.z,
        );
        break;
      case 'blobscale':
        if (typeof value !== 'number')
          return { success: false, message: t('workspaceAgentTools.blobScaleNum') };
        blobStore.shape.scale = value;
        break;
      case 'blobopacity':
        if (typeof value !== 'number')
          return { success: false, message: t('workspaceAgentTools.blobOpacityNum') };
        blobStore.skin.opacity = value;
        break;
      case 'blobshininess':
        if (typeof value !== 'number')
          return { success: false, message: t('workspaceAgentTools.blobShininessNum') };
        blobStore.skin.shininess = value;
        break;
      case 'blobwireframe':
        if (typeof value !== 'boolean')
          return { success: false, message: t('workspaceAgentTools.blobWireframeBool') };
        blobStore.skin.wireframe = value;
        break;
      case 'blobglassmode':
        if (typeof value !== 'boolean')
          return { success: false, message: t('workspaceAgentTools.blobGlassBool') };
        blobStore.skin.glassMode = value;
        break;
      case 'blobaudioreactivity':
        if (typeof value !== 'number')
          return { success: false, message: t('workspaceAgentTools.blobAudioReactivityNum') };
        blobStore.audio.reactivity = value;
        break;
      case 'blobaudioenabled':
        if (typeof value !== 'boolean')
          return { success: false, message: t('workspaceAgentTools.blobAudioEnabledBool') };
        blobStore.audio.enabled = value;
        break;
      case 'blackholecolorscheme':
        if (typeof value !== 'string')
          return { success: false, message: t('workspaceAgentTools.bhColorScheme') };
        blackHoleStore.setColorSchemePreset(
          value as 'classic' | 'fire' | 'ice' | 'nebula' | 'void',
        );
        break;
      case 'blackholecolors':
        if (!isRecord(value))
          return { success: false, message: t('workspaceAgentTools.bhColorsObject') };
        blackHoleStore.updateColors({
          hot: typeof value.hot === 'string' ? value.hot : blackHoleStore.colors.hot,
          mid1: typeof value.mid1 === 'string' ? value.mid1 : blackHoleStore.colors.mid1,
          mid2: typeof value.mid2 === 'string' ? value.mid2 : blackHoleStore.colors.mid2,
          mid3: typeof value.mid3 === 'string' ? value.mid3 : blackHoleStore.colors.mid3,
          outer: typeof value.outer === 'string' ? value.outer : blackHoleStore.colors.outer,
        });
        break;
      case 'blackholecore':
        if (!isRecord(value))
          return { success: false, message: t('workspaceAgentTools.bhCoreObject') };
        blackHoleStore.updateCore(value);
        break;
      case 'blackholedisk':
        if (!isRecord(value))
          return { success: false, message: t('workspaceAgentTools.bhDiskObject') };
        blackHoleStore.updateDisk(value);
        break;
      case 'blackholeanimation':
        if (!isRecord(value))
          return { success: false, message: t('workspaceAgentTools.bhAnimObject') };
        blackHoleStore.updateAnimation(value);
        break;
      case 'blackholeeffects':
        if (!isRecord(value))
          return { success: false, message: t('workspaceAgentTools.bhEffectsObject') };
        blackHoleStore.updateEffects(value);
        break;
      case 'blackholescale':
        if (typeof value !== 'number')
          return { success: false, message: t('workspaceAgentTools.bhScaleNum') };
        blackHoleStore.setScale(value);
        break;
      case 'particlesfaceappearance':
      case 'particlesfacemotion':
        if (!isRecord(value))
          return { success: false, message: t('workspaceAgentTools.particlesFaceObject') };
        particlesFaceStore.update(value);
        break;
      // The eye-iris renderer had no agent-facing controls at all, so it could
      // be selected by voice and then not adjusted by voice.
      case 'eyeirispalette':
        if (typeof value !== 'string')
          return { success: false, message: t('workspaceAgentTools.eyeIrisPaletteName') };
        eyeIrisStore.applyPalettePreset(
          value as Parameters<typeof eyeIrisStore.applyPalettePreset>[0],
        );
        break;
      case 'eyeiriscolors':
        if (!isRecord(value))
          return { success: false, message: t('workspaceAgentTools.eyeIrisColorsObject') };
        eyeIrisStore.importState({
          color: { ...eyeIrisStore.state.color, ...(value as Record<string, string>) },
        });
        break;
      case 'eyeirispupil':
        if (!isRecord(value))
          return { success: false, message: t('workspaceAgentTools.eyeIrisPupilObject') };
        eyeIrisStore.importState({ geometry: { ...eyeIrisStore.state.geometry, ...value } });
        break;
      case 'eyeirismotion':
        if (!isRecord(value))
          return { success: false, message: t('workspaceAgentTools.eyeIrisMotionObject') };
        eyeIrisStore.importState({ animation: { ...eyeIrisStore.state.animation, ...value } });
        break;
      default:
        return {
          success: false,
          message: t('workspaceAgentTools.unknownAvatarControl', { control }),
        };
    }

    persistAvatarChanges();
    actionState.recordAction(t('workspaceAgentTools.actionUpdatedAvatarControl'), String(control), {
      announce: true,
    });
    return { success: true, message: t('workspaceAgentTools.updatedAvatarControl', { control }) };
  }

  async function setSceneControl(control: unknown, value: unknown) {
    if (typeof control !== 'string') {
      return { success: false, message: t('workspaceAgentTools.sceneControlString') };
    }

    switch (normalizeKey(control)) {
      case 'mediatype':
        if (value !== 'none' && value !== 'image' && value !== 'video' && value !== 'hdri') {
          return { success: false, message: t('workspaceAgentTools.mediaTypeInvalid') };
        }
        sceneStore.setMediaType(value);
        break;
      case 'imageurl':
        if (typeof value !== 'string')
          return { success: false, message: t('workspaceAgentTools.imageUrlString') };
        sceneStore.setImageUrl(value);
        break;
      case 'imagefit':
        if (value !== 'cover' && value !== 'contain' && value !== 'stretch') {
          return { success: false, message: t('workspaceAgentTools.imageFitInvalid') };
        }
        sceneStore.setImageFit(value);
        break;
      case 'imageopacity':
        if (typeof value !== 'number')
          return { success: false, message: t('workspaceAgentTools.imageOpacityNum') };
        sceneStore.setImageOpacity(value);
        break;
      case 'videourl':
        if (typeof value !== 'string')
          return { success: false, message: t('workspaceAgentTools.videoUrlString') };
        sceneStore.setVideoUrl(value);
        break;
      case 'videofit':
        if (value !== 'cover' && value !== 'contain' && value !== 'stretch') {
          return { success: false, message: t('workspaceAgentTools.videoFitInvalid') };
        }
        sceneStore.setVideoFit(value);
        break;
      case 'videoopacity':
        if (typeof value !== 'number')
          return { success: false, message: t('workspaceAgentTools.videoOpacityNum') };
        sceneStore.setVideoOpacity(value);
        break;
      case 'videoloop':
        if (typeof value !== 'boolean')
          return { success: false, message: t('workspaceAgentTools.videoLoopBool') };
        sceneStore.setVideoLoop(value);
        break;
      case 'videomuted':
        if (typeof value !== 'boolean')
          return { success: false, message: t('workspaceAgentTools.videoMutedBool') };
        sceneStore.setVideoMuted(value);
        break;
      case 'hdriurl':
        if (typeof value !== 'string')
          return { success: false, message: t('workspaceAgentTools.hdriUrlString') };
        sceneStore.setHdriUrl(value);
        break;
      case 'hdriintensity':
        if (typeof value !== 'number')
          return { success: false, message: t('workspaceAgentTools.hdriIntensityNum') };
        sceneStore.setHdriIntensity(value);
        break;
      case 'hdriopacity':
        if (typeof value !== 'number')
          return { success: false, message: t('workspaceAgentTools.hdriOpacityNum') };
        sceneStore.setHdriOpacity(value);
        break;
      case 'hdrirotation':
        if (typeof value !== 'number')
          return { success: false, message: t('workspaceAgentTools.hdriRotationNum') };
        sceneStore.setHdriRotation(value);
        break;
      case 'hdriblur':
        if (typeof value !== 'number')
          return { success: false, message: t('workspaceAgentTools.hdriBlurNum') };
        sceneStore.setHdriBlur(value);
        break;
      case 'gradientenabled':
        if (typeof value !== 'boolean')
          return { success: false, message: t('workspaceAgentTools.gradientEnabledBool') };
        sceneStore.setGradientEnabled(value);
        break;
      case 'gradienttype':
        if (value !== 'solid' && value !== 'radial' && value !== 'linear' && value !== 'orbs') {
          return { success: false, message: t('workspaceAgentTools.gradientTypeInvalid') };
        }
        sceneStore.setGradientType(value);
        break;
      case 'gradientsolidcolor':
        if (typeof value !== 'string')
          return { success: false, message: t('workspaceAgentTools.gradientSolidHex') };
        sceneStore.background.gradient.solidColor = value;
        break;
      case 'gradientangle':
        if (typeof value !== 'number')
          return { success: false, message: t('workspaceAgentTools.gradientAngleNum') };
        sceneStore.setGradientAngle(value);
        break;
      case 'gradientradialcenter':
        if (!isRecord(value) || typeof value.x !== 'number' || typeof value.y !== 'number') {
          return { success: false, message: t('workspaceAgentTools.gradientRadialCenterObject') };
        }
        sceneStore.setGradientRadialCenter(value.x, value.y);
        break;
      case 'gradientradialsize':
        if (typeof value !== 'number')
          return { success: false, message: t('workspaceAgentTools.gradientRadialSizeNum') };
        sceneStore.setGradientRadialSize(value);
        break;
      case 'gradientopacity':
        if (typeof value !== 'number')
          return { success: false, message: t('workspaceAgentTools.gradientOpacityNum') };
        sceneStore.setGradientOpacity(value);
        break;
      case 'gradientblendmode':
        if (
          value !== 'normal' &&
          value !== 'multiply' &&
          value !== 'screen' &&
          value !== 'overlay' &&
          value !== 'soft-light'
        ) {
          return { success: false, message: t('workspaceAgentTools.gradientBlendInvalid') };
        }
        sceneStore.setGradientBlendMode(value);
        break;
      default:
        return {
          success: false,
          message: t('workspaceAgentTools.unknownSceneControl', { control }),
        };
    }

    actionState.recordAction(t('workspaceAgentTools.actionUpdatedSceneControl'), String(control), {
      announce: true,
    });
    return { success: true, message: t('workspaceAgentTools.updatedSceneControl', { control }) };
  }

  async function setVoiceControl(control: unknown, value: unknown, confirm: unknown) {
    if (typeof control !== 'string') {
      return { success: false, message: t('workspaceAgentTools.voiceControlString') };
    }

    const normalized = normalizeKey(control);
    const approved = await confirmIfNeeded(
      ADVANCED_VOICE_CONTROLS.has(normalized),
      confirm,
      t('workspaceAgentTools.confirmVoiceTitle'),
      t('workspaceAgentTools.confirmVoiceBody', { control }),
    );
    if (!approved) {
      return {
        success: false,
        cancelled: true,
        message: t('workspaceAgentTools.cancelledVoiceControl', { control }),
      };
    }

    if (normalized === 'pipelinemode') {
      if (value !== 'realtime' && value !== 'stt-llm-tts') {
        return { success: false, message: t('workspaceAgentTools.pipelineModeInvalid') };
      }
      voiceStore.setPipelineMode(value);
      if (kwami.value) {
        kwami.value.agent.updateConfig({
          livekit: {
            ...kwami.value.agent.getConfig().livekit,
            voice: voiceStore.voiceConfig,
          },
        });
      }
      // `updateConfig` only mutates the local object. Without this the backend
      // never heard about the switch at all, which is why the message below
      // used to tell the user to reconnect. It can now be applied live.
      const switchedLive =
        isConnected.value &&
        !!kwami.value &&
        sendRawConfigUpdate(kwami.value, 'pipeline', { pipelineType: value });
      actionState.recordAction(t('workspaceAgentTools.actionUpdatedPipeline'), value, {
        announce: true,
      });
      return {
        success: true,
        message: switchedLive
          ? t('workspaceAgentTools.pipelineModeSwitched', { mode: value })
          : isConnected.value
            ? t('workspaceAgentTools.pipelineModeSetReconnect', { mode: value })
            : t('workspaceAgentTools.pipelineModeSet', { mode: value }),
      };
    }

    if (normalized === 'ttsvoice') {
      if (typeof value !== 'string')
        return { success: false, message: t('workspaceAgentTools.ttsVoiceString') };
      voiceStore.updateTTS({ voice: value });
      if (isConnected.value && kwami.value) {
        kwami.value.agent.updateTtsLive({ voice: value, speed: voiceStore.tts.speed });
      }
    } else if (normalized === 'ttsspeed') {
      if (typeof value !== 'number')
        return { success: false, message: t('workspaceAgentTools.ttsSpeedNum') };
      voiceStore.updateTTS({ speed: value });
      if (isConnected.value && kwami.value) {
        kwami.value.agent.updateTtsLive({ voice: voiceStore.tts.voice, speed: value });
      }
    } else if (normalized === 'realtimevoice') {
      if (typeof value !== 'string')
        return { success: false, message: t('workspaceAgentTools.realtimeVoiceString') };
      voiceStore.updateRealtime({ voice: value });
      if (isConnected.value && kwami.value) {
        kwami.value.agent.updateRealtimeLive({ voice: value });
      }
    } else if (normalized === 'sttlanguage') {
      if (typeof value !== 'string')
        return { success: false, message: t('workspaceAgentTools.sttLanguageString') };
      voiceStore.updateSTT({ language: value as STTLanguage });
      if (isConnected.value && kwami.value) {
        kwami.value.agent.updateSttLive({
          provider: voiceStore.stt.provider,
          model: voiceStore.stt.model,
          language: value as STTLanguage,
        });
      }
    } else if (normalized === 'responselength') {
      return setResponseLength(value, true);
    } else if (normalized === 'emotionaltone') {
      if (value !== 'neutral' && value !== 'warm' && value !== 'enthusiastic' && value !== 'calm') {
        return { success: false, message: t('workspaceAgentTools.emotionalToneInvalid') };
      }
      voiceStore.soulConfig.emotionalTone = value;
      syncSoulToAgent();
    } else if (
      normalized === 'llmmodel' ||
      normalized === 'sttmodel' ||
      normalized === 'ttsmodel' ||
      normalized === 'realtimemodel'
    ) {
      if (!isRecord(value))
        return {
          success: false,
          message: t('workspaceAgentTools.voiceControlSettingsObject', { control }),
        };
      if (normalized === 'llmmodel') {
        voiceStore.updateLLM({
          provider:
            typeof value.provider === 'string'
              ? (value.provider as LLMProvider)
              : voiceStore.llm.provider,
          model: typeof value.model === 'string' ? value.model : voiceStore.llm.model,
          temperature:
            typeof value.temperature === 'number' ? value.temperature : voiceStore.llm.temperature,
        });
      } else if (normalized === 'sttmodel') {
        voiceStore.updateSTT({
          provider:
            typeof value.provider === 'string'
              ? (value.provider as STTProvider)
              : voiceStore.stt.provider,
          model: typeof value.model === 'string' ? value.model : voiceStore.stt.model,
          language:
            typeof value.language === 'string'
              ? (value.language as STTLanguage)
              : voiceStore.stt.language,
        });
      } else if (normalized === 'ttsmodel') {
        voiceStore.updateTTS({
          provider:
            typeof value.provider === 'string'
              ? (value.provider as TTSProvider)
              : voiceStore.tts.provider,
          model: typeof value.model === 'string' ? value.model : voiceStore.tts.model,
          voice: typeof value.voice === 'string' ? value.voice : voiceStore.tts.voice,
          speed: typeof value.speed === 'number' ? value.speed : voiceStore.tts.speed,
        });
      } else {
        voiceStore.updateRealtime({
          provider:
            typeof value.provider === 'string'
              ? (value.provider as RealtimeProvider)
              : voiceStore.realtime.provider,
          model: typeof value.model === 'string' ? value.model : voiceStore.realtime.model,
          voice: typeof value.voice === 'string' ? value.voice : voiceStore.realtime.voice,
        });
      }

      syncVoiceModelsToAgent(
        normalized === 'llmmodel'
          ? 'llmModel'
          : normalized === 'sttmodel'
            ? 'sttModel'
            : normalized === 'ttsmodel'
              ? 'ttsModel'
              : 'realtimeModel',
        value,
      );
    } else {
      return { success: false, message: t('workspaceAgentTools.unknownVoiceControl', { control }) };
    }

    actionState.recordAction(t('workspaceAgentTools.actionUpdatedVoiceControl'), String(control), {
      announce: true,
    });
    return { success: true, message: t('workspaceAgentTools.updatedVoiceControl', { control }) };
  }

  async function setEnhancementControl(control: unknown, value: unknown) {
    if (typeof control !== 'string') {
      return { success: false, message: t('workspaceAgentTools.enhancementControlString') };
    }

    const eState = voiceStore.enhancementsState;
    switch (normalizeKey(control)) {
      case 'turndetectionenabled':
        if (typeof value !== 'boolean')
          return { success: false, message: t('workspaceAgentTools.turnDetectionEnabledBool') };
        eState.turnDetection.enabled = value;
        break;
      case 'turndetectionmode':
        if (value !== 'vad' && value !== 'stt' && value !== 'model' && value !== 'manual') {
          return { success: false, message: t('workspaceAgentTools.turnDetectionModeInvalid') };
        }
        eState.turnDetection.mode = value;
        break;
      case 'turndetectionmodel':
        if (value !== 'english' && value !== 'multilingual') {
          return { success: false, message: t('workspaceAgentTools.turnDetectionModelInvalid') };
        }
        eState.turnDetection.model = value;
        break;
      case 'minendpointingdelay':
        if (typeof value !== 'number')
          return { success: false, message: t('workspaceAgentTools.minEndpointingNum') };
        eState.turnDetection.minEndpointingDelay = value;
        break;
      case 'maxendpointingdelay':
        if (typeof value !== 'number')
          return { success: false, message: t('workspaceAgentTools.maxEndpointingNum') };
        eState.turnDetection.maxEndpointingDelay = value;
        break;
      case 'interruptionsenabled':
        if (typeof value !== 'boolean')
          return { success: false, message: t('workspaceAgentTools.interruptionsEnabledBool') };
        eState.interruptions.enabled = value;
        break;
      case 'interruptionduration':
        if (typeof value !== 'number')
          return { success: false, message: t('workspaceAgentTools.interruptionDurationNum') };
        eState.interruptions.minDuration = value;
        break;
      case 'interruptionwords':
        if (typeof value !== 'number')
          return { success: false, message: t('workspaceAgentTools.interruptionWordsNum') };
        eState.interruptions.minWords = value;
        break;
      case 'noisecancellationenabled':
        if (typeof value !== 'boolean')
          return { success: false, message: t('workspaceAgentTools.noiseCancellationEnabledBool') };
        eState.noiseCancellation.enabled = value;
        break;
      case 'noisecancellationmode':
        if (value !== 'bvc' && value !== 'krisp' && value !== 'default') {
          return { success: false, message: t('workspaceAgentTools.noiseCancellationModeInvalid') };
        }
        eState.noiseCancellation.mode = value;
        break;
      case 'vadthreshold':
        if (typeof value !== 'number')
          return { success: false, message: t('workspaceAgentTools.vadThresholdNum') };
        eState.vad.threshold = value;
        break;
      case 'vadminspeech':
        if (typeof value !== 'number')
          return { success: false, message: t('workspaceAgentTools.vadMinSpeechNum') };
        eState.vad.minSpeech = value;
        break;
      case 'vadminsilence':
        if (typeof value !== 'number')
          return { success: false, message: t('workspaceAgentTools.vadMinSilenceNum') };
        eState.vad.minSilence = value;
        break;
      case 'echocancellation':
        if (typeof value !== 'boolean')
          return { success: false, message: t('workspaceAgentTools.echoCancellationBool') };
        eState.audioProcessing.echoCancellation = value;
        break;
      case 'autogaincontrol':
        if (typeof value !== 'boolean')
          return { success: false, message: t('workspaceAgentTools.autoGainBool') };
        eState.audioProcessing.autoGainControl = value;
        break;
      case 'preemptivegeneration':
        if (typeof value !== 'boolean')
          return { success: false, message: t('workspaceAgentTools.preemptiveGenBool') };
        eState.performance.preemptiveGeneration = value;
        break;
      default:
        return {
          success: false,
          message: t('workspaceAgentTools.unknownEnhancementControl', { control }),
        };
    }

    syncEnhancementsToAgent();
    actionState.recordAction(
      t('workspaceAgentTools.actionUpdatedEnhancementControl'),
      String(control),
      { announce: true },
    );
    return {
      success: true,
      message: t('workspaceAgentTools.updatedEnhancementControl', { control }),
    };
  }

  async function setMemoryUiControl(control: unknown, value: unknown) {
    if (typeof control !== 'string') {
      return { success: false, message: t('workspaceAgentTools.memoryUiControlString') };
    }

    const normalizedControl = normalizeKey(control);
    const openGraphControls = new Set([
      'opengraph',
      'opengraphview',
      'showgraph',
      'showgraphview',
      'knowledgegraph',
      'knowledgegraphview',
      'graph',
      'graphview',
    ]);

    if (normalizedControl === 'activetab') {
      if (value !== 'facts' && value !== 'entities' && value !== 'messages') {
        return { success: false, message: t('workspaceAgentTools.memoryTabInvalid') };
      }
      voiceStore.memoryUI.activeTab = value;
      voiceStore.memoryUI.graphModalOpen = false;
      uiStore.setPanel('memory');
      actionState.recordAction(t('workspaceAgentTools.actionOpenedMemoryView'), String(value), {
        announce: true,
      });
      return {
        success: true,
        message: t('workspaceAgentTools.openedMemoryView', { tab: String(value) }),
      };
    }

    if (openGraphControls.has(normalizedControl)) {
      const shouldOpen =
        value === undefined
          ? true
          : value === true ||
            value === 'true' ||
            value === 'open' ||
            value === 'show' ||
            value === 1;
      voiceStore.memoryUI.graphModalOpen = shouldOpen;
      uiStore.setPanel('memory');
      actionState.recordAction(
        shouldOpen
          ? t('workspaceAgentTools.actionOpenedMemoryGraph')
          : t('workspaceAgentTools.actionClosedMemoryGraph'),
        'knowledge-graph',
        { announce: true },
      );
      return {
        success: true,
        message: shouldOpen
          ? t('workspaceAgentTools.openedMemoryGraph')
          : t('workspaceAgentTools.closedMemoryGraph'),
      };
    }

    return {
      success: false,
      message: t('workspaceAgentTools.unknownMemoryUiControl', { control: String(control) }),
    };
  }

  async function resetUiDomain(domain: unknown, confirm: unknown) {
    if (domain !== 'avatar' && domain !== 'theme' && domain !== 'scene') {
      return {
        success: false,
        message: t('workspaceAgentTools.resettableDomains', {
          list: RESETTABLE_DOMAINS.join(', '),
        }),
      };
    }

    const approved = await confirmIfNeeded(
      true,
      confirm,
      t('workspaceAgentTools.confirmResetTitle', { domain: String(domain) }),
      t('workspaceAgentTools.confirmResetBody', { domain: String(domain) }),
    );
    if (!approved) {
      return {
        success: false,
        cancelled: true,
        message: t('workspaceAgentTools.cancelledReset', { domain: String(domain) }),
      };
    }

    if (domain === 'avatar') {
      avatarStore.reset();
      blobStore.resetAll();
      blackHoleStore.resetAll();
      particlesFaceStore.resetAll();
      persistAvatarChanges();
    } else if (domain === 'theme') {
      themeStore.resetToDefaults();
    } else {
      sceneStore.resetToDefaults();
    }

    actionState.recordAction(t('workspaceAgentTools.actionResetUiDomain'), String(domain), {
      announce: true,
    });
    return {
      success: true,
      message: t('workspaceAgentTools.resetDomainDone', { domain: String(domain) }),
    };
  }

  async function listUiControls() {
    return {
      success: true,
      panels: [...WORKSPACE_PANELS],
      panelControls: ['activePanel', 'isOpen', 'sizePreset'],
      themeControls: [
        'preset',
        'accentPreset',
        'mode',
        'sidebarPosition',
        'compactMode',
        'accentPrimary',
        'accentSecondary',
        'glassBlur',
        'glassOpacity',
        'saturation',
        'gradientDirection',
        'panelBorder',
        'glowEffects',
        'highContrast',
        'focusIndicators',
        'cursorFlashlight',
        'flashlightSize',
        'flashlightIntensity',
        'flashlightColor',
        'borderRadius',
      ],
      avatarControls: [
        'renderer',
        'preset',
        'blobSkinType',
        'blobColors',
        'blobSpikes',
        'blobAmplitude',
        'blobRotation',
        'blobScale',
        'blobOpacity',
        'blobShininess',
        'blobWireframe',
        'blobGlassMode',
        'blobAudioReactivity',
        'blobAudioEnabled',
        'blackHoleColorScheme',
        'blackHoleColors',
        'blackHoleCore',
        'blackHoleDisk',
        'blackHoleAnimation',
        'blackHoleEffects',
        'blackHoleScale',
        'particlesFaceAppearance',
        'particlesFaceMotion',
      ],
      sceneControls: [
        'mediaType',
        'imageUrl',
        'imageFit',
        'imageOpacity',
        'videoUrl',
        'videoFit',
        'videoOpacity',
        'videoLoop',
        'videoMuted',
        'hdriUrl',
        'hdriIntensity',
        'hdriOpacity',
        'hdriRotation',
        'hdriBlur',
        'gradientEnabled',
        'gradientType',
        'gradientSolidColor',
        'gradientAngle',
        'gradientRadialCenter',
        'gradientRadialSize',
        'gradientOpacity',
        'gradientBlendMode',
      ],
      voiceControls: [
        'pipelineMode',
        'ttsVoice',
        'ttsSpeed',
        'realtimeVoice',
        'sttLanguage',
        'responseLength',
        'emotionalTone',
        'llmModel',
        'sttModel',
        'ttsModel',
        'realtimeModel',
      ],
      enhancementControls: [
        'turnDetectionEnabled',
        'turnDetectionMode',
        'turnDetectionModel',
        'minEndpointingDelay',
        'maxEndpointingDelay',
        'interruptionsEnabled',
        'interruptionDuration',
        'interruptionWords',
        'noiseCancellationEnabled',
        'noiseCancellationMode',
        'vadThreshold',
        'vadMinSpeech',
        'vadMinSilence',
        'echoCancellation',
        'autoGainControl',
        'preemptiveGeneration',
      ],
      memoryUiControls: ['activeTab', 'openGraphView'],
      resettableDomains: [...RESETTABLE_DOMAINS],
      message: t('workspaceAgentTools.listUiMessage'),
    };
  }

  // ---------------------------------------------------------------------------
  // Live browser panel
  // ---------------------------------------------------------------------------

  /**
   * Drive the layout of the live browsing panel.
   *
   * Deliberately does not open or close the browser: the session itself is the
   * agent's own `navigate_to` / `close_navigation`. Opening a page and moving
   * the window that shows it are different things, and folding them together
   * gave the model two ways to do one job and no way to do the other.
   */
  async function setBrowserPanelControl(control: unknown, value: unknown) {
    if (typeof control !== 'string') {
      return { success: false, message: t('workspaceAgentTools.browserControlString') };
    }

    const normalized = normalizeKey(control);

    function result(message: string) {
      actionState.recordAction(
        t('workspaceAgentTools.actionUpdatedBrowserPanel'),
        String(control),
        {
          announce: true,
        },
      );
      return {
        success: true,
        layout: navigationStore.layout,
        rect: { ...navigationStore.floatingRect },
        isOpen: navigationStore.isActive,
        message,
      };
    }

    switch (normalized) {
      case 'layout':
      case 'mode': {
        const layout = typeof value === 'string' ? normalizeKey(value) : '';
        const match = BROWSER_PANEL_LAYOUTS.find((item) => normalizeKey(item) === layout);
        if (!match) {
          return {
            success: false,
            message: t('workspaceAgentTools.browserLayoutInvalid', {
              list: BROWSER_PANEL_LAYOUTS.join(', '),
            }),
          };
        }
        navigationStore.setLayout(match as BrowserPanelLayout);
        return result(t('workspaceAgentTools.browserLayoutSet', { layout: match }));
      }

      case 'expand':
      case 'fullscreen': {
        if (typeof value !== 'boolean') {
          return { success: false, message: t('workspaceAgentTools.browserExpandBool') };
        }
        // Collapsing returns to whatever the panel was before it expanded --
        // the store remembers, so "expand, read this page, put it back" does
        // not quietly dock a panel the user had floating.
        if (value) navigationStore.expandFullscreen();
        else navigationStore.collapseFullscreen();
        return result(
          value
            ? t('workspaceAgentTools.browserExpanded')
            : t('workspaceAgentTools.browserCollapsed'),
        );
      }

      case 'position':
      case 'move': {
        if (!isRecord(value) || typeof value.x !== 'number' || typeof value.y !== 'number') {
          return { success: false, message: t('workspaceAgentTools.browserPositionObject') };
        }
        // Moving implies floating: asking a docked split pane to go to (40, 40)
        // would otherwise report success and visibly do nothing.
        navigationStore.setLayout('floating');
        navigationStore.moveTo(value.x, value.y);
        return result(t('workspaceAgentTools.browserMoved'));
      }

      case 'size':
      case 'resize': {
        if (
          !isRecord(value) ||
          typeof value.width !== 'number' ||
          typeof value.height !== 'number'
        ) {
          return { success: false, message: t('workspaceAgentTools.browserSizeObject') };
        }
        navigationStore.setLayout('floating');
        navigationStore.resizeTo(value.width, value.height);
        return result(t('workspaceAgentTools.browserResized'));
      }

      case 'center':
      case 'centre':
        navigationStore.setLayout('floating');
        navigationStore.centerPanel();
        return result(t('workspaceAgentTools.browserCentered'));

      case 'reset':
        navigationStore.resetLayout();
        return result(t('workspaceAgentTools.browserReset'));

      default:
        return {
          success: false,
          message: t('workspaceAgentTools.unknownBrowserControl', { control }),
        };
    }
  }

  // ---------------------------------------------------------------------------
  // Soul (who the companion is)
  // ---------------------------------------------------------------------------

  /** Sliders in the soul panel run -100..100, not 0..1. */
  const EMOTIONAL_TRAIT_MIN = -100;
  const EMOTIONAL_TRAIT_MAX = 100;

  const EMOTIONAL_TRAITS = [
    'happiness',
    'energy',
    'confidence',
    'calmness',
    'optimism',
    'socialness',
    'patience',
    'empathy',
    'curiosity',
    'creativity',
  ] as const;

  function clampTrait(value: number): number {
    return Math.round(Math.min(EMOTIONAL_TRAIT_MAX, Math.max(EMOTIONAL_TRAIT_MIN, value)));
  }

  /**
   * Edit who the companion is.
   *
   * The soul panel writes six fields; until now the only one any tool could
   * reach was `emotionalTone`, so "call yourself Atlas and be more direct" was
   * a change the user could make by hand and not by voice -- in an app whose
   * whole premise is speaking to it.
   */
  async function setSoulControl(control: unknown, value: unknown, confirm: unknown) {
    if (typeof control !== 'string') {
      return { success: false, message: t('workspaceAgentTools.soulControlString') };
    }

    const normalized = normalizeKey(control);
    const soul = voiceStore.soulConfig;

    function applied(message: string, extra: Record<string, unknown> = {}) {
      syncSoulToAgent();
      actionState.recordAction(t('workspaceAgentTools.actionUpdatedSoul'), String(control), {
        announce: true,
      });
      return { success: true, message, ...extra };
    }

    switch (normalized) {
      case 'name': {
        const name = asString(value).trim();
        if (!name) return { success: false, message: t('workspaceAgentTools.soulNameRequired') };
        soul.name = name.slice(0, 60);
        return applied(t('workspaceAgentTools.soulNameSet', { name: soul.name }));
      }

      case 'personality': {
        const personality = asString(value).trim();
        if (!personality) {
          return { success: false, message: t('workspaceAgentTools.soulPersonalityRequired') };
        }
        soul.personality = personality.slice(0, 2000);
        return applied(t('workspaceAgentTools.soulPersonalitySet'));
      }

      case 'systemprompt': {
        // The system prompt is the whole instruction set, not one setting.
        // Overwriting it by voice on a misheard sentence would replace the
        // companion wholesale, so it is confirmed like a destructive action.
        const prompt = asString(value);
        const approved = await confirmIfNeeded(
          true,
          confirm,
          t('workspaceAgentTools.confirmSystemPromptTitle'),
          t('workspaceAgentTools.confirmSystemPromptBody'),
        );
        if (!approved) {
          return {
            success: false,
            cancelled: true,
            message: t('workspaceAgentTools.soulSystemPromptCancelled'),
          };
        }
        soul.systemPrompt = prompt.slice(0, 8000);
        return applied(t('workspaceAgentTools.soulSystemPromptSet'));
      }

      case 'conversationstyle': {
        const style = asString(value).trim();
        if (!style) return { success: false, message: t('workspaceAgentTools.soulStyleRequired') };
        soul.conversationStyle = style.slice(0, 40);
        return applied(t('workspaceAgentTools.soulStyleSet', { style: soul.conversationStyle }));
      }

      case 'language': {
        const language = asString(value).trim().toLowerCase();
        if (!language) {
          return { success: false, message: t('workspaceAgentTools.soulLanguageRequired') };
        }
        soul.language = language;
        return applied(t('workspaceAgentTools.soulLanguageSet', { language }));
      }

      case 'traits': {
        if (!Array.isArray(value)) {
          return { success: false, message: t('workspaceAgentTools.soulTraitsArray') };
        }
        const traits = value
          .map((item) => asString(item).trim())
          .filter(Boolean)
          .slice(0, 12);
        soul.traits = traits;
        return applied(t('workspaceAgentTools.soulTraitsSet', { count: traits.length }), {
          traits,
        });
      }

      case 'emotionaltraits': {
        if (!isRecord(value)) {
          return {
            success: false,
            message: t('workspaceAgentTools.soulEmotionalTraitsObject', {
              list: EMOTIONAL_TRAITS.join(', '),
            }),
          };
        }
        const unknown: string[] = [];
        const updated: string[] = [];
        for (const [key, raw] of Object.entries(value)) {
          const trait = EMOTIONAL_TRAITS.find((name) => normalizeKey(name) === normalizeKey(key));
          if (!trait) {
            unknown.push(key);
            continue;
          }
          if (typeof raw !== 'number' || !Number.isFinite(raw)) continue;
          soul.emotionalTraits[trait] = clampTrait(raw);
          updated.push(trait);
        }
        if (!updated.length) {
          return {
            success: false,
            message: t('workspaceAgentTools.soulEmotionalTraitsNone', {
              list: EMOTIONAL_TRAITS.join(', '),
            }),
          };
        }
        return applied(
          t('workspaceAgentTools.soulEmotionalTraitsSet', { traits: updated.join(', ') }),
          { updated, unknown },
        );
      }

      case 'emotionaltone':
      case 'responselength':
        // Both already have a home in the voice domain; route rather than
        // duplicate, so the two paths cannot drift apart.
        return setVoiceControl(control, value, confirm);

      default:
        return {
          success: false,
          message: t('workspaceAgentTools.unknownSoulControl', { control }),
        };
    }
  }

  async function getSoulProfile() {
    const soul = voiceStore.soulConfig;
    return {
      success: true,
      soul: {
        name: soul.name,
        personality: soul.personality,
        conversationStyle: soul.conversationStyle,
        responseLength: soul.responseLength,
        emotionalTone: soul.emotionalTone,
        language: soul.language,
        traits: [...soul.traits],
        emotionalTraits: { ...soul.emotionalTraits },
        hasCustomSystemPrompt: Boolean(soul.systemPrompt),
      },
      message: t('workspaceAgentTools.soulProfile', {
        name: soul.name,
        style: soul.conversationStyle,
        tone: soul.emotionalTone,
      }),
    };
  }

  async function listSoulPresets(category: unknown) {
    const wanted = normalizeKey(asString(category));
    const matching =
      wanted && wanted !== 'all'
        ? soulPresets.filter((preset) => normalizeKey(preset.category ?? '') === wanted)
        : soulPresets;

    return {
      success: true,
      categories: [...new Set(soulPresets.map((preset) => preset.category).filter(Boolean))],
      presets: matching.map((preset) => ({ name: preset.name, category: preset.category })),
      message: t('workspaceAgentTools.soulPresetsListed', { count: matching.length }),
    };
  }

  /**
   * Replace the companion's personality with a bundled preset.
   *
   * Confirmed, because it overwrites name, personality, system prompt, traits,
   * style, length, tone and all ten emotional traits at once -- everything the
   * user may have tuned by hand.
   */
  async function applySoulPreset(name: unknown, confirm: unknown) {
    const wanted = normalizeKey(asString(name));
    if (!wanted) {
      return { success: false, message: t('workspaceAgentTools.soulPresetNameRequired') };
    }

    const preset =
      soulPresets.find(
        (item) => normalizeKey(item.id) === wanted || normalizeKey(item.name) === wanted,
      ) ?? soulPresets.find((item) => normalizeKey(item.name).includes(wanted));

    if (!preset) {
      return {
        success: false,
        message: t('workspaceAgentTools.soulPresetUnknown', {
          name: asString(name),
          list: soulPresets
            .slice(0, 8)
            .map((item) => item.name)
            .join(', '),
        }),
      };
    }

    const approved = await confirmIfNeeded(
      true,
      confirm,
      t('workspaceAgentTools.confirmSoulPresetTitle'),
      t('workspaceAgentTools.confirmSoulPresetBody', { name: preset.name }),
    );
    if (!approved) {
      return {
        success: false,
        cancelled: true,
        message: t('workspaceAgentTools.soulPresetCancelled', { name: preset.name }),
      };
    }

    const soul = voiceStore.soulConfig;
    soul.name = preset.name;
    soul.personality = preset.personality ?? soul.personality;
    soul.systemPrompt = preset.systemPrompt ?? soul.systemPrompt;
    soul.traits = [...(preset.traits ?? [])];
    soul.conversationStyle = preset.conversationStyle ?? soul.conversationStyle;
    if (preset.responseLength) soul.responseLength = preset.responseLength as ResponseLength;
    if (preset.emotionalTone) {
      soul.emotionalTone = preset.emotionalTone as typeof soul.emotionalTone;
    }
    if (preset.emotionalTraits) {
      Object.assign(soul.emotionalTraits, preset.emotionalTraits);
    }

    syncSoulToAgent();
    actionState.recordAction(t('workspaceAgentTools.actionAppliedSoulPreset'), preset.name, {
      announce: true,
    });
    return {
      success: true,
      preset: preset.name,
      message: t('workspaceAgentTools.soulPresetApplied', { name: preset.name }),
    };
  }

  // ---------------------------------------------------------------------------
  // Soundtrack
  // ---------------------------------------------------------------------------

  const SOUNDTRACK_ACTIONS = ['play', 'pause', 'toggle', 'next', 'stop', 'status'] as const;

  /**
   * Playback state does not settle synchronously: `play()` resumes an
   * AudioContext and starts a fade, so reading `isPlaying` on the next line
   * reports the state we just left. Poll briefly instead of guessing.
   */
  async function settledPlayback(
    isPlaying: { value: boolean },
    expected: boolean,
    timeoutMs = 800,
  ): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (isPlaying.value === expected) return true;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return isPlaying.value === expected;
  }

  /**
   * Control the built-in music crate.
   *
   * Deliberately reports what actually happened rather than that the call was
   * made. Browsers only let an AudioContext resume from a real user gesture, so
   * on a cold page "play some music" can silently do nothing -- and a tool that
   * answers "playing" over silence reads as the agent lying about the world.
   */
  async function controlSoundtrack(action: unknown, volume: unknown) {
    const normalized = normalizeKey(asString(action)) || 'status';

    // Built on first use, and it reaches useKwami(), which needs Pinia
    // installed -- so resolve it here rather than at module scope.
    const { useWorkspaceSoundtrack } = await import('@/composables/useSoundtrack');
    const { soundtrack, level } = useWorkspaceSoundtrack();

    function describe(message: string, extra: Record<string, unknown> = {}) {
      const track = soundtrack.currentTrack.value;
      return {
        success: true,
        isPlaying: soundtrack.isPlaying.value,
        track: track ? { title: track.title, artist: track.artist } : null,
        volume: Number(level.value.toFixed(2)),
        message,
        ...extra,
      };
    }

    if (typeof volume === 'number' && Number.isFinite(volume)) {
      // Accept both 0-1 and 0-100, because "turn it up to 40" is as likely as
      // a normalised value and 40 would otherwise pin the volume at maximum.
      const normalizedVolume = volume > 1 ? volume / 100 : volume;
      level.value = Math.min(1, Math.max(0, normalizedVolume));
      if (normalized === 'status' || normalized === 'volume') {
        actionState.recordAction(t('workspaceAgentTools.actionSetVolume'), String(level.value), {
          announce: true,
        });
        return describe(
          t('workspaceAgentTools.soundtrackVolume', { percent: Math.round(level.value * 100) }),
        );
      }
    } else if (normalized === 'volume') {
      return { success: false, message: t('workspaceAgentTools.soundtrackVolumeNumber') };
    }

    switch (normalized) {
      case 'play':
      case 'resume': {
        if (soundtrack.isPlaying.value) {
          return describe(t('workspaceAgentTools.soundtrackAlreadyPlaying'));
        }
        soundtrack.toggle();
        const started = await settledPlayback(soundtrack.isPlaying, true);
        actionState.recordAction(t('workspaceAgentTools.actionPlayedMusic'), undefined, {
          announce: true,
        });
        return started
          ? describe(t('workspaceAgentTools.soundtrackPlaying'))
          : {
              ...describe(t('workspaceAgentTools.soundtrackBlocked')),
              success: false,
            };
      }

      case 'pause': {
        if (!soundtrack.isPlaying.value) {
          return describe(t('workspaceAgentTools.soundtrackAlreadyPaused'));
        }
        soundtrack.toggle();
        await settledPlayback(soundtrack.isPlaying, false);
        return describe(t('workspaceAgentTools.soundtrackPaused'));
      }

      case 'toggle': {
        const wasPlaying = soundtrack.isPlaying.value;
        soundtrack.toggle();
        await settledPlayback(soundtrack.isPlaying, !wasPlaying);
        return describe(
          soundtrack.isPlaying.value
            ? t('workspaceAgentTools.soundtrackPlaying')
            : t('workspaceAgentTools.soundtrackPaused'),
        );
      }

      case 'next':
      case 'skip': {
        soundtrack.next();
        await settledPlayback(soundtrack.isPlaying, true);
        actionState.recordAction(t('workspaceAgentTools.actionSkippedTrack'), undefined, {
          announce: true,
        });
        return describe(t('workspaceAgentTools.soundtrackSkipped'));
      }

      case 'stop': {
        soundtrack.stop();
        await settledPlayback(soundtrack.isPlaying, false);
        return describe(t('workspaceAgentTools.soundtrackStopped'));
      }

      case 'status':
        return describe(
          soundtrack.isPlaying.value
            ? t('workspaceAgentTools.soundtrackPlaying')
            : t('workspaceAgentTools.soundtrackIdle'),
        );

      default:
        return {
          success: false,
          message: t('workspaceAgentTools.unknownSoundtrackAction', {
            action: asString(action),
            list: SOUNDTRACK_ACTIONS.join(', '),
          }),
        };
    }
  }

  // ---------------------------------------------------------------------------
  // Scene presets
  // ---------------------------------------------------------------------------

  const SCENE_PRESET_KINDS = ['image', 'video', 'hdri'] as const;
  type ScenePresetKind = (typeof SCENE_PRESET_KINDS)[number];

  function scenePresetsFor(kind: ScenePresetKind): { id: string; name: string; url: string }[] {
    if (kind === 'image') return sceneImagePresets;
    if (kind === 'video') return sceneVideoPresets;
    return sceneHdriPresets.map(({ id, name, url }) => ({ id, name, url }));
  }

  function normalizeSceneKind(kind: unknown): ScenePresetKind | null {
    const normalized = normalizeKey(asString(kind));
    if (normalized === 'image' || normalized === 'photo' || normalized === 'picture')
      return 'image';
    if (normalized === 'video' || normalized === 'movie' || normalized === 'clip') return 'video';
    if (normalized === 'hdri' || normalized === 'environment' || normalized === 'hdr')
      return 'hdri';
    return null;
  }

  /**
   * List the backgrounds that ship with the app.
   *
   * `set_scene_control` only ever accepted raw URLs, which the model has no way
   * to produce -- it cannot invent a Poly Haven asset path. So every "put a
   * forest behind you" either failed or hallucinated a dead URL, even though
   * the app has had a curated set the whole time.
   */
  async function listScenePresets(kind: unknown) {
    const requested =
      kind === undefined || kind === null || normalizeKey(asString(kind)) === 'all'
        ? [...SCENE_PRESET_KINDS]
        : [normalizeSceneKind(kind)].filter(
            Boolean as unknown as (k: ScenePresetKind | null) => k is ScenePresetKind,
          );

    if (!requested.length) {
      return {
        success: false,
        message: t('workspaceAgentTools.scenePresetKindInvalid', {
          list: SCENE_PRESET_KINDS.join(', '),
        }),
      };
    }

    const presets = Object.fromEntries(
      requested.map((k) => [k, scenePresetsFor(k).map((p) => p.name)]),
    );
    return {
      success: true,
      presets,
      message: t('workspaceAgentTools.scenePresetsListed', {
        count: Object.values(presets).reduce((sum, list) => sum + list.length, 0),
      }),
    };
  }

  async function applyScenePreset(kind: unknown, name: unknown) {
    const resolvedKind = normalizeSceneKind(kind);
    if (!resolvedKind) {
      return {
        success: false,
        message: t('workspaceAgentTools.scenePresetKindInvalid', {
          list: SCENE_PRESET_KINDS.join(', '),
        }),
      };
    }

    const wanted = normalizeKey(asString(name));
    if (!wanted) {
      return { success: false, message: t('workspaceAgentTools.scenePresetNameRequired') };
    }

    const presets = scenePresetsFor(resolvedKind);
    // Exact id or name first, then a contains match, so "waterfall" finds
    // "Beautiful Waterfall Panoramic" without "forest" matching everything.
    const preset =
      presets.find((p) => normalizeKey(p.id) === wanted || normalizeKey(p.name) === wanted) ??
      presets.find((p) => normalizeKey(p.name).includes(wanted));

    if (!preset) {
      return {
        success: false,
        message: t('workspaceAgentTools.scenePresetUnknown', {
          name: asString(name),
          list: presets
            .slice(0, 8)
            .map((p) => p.name)
            .join(', '),
        }),
      };
    }

    if (resolvedKind === 'image') {
      sceneStore.setImageUrl(preset.url);
    } else if (resolvedKind === 'video') {
      sceneStore.setVideoUrl(preset.url);
    } else {
      sceneStore.setHdriUrl(preset.url);
    }
    // Setting the URL alone changes nothing on screen unless the background is
    // actually showing that medium.
    sceneStore.setMediaType(resolvedKind);

    actionState.recordAction(t('workspaceAgentTools.actionAppliedScenePreset'), preset.name, {
      announce: true,
    });
    return {
      success: true,
      kind: resolvedKind,
      preset: preset.name,
      message: t('workspaceAgentTools.scenePresetApplied', { name: preset.name }),
    };
  }

  // ---------------------------------------------------------------------------
  // Kwami profiles
  // ---------------------------------------------------------------------------

  async function listKwamiProfiles() {
    const profiles = workspaceStore.workspaces.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      active: workspace.id === workspaceStore.activeWorkspaceId,
    }));
    return {
      success: true,
      profiles,
      message: profiles.length
        ? t('workspaceAgentTools.profilesListed', {
            names: profiles.map((p) => p.name).join(', '),
          })
        : t('workspaceAgentTools.profilesNone'),
    };
  }

  /**
   * Switch the active kwami.
   *
   * Confirmation-gated because this is not a single setting: it swaps avatar,
   * voice, scene, theme and telephony config together, and any unsaved edits to
   * the current one are only held in the local draft.
   */
  async function switchKwamiProfile(nameOrId: unknown, confirm: unknown) {
    const wanted = normalizeKey(asString(nameOrId));
    if (!wanted) {
      return { success: false, message: t('workspaceAgentTools.profileNameRequired') };
    }

    const match =
      workspaceStore.workspaces.find(
        (w) => normalizeKey(w.id) === wanted || normalizeKey(w.name) === wanted,
      ) ?? workspaceStore.workspaces.find((w) => normalizeKey(w.name).includes(wanted));

    if (!match) {
      return {
        success: false,
        message: t('workspaceAgentTools.profileUnknown', {
          name: asString(nameOrId),
          list: workspaceStore.workspaces.map((w) => w.name).join(', '),
        }),
      };
    }

    if (match.id === workspaceStore.activeWorkspaceId) {
      return {
        success: true,
        message: t('workspaceAgentTools.profileAlreadyActive', { name: match.name }),
      };
    }

    const approved = await confirmIfNeeded(
      true,
      confirm,
      t('workspaceAgentTools.confirmProfileTitle'),
      t('workspaceAgentTools.confirmProfileBody', { name: match.name }),
    );
    if (!approved) {
      return {
        success: false,
        cancelled: true,
        message: t('workspaceAgentTools.profileSwitchCancelled', { name: match.name }),
      };
    }

    // Goes through the config sync rather than workspaceStore.setActive so the
    // outgoing kwami's draft is saved first; setActive on its own discards it.
    switchToKwami(match.id);
    actionState.recordAction(t('workspaceAgentTools.actionSwitchedProfile'), match.name, {
      announce: true,
    });
    return {
      success: true,
      profile: match.name,
      message: t('workspaceAgentTools.profileSwitched', { name: match.name }),
    };
  }

  async function setUiControl(domain: unknown, control: unknown, value: unknown, confirm: unknown) {
    const normalizedDomain = normalizeDomain(domain);
    if (!normalizedDomain) {
      return {
        success: false,
        message: t('workspaceAgentTools.unknownUiDomain', {
          domain: String(domain),
          supported: UI_CONTROL_DOMAINS.join(', '),
        }),
      };
    }

    if (typeof control !== 'string') {
      return {
        success: false,
        message: t('workspaceAgentTools.uiControlNameString'),
      };
    }

    const normalizedControl = normalizeKey(control);

    if (normalizedDomain === 'workspace') {
      if (normalizedControl === 'openpanel') return openPanel(value);
      if (normalizedControl === 'closepanel') return closePanel();
      if (normalizedControl === 'focustranscription') return openPanel('history');
      if (normalizedControl === 'renderer') return setRenderer(value);
      if (normalizedControl === 'responselength') return setResponseLength(value, confirm);
      if (normalizedControl === 'status') return showWorkspaceStatus();
      if (normalizedControl === 'listcontrols') return listUiControls();
      return {
        success: false,
        message: t('workspaceAgentTools.workspaceControlsHint'),
      };
    }

    if (normalizedDomain === 'panel') {
      return setPanelControl(
        normalizedControl === 'openpanel' ? 'activePanel' : control,
        normalizedControl === 'openpanel' ? value : value,
      );
    }

    if (normalizedDomain === 'theme') {
      return setThemeControl(control, value);
    }

    if (normalizedDomain === 'avatar') {
      return setAvatarControl(control, value);
    }

    if (normalizedDomain === 'scene') {
      return setSceneControl(control, value);
    }

    if (normalizedDomain === 'browser') {
      return setBrowserPanelControl(control, value);
    }

    if (normalizedDomain === 'soul') {
      return setSoulControl(control, value, confirm);
    }

    if (normalizedDomain === 'voice') {
      return setVoiceControl(control, value, confirm);
    }

    if (normalizedDomain === 'enhancements') {
      return setEnhancementControl(control, value);
    }

    if (normalizedDomain === 'memory') {
      return setMemoryUiControl(control, value);
    }

    if (normalizedDomain === 'search') {
      if (normalizedControl === 'clear' || normalizedControl === 'clearresults') {
        return clearSearchResults();
      }
      return {
        success: false,
        message: t('workspaceAgentTools.searchControlsHint'),
      };
    }

    return {
      success: false,
      message: t('workspaceAgentTools.unsupportedUiDomain', { domain: normalizedDomain }),
    };
  }

  function registerTools(instance: Kwami) {
    // Every `use*AgentTools` composable must be registered here, or its tools
    // are unreachable: they exist, they are translated, their unit tests pass,
    // and the model is never told they exist. Recall, admin and extras — 19
    // tools — sat in exactly that state, green in CI and invisible, until this
    // line was added. `toolRegistrars.test.ts` now fails if a composable is
    // added without being wired in below.
    searchPanelTools.registerSearchPanelTools(instance);
    commsTools.registerCommsTools(instance);
    localeTools.registerLocaleTools(instance);
    recallTools.registerRecallTools(instance);
    kwamiAdminTools.registerKwamiAdminTools(instance);
    extrasTools.registerWorkspaceExtrasTools(instance);

    instance.registerTool({
      name: 'set_ui_control',
      description: t('workspaceAgentTools.toolDescSetUiControl'),
      parameters: {
        domain: {
          type: 'string',
          enum: [...UI_CONTROL_DOMAINS],
        },
        control: {
          type: 'string',
        },
        value: {},
        confirm: {
          type: 'boolean',
        },
      },
      handler: async ({ domain, control, value, confirm }) =>
        setUiControl(domain, control, value, confirm),
    });

    instance.registerTool({
      name: 'open_workspace_panel',
      description: t('workspaceAgentTools.toolDescOpenWorkspacePanel'),
      parameters: { panelName: { type: 'string', enum: [...WORKSPACE_PANELS] } },
      handler: async ({ panelName }) => openPanel(panelName),
    });

    instance.registerTool({
      name: 'close_workspace_panel',
      description: t('workspaceAgentTools.toolDescCloseWorkspacePanel'),
      handler: async () => closePanel(),
    });

    instance.registerTool({
      name: 'focus_transcription_panel',
      description: t('workspaceAgentTools.toolDescFocusTranscription'),
      handler: async () => openPanel('history'),
    });

    instance.registerTool({
      name: 'set_panel_control',
      description: t('workspaceAgentTools.toolDescSetPanelControl'),
      parameters: {
        control: { type: 'string', enum: ['activePanel', 'isOpen', 'sizePreset'] },
        value: { type: 'string' },
      },
      handler: async ({ control, value }) => setPanelControl(control, value),
    });

    instance.registerTool({
      name: 'set_theme_control',
      description: t('workspaceAgentTools.toolDescSetThemeControl'),
      parameters: {
        control: { type: 'string' },
        value: {},
      },
      handler: async ({ control, value }) => setThemeControl(control, value),
    });

    instance.registerTool({
      name: 'set_avatar_control',
      description: t('workspaceAgentTools.toolDescSetAvatarControl'),
      parameters: {
        control: { type: 'string' },
        value: {},
      },
      handler: async ({ control, value }) => setAvatarControl(control, value),
    });

    instance.registerTool({
      name: 'set_scene_control',
      description: t('workspaceAgentTools.toolDescSetSceneControl'),
      parameters: {
        control: { type: 'string' },
        value: {},
      },
      handler: async ({ control, value }) => setSceneControl(control, value),
    });

    instance.registerTool({
      name: 'set_voice_control',
      description: t('workspaceAgentTools.toolDescSetVoiceControl'),
      parameters: {
        control: { type: 'string' },
        value: {},
        confirm: { type: 'boolean' },
      },
      handler: async ({ control, value, confirm }) => setVoiceControl(control, value, confirm),
    });

    instance.registerTool({
      name: 'set_enhancement_control',
      description: t('workspaceAgentTools.toolDescSetEnhancementControl'),
      parameters: {
        control: { type: 'string' },
        value: {},
      },
      handler: async ({ control, value }) => setEnhancementControl(control, value),
    });

    instance.registerTool({
      name: 'set_memory_ui_control',
      description: t('workspaceAgentTools.toolDescSetMemoryUi'),
      parameters: {
        control: {
          type: 'string',
          enum: ['activeTab', 'openGraphView', 'knowledgeGraph', 'graphView'],
        },
        value: {},
      },
      handler: async ({ control, value }) => setMemoryUiControl(control, value),
    });

    instance.registerTool({
      name: 'set_workspace_renderer',
      description: t('workspaceAgentTools.toolDescSetRenderer'),
      parameters: {
        renderer: { type: 'string', enum: [...AVATAR_RENDERERS] },
      },
      handler: async ({ renderer }) => setRenderer(renderer),
    });

    instance.registerTool({
      name: 'set_browser_panel',
      description: t('workspaceAgentTools.toolDescSetBrowserPanel'),
      parameters: {
        control: {
          type: 'string',
          enum: ['layout', 'expand', 'position', 'size', 'center', 'reset'],
        },
        value: {},
      },
      handler: async ({ control, value }) => setBrowserPanelControl(control, value),
    });

    instance.registerTool({
      name: 'set_soul_control',
      description: t('workspaceAgentTools.toolDescSetSoulControl'),
      parameters: {
        control: {
          type: 'string',
          enum: [
            'name',
            'personality',
            'systemPrompt',
            'conversationStyle',
            'language',
            'traits',
            'emotionalTraits',
            'emotionalTone',
            'responseLength',
          ],
        },
        value: {},
        confirm: { type: 'boolean' },
      },
      handler: async ({ control, value, confirm }) => setSoulControl(control, value, confirm),
    });

    instance.registerTool({
      name: 'get_soul_profile',
      description: t('workspaceAgentTools.toolDescGetSoulProfile'),
      handler: async () => getSoulProfile(),
    });

    instance.registerTool({
      name: 'list_soul_presets',
      description: t('workspaceAgentTools.toolDescListSoulPresets'),
      parameters: { category: { type: 'string' } },
      handler: async ({ category }) => listSoulPresets(category),
    });

    instance.registerTool({
      name: 'apply_soul_preset',
      description: t('workspaceAgentTools.toolDescApplySoulPreset'),
      parameters: {
        name: { type: 'string' },
        confirm: { type: 'boolean' },
      },
      handler: async ({ name, confirm }) => applySoulPreset(name, confirm),
    });

    instance.registerTool({
      name: 'control_soundtrack',
      description: t('workspaceAgentTools.toolDescControlSoundtrack'),
      parameters: {
        action: { type: 'string', enum: [...SOUNDTRACK_ACTIONS, 'volume'] },
        volume: { type: 'number' },
      },
      handler: async ({ action, volume }) => controlSoundtrack(action, volume),
    });

    instance.registerTool({
      name: 'list_scene_presets',
      description: t('workspaceAgentTools.toolDescListScenePresets'),
      parameters: {
        kind: { type: 'string', enum: ['image', 'video', 'hdri', 'all'] },
      },
      handler: async ({ kind }) => listScenePresets(kind),
    });

    instance.registerTool({
      name: 'apply_scene_preset',
      description: t('workspaceAgentTools.toolDescApplyScenePreset'),
      parameters: {
        kind: { type: 'string', enum: ['image', 'video', 'hdri'] },
        name: { type: 'string' },
      },
      handler: async ({ kind, name }) => applyScenePreset(kind, name),
    });

    instance.registerTool({
      name: 'list_kwami_profiles',
      description: t('workspaceAgentTools.toolDescListKwamiProfiles'),
      handler: async () => listKwamiProfiles(),
    });

    instance.registerTool({
      name: 'switch_kwami_profile',
      description: t('workspaceAgentTools.toolDescSwitchKwamiProfile'),
      parameters: {
        name: { type: 'string' },
        confirm: { type: 'boolean' },
      },
      handler: async ({ name, confirm }) => switchKwamiProfile(name, confirm),
    });

    instance.registerTool({
      name: 'set_response_length',
      description: t('workspaceAgentTools.toolDescSetResponseLength'),
      parameters: {
        length: { type: 'string', enum: ['short', 'medium', 'long'] },
        confirm: { type: 'boolean' },
      },
      handler: async ({ length, confirm }) => setResponseLength(length, confirm),
    });

    instance.registerTool({
      name: 'clear_search_results',
      description: t('workspaceAgentTools.toolDescClearSearch'),
      handler: async () => clearSearchResults(),
    });

    instance.registerTool({
      name: 'reset_ui_domain',
      description: t('workspaceAgentTools.toolDescResetUiDomain'),
      parameters: {
        domain: { type: 'string', enum: [...RESETTABLE_DOMAINS] },
        confirm: { type: 'boolean' },
      },
      handler: async ({ domain, confirm }) => resetUiDomain(domain, confirm),
    });

    instance.registerTool({
      name: 'list_ui_controls',
      description: t('workspaceAgentTools.toolDescListUiControls'),
      handler: async () => listUiControls(),
    });

    instance.registerTool({
      name: 'show_workspace_status',
      description: t('workspaceAgentTools.toolDescShowWorkspaceStatus'),
      handler: async () => showWorkspaceStatus(),
    });

    // ---- Email Smart Hub tools ----
    const emailStore = useEmailStore();
    const calendarStore = useCalendarStore();
    let _lastEmailListing: { id: string; from_address: string; subject: string }[] = [];

    function _resolveRef(
      rawRef: unknown,
    ): { id: string; from_address: string; subject: string } | null {
      const ref = asString(rawRef).trim();
      if (!ref) return null;
      const num = parseInt(ref, 10);
      if (!isNaN(num) && num >= 1 && num <= _lastEmailListing.length) {
        return _lastEmailListing[num - 1] ?? null;
      }
      if (ref.includes('-')) {
        return (
          _lastEmailListing.find((m) => m.id === ref) ?? { id: ref, from_address: '', subject: '' }
        );
      }
      return null;
    }

    instance.registerTool({
      name: 'read_emails',
      description: t('workspaceAgentTools.toolDescReadEmails'),
      parameters: {
        category: {
          type: 'string',
          enum: [
            'all',
            'travel',
            'bills',
            'events',
            'newsletters',
            'personal',
            'notifications',
            'shopping',
            'work',
          ],
        },
      },
      handler: async ({ category }) => {
        if (!emailStore.isActivated) return 'Email is not activated for this kwami.';
        // The store has no queryInbox(); fetchInbox() populates `messages`.
        const cat = asString(category, 'all') as EmailCategory;
        await emailStore.fetchInbox(cat);
        const msgs = emailStore.messages.slice(0, 10);
        _lastEmailListing = msgs.map((m) => ({
          id: m.id,
          from_address: m.from_address,
          subject: m.subject,
        }));
        if (msgs.length === 0) return `No ${cat !== 'all' ? cat + ' ' : ''}emails found.`;
        return (
          msgs
            .map(
              (m, i) =>
                `${i + 1}. [${m.is_read ? 'read' : 'UNREAD'}] From: ${m.from_address} | Subject: ${m.subject || '(no subject)'} | Category: ${m.category}`,
            )
            .join('\n') + '\n\nUse the number (1, 2, 3...) to reference an email in other tools.'
        );
      },
    });

    instance.registerTool({
      name: 'read_email_detail',
      description: t('workspaceAgentTools.toolDescReadEmailDetail'),
      parameters: {
        email_ref: { type: 'string' },
      },
      handler: async ({ email_ref }) => {
        const ref = _resolveRef(email_ref);
        if (!ref)
          return 'Invalid email reference. Use a number from the last listing (e.g. "1") or a message ID.';
        try {
          const msg = await emailStore.fetchMessage(ref.id);
          emailStore.markRead(ref.id);
          return `ID: ${msg.id}\nFrom: ${msg.from_address}\nTo: ${msg.to_addresses.join(', ')}\nSubject: ${msg.subject}\nDate: ${msg.received_at}\nCategory: ${msg.category}\n\n${msg.body_text.slice(0, 2000)}`;
        } catch {
          return 'Message not found.';
        }
      },
    });

    instance.registerTool({
      name: 'reply_to_email',
      description: t('workspaceAgentTools.toolDescReplyToEmail'),
      parameters: {
        email_ref: { type: 'string' },
        body: { type: 'string' },
        confirm: { type: 'boolean' },
      },
      handler: async ({ email_ref, body, confirm }) => {
        if (!confirm) return t('workspaceAgentTools.confirmRequired');
        const ref = _resolveRef(email_ref);
        if (!ref)
          return 'Invalid email reference. Use a number from the last listing (e.g. "1") or a message ID.';
        const replyTo = ref.from_address || (await emailStore.fetchMessage(ref.id))?.from_address;
        const replySubject = ref.subject || '';
        if (!replyTo) return 'Message not found. Try calling read_emails first.';
        try {
          await emailStore.sendEmail({
            to: [replyTo],
            subject: replySubject.startsWith('Re:') ? replySubject : `Re: ${replySubject}`,
            bodyText: asString(body),
          });
          void emailStore.refreshInbox();
          return `Reply sent to ${replyTo}.`;
        } catch (e: unknown) {
          return `Failed to send reply: ${getErrorMessage(e)}`;
        }
      },
    });

    instance.registerTool({
      name: 'send_email',
      description: t('workspaceAgentTools.toolDescSendEmail'),
      parameters: {
        to: { type: 'string' },
        subject: { type: 'string' },
        body: { type: 'string' },
        confirm: { type: 'boolean' },
      },
      handler: async ({ to, subject, body, confirm }) => {
        if (!emailStore.isActivated) return 'Email is not activated for this kwami.';
        if (!confirm) return t('workspaceAgentTools.confirmRequired');
        const toList = asString(to)
          .split(/[,;]\s*/)
          .map((a) => a.trim())
          .filter(Boolean);
        if (toList.length === 0) return 'No recipient provided.';
        try {
          await emailStore.sendEmail({
            to: toList,
            subject: asString(subject),
            bodyText: asString(body),
          });
          void emailStore.refreshInbox();
          return `Email sent to ${toList.join(', ')}.`;
        } catch (e: unknown) {
          return `Failed to send email: ${getErrorMessage(e)}`;
        }
      },
    });

    instance.registerTool({
      name: 'archive_email',
      description: t('workspaceAgentTools.toolDescArchiveEmail'),
      parameters: {
        email_ref: { type: 'string' },
      },
      handler: async ({ email_ref }) => {
        const ref = _resolveRef(email_ref);
        if (!ref)
          return 'Invalid email reference. Use a number from the last listing (e.g. "1") or a message ID.';
        try {
          await emailStore.archiveMessage(ref.id);
          return 'Email archived.';
        } catch {
          return 'Failed to archive email.';
        }
      },
    });

    instance.registerTool({
      name: 'check_email_status',
      description: t('workspaceAgentTools.toolDescCheckEmailStatus'),
      handler: async () => {
        if (!emailStore.isActivated) return 'Email is not activated for this kwami.';
        await emailStore.fetchUnreadCounts();
        const counts = emailStore.unreadCounts;
        const total = emailStore.totalUnread;
        if (total === 0) return 'No unread emails.';
        const breakdown = Object.entries(counts)
          .filter(([, c]) => c > 0)
          .map(([cat, c]) => `${cat}: ${c}`)
          .join(', ');
        return `${total} unread email(s). ${breakdown}`;
      },
    });

    // ---- Calendar tools ----
    instance.registerTool({
      name: 'list_calendar_events',
      description: t('workspaceAgentTools.toolDescListCalendarEvents'),
      parameters: {
        range_start: { type: 'string' },
        range_end: { type: 'string' },
      },
      handler: async ({ range_start, range_end }) => {
        try {
          const start = typeof range_start === 'string' ? range_start : new Date().toISOString();
          const end =
            typeof range_end === 'string'
              ? range_end
              : new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
          const events = await calendarStore.fetchEvents(start, end);
          if (events.length === 0) return t('workspaceAgentTools.calendarNoEvents');
          return events
            .map(
              (event, index) =>
                `${index + 1}. ${event.title} | ${event.starts_at} -> ${event.ends_at} | ${event.event_type} | ${event.id}`,
            )
            .join('\n');
        } catch (e: unknown) {
          return `${t('workspaceAgentTools.calendarListFailed')}: ${getErrorMessage(e)}`;
        }
      },
    });

    instance.registerTool({
      name: 'create_calendar_event',
      description: t('workspaceAgentTools.toolDescCreateCalendarEvent'),
      parameters: {
        title: { type: 'string' },
        starts_at: { type: 'string' },
        ends_at: { type: 'string' },
        event_type: {
          type: 'string',
          enum: ['meeting', 'task', 'personal', 'reminder', 'focus', 'other'],
        },
        color: { type: 'string' },
        location: { type: 'string' },
        description: { type: 'string' },
        confirm: { type: 'boolean' },
      },
      handler: async ({
        title,
        starts_at,
        ends_at,
        event_type,
        color,
        location,
        description,
        confirm,
      }) => {
        if (!confirm) return t('workspaceAgentTools.confirmRequired');
        try {
          const created = await calendarStore.createEvent({
            title: typeof title === 'string' ? title : '',
            starts_at: typeof starts_at === 'string' ? starts_at : '',
            ends_at: typeof ends_at === 'string' ? ends_at : '',
            event_type: (typeof event_type === 'string'
              ? event_type
              : 'other') as CalendarEventType,
            color: typeof color === 'string' ? color : '#6366f1',
            location: typeof location === 'string' ? location : '',
            description: typeof description === 'string' ? description : '',
          });
          return t('workspaceAgentTools.calendarCreated', { title: created.title, id: created.id });
        } catch (e: unknown) {
          return `${t('workspaceAgentTools.calendarCreateFailed')}: ${getErrorMessage(e)}`;
        }
      },
    });

    instance.registerTool({
      name: 'update_calendar_event',
      description: t('workspaceAgentTools.toolDescUpdateCalendarEvent'),
      parameters: {
        event_id: { type: 'string' },
        title: { type: 'string' },
        starts_at: { type: 'string' },
        ends_at: { type: 'string' },
        event_type: {
          type: 'string',
          enum: ['meeting', 'task', 'personal', 'reminder', 'focus', 'other'],
        },
        color: { type: 'string' },
        location: { type: 'string' },
        description: { type: 'string' },
        confirm: { type: 'boolean' },
      },
      handler: async ({
        event_id,
        title,
        starts_at,
        ends_at,
        event_type,
        color,
        location,
        description,
        confirm,
      }) => {
        if (!confirm) return t('workspaceAgentTools.confirmRequired');
        if (typeof event_id !== 'string' || !event_id.trim())
          return t('workspaceAgentTools.calendarEventIdRequired');
        try {
          const updated = await calendarStore.updateEvent(event_id, {
            ...(typeof title === 'string' ? { title } : {}),
            ...(typeof starts_at === 'string' ? { starts_at } : {}),
            ...(typeof ends_at === 'string' ? { ends_at } : {}),
            ...(typeof event_type === 'string'
              ? { event_type: event_type as CalendarEventType }
              : {}),
            ...(typeof color === 'string' ? { color } : {}),
            ...(typeof location === 'string' ? { location } : {}),
            ...(typeof description === 'string' ? { description } : {}),
          });
          return t('workspaceAgentTools.calendarUpdated', { title: updated.title, id: updated.id });
        } catch (e: unknown) {
          return `${t('workspaceAgentTools.calendarUpdateFailed')}: ${getErrorMessage(e)}`;
        }
      },
    });

    instance.registerTool({
      name: 'delete_calendar_event',
      description: t('workspaceAgentTools.toolDescDeleteCalendarEvent'),
      parameters: {
        event_id: { type: 'string' },
        confirm: { type: 'boolean' },
      },
      handler: async ({ event_id, confirm }) => {
        if (!confirm) return t('workspaceAgentTools.confirmRequired');
        if (typeof event_id !== 'string' || !event_id.trim())
          return t('workspaceAgentTools.calendarEventIdRequired');
        try {
          await calendarStore.deleteEvent(event_id);
          return t('workspaceAgentTools.calendarDeleted', { id: event_id });
        } catch (e: unknown) {
          return `${t('workspaceAgentTools.calendarDeleteFailed')}: ${getErrorMessage(e)}`;
        }
      },
    });
  }

  watch(
    kwami,
    (instance) => {
      if (!instance) return;
      registerTools(instance);
    },
    { immediate: true },
  );

  watch(
    () => i18n.global.locale.value,
    () => {
      if (kwami.value) registerTools(kwami.value);
    },
  );
}
