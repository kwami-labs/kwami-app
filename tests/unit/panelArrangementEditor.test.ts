/**
 * The editor really changes the sidebar's state, and the layout reaches the account
 * only after the account's own layout has been read.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { defineComponent, h, nextTick } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import PanelArrangementEditor from '@/components/panels/settings/theme/PanelArrangementEditor.vue';
import { useUiLayoutSync } from '@/composables/useUiLayoutSync';
import { layoutEn } from '@/i18n/layout.locale';
import { useUIStore } from '@/stores/ui';
import { useAuthStore } from '@/stores/auth';

const db = vi.hoisted(() => ({
  loadUserLocaleFromDb: vi.fn(async () => {}),
  loadUserUiFromDb: vi.fn(async (): Promise<Record<string, unknown> | null> => null),
  saveUserUiToDb: vi.fn(async () => {}),
}));

vi.mock('@/lib/userAppSettings', () => db);

function i18n() {
  return createI18n({
    legacy: false,
    locale: 'en',
    missingWarn: false,
    fallbackWarn: false,
    messages: { en: layoutEn },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  setActivePinia(createPinia());
});

describe('PanelArrangementEditor', () => {
  function render() {
    return mount(PanelArrangementEditor, {
      global: {
        plugins: [i18n()],
        stubs: {
          PanelSection: { template: '<section><slot /></section>' },
          BaseButton: {
            template: '<button class="reset" @click="$emit(\'click\')"><slot /></button>',
          },
          'iconify-icon': true,
        },
      },
    });
  }

  function rowOf(wrapper: ReturnType<typeof render>, panel: string) {
    const row = wrapper
      .findAll('.layout-row')
      .find((r) => r.text().includes(`sidebar.panels.${panel}`));
    if (!row) throw new Error(`no row for ${panel}`);
    return row;
  }

  it('hides a panel', async () => {
    const wrapper = render();
    await rowOf(wrapper, 'audio').findAll('button')[2]!.trigger('click');
    expect(useUIStore().panelArrangement.hidden).toEqual(['audio']);
    // The global .hidden utility is display:none, and the name must stay readable.
    expect(rowOf(wrapper, 'audio').find('.layout-name').classes()).not.toContain('hidden');
    await rowOf(wrapper, 'audio').findAll('button')[2]!.trigger('click');
    expect(useUIStore().panelArrangement.hidden).toEqual([]);
  });

  it('moves a panel', async () => {
    const wrapper = render();
    await rowOf(wrapper, 'audio').findAll('button')[0]!.trigger('click');
    expect(useUIStore().panelArrangement.order.slice(0, 2)).toEqual(['audio', 'avatar']);
  });

  it('does not offer to hide the panel the editor lives in', () => {
    const buttons = rowOf(render(), 'theme').findAll('button');
    expect(buttons[2]!.attributes('disabled')).toBeDefined();
  });

  it('does not offer to move past the edges', () => {
    const wrapper = render();
    expect(rowOf(wrapper, 'avatar').findAll('button')[0]!.attributes('disabled')).toBeDefined();
    expect(rowOf(wrapper, 'theme').findAll('button')[1]!.attributes('disabled')).toBeDefined();
  });

  it('resets', async () => {
    useUIStore().setPanelHidden('audio', true);
    await render().find('.reset').trigger('click');
    expect(useUIStore().panelArrangement.hidden).toEqual([]);
  });
});

describe('useUiLayoutSync', () => {
  function start() {
    const auth = useAuthStore();
    vi.spyOn(auth, 'isAuthenticated', 'get').mockReturnValue(true);
    vi.spyOn(auth, 'userId', 'get').mockReturnValue('u1');
    return mount(
      defineComponent({
        setup() {
          useUiLayoutSync();
          return () => h('div');
        },
      }),
    );
  }

  it('applies the layout saved in the account, after the locale', async () => {
    db.loadUserUiFromDb.mockResolvedValue({ arrangement: { hidden: ['audio'], order: [] } });
    start();
    await flushPromises();
    expect(db.loadUserLocaleFromDb).toHaveBeenCalledWith('u1');
    expect(useUIStore().panelArrangement.hidden).toEqual(['audio']);
  });

  it('saves a later change', async () => {
    vi.useFakeTimers();
    try {
      start();
      await vi.waitFor(() => expect(db.loadUserUiFromDb).toHaveBeenCalled());
      await Promise.resolve();
      await Promise.resolve();
      useUIStore().setPanelHidden('audio', true);
      await nextTick();
      vi.advanceTimersByTime(1000);
      expect(db.saveUserUiToDb).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({
          arrangement: expect.objectContaining({ hidden: ['audio'] }),
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('never overwrites the account before reading it', async () => {
    let finish = (_: null) => {};
    db.loadUserUiFromDb.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    vi.useFakeTimers();
    try {
      start();
      useUIStore().setPanelHidden('audio', true);
      await nextTick();
      vi.advanceTimersByTime(1000);
      expect(db.saveUserUiToDb).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
      finish(null);
    }
  });
});
