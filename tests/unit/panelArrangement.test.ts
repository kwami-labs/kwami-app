/**
 * The sidebar layout. The failure worth testing is a user who hides or moves their
 * way into a state they cannot get out of, or a stale row from the database that
 * breaks the sidebar.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import {
  emptyArrangement,
  normalizeArrangement,
  orderPanels,
  visiblePanels,
  withPanelHidden,
  withPanelMoved,
} from '@/lib/panelArrangement';
import { SETTINGS_VISUAL_PANELS } from '@/constants/panels';
import { useUIStore } from '@/stores/ui';

describe('panelArrangement', () => {
  it('leaves the default order alone when nothing was chosen', () => {
    expect(visiblePanels(SETTINGS_VISUAL_PANELS, emptyArrangement())).toEqual([
      ...SETTINGS_VISUAL_PANELS,
    ]);
  });

  it('hides a panel and brings it back', () => {
    const hidden = withPanelHidden(emptyArrangement(), 'audio', true);
    expect(visiblePanels(SETTINGS_VISUAL_PANELS, hidden)).not.toContain('audio');
    expect(orderPanels(SETTINGS_VISUAL_PANELS, hidden)).toContain('audio');
    const shown = withPanelHidden(hidden, 'audio', false);
    expect(visiblePanels(SETTINGS_VISUAL_PANELS, shown)).toContain('audio');
  });

  it.each(['theme', 'account', 'credits'])('never hides %s', (panel) => {
    expect(withPanelHidden(emptyArrangement(), panel, true).hidden).toEqual([]);
  });

  it('ignores a panel that does not exist', () => {
    expect(withPanelHidden(emptyArrangement(), 'nonsense', true).hidden).toEqual([]);
    expect(withPanelMoved(emptyArrangement(), 'nonsense', 1).order).toEqual([]);
  });

  it('moves a panel within its group', () => {
    const moved = withPanelMoved(emptyArrangement(), 'audio', -1);
    expect(orderPanels(SETTINGS_VISUAL_PANELS, moved)).toEqual([
      'audio',
      'avatar',
      'scene',
      'theme',
    ]);
  });

  it('does nothing at the edge of the group', () => {
    const start = emptyArrangement();
    expect(withPanelMoved(start, 'avatar', -1)).toBe(start);
    expect(withPanelMoved(start, 'theme', 1)).toBe(start);
  });

  it('keeps moves in other groups', () => {
    const one = withPanelMoved(emptyArrangement(), 'audio', -1);
    const both = withPanelMoved(one, 'metrics', 1);
    expect(orderPanels(SETTINGS_VISUAL_PANELS, both)[0]).toBe('audio');
    expect(orderPanels(['metrics', 'info'], both)).toEqual(['info', 'metrics']);
  });

  it.each([[null], [undefined], ['x'], [{ hidden: 'audio', order: 3 }]])(
    'survives a bad stored value: %s',
    (value) => {
      expect(normalizeArrangement(value)).toEqual(emptyArrangement());
    },
  );

  it('drops unknown, repeated and protected panels from a stored value', () => {
    expect(
      normalizeArrangement({
        hidden: ['audio', 'audio', 'theme', 'gone', 3],
        order: ['scene', 'gone'],
      }),
    ).toEqual({ hidden: ['audio'], order: ['scene'] });
  });
});

describe('ui store', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('remembers the arrangement on this device', () => {
    useUIStore().setPanelHidden('audio', true);
    setActivePinia(createPinia());
    const store = useUIStore();
    store.loadSettings();
    expect(store.panelArrangement.hidden).toEqual(['audio']);
  });

  it('closes the open panel when it gets hidden', () => {
    const store = useUIStore();
    store.setPanel('audio');
    store.setPanelHidden('audio', true);
    expect(store.isPanelOpen).toBe(false);
  });

  it('leaves another open panel alone', () => {
    const store = useUIStore();
    store.setPanel('scene');
    store.setPanelHidden('audio', true);
    expect(store.isPanelOpen).toBe(true);
  });

  it('round-trips a layout through its snapshot', () => {
    const store = useUIStore();
    store.movePanel('audio', -1);
    store.setPanelHidden('metrics', true);
    store.setAllowCustomResize(false);
    const snapshot = JSON.parse(JSON.stringify(store.getLayoutSnapshot()));

    setActivePinia(createPinia());
    const other = useUIStore();
    other.applyLayoutSnapshot(snapshot);
    expect(other.panelArrangement).toEqual(store.panelArrangement);
    expect(other.allowCustomResize).toBe(false);
    expect(other.activeSizePreset).toBe(store.activeSizePreset);
  });

  it('ignores the broken parts of a snapshot', () => {
    const store = useUIStore();
    store.applyLayoutSnapshot({
      arrangement: 'x',
      activeSizePreset: 'huge',
      sizePresets: 3,
    } as never);
    expect(store.panelArrangement).toEqual(emptyArrangement());
    expect(store.activeSizePreset).toBe('small');
  });

  it('resets', () => {
    const store = useUIStore();
    store.setPanelHidden('audio', true);
    store.resetPanelArrangement();
    expect(store.panelArrangement).toEqual(emptyArrangement());
  });
});
