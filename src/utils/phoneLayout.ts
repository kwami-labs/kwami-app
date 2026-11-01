/**
 * The phone layout: a portrait screen narrower than the compact-mode breakpoint
 * (stores/ui.ts, 768px).
 *
 * There the nav rail becomes a dock along the bottom and an open panel becomes a
 * sheet above it (src/assets/main.css, "PHONES"). Landscape phones keep the rail,
 * which scrolls when it is taller than the screen: a dock plus a sheet would leave
 * a landscape panel a strip ~250px tall.
 *
 * Orientation, not height, decides it, because the on-screen keyboard shrinks
 * the viewport's height and a height rule would swap layouts mid-typing.
 *
 * Keep this string identical to the media queries in main.css and the
 * components that style the dock (search for PHONE_LAYOUT_QUERY).
 */
export const PHONE_LAYOUT_QUERY = '(max-width: 767px) and (orientation: portrait)';

export function isPhoneLayout(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.(PHONE_LAYOUT_QUERY).matches;
}
