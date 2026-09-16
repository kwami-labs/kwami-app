/**
 * Shared guards for global keyboard shortcuts.
 *
 * Bare-key shortcuts must never fire while the user is typing, and must never
 * shadow a browser or OS binding (Ctrl/Cmd+1 switches tabs, Ctrl+P prints).
 */

/** True when the event target is somewhere the user can type. */
export function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== 'string') return false;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return true;
  if (el.isContentEditable) return true;
  return el.closest?.('[contenteditable="true"], [role="textbox"]') != null;
}

/** True when a modifier is held, meaning the chord belongs to the browser/OS. */
export function hasModifier(e: KeyboardEvent): boolean {
  return e.ctrlKey || e.metaKey || e.altKey;
}

/** True when a bare-key shortcut is safe to handle for this event. */
export function isBareShortcut(e: KeyboardEvent): boolean {
  return !hasModifier(e) && !isEditableTarget(e.target);
}
