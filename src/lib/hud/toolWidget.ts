/**
 * A tool on Jarvis's screen: a window that runs one of the tools the app holds (an MCP
 * server's, a webhook the user added, one of the app's own) and shows what it answered,
 * again on a button or every so often. The weather from an MCP server, the next events,
 * the unread mail: a live panel instead of a sentence said once.
 *
 * Only tools that read. A window runs its tool by itself when it opens, when the app
 * reloads and on its timer, with nobody asking each time; a tool that sends, buys,
 * deletes or changes something must stay a call Jarvis makes on purpose. An MCP server
 * can say so itself (`readOnlyHint`, `destructiveHint`); for the rest the verb the name
 * starts with decides, and anything unclear is refused.
 */

/** Fastest a window may run its tool again: most of what it calls is someone's API. */
export const REFRESH_MIN = 15;
/** Slowest worth a timer: a day. */
export const REFRESH_MAX = 86_400;

/** Verbs that read, as the first word of a tool's name. */
const READ_VERBS = new Set([
  'list',
  'read',
  'get',
  'search',
  'fetch',
  'find',
  'check',
  'query',
  'lookup',
  'look',
  'describe',
  'count',
  'status',
  'view',
  'browse',
  'match',
  'retrieve',
  'inspect',
  'preview',
  'stats',
  'info',
  'current',
]);

/** Tools no window may run, whatever their name says: this one opens windows itself. */
const NEVER = new Set(['show_on_screen']);

export interface ToolHints {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
}

/** The tool's own name, without the `server__` an MCP tool is exposed with. */
export function baseToolName(name: string): string {
  const parts = name.split('__');
  return parts[parts.length - 1] || name;
}

function firstWord(name: string): string {
  const base = baseToolName(name)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();
  return base.split(/[_\-\s.]+/).find(Boolean) ?? '';
}

/** Whether a window may run `name` by itself: it only reads. */
export function canShowTool(name: string, hints?: ToolHints): boolean {
  if (!name || NEVER.has(name)) return false;
  if (hints?.destructiveHint === true) return false;
  if (hints?.readOnlyHint === true) return true;
  if (hints?.readOnlyHint === false) return false;
  return READ_VERBS.has(firstWord(name));
}

/** Seconds between runs, within bounds; 0 (or nothing usable) is no timer. */
export function clampRefresh(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return 0;
  return Math.round(Math.min(REFRESH_MAX, Math.max(REFRESH_MIN, n)));
}

// ---------------------------------------------------------------------------
// What a tool answered, ready to be shown
// ---------------------------------------------------------------------------

export type ToolView =
  | { type: 'empty' }
  | { type: 'error'; message: string }
  | { type: 'text'; text: string }
  | { type: 'list'; items: string[]; pairs: [string, string][] }
  | { type: 'table'; columns: string[]; rows: string[][]; more: number; pairs: [string, string][] }
  | { type: 'pairs'; pairs: [string, string][] };

const MAX_ROWS = 50;
const MAX_COLUMNS = 6;
const MAX_CELL = 160;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** A value as one short line: scalars as they are, anything else as compact JSON. */
export function cell(value: unknown): string {
  let text: string;
  if (value === null || value === undefined) text = '';
  else if (typeof value === 'string') text = value;
  else if (typeof value === 'number' || typeof value === 'boolean') text = String(value);
  else {
    try {
      text = JSON.stringify(value);
    } catch {
      text = String(value);
    }
  }
  text = text.replace(/\s+/g, ' ').trim();
  return text.length > MAX_CELL ? `${text.slice(0, MAX_CELL - 1)}…` : text;
}

const FENCE = /^\s*```/;

/**
 * HTML inside Markdown, as a README has it (a centred logo, a row of badges), turned into
 * Markdown: a link keeps its text and address, a picture or a badge goes, every other tag
 * goes. Code blocks are left alone: HTML there is an example, not markup.
 */
export function stripHtml(text: string): string {
  if (!/<\/?[a-z][^>]*>/i.test(text)) return text;
  let inCode = false;
  const out = text.split('\n').map((line) => {
    if (FENCE.test(line)) {
      inCode = !inCode;
      return line;
    }
    if (inCode) return line;
    return line
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<a\b[^>]*?href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, inner) => {
        const label = String(inner)
          .replace(/<[^>]+>/g, '')
          .trim();
        return label ? `[${label}](${href})` : '';
      })
      .replace(/<\/?[a-z][^>]*>/gi, '')
      .trimEnd();
  });
  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parsed(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  if (!/^[[{]/.test(text)) return value;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return value;
  }
}

/** The scalar fields of an object, as label and value: what goes above a table. */
function scalarPairs(record: Record<string, unknown>, skip?: string): [string, string][] {
  return Object.entries(record)
    .filter(([key, v]) => key !== skip && (v === null || typeof v !== 'object'))
    .map(([key, v]) => [key, cell(v)]);
}

function table(rows: unknown[], pairs: [string, string][]): ToolView {
  const records = rows.filter(isRecord);
  if (records.length < rows.length / 2) {
    return { type: 'list', items: rows.slice(0, MAX_ROWS).map(cell), pairs };
  }
  const columns: string[] = [];
  for (const record of records.slice(0, 20)) {
    for (const key of Object.keys(record)) {
      if (!columns.includes(key) && columns.length < MAX_COLUMNS) columns.push(key);
    }
  }
  return {
    type: 'table',
    columns,
    rows: records.slice(0, MAX_ROWS).map((r) => columns.map((c) => cell(r[c]))),
    more: Math.max(0, records.length - MAX_ROWS),
    pairs,
  };
}

/**
 * How to show what a tool answered: a table for a list of records, label and value for
 * an object, the text itself (Markdown, usually, from an MCP server) for anything else.
 * A failure reads as one: `{ ok: false }` from an MCP call, `{ success: false }` from
 * the app's tools.
 */
export function toolView(value: unknown): ToolView {
  const data = parsed(value);
  if (data === null || data === undefined || data === '') return { type: 'empty' };
  if (typeof data === 'string') {
    const text = stripHtml(data);
    return text ? { type: 'text', text } : { type: 'empty' };
  }
  if (typeof data === 'number' || typeof data === 'boolean') {
    return { type: 'text', text: String(data) };
  }
  if (Array.isArray(data)) return data.length ? table(data, []) : { type: 'empty' };
  if (!isRecord(data)) return { type: 'text', text: cell(data) };

  if (data.ok === false || data.success === false) {
    const message = data.error ?? data.message ?? data.reason;
    return { type: 'error', message: cell(message) || 'error' };
  }
  // An answer wrapped around the thing itself: `{ success, message, events: [...] }`.
  const lists = Object.entries(data).filter(([, v]) => Array.isArray(v) && v.length);
  if (lists.length === 1) {
    const [key, rows] = lists[0];
    return table(rows as unknown[], scalarPairs(data, key));
  }
  const pairs = Object.entries(data).map(([k, v]): [string, string] => [k, cell(v)]);
  return pairs.length ? { type: 'pairs', pairs } : { type: 'empty' };
}

/** The same, as Markdown: for a document made from it, and for Jarvis to read back. */
export function toolMarkdown(view: ToolView): string {
  const pairs = (list: [string, string][]) => list.map(([k, v]) => `- **${k}**: ${v}`).join('\n');
  switch (view.type) {
    case 'empty':
      return '';
    case 'error':
      return `**Error:** ${view.message}`;
    case 'text':
      return view.text;
    case 'pairs':
      return pairs(view.pairs);
    case 'list':
      return [pairs(view.pairs), view.items.map((i) => `- ${i}`).join('\n')]
        .filter(Boolean)
        .join('\n\n');
    case 'table': {
      const rows = view.rows.map(
        (r) => `- ${r.map((c, i) => `${view.columns[i]}: ${c}`).join(' · ')}`,
      );
      if (view.more) rows.push(`- … +${view.more}`);
      return [pairs(view.pairs), rows.join('\n')].filter(Boolean).join('\n\n');
    }
  }
}

/** A short version for a spoken reply: the model reads it, the user does not. */
export function toolSummary(view: ToolView, max = 600): string {
  const text = toolMarkdown(view).replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
