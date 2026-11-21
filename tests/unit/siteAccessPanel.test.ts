/**
 * The Access panel, button by button (2026-11-17): every control does one thing, says
 * what it did, and never shows the user a list that is not the one Jarvis keeps to.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { mountWithPinia } from '../helpers/mount';
import { i18n, setLocale } from '../../src/i18n';
import { api } from '../../src/lib/apiClient';
import { resetSiteAccess, useSiteAccess } from '../../src/composables/useSiteAccess';
import AccessPanel from '../../src/components/panels/settings/access/AccessPanel.vue';
import AccessLevelPicker from '../../src/components/panels/settings/access/AccessLevelPicker.vue';

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}));
vi.mock('vue-toastification', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-toastification')>()),
  useToast: () => toast,
}));

enableAutoUnmount(afterEach);

// Rows and results leave at once: a leave animation waits on an event jsdom never sends.
const global = {
  global: {
    plugins: [i18n],
    stubs: { PanelHeaderControls: true, transition: true, 'transition-group': true },
  },
};
const t = i18n.global.t;

const ONE = {
  default: 'account',
  sites: [{ id: 's1', pattern: 'github.com', access: 'write', reason: null }],
  pending: [],
};

function rule(pattern: string, access: string, id = `id-${pattern}`) {
  return { id, pattern, access, reason: null };
}

beforeEach(() => {
  setLocale('es');
  resetSiteAccess();
  for (const fn of Object.values(toast)) fn.mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('what the panel says', () => {
  it('counts in proper Spanish, one and many', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      ...ONE,
      pending: [rule('amazon.es', 'browse', 'r1')],
    } as never);
    const wrapper = mountWithPinia(AccessPanel, global);
    await flushPromises();
    const stats = wrapper.find('.hero-stats').text();
    expect(stats).toContain('1 sitio');
    expect(stats).not.toContain('1 sitios');
    expect(stats).toContain('0 bloqueados');
    expect(stats).toContain('1 solicitud');
    expect(wrapper.text()).toContain('Añadir un sitio');
    expect(wrapper.text()).toContain('Dónde puede entrar Jarvis');
    expect(wrapper.find('.hero-where').text()).toContain('tu Chrome');
  });

  it('warns that blocking every other site leaves only the list', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ ...ONE, default: 'blocked' } as never);
    const wrapper = mountWithPinia(AccessPanel, global);
    await flushPromises();
    expect(wrapper.text()).toContain(t('siteAccess.default.onlyList'));
  });
});

describe('every other site', () => {
  it('shows it was saved, and puts it back with a word when it was not', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(ONE as never);
    const put = vi.spyOn(api, 'put').mockResolvedValue({} as never);
    const wrapper = mountWithPinia(AccessPanel, global);
    await flushPromises();

    const firstPicker = wrapper.findAllComponents(AccessLevelPicker)[0];
    await firstPicker.findAll('[role="radio"]')[1].trigger('click');
    await flushPromises();
    expect(put).toHaveBeenCalledWith('/access/default', { access: 'read' });
    expect(wrapper.find('.saved-note').exists()).toBe(true);

    put.mockRejectedValueOnce(new Error('500'));
    await firstPicker.findAll('[role="radio"]')[0].trigger('click');
    await flushPromises();
    expect(useSiteAccess().defaultLevel.value).toBe('read');
    expect(toast.error).toHaveBeenCalledWith(t('siteAccess.saveFailed'));
  });
});

describe('adding', () => {
  it('adds a suggestion in one tap, at the level it suggests', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ ...ONE, sites: [] } as never);
    const put = vi.spyOn(api, 'put').mockResolvedValue(rule('google.com', 'browse', 'n1') as never);
    const wrapper = mountWithPinia(AccessPanel, global);
    await flushPromises();

    const chip = wrapper.find('.suggestion');
    expect(chip.attributes('title')).toBe('Añadir como Navegar');
    await chip.trigger('click');
    await flushPromises();
    expect(put).toHaveBeenCalledWith('/access/sites', { address: 'google.com', access: 'browse' });
    expect(wrapper.findAll('.site .host').map((h) => h.text())).toEqual(['google.com']);
    expect(toast.success).toHaveBeenCalledWith('google.com añadido: Navegar.');
    expect(wrapper.findAll('.suggestion').map((s) => s.text())).not.toContain('google.com');
  });

  it('says a site already in the list is changed, not added', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(ONE as never);
    vi.spyOn(api, 'put').mockResolvedValue(rule('github.com', 'read', 's1') as never);
    const wrapper = mountWithPinia(AccessPanel, global);
    await flushPromises();

    await wrapper.find('.address input').setValue('https://github.com/me');
    expect(wrapper.text()).toContain('github.com ya está en tu lista (Escribir)');
    expect(wrapper.find('form.add button[type="submit"]').text()).toBe('Cambiar nivel');
    await wrapper.find('form.add').trigger('submit');
    await flushPromises();
    expect(toast.success).toHaveBeenCalledWith('github.com pasa a Navegar.');
    expect(wrapper.findAll('.site')).toHaveLength(1);
  });

  it('keeps what was typed when saving fails', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ ...ONE, sites: [] } as never);
    vi.spyOn(api, 'put').mockRejectedValue(new Error('500'));
    const wrapper = mountWithPinia(AccessPanel, global);
    await flushPromises();

    await wrapper.find('.address input').setValue('wikipedia.org');
    await wrapper.find('form.add').trigger('submit');
    await flushPromises();
    expect((wrapper.find('.address input').element as HTMLInputElement).value).toBe(
      'wikipedia.org',
    );
    expect(toast.error).toHaveBeenCalled();
    await wrapper.find('.suggestion').trigger('click');
    await flushPromises();
    expect(wrapper.findAll('.site')).toHaveLength(0);
  });

  it('ignores a second tap while one is being saved', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ ...ONE, sites: [] } as never);
    let done: (value: unknown) => void = () => {};
    const put = vi
      .spyOn(api, 'put')
      .mockImplementation((() => new Promise((resolve) => (done = resolve))) as never);
    const wrapper = mountWithPinia(AccessPanel, global);
    await flushPromises();

    await wrapper.find('.suggestion').trigger('click');
    await wrapper.find('form.add').trigger('submit');
    await wrapper.findAll('.suggestion')[1].trigger('click');
    expect(put).toHaveBeenCalledTimes(1);
    done(rule('google.com', 'browse'));
    await flushPromises();
  });
});

describe('removing', () => {
  it('can be undone from its toast', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(ONE as never);
    vi.spyOn(api, 'del').mockResolvedValue(undefined as never);
    const put = vi.spyOn(api, 'put').mockResolvedValue(rule('github.com', 'write', 's9') as never);
    const wrapper = mountWithPinia(AccessPanel, global);
    await flushPromises();

    const remove = wrapper.find('.site .remove');
    await remove.trigger('click');
    await remove.trigger('click');
    await flushPromises();
    expect(wrapper.findAll('.site')).toHaveLength(0);
    const [text, options] = toast.info.mock.calls[0] as [string, { onClick: () => void }];
    expect(text).toBe('github.com quitado. Toca aquí para deshacer.');

    options.onClick();
    await flushPromises();
    expect(put).toHaveBeenCalledWith('/access/sites', { address: 'github.com', access: 'write' });
    expect(wrapper.findAll('.site .host').map((h) => h.text())).toEqual(['github.com']);
  });

  it('a failed removal keeps the site and offers no undo', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(ONE as never);
    vi.spyOn(api, 'del').mockRejectedValue(new Error('500'));
    const wrapper = mountWithPinia(AccessPanel, global);
    await flushPromises();
    const remove = wrapper.find('.site .remove');
    await remove.trigger('click');
    await remove.trigger('click');
    await flushPromises();
    expect(wrapper.findAll('.site')).toHaveLength(1);
    expect(toast.info).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it('Escape takes back the question', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(ONE as never);
    const wrapper = mountWithPinia(AccessPanel, global);
    await flushPromises();
    const remove = wrapper.find('.site .remove');
    await remove.trigger('click');
    expect(remove.classes()).toContain('confirm');
    await wrapper.find('.access-panel').trigger('keydown', { key: 'Escape' });
    expect(remove.classes()).not.toContain('confirm');
    await wrapper.find('.access-panel').trigger('keydown', { key: 'Escape' });
  });
});

describe('a steady list', () => {
  it('a refresh that fails once loaded keeps the list and says it is not live', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue(ONE as never);
    const wrapper = mountWithPinia(AccessPanel, global);
    await flushPromises();

    get.mockRejectedValueOnce(new Error('offline'));
    await useSiteAccess().load();
    await flushPromises();
    expect(wrapper.find('.notice').exists()).toBe(false);
    expect(wrapper.findAll('.site')).toHaveLength(1);
    expect(wrapper.find('.stat.offline').text()).toContain('Sin conexión');

    await useSiteAccess().load();
    await flushPromises();
    expect(wrapper.find('.stat.offline').exists()).toBe(false);
  });

  it('a refresh that began before a change does not undo it', async () => {
    let answer: (value: unknown) => void = () => {};
    vi.spyOn(api, 'get')
      .mockResolvedValueOnce(ONE as never)
      .mockImplementationOnce((() => new Promise((resolve) => (answer = resolve))) as never);
    vi.spyOn(api, 'put').mockResolvedValue({} as never);
    const access = useSiteAccess();
    await access.load();

    const refresh = access.load();
    await access.changeSite(access.sites.value[0], 'read');
    answer(ONE);
    await refresh;
    expect(access.sites.value[0].access).toBe('read');
  });

  it('only the newest choice for a site may put it back', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(ONE as never);
    let fail: (reason: unknown) => void = () => {};
    vi.spyOn(api, 'put')
      .mockImplementationOnce((() => new Promise((_resolve, reject) => (fail = reject))) as never)
      .mockResolvedValueOnce({} as never);
    const access = useSiteAccess();
    await access.load();
    const github = access.sites.value[0];

    const first = access.changeSite(github, 'read');
    await access.changeSite(github, 'browse');
    fail(new Error('500'));
    await expect(first).rejects.toThrow();
    expect(access.sites.value[0].access).toBe('browse');
  });
});

describe('testing an address', () => {
  it('tells a failed question from a bad address, and stays current', async () => {
    let level = 'write';
    const get = vi
      .spyOn(api, 'get')
      .mockImplementation(((path: string) =>
        path.startsWith('/access/check')
          ? Promise.resolve({ host: 'github.com', access: level, pattern: 'github.com' })
          : Promise.resolve(ONE)) as never);
    vi.spyOn(api, 'put').mockResolvedValue({} as never);
    const wrapper = mountWithPinia(AccessPanel, global);
    await flushPromises();

    const tester = wrapper.find('form.tester');
    expect(tester.find('button').attributes('disabled')).toBeDefined();
    await tester.find('input').setValue('github.com');
    await tester.trigger('submit');
    await flushPromises();
    expect(wrapper.find('.test-result').text()).toContain('Escribir');

    // A rule changes: the answer on screen follows.
    level = 'read';
    await wrapper.findAll('.site [role="radio"]')[1].trigger('click');
    await flushPromises();
    expect(wrapper.find('.test-result').text()).toContain('Leer');

    // Another address: the old answer goes.
    await tester.find('input').setValue('gitlab.com');
    expect(wrapper.find('.test-result').exists()).toBe(false);

    get.mockRejectedValueOnce(new Error('offline'));
    await tester.trigger('submit');
    await flushPromises();
    expect(wrapper.text()).toContain(t('siteAccess.test.failed'));
    expect(wrapper.text()).not.toContain(t('siteAccess.add.invalid'));
  });
});

describe('the level picker', () => {
  it('moves the focus with the arrows, and goes to the ends with Home and End', async () => {
    const wrapper = mountWithPinia(AccessLevelPicker, {
      props: {
        modelValue: 'read',
        'onUpdate:modelValue': (v: string) => wrapper.setProps({ modelValue: v }),
      },
      attachTo: document.body,
      ...global,
    });
    const radios = () => wrapper.findAll('[role="radio"]');
    const group = wrapper.find('[role="radiogroup"]');

    await group.trigger('keydown', { key: 'ArrowRight' });
    await flushPromises();
    expect(radios()[2].attributes('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(radios()[2].element);

    await group.trigger('keydown', { key: 'End' });
    await flushPromises();
    expect(document.activeElement).toBe(radios()[4].element);
    await group.trigger('keydown', { key: 'End' });
    await group.trigger('keydown', { key: 'Home' });
    await flushPromises();
    expect(radios()[0].attributes('aria-checked')).toBe('true');
    await group.trigger('keydown', { key: 'ArrowUp' });
    await group.trigger('keydown', { key: 'ArrowDown' });
    await group.trigger('keydown', { key: 'a' });
    await flushPromises();
    expect(radios()[1].attributes('aria-checked')).toBe('true');
  });
});
