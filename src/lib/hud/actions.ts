/**
 * How the HUD draws what Jarvis does: each tool call in the action log, and each line
 * of a task's live log. The words live in the `hud` locale; this picks the icon, the
 * family and which string, from the tool's name.
 */

export type ActionFamily =
  'web' | 'search' | 'brain' | 'memory' | 'comms' | 'media' | 'ui' | 'system';

export interface ActionLook {
  icon: string;
  family: ActionFamily;
  /** A key under `hud.tools`, or null to show the tool's own name, tidied. */
  labelKey: string | null;
}

const FAMILY_ICONS: Record<ActionFamily, string> = {
  web: 'ph:globe-hemisphere-west-duotone',
  search: 'ph:magnifying-glass-duotone',
  brain: 'ph:brain-duotone',
  memory: 'ph:database-duotone',
  comms: 'ph:paper-plane-tilt-duotone',
  media: 'ph:film-strip-duotone',
  ui: 'ph:squares-four-duotone',
  system: 'ph:cpu-duotone',
};

/** Tools with words of their own; the rest are named by family. */
const NAMED: Record<string, { family: ActionFamily; icon?: string }> = {
  navigate_to: { family: 'web' },
  read_navigation_page: { family: 'web', icon: 'ph:article-ny-times-duotone' },
  click_in_navigation: { family: 'web', icon: 'ph:cursor-click-duotone' },
  type_in_navigation: { family: 'web', icon: 'ph:keyboard-duotone' },
  scroll_navigation: { family: 'web', icon: 'ph:arrows-down-up-duotone' },
  close_navigation: { family: 'web', icon: 'ph:x-square-duotone' },
  web_search: { family: 'search' },
  product_search: { family: 'search', icon: 'ph:shopping-cart-duotone' },
  deep_research: { family: 'search', icon: 'ph:books-duotone' },
  delegate_task: { family: 'brain' },
  check_tasks: { family: 'brain', icon: 'ph:list-checks-duotone' },
  cancel_task: { family: 'brain', icon: 'ph:stop-circle-duotone' },
  brain_status: { family: 'brain', icon: 'ph:gauge-duotone' },
  remember_fact: { family: 'memory' },
  recall_memories: { family: 'memory', icon: 'ph:clock-counter-clockwise-duotone' },
  play_media: { family: 'media', icon: 'ph:play-circle-duotone' },
  get_market_quote: { family: 'system', icon: 'ph:chart-line-up-duotone' },
  get_current_time: { family: 'system', icon: 'ph:clock-duotone' },
  show_on_screen: { family: 'ui', icon: 'ph:monitor-play-duotone' },
};

const FAMILY_RULES: [RegExp, ActionFamily][] = [
  [/navigat|browser|site_access/, 'web'],
  [/search|research|lookup/, 'search'],
  [/brain|task|delegate|agent|model|pipeline/, 'brain'],
  [/memor|remember|forget|recall|profile/, 'memory'],
  [/email|gmail|sms|whatsapp|call|message|contact|calendar|event|reminder/, 'comms'],
  [/media|music|soundtrack|playback|video|image|voice/, 'media'],
  [/ui|panel|theme|scene|avatar|layout|screen|language|appearance/, 'ui'],
];

export function lookOf(name: string): ActionLook {
  const named = NAMED[name];
  if (named) {
    return {
      family: named.family,
      icon: named.icon ?? FAMILY_ICONS[named.family],
      labelKey: name,
    };
  }
  const family = FAMILY_RULES.find(([pattern]) => pattern.test(name))?.[1] ?? 'system';
  return { family, icon: FAMILY_ICONS[family], labelKey: null };
}

/** `navigate_to` → `Navigate to`: what a tool with no words of its own is called. */
export function tidyToolName(name: string): string {
  const words = name
    .replace(/^mcp__[^_]+__/, '')
    .replace(/[_-]+/g, ' ')
    .trim();
  return words ? words[0].toUpperCase() + words.slice(1) : name;
}

// ---------------------------------------------------------------------------
// A task's live log
// ---------------------------------------------------------------------------

export type ActivityKind =
  | 'model'
  | 'plan'
  | 'step'
  | 'stepDone'
  | 'stepFailed'
  | 'shell'
  | 'read'
  | 'write'
  | 'find'
  | 'web'
  | 'browser'
  | 'signIn'
  | 'google'
  | 'database'
  | 'team'
  | 'other';

export interface ActivityLook {
  kind: ActivityKind;
  icon: string;
  /** What follows the label: a command, a file, a query. */
  detail: string;
  /** The tool's own name, for the lines that have no words of their own. */
  tool: string;
}

const ACTIVITY_ICONS: Record<ActivityKind, string> = {
  model: 'ph:cpu-duotone',
  plan: 'ph:tree-structure-duotone',
  step: 'ph:arrow-circle-right-duotone',
  stepDone: 'ph:check-circle-duotone',
  stepFailed: 'ph:warning-circle-duotone',
  shell: 'ph:terminal-window-duotone',
  read: 'ph:file-text-duotone',
  write: 'ph:pencil-simple-line-duotone',
  find: 'ph:magnifying-glass-duotone',
  web: 'ph:globe-duotone',
  browser: 'ph:browser-duotone',
  signIn: 'ph:key-duotone',
  google: 'ph:google-logo-duotone',
  database: 'ph:database-duotone',
  team: 'ph:users-three-duotone',
  other: 'ph:lightning-duotone',
};

const TOOL_KINDS: Record<string, ActivityKind> = {
  model: 'model',
  plan: 'plan',
  step: 'step',
  step_done: 'stepDone',
  step_failed: 'stepFailed',
  Bash: 'shell',
  PowerShell: 'shell',
  Read: 'read',
  Write: 'write',
  Edit: 'write',
  MultiEdit: 'write',
  NotebookEdit: 'write',
  Glob: 'find',
  Grep: 'find',
  WebSearch: 'web',
  WebFetch: 'web',
  mcp__browser__sign_in: 'signIn',
};

/** One line the agent logged for a task (`"Bash: npm test"`), as the HUD draws it. */
export function lookOfActivity(line: string): ActivityLook {
  const split = line.indexOf(': ');
  const tool = split > 0 ? line.slice(0, split) : line;
  const detail = split > 0 ? line.slice(split + 2) : '';
  let kind: ActivityKind = TOOL_KINDS[tool] ?? 'other';
  if (kind === 'other') {
    if (tool.startsWith('mcp__browser__')) kind = 'browser';
    else if (tool.startsWith('mcp__google')) kind = 'google';
    else if (tool.startsWith('mcp__kwami_db')) kind = 'database';
    else if (split > 0 && !tool.includes('__') && /^[a-z][\w-]*$/.test(tool)) kind = 'team';
  }
  return { kind, icon: ACTIVITY_ICONS[kind], detail, tool };
}

/** `2026-11-16T08:30:00Z` against a start → `+01:24`, the HUD's mission clock. */
export function missionClock(at: string, startedAt: string): string {
  const ms = Date.parse(at) - Date.parse(startedAt);
  if (!Number.isFinite(ms) || ms < 0) return '+00:00';
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `+${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * A task as the HUD tells it apart. The agent numbers tasks per call (`t1`, `t2`...),
 * so the same id comes back in the next call; with when it started, it is one task.
 */
export function taskKey(task: { id: string; startedAt?: string | null }): string {
  return task.startedAt ? `${task.id}@${task.startedAt}` : task.id;
}
