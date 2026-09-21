/**
 * The single source of truth for which panels exist and how they are grouped.
 *
 * These lists were previously hand-maintained in three places —
 * SidebarNavigation's template, usePanelShortcuts and useWorkspaceAgentTools —
 * and had drifted:
 *
 *  - The keyboard shortcuts could not reach `theme`, `models` or `credits`,
 *    and listed `interaction`, which no component implements (pressing its key
 *    opened an empty sidebar).
 *  - whatsapp/sms were gated on phone activation in the sidebar but listed
 *    unconditionally in the shortcuts, so a digit key opened a panel the
 *    sidebar deliberately hides.
 *
 * Deriving all three from here means adding a panel is one edit.
 */

/** Visual/appearance settings. */
export const SETTINGS_VISUAL_PANELS = ['avatar', 'audio', 'scene', 'theme'] as const;

/** Agent behaviour settings. `communications` is the provisioning surface the
 *  apps-mode phone/whatsapp/sms panels assume has already been completed. */
export const SETTINGS_AGENT_PANELS = [
  'models',
  'voice',
  'soul',
  'memory',
  'enhancements',
  'communications',
  'tools',
] as const;

/** Diagnostics. */
export const SETTINGS_INFO_PANELS = ['metrics', 'info'] as const;

/** Pinned to the bottom of the sidebar rather than a group. */
export const SETTINGS_PINNED_PANELS = ['credits', 'account'] as const;

/** Keyboard order for settings mode, matching the sidebar top to bottom. */
export const SETTINGS_PANEL_ORDER: readonly string[] = [
  ...SETTINGS_VISUAL_PANELS,
  ...SETTINGS_AGENT_PANELS,
  ...SETTINGS_INFO_PANELS,
  ...SETTINGS_PINNED_PANELS,
];

/** Apps available regardless of telephony provisioning. */
export const APPS_BASE_PANELS = ['contacts', 'email', 'phone'] as const;

/** Apps that only exist once a phone number is provisioned. */
export const APPS_PHONE_PANELS = ['whatsapp', 'sms'] as const;

/** Apps listed after the telephony group. */
export const APPS_TAIL_PANELS = ['history', 'wallet', 'calendar'] as const;

/**
 * Apps-mode order. `phoneActivated` must match the sidebar's own gate, or the
 * keyboard and the sidebar disagree about which panel a digit maps to.
 */
export function appsPanelOrder(phoneActivated: boolean): string[] {
  return [...APPS_BASE_PANELS, ...(phoneActivated ? APPS_PHONE_PANELS : []), ...APPS_TAIL_PANELS];
}
