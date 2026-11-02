import {
  APPS_BASE_PANELS,
  APPS_PHONE_PANELS,
  APPS_TAIL_PANELS,
  SETTINGS_AGENT_PANELS,
  SETTINGS_INFO_PANELS,
  SETTINGS_PINNED_PANELS,
  SETTINGS_VISUAL_PANELS,
} from '@/constants/panels';

/**
 * Which sidebar panels show, and in what order.
 *
 * Pure, because the same rules serve the editor, the voice tool and whatever comes
 * back from the database, which may have been written by an older app.
 */
export interface PanelArrangement {
  hidden: string[];
  order: string[];
}

/** The groups the sidebar draws. A panel only moves within its own. */
export const PANEL_GROUPS: readonly (readonly string[])[] = [
  SETTINGS_VISUAL_PANELS,
  SETTINGS_AGENT_PANELS,
  SETTINGS_INFO_PANELS,
  [...APPS_BASE_PANELS, ...APPS_PHONE_PANELS, ...APPS_TAIL_PANELS],
];

/**
 * Never hidden. The editor lives in `theme`, so hiding it would leave no way back,
 * and the pinned buttons are how the user reaches their balance and signs out.
 */
export const PROTECTED_PANELS: ReadonlySet<string> = new Set(['theme', ...SETTINGS_PINNED_PANELS]);

const KNOWN_PANELS: ReadonlySet<string> = new Set(PANEL_GROUPS.flat());

export function emptyArrangement(): PanelArrangement {
  return { hidden: [], order: [] };
}

export function isKnownPanel(panel: string): boolean {
  return KNOWN_PANELS.has(panel);
}

export function normalizeArrangement(value: unknown): PanelArrangement {
  const source = (value ?? {}) as Partial<Record<keyof PanelArrangement, unknown>>;
  const known = (list: unknown) =>
    Array.isArray(list)
      ? [...new Set(list.filter((p): p is string => typeof p === 'string' && isKnownPanel(p)))]
      : [];
  return {
    hidden: known(source.hidden).filter((p) => !PROTECTED_PANELS.has(p)),
    order: known(source.order),
  };
}

/** Every panel of the list in the chosen order, hidden ones included: what the editor shows. */
export function orderPanels(panels: readonly string[], arrangement: PanelArrangement): string[] {
  const rank = (panel: string) => {
    const index = arrangement.order.indexOf(panel);
    return index === -1 ? arrangement.order.length + panels.indexOf(panel) : index;
  };
  return [...panels].sort((a, b) => rank(a) - rank(b));
}

/** What the sidebar and the keyboard shortcuts show. */
export function visiblePanels(panels: readonly string[], arrangement: PanelArrangement): string[] {
  return orderPanels(panels, arrangement).filter((p) => !arrangement.hidden.includes(p));
}

export function withPanelHidden(
  arrangement: PanelArrangement,
  panel: string,
  hidden: boolean,
): PanelArrangement {
  if (!isKnownPanel(panel) || (hidden && PROTECTED_PANELS.has(panel))) return arrangement;
  const rest = arrangement.hidden.filter((p) => p !== panel);
  return { ...arrangement, hidden: hidden ? [...rest, panel] : rest };
}

/** Moves a panel one place up (-1) or down (+1) within its group. At the edge, nothing changes. */
export function withPanelMoved(
  arrangement: PanelArrangement,
  panel: string,
  offset: -1 | 1,
): PanelArrangement {
  const group = PANEL_GROUPS.find((candidate) => candidate.includes(panel));
  if (!group) return arrangement;
  const ordered = orderPanels(group, arrangement);
  const from = ordered.indexOf(panel);
  const to = from + offset;
  const target = ordered[to];
  if (target === undefined) return arrangement;
  ordered[from] = target;
  ordered[to] = panel;
  // The whole group is written, so its order never depends on the panels left out.
  return {
    ...arrangement,
    order: [...arrangement.order.filter((p) => !group.includes(p)), ...ordered],
  };
}
