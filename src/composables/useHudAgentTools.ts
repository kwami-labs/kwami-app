import { useI18n } from 'vue-i18n';
import type { Kwami } from 'kwami';
import { useHudStore, type HudWidget, type SizePreset, type SnapZone } from '@/stores/hud';
import {
  fromShare,
  keepPicture,
  maximizedRect,
  moveToZone,
  toShare,
  VIDEO_CHROME,
  type HudRect,
  type PlaceZone,
} from '@/lib/hud/layout';
import { useAgentActionState } from '@/composables/useAgentActionState';
import { titleOf } from '@/lib/hud/markdown';
import { openUrlInHud } from '@/lib/hud/open';
import { baseToolName, clampRefresh, toolSummary } from '@/lib/hud/toolWidget';
import { useToolWidgets, type ToolRun } from '@/composables/useToolWidgets';

/**
 * `show_on_screen`: Jarvis runs its own screen by voice, as it works.
 *
 * It opens what it produces or finds (a report or notes as a document, a video, a
 * page, a picture, a tool it keeps running in view: an MCP server's, the agenda), and
 * arranges it with everything the user has by hand: folds,
 * brings back, closes, moves, resizes, places, maximises, brings to the front, pins,
 * snaps, gathers windows as tabs, moves them between screens, makes and switches
 * screens, lays a screen out, puts one on centre stage (its own figure moving aside),
 * tidies its own windows to the sides so the user's are not covered, or turns on edit
 * mode for the user. `list` tells it where everything is and where the user likes
 * each kind of window, so it can lay things out as they would. One tool with an `action`, not one per verb: the model's
 * tool list is full (128 at most), and each new tool would push out another.
 *
 * A window can be named by its id (from `list` or from what `open` answered), or by
 * words of its title or its kind ("vídeo", "informe"), as the user said them.
 */

const ACTIONS = [
  'open',
  'list',
  'close',
  'close_all',
  'minimize',
  'restore',
  'snap',
  'tab_with',
  'detach',
  'rename',
  'move_to_screen',
  'new_screen',
  'switch_screen',
  'rename_screen',
  'remove_screen',
  'organize',
  'tidy',
  'move',
  'resize',
  'place',
  'maximize',
  'focus',
  'pin',
  'unpin',
  'feature',
  'edit_mode',
  'refresh',
] as const;

const ZONES: readonly SnapZone[] = [
  'left',
  'right',
  'top',
  'topLeft',
  'topRight',
  'bottomLeft',
  'bottomRight',
];

/** Where `move` can send a window with its size kept. */
const PLACES: readonly PlaceZone[] = [...ZONES, 'bottom', 'center'];

const SIZES: readonly SizePreset[] = ['small', 'medium', 'large'];

/** What the user may call each kind of window, as said aloud. */
const KIND_WORDS: Record<string, string[]> = {
  task: ['task', 'tarea'],
  document: ['document', 'documento', 'informe', 'report', 'nota', 'notes'],
  video: ['video', 'vídeo'],
  web: ['web', 'page', 'página', 'pagina'],
  image: ['image', 'imagen', 'foto', 'picture'],
  browser: ['browser', 'navegador', 'chrome'],
  tool: ['tool', 'herramienta', 'widget', 'panel', 'mcp'],
};

/** How long a spoken reply waits for a tool window's first answer. */
const FIRST_RUN_WAIT_MS = 20_000;

function asString(value: unknown): string {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
}

function fold(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** A share of the free screen from a percentage the model gave, or undefined. */
function percent(value: unknown): number | undefined {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value.replace('%', ''))
        : Number.NaN;
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) / 100 : undefined;
}

function flag(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 'on' || value === 1) return true;
  if (value === 'false' || value === 'off' || value === 0) return false;
  return undefined;
}

/** Shares (0-1) as whole percentages, which is how the model reads and gives them. */
function asPercent(share: { x: number; y: number; w: number; h: number }) {
  const p = (v: number) => Math.round(v * 100);
  return { x: p(share.x), y: p(share.y), w: p(share.w), h: p(share.h) };
}

export function useHudAgentTools() {
  const { t } = useI18n();
  const hud = useHudStore();
  const actionState = useAgentActionState();
  const tools = useToolWidgets();

  /** A window by id, or by words of its title or kind; the newest wins a tie. */
  function findWindow(ref: string): HudWidget | undefined {
    const wanted = ref.trim();
    if (!wanted) return undefined;
    const exact = hud.byId(wanted);
    if (exact) return exact;
    const words = fold(wanted);
    const newest = [...hud.widgets].sort((a, b) => b.z - a.z);
    return (
      newest.find((w) => fold(w.title).includes(words)) ??
      newest.find((w) => KIND_WORDS[w.kind]?.some((word) => words.includes(fold(word))))
    );
  }

  /** A screen by number (from 1), id or name. */
  function findScreen(ref: string): string | undefined {
    const wanted = ref.trim();
    if (!wanted) return undefined;
    const n = Number(wanted);
    if (Number.isInteger(n) && n >= 1 && hud.screens[n - 1]) return hud.screens[n - 1].id;
    const byId = hud.screens.find((s) => s.id === wanted);
    if (byId) return byId.id;
    return hud.screens.find((s) => s.name && fold(s.name).includes(fold(wanted)))?.id;
  }

  function screenName(id: string): string {
    const index = hud.screens.findIndex((s) => s.id === id);
    return hud.screens[index]?.name || t('hud.screens.default', { n: index + 1 });
  }

  function describe(widget: HudWidget) {
    const state = widget.minimized
      ? 'folded'
      : widget.group && !hud.isShown(widget) && widget.screen === hud.activeScreen
        ? 'behind another tab'
        : widget.screen !== hud.activeScreen
          ? 'on another screen'
          : 'shown';
    return {
      id: widget.id,
      kind: widget.kind,
      title: widget.title,
      screen: screenName(widget.screen),
      state,
      tabs: widget.group ? hud.membersOf(widget).length : 1,
      // Where it is and how big, in % of the free screen: what `place` takes back.
      ...(state === 'shown' ? { place: asPercent(toShare(hud.rectOf(widget), hud.viewport)) } : {}),
      ...(widget.maximized ? { maximized: true } : {}),
      ...(widget.pinned ? { pinned: true } : {}),
      ...(widget.manual ? { placedByHand: true } : {}),
      ...(hud.stageId === widget.id ? { featured: true } : {}),
      ...(widget.kind === 'tool'
        ? {
            tool: widget.tool,
            args: widget.args,
            refreshEvery: widget.refresh || 'by hand',
            ...(tools.runs[widget.id]?.view
              ? { shows: toolSummary(tools.runs[widget.id].view!, 240) }
              : {}),
          }
        : {}),
    };
  }

  /** What a tool window answered, for the spoken reply: the first run, or its state. */
  async function firstAnswer(widget: HudWidget): Promise<Record<string, unknown>> {
    const run = tools.run(widget);
    const settled = await Promise.race([
      run,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), FIRST_RUN_WAIT_MS)),
    ]);
    return answerOf(settled);
  }

  function answerOf(run: ToolRun | null): Record<string, unknown> {
    if (!run) return { result: 'still running; it shows when it comes' };
    if (run.status === 'error') return { error: run.error };
    return run.view ? { result: toolSummary(run.view) } : {};
  }

  async function refreshTool(widget: HudWidget, args: Record<string, unknown>) {
    if (widget.kind !== 'tool') return { success: false, message: t('hud.tool.notATool') };
    if (args.refresh !== undefined) hud.setRefresh(widget.id, clampRefresh(args.refresh));
    const answer = answerOf(await tools.run(widget));
    return done(t('hud.tool.refreshed', { title: widget.title }), {
      refreshEvery: widget.refresh || 'by hand',
      ...answer,
    });
  }

  async function openTool(args: Record<string, unknown>, title: string) {
    const name = asString(args.tool).trim();
    if (!name) {
      return { success: false, message: t('hud.tool.needsTool'), showable: tools.showable() };
    }
    const allowed = tools.check(name);
    if (!allowed.ok) {
      return {
        success: false,
        message: t(allowed.reason === 'missing' ? 'hud.tool.missing' : 'hud.tool.writes', {
          tool: name,
        }),
        ...(allowed.reason === 'missing' ? { showable: tools.showable() } : {}),
      };
    }
    const toolArgs =
      args.args && typeof args.args === 'object' && !Array.isArray(args.args)
        ? (args.args as Record<string, unknown>)
        : {};
    const widget = hud.open({
      kind: 'tool',
      title: title || baseToolName(name).replace(/_/g, ' '),
      tool: name,
      args: toolArgs,
      refresh: clampRefresh(args.refresh),
      source: 'agent',
    });
    const answer = await firstAnswer(widget);
    return done(t('hud.shown', { title: widget.title }), {
      id: widget.id,
      kind: 'tool',
      refreshEvery: widget.refresh || 'by hand',
      ...answer,
    });
  }

  /** Where Jarvis's figure is now, in % of the whole HUD, and how big (100 is full size). */
  function figure() {
    const { width, height } = hud.viewport;
    const spot = hud.avatar;
    return {
      x: Math.round((spot.x / Math.max(1, width)) * 100),
      y: Math.round((spot.y / Math.max(1, height)) * 100),
      size: Math.round(spot.scale * 100),
    };
  }

  /** Where the user put each kind of window by hand last, in % of the free screen. */
  function liked() {
    return Object.fromEntries(
      Object.entries(hud.learned).map(([kind, share]) => [kind, share && asPercent(share)]),
    );
  }

  /** `rect` with any of x, y, w, h (percent of the free screen) the model gave. */
  function withShares(rect: HudRect, args: Record<string, unknown>, keepCentre: boolean): HudRect {
    const share = toShare(rect, hud.viewport);
    const w = percent(args.w) ?? share.w;
    const h = percent(args.h) ?? share.h;
    const x = percent(args.x) ?? (keepCentre ? share.x + (share.w - w) / 2 : share.x);
    const y = percent(args.y) ?? (keepCentre ? share.y + (share.h - h) / 2 : share.y);
    return fromShare({ x, y, w, h }, hud.viewport);
  }

  /**
   * A video sized by voice keeps its picture at 16:9: the height follows the width it was
   * given, or the width follows a height given alone.
   */
  function sized(
    widget: HudWidget,
    rect: HudRect,
    args: Record<string, unknown>,
    anchor: 'centre' | 'corner',
  ): HudRect {
    if (widget.kind !== 'video') return rect;
    if (percent(args.w) === undefined && percent(args.h) !== undefined) {
      const w = Math.round(((rect.h - VIDEO_CHROME) * 16) / 9);
      const x = anchor === 'centre' ? rect.x + (rect.w - w) / 2 : rect.x;
      return keepPicture({ ...rect, x, w }, hud.viewport, anchor);
    }
    return keepPicture(rect, hud.viewport, anchor);
  }

  function placedReply(widget: HudWidget) {
    return done(t('hud.voice.placed', { title: widget.title }), {
      place: asPercent(toShare(hud.rectOf(widget), hud.viewport)),
    });
  }

  function done(message: string, extra: Record<string, unknown> = {}) {
    actionState.recordAction(message);
    return { success: true, message, ...extra };
  }

  function missing() {
    return { success: false, message: t('hud.notFound') };
  }

  function open(args: Record<string, unknown>) {
    if (!hud.prefs.enabled) return { success: false, message: t('hud.disabled') };
    const url = asString(args.url);
    const kind = asString(args.kind) || (args.tool ? 'tool' : url ? 'web' : 'document');
    const title = asString(args.title).trim();
    if (kind === 'tool') return openTool(args, title);
    if (kind === 'document') {
      const content = asString(args.content);
      if (!content.trim()) return { success: false, message: t('hud.needsContent') };
      const doc = hud.createDocument(title || titleOf(content, t('hud.doc.untitled')), content);
      const widget = hud.openDocument(doc, 'agent');
      return done(t('hud.shown', { title: widget.title }), { id: widget.id, kind: 'document' });
    }
    const start = typeof args.start === 'number' && args.start > 0 ? args.start : undefined;
    const widget = openUrlInHud(url, { title, source: 'agent', kind, start });
    if (!widget) return { success: false, message: t('hud.needsUrl') };
    return done(t('hud.shown', { title: widget.title }), { id: widget.id, kind: widget.kind });
  }

  // Synchronous for every action but a tool window's, which waits for the tool's answer.
  function showOnScreen(args: Record<string, unknown>) {
    const action = asString(args.action) || 'open';
    const target = asString(args.id);
    switch (action) {
      case 'open':
        return open(args);
      case 'list':
        return {
          success: true,
          screen: screenName(hud.activeScreen),
          screens: hud.screens.map((s) => screenName(s.id)),
          windows: hud.widgets.map(describe),
          figure: figure(),
          likedPlaces: liked(),
          editing: hud.editing,
          message: t('hud.listed', { n: hud.widgets.length }),
        };
      case 'close_all':
        hud.closeAll();
        return done(t('hud.closedAll'));
      case 'organize':
        hud.organize();
        return done(t('hud.voice.organized'));
      case 'tidy':
        // Asked for by name: back to columns at the sides, even from a grid.
        hud.leaveGrid();
        return done(t('hud.voice.tidied', { n: hud.tidy() }));
      case 'edit_mode': {
        const on = flag(args.on) ?? !hud.editing;
        hud.setEditing(on);
        return done(t(on ? 'hud.voice.editOn' : 'hud.voice.editOff'));
      }
      case 'new_screen': {
        const screen = hud.addScreen(asString(args.name));
        return screen
          ? done(t('hud.voice.screenMade', { name: screenName(screen.id) }))
          : { success: false, message: t('hud.voice.tooManyScreens') };
      }
      case 'switch_screen':
      case 'rename_screen':
      case 'remove_screen': {
        const id =
          findScreen(asString(args.screen)) ??
          (action === 'switch_screen' ? undefined : hud.activeScreen);
        if (!id) return { success: false, message: t('hud.voice.noScreen') };
        if (action === 'switch_screen') {
          hud.switchScreen(id);
          return done(t('hud.voice.screenShown', { name: screenName(id) }));
        }
        if (action === 'rename_screen') {
          hud.renameScreen(id, asString(args.name));
          return done(t('hud.voice.screenRenamed', { name: screenName(id) }));
        }
        const name = screenName(id);
        hud.removeScreen(id);
        return done(t('hud.voice.screenRemoved', { name }));
      }
    }

    const widget = findWindow(target);
    if (!widget) return missing();
    switch (action) {
      case 'close':
        hud.close(widget.id);
        return done(t('hud.closedOne'));
      case 'minimize':
        hud.minimize(widget.id);
        return done(t('hud.voice.folded', { title: widget.title }));
      case 'restore':
        if (widget.screen !== hud.activeScreen) hud.switchScreen(widget.screen);
        if (widget.group) hud.activateTab(widget.id);
        // Shown and maximised, "restore" means its own size again.
        if (!widget.minimized && widget.maximized) hud.maximize(widget.id, false);
        hud.restore(widget.id);
        return done(t('hud.voice.shownAgain', { title: widget.title }));
      case 'focus':
        if (widget.screen !== hud.activeScreen) hud.switchScreen(widget.screen);
        if (widget.group) hud.activateTab(widget.id);
        if (widget.minimized) hud.restore(widget.id);
        else hud.focus(widget.id);
        return done(t('hud.voice.focused', { title: widget.title }));
      case 'maximize':
        if (widget.minimized) hud.restore(widget.id);
        hud.maximize(widget.id, true);
        return done(t('hud.voice.maximized', { title: widget.title }));
      case 'pin':
      case 'unpin':
        if (widget.pinned !== (action === 'pin')) hud.togglePin(widget.id);
        return done(
          t(action === 'pin' ? 'hud.voice.pinned' : 'hud.voice.unpinned', {
            title: widget.title,
          }),
        );
      case 'feature':
        hud.feature(widget.id);
        return done(t('hud.voice.featured', { title: widget.title }));
      case 'refresh':
        return refreshTool(widget, args);
      case 'move': {
        const zone = PLACES.find((z) => z === asString(args.zone));
        if (!zone && percent(args.x) === undefined && percent(args.y) === undefined) {
          return { success: false, message: t('hud.voice.needsPlace') };
        }
        const from = hud.rectOf(widget);
        hud.place(
          widget.id,
          zone
            ? moveToZone(from, zone, hud.viewport)
            : withShares(from, { x: args.x, y: args.y }, false),
        );
        return placedReply(widget);
      }
      case 'resize': {
        const size = SIZES.find((z) => z === asString(args.size));
        if (size) hud.resizeTo(widget.id, size);
        else if (percent(args.w) !== undefined || percent(args.h) !== undefined) {
          const sizes = { w: args.w, h: args.h };
          hud.place(
            widget.id,
            sized(widget, withShares(hud.rectOf(widget), sizes, true), sizes, 'centre'),
          );
        } else {
          return { success: false, message: t('hud.voice.needsSize') };
        }
        return placedReply(widget);
      }
      case 'place': {
        if (['x', 'y', 'w', 'h'].every((k) => percent(args[k]) === undefined)) {
          return { success: false, message: t('hud.voice.needsPlace') };
        }
        const from = widget.maximized ? maximizedRect(hud.viewport) : hud.rectOf(widget);
        hud.place(widget.id, sized(widget, withShares(from, args, false), args, 'corner'));
        return placedReply(widget);
      }
      case 'snap': {
        const zone = ZONES.find((z) => z === asString(args.zone)) ?? 'right';
        hud.snap(widget.id, zone);
        return done(t('hud.voice.snapped', { title: widget.title }));
      }
      case 'tab_with': {
        const other = findWindow(asString(args.with));
        if (!other || other.id === widget.id) return missing();
        hud.joinTabs(widget.id, other.id);
        return done(t('hud.voice.tabbed', { title: widget.title, other: other.title }));
      }
      case 'detach':
        hud.detachTab(widget.id);
        return done(t('hud.voice.detached', { title: widget.title }));
      case 'rename': {
        const name = asString(args.name).trim();
        if (!name) return { success: false, message: t('hud.voice.needsName') };
        hud.rename(widget.id, name);
        return done(t('hud.voice.renamed', { title: name }));
      }
      case 'move_to_screen': {
        const id = findScreen(asString(args.screen)) ?? hud.addScreen(asString(args.screen))?.id;
        if (!id) return { success: false, message: t('hud.voice.noScreen') };
        hud.moveToScreen(widget.id, id);
        return done(t('hud.voice.moved', { title: widget.title, name: screenName(id) }));
      }
      default:
        return { success: false, message: t('hud.voice.unknownAction') };
    }
  }

  function registerHudTools(instance: Kwami) {
    instance.registerTool({
      name: 'show_on_screen',
      description: t('hud.toolDescShowOnScreen'),
      parameters: {
        action: { type: 'string', enum: [...ACTIONS] },
        kind: { type: 'string', enum: ['document', 'video', 'web', 'image', 'tool'] },
        tool: { type: 'string' },
        args: { type: 'object' },
        refresh: { type: 'number' },
        title: { type: 'string' },
        content: { type: 'string' },
        url: { type: 'string' },
        start: { type: 'number' },
        id: { type: 'string' },
        with: { type: 'string' },
        zone: { type: 'string', enum: [...PLACES] },
        size: { type: 'string', enum: [...SIZES] },
        x: { type: 'number' },
        y: { type: 'number' },
        w: { type: 'number' },
        h: { type: 'number' },
        on: { type: 'boolean' },
        screen: { type: 'string' },
        name: { type: 'string' },
      },
      handler: async (args) => showOnScreen(args as Record<string, unknown>),
    });
  }

  return { showOnScreen, registerHudTools, findWindow, findScreen };
}
