import { computed, onBeforeUnmount, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useHudStore } from '@/stores/hud';
import { useVoiceStore } from '@/stores/voice';
import { isSignInAddress, safeHttpUrl } from '@/lib/hud/media';
import { composeReport, reportOf, titleOf } from '@/lib/hud/markdown';
import { sendToAgent } from '@/lib/hud/agentLink';
import { useNavigationStore } from '@/stores/navigation';
import { taskKey } from '@/lib/hud/actions';
import { openUrlInHud } from '@/lib/hud/open';
import { openExternal } from '@/lib/hud/external';
import type { BrainTaskStatus } from '@/lib/brain';

/**
 * What puts things on Jarvis's screen without anyone asking.
 *
 * - Each tool call the agent reports (`agent_action`) goes to the action log.
 * - A task Jarvis starts opens its window, with the live log; when it finishes with a
 *   report (`brain_result`), the report opens as a document and the task folds away.
 * - Jarvis's browser opening opens its live mirror (its own Chrome, or the window it
 *   works in inside the user's Chrome), and the clean-window sign-in (`sign_in`,
 *   `sign_in_done`) is shown there.
 * - What the agent puts on screen itself (`hud_open`: a song or a video it found plays
 *   in the video window, not in a browser beside it), and the voice's playback controls
 *   for that window (`hud_media`).
 * - A link clicked anywhere in the app opens on screen; Ctrl-click still leaves for
 *   the system browser.
 *
 * Each of these has a switch in the dock's settings.
 */

/** What the voice's playback controls send to the video window on Jarvis's screen. */
export const HUD_MEDIA_EVENT = 'kwami:hud_media';
export const MEDIA_ACTIONS = [
  'pause',
  'resume',
  'stop',
  'mute',
  'unmute',
  'restart',
  'volume',
] as const;
export type HudMediaAction = (typeof MEDIA_ACTIONS)[number];
export interface HudMediaCommand {
  id: string;
  action: HudMediaAction;
  level?: number;
}

/** A result this long is a report worth reading on its own, not an answer in passing. */
export const REPORT_CHARS = 400;
/** A task older than this when first seen was restored from storage, not started now. */
const FRESH_TASK_MS = 10 * 60 * 1000;

interface AgentMessage {
  type?: string;
  [key: string]: unknown;
}

export function useHud() {
  const hud = useHudStore();
  const voice = useVoiceStore();
  const nav = useNavigationStore();
  const { t } = useI18n();

  /**
   * Whether anyone is looking at Jarvis's browser: its window here in view, or the
   * docked browser panel. The agent sends frames only while someone is.
   */
  const framesWanted = computed(() => {
    const browser = hud.byKey('browser');
    return (!!browser && hud.isShown(browser)) || nav.hasView;
  });
  /** What the agent was last told: it starts each browser sending, so only a change is news. */
  let agentSends = true;
  function tellFrames(on: boolean) {
    if (on === agentSends) return;
    agentSends = on;
    sendToAgent({ type: 'browser_frames', on });
  }
  watch(framesWanted, (on) => {
    if (nav.isActive) tellFrames(on);
  });

  const seen = new Set<string>();
  let seeded = false;
  let signInTimer: ReturnType<typeof setTimeout> | null = null;

  function userIsWriting(): boolean {
    const focused = hud.focusedId ? hud.byId(hud.focusedId) : undefined;
    return (
      focused?.kind === 'document' &&
      !!document.activeElement?.closest('[contenteditable], textarea, input')
    );
  }

  function onTasks(tasks: BrainTaskStatus[] | undefined) {
    for (const task of tasks ?? []) {
      const id = taskKey(task);
      const key = `task:${id}`;
      const fresh = Date.now() - Date.parse(task.startedAt) < FRESH_TASK_MS;
      if (!seen.has(id)) {
        seen.add(id);
        if (seeded && fresh && task.status === 'running' && hud.prefs.enabled && hud.prefs.tasks) {
          hud.open({
            kind: 'task',
            taskId: id,
            key,
            title: task.title,
            source: 'agent',
            background: userIsWriting(),
          });
        }
      }
      const widget = hud.byKey(key);
      if (widget && task.title && widget.title !== task.title) widget.title = task.title;
    }
    seeded = true;
  }

  function onResult(message: AgentMessage) {
    const raw = typeof message.id === 'string' ? message.id : '';
    const startedAt = typeof message.startedAt === 'string' ? message.startedAt : '';
    const id = raw ? taskKey({ id: raw, startedAt }) : '';
    const result = typeof message.result === 'string' ? message.result : '';
    if (!id || !result) return;
    const sources = Array.isArray(message.sources)
      ? message.sources.filter((s): s is string => typeof s === 'string')
      : [];
    const title = typeof message.title === 'string' ? message.title : '';
    hud.rememberResult(id, result, sources, title);
    const report =
      typeof message.report === 'string' && message.report.trim()
        ? composeReport(typeof message.spoken === 'string' ? message.spoken : '', message.report)
        : reportOf(result);
    if (!hud.prefs.enabled || !hud.prefs.reports || report.length < REPORT_CHARS) return;
    const body = sources.length
      ? `${report}\n\n## ${t('hud.task.sources')}\n\n${sources.map((s) => `- ${s}`).join('\n')}`
      : report;
    const doc = hud.createDocument(title || titleOf(report, t('hud.doc.untitled')), body, {
      taskId: id,
    });
    hud.open({
      kind: 'document',
      docId: doc.id,
      title: doc.title,
      source: 'agent',
      background: userIsWriting(),
    });
    const task = hud.byKey(`task:${id}`);
    if (task && !task.pinned) hud.minimize(task.id);
  }

  function onAction(message: AgentMessage) {
    const id = typeof message.id === 'string' ? message.id : '';
    if (!id) return;
    if (message.phase === 'start') {
      hud.actionStarted(id, String(message.name ?? ''), String(message.detail ?? ''));
    } else if (message.phase === 'update') {
      hud.actionUpdated(id, String(message.detail ?? ''));
    } else if (message.phase === 'end') {
      hud.actionEnded(id, String(message.status ?? 'done'));
    }
  }

  function onOpen(message: AgentMessage) {
    if (!hud.prefs.enabled) return;
    const url = typeof message.url === 'string' ? message.url : '';
    const kind = typeof message.kind === 'string' ? message.kind : undefined;
    const title = typeof message.title === 'string' ? message.title.slice(0, 120) : undefined;
    const start =
      typeof message.start === 'number' && message.start > 0 ? message.start : undefined;
    openUrlInHud(url, { title, source: 'agent', kind, start });
  }

  function onMedia(message: AgentMessage) {
    const action = typeof message.action === 'string' ? message.action : '';
    if (!(MEDIA_ACTIONS as readonly string[]).includes(action)) return;
    const video = [...hud.widgets].filter((w) => w.kind === 'video').sort((a, b) => b.z - a.z)[0];
    if (!video) return;
    const level = typeof message.level === 'number' ? message.level : undefined;
    window.dispatchEvent(
      new CustomEvent<HudMediaCommand>(HUD_MEDIA_EVENT, {
        detail: { id: video.id, action: action as HudMediaAction, level },
      }),
    );
  }

  function onAgentMessage(event: Event) {
    const message = (event as CustomEvent<AgentMessage>).detail;
    if (message?.type === 'agent_action') onAction(message);
    else if (message?.type === 'brain_result') onResult(message);
    else if (message?.type === 'hud_open') onOpen(message);
    else if (message?.type === 'hud_media') onMedia(message);
  }

  function openBrowser(background: boolean) {
    if (!hud.prefs.enabled || !hud.prefs.browser) return;
    hud.open({
      kind: 'browser',
      key: 'browser',
      title: t('hud.browser.title'),
      source: 'agent',
      background,
    });
  }

  function onBrowserSession(event: Event) {
    const detail = (event as CustomEvent<{ action?: string; url?: string }>).detail;
    switch (detail?.action) {
      case 'open':
        if (hud.browserSignIn.state === 'done') hud.setBrowserSignIn('idle');
        openBrowser(userIsWriting());
        // The agent starts sending frames; nobody to look at them, then stop.
        agentSends = true;
        tellFrames(framesWanted.value);
        break;
      case 'sign_in':
        hud.setBrowserSignIn('open', detail.url ?? '');
        openBrowser(false);
        break;
      case 'sign_in_done':
        hud.setBrowserSignIn('done', detail.url ?? '');
        if (signInTimer) clearTimeout(signInTimer);
        signInTimer = setTimeout(() => {
          if (hud.browserSignIn.state === 'done') hud.setBrowserSignIn('idle');
        }, 12000);
        break;
    }
  }

  function onClick(event: MouseEvent) {
    if (!hud.prefs.enabled || !hud.prefs.links) return;
    if (event.defaultPrevented || event.button !== 0) return;
    const target = event.target as Element | null;
    const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!anchor || anchor.hasAttribute('download') || anchor.closest('[data-hud-external]')) return;
    const url = safeHttpUrl(anchor.href);
    if (!url || new URL(url).origin === window.location.origin) return;
    event.preventDefault();
    if (event.ctrlKey || event.metaKey || event.shiftKey || isSignInAddress(url)) {
      void openExternal(url);
      return;
    }
    openUrlInHud(url, { title: anchor.textContent?.trim().slice(0, 80) || undefined });
  }

  watch(
    () => voice.brainStatus?.tasks,
    (tasks) => onTasks(tasks),
    { immediate: true, deep: true },
  );

  onMounted(() => {
    window.addEventListener('kwami:agent_message', onAgentMessage);
    window.addEventListener('kwami:browser_session', onBrowserSession);
    document.addEventListener('click', onClick, true);
  });

  onBeforeUnmount(() => {
    window.removeEventListener('kwami:agent_message', onAgentMessage);
    window.removeEventListener('kwami:browser_session', onBrowserSession);
    document.removeEventListener('click', onClick, true);
    if (signInTimer) clearTimeout(signInTimer);
  });

  return { onAgentMessage, onBrowserSession, onClick, onTasks, onOpen, onMedia };
}
