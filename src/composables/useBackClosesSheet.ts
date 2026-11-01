import { onMounted, onUnmounted, watch } from 'vue';
import { useUIStore } from '@/stores/ui';
import { isPhoneLayout } from '@/utils/phoneLayout';

/** Marks the history entry this composable owns, so it never pops anyone else's. */
const MARKER = 'kwamiPanelSheet';

/**
 * On a phone, Back closes the open panel instead of leaving the app.
 *
 * An open panel is a sheet over the whole workspace (main.css, PHONES), and
 * phones offer Back everywhere: Android's button or gesture, Safari's edge
 * swipe. With nothing in the history, Back with a sheet open left Kwami
 * altogether. Opening a sheet now pushes one history entry; Back pops it and
 * closes the sheet, and closing the sheet any other way pops it too, so the
 * history never fills with stale entries.
 *
 * Phone layout only: on a desktop the panel sits beside the avatar, and Back
 * there should do what Back does.
 */
export function useBackClosesSheet() {
  const ui = useUIStore();
  let pushed = false;

  function push() {
    if (pushed || !isPhoneLayout()) return;
    const state = history.state && typeof history.state === 'object' ? history.state : {};
    history.pushState({ ...state, [MARKER]: true }, '');
    pushed = true;
  }

  function onPopState() {
    if (!pushed) return;
    // Back left our entry: the sheet goes with it.
    pushed = false;
    if (ui.isPanelOpen) ui.togglePanel();
  }

  watch(
    () => ui.isPanelOpen,
    (open) => {
      if (open) {
        push();
      } else if (pushed) {
        // Closed by its own button, a swipe or a shortcut: take our entry back off,
        // so a later Back is not spent on a sheet that is already gone.
        pushed = false;
        if (history.state?.[MARKER]) history.back();
      }
    },
  );

  onMounted(() => {
    window.addEventListener('popstate', onPopState);
    // A panel restored open from the last visit needs its entry as well.
    if (ui.isPanelOpen) push();
  });

  onUnmounted(() => window.removeEventListener('popstate', onPopState));
}
