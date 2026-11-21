import { reactive } from 'vue';
import { useKwami } from '@/composables/useKwami';
import { useMcpServers } from '@/composables/useMcpServers';
import type { HudWidget } from '@/stores/hud';
import { canShowTool, toolView, type ToolHints, type ToolView } from '@/lib/hud/toolWidget';

export interface ToolRun {
  status: 'running' | 'done' | 'error';
  /** When it last finished (or started, while running). */
  at: number;
  view?: ToolView;
  error?: string;
}

export type ToolCheck = { ok: true } | { ok: false; reason: 'missing' | 'writes' };

/** Longest a window waits for its tool before it says so. */
const RUN_TIMEOUT_MS = 60_000;

// Module scope: the window, the voice tool and the dock share one set of results, and a
// run already under way is joined rather than started twice.
const runs = reactive<Record<string, ToolRun>>({});
const inflight = new Map<string, Promise<ToolRun>>();

/**
 * Runs the tool of each tool window (see lib/hud/toolWidget) and keeps what it answered.
 */
export function useToolWidgets() {
  const { kwami } = useKwami();
  const mcp = useMcpServers();

  /** What the MCP server said about the tool exposed as `name`, if it is one of theirs. */
  function hintsOf(name: string): ToolHints | undefined {
    for (const state of Object.values(mcp.states)) {
      for (const tool of state.tools) {
        if (state.exposed[tool.name] === name) return tool.annotations ?? {};
      }
    }
    return undefined;
  }

  /** Whether a window may run `name`: the app holds it, and it only reads. */
  function check(name: string): ToolCheck {
    if (!kwami.value?.tools.get(name)) return { ok: false, reason: 'missing' };
    if (!canShowTool(name, hintsOf(name))) return { ok: false, reason: 'writes' };
    return { ok: true };
  }

  /** Tools a window could show right now, for Jarvis to pick from. */
  function showable(): string[] {
    const all = kwami.value?.tools.getAll() ?? [];
    return all.map((tool) => tool.name).filter((name) => check(name).ok);
  }

  async function execute(widget: HudWidget): Promise<ToolRun> {
    const name = widget.tool ?? '';
    const allowed = check(name);
    if (!allowed.ok) {
      return { status: 'error', at: Date.now(), error: allowed.reason };
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const value = await Promise.race([
        kwami.value!.tools.execute(name, { ...(widget.args ?? {}) }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('timeout')), RUN_TIMEOUT_MS);
        }),
      ]);
      const view = toolView(value);
      return view.type === 'error'
        ? { status: 'error', at: Date.now(), view, error: view.message }
        : { status: 'done', at: Date.now(), view };
    } catch (e) {
      return {
        status: 'error',
        at: Date.now(),
        error: e instanceof Error ? e.message : String(e),
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /** Run a window's tool now; a run already under way for it is joined, not doubled. */
  function run(widget: HudWidget): Promise<ToolRun> {
    const pending = inflight.get(widget.id);
    if (pending) return pending;
    const previous = runs[widget.id];
    // The last answer stays on screen while the new one comes.
    runs[widget.id] = { ...previous, status: 'running', at: Date.now() };
    const job = execute(widget).then((result) => {
      runs[widget.id] =
        result.status === 'error' && previous?.view && !result.view
          ? { ...result, view: previous.view }
          : result;
      inflight.delete(widget.id);
      return runs[widget.id];
    });
    inflight.set(widget.id, job);
    return job;
  }

  function forget(id: string): void {
    delete runs[id];
  }

  return { runs, run, check, showable, forget };
}
