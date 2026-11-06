/**
 * The Access panel: the list of sites Jarvis may visit, Jarvis's requests, and the
 * rules the app previews before the API has the last word.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { mountWithPinia } from '../helpers/mount';
import { i18n, setLocale } from '../../src/i18n';
import { api } from '../../src/lib/apiClient';
import {
  DEFAULT_SITE_ACCESS,
  SITE_ACCESS_LEVELS,
  isSiteAccessLevel,
  siteAccessAllows,
  siteHost,
  siteHue,
} from '../../src/constants/siteAccess';
import { resetSiteAccess, useSiteAccess } from '../../src/composables/useSiteAccess';
import AccessPanel from '../../src/components/panels/settings/access/AccessPanel.vue';
import AccessLevelPicker from '../../src/components/panels/settings/access/AccessLevelPicker.vue';

enableAutoUnmount(afterEach);

const global = {
  global: {
    plugins: [i18n],
    stubs: { PanelHeaderControls: true },
  },
};

const LIST = {
  default: 'read',
  sites: [
    { id: 's2', pattern: 'github.com', access: 'write', reason: null },
    { id: 's1', pattern: 'evil.com', access: 'blocked', reason: null },
    { id: 'sx', pattern: 'odd.com', access: 'root', reason: null },
  ],
  pending: [{ id: 'r1', pattern: 'amazon.es', access: 'browse', reason: 'compare prices' }],
};

beforeEach(() => {
  setLocale('es');
  resetSiteAccess();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('site rules', () => {
  it('turns an address into the host the API keeps', () => {
    expect(siteHost('https://www.GitHub.com/x?y=1')).toBe('github.com');
    expect(siteHost('*.amazon.es')).toBe('amazon.es');
    expect(siteHost('mail.google.com.')).toBe('mail.google.com');
    for (const bad of ['', 'localhost', 'two words.com', 'http://[::1', 'a..b']) {
      expect(siteHost(bad)).toBeNull();
    }
  });

  it('orders the levels so each includes the ones before', () => {
    expect(SITE_ACCESS_LEVELS[0]).toBe('blocked');
    expect(siteAccessAllows('account', 'read')).toBe(true);
    expect(siteAccessAllows('read', 'browse')).toBe(false);
    expect(isSiteAccessLevel('write')).toBe(true);
    expect(isSiteAccessLevel('root')).toBe(false);
    expect(DEFAULT_SITE_ACCESS).toBe('account');
  });

  it('gives a site the same hue every time', () => {
    expect(siteHue('github.com')).toBe(siteHue('github.com'));
    expect(siteHue('github.com')).toBeGreaterThanOrEqual(0);
    expect(siteHue('github.com')).toBeLessThan(360);
  });
});

describe('useSiteAccess', () => {
  it('loads the list, sorted, without levels it does not know', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(LIST as never);
    const access = useSiteAccess();
    await access.load();
    expect(access.defaultLevel.value).toBe('read');
    expect(access.sites.value.map((s) => s.pattern)).toEqual(['evil.com', 'github.com']);
    expect(access.pending.value).toHaveLength(1);
    expect(access.blockedCount.value).toBe(1);
    expect(access.loaded.value).toBe(true);
  });

  it('marks an API without the route as unavailable, not as an open list', async () => {
    vi.spyOn(api, 'get').mockRejectedValue(new Error('404'));
    const access = useSiteAccess();
    await access.load();
    expect(access.unavailable.value).toBe(true);
    expect(access.loaded.value).toBe(false);
  });

  it('falls back to the default level when the API sends one it does not know', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ ...LIST, default: 'everything' } as never);
    const access = useSiteAccess();
    await access.load();
    expect(access.defaultLevel.value).toBe(DEFAULT_SITE_ACCESS);
  });

  it('adding a site Jarvis asked for answers the request', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(LIST as never);
    const put = vi.spyOn(api, 'put').mockResolvedValue({
      id: 'r1',
      pattern: 'amazon.es',
      access: 'read',
      reason: null,
    } as never);
    const access = useSiteAccess();
    await access.load();
    await access.setSite('https://www.amazon.es/', 'read');
    expect(put).toHaveBeenCalledWith('/access/sites', {
      address: 'https://www.amazon.es/',
      access: 'read',
    });
    expect(access.pending.value).toEqual([]);
    expect(access.sites.value.map((s) => s.pattern)).toContain('amazon.es');
  });

  it('puts a change back when the API refuses it', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(LIST as never);
    vi.spyOn(api, 'put').mockRejectedValue(new Error('500'));
    vi.spyOn(api, 'del').mockRejectedValue(new Error('500'));
    const access = useSiteAccess();
    await access.load();
    const github = access.sites.value.find((s) => s.pattern === 'github.com')!;

    await expect(access.changeSite(github, 'read')).rejects.toThrow();
    expect(access.sites.value.find((s) => s.id === 's2')!.access).toBe('write');
    await expect(access.setDefault('blocked')).rejects.toThrow();
    expect(access.defaultLevel.value).toBe('read');
    await expect(access.removeSite(github)).rejects.toThrow();
    expect(access.sites.value).toHaveLength(2);
  });

  it('changes, removes and sets the default', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(LIST as never);
    const put = vi.spyOn(api, 'put').mockResolvedValue({} as never);
    const del = vi.spyOn(api, 'del').mockResolvedValue(undefined as never);
    const access = useSiteAccess();
    await access.load();
    const github = access.sites.value.find((s) => s.pattern === 'github.com')!;

    await access.changeSite(github, 'browse');
    await access.setDefault('blocked');
    await access.removeSite(github);

    expect(put).toHaveBeenCalledWith('/access/sites', { address: 'github.com', access: 'browse' });
    expect(put).toHaveBeenCalledWith('/access/default', { access: 'blocked' });
    expect(del).toHaveBeenCalledWith('/access/sites/s2');
    expect(access.sites.value.map((s) => s.pattern)).toEqual(['evil.com']);
  });

  it('answers a request at the level chosen, or refuses it', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(LIST as never);
    const post = vi.spyOn(api, 'post').mockResolvedValue({} as never);
    const access = useSiteAccess();
    await access.load();
    const request = access.pending.value[0];

    await access.answer(request, true, 'read');
    expect(post).toHaveBeenCalledWith('/access/requests/r1', { approve: true, access: 'read' });
    expect(access.sites.value.find((s) => s.pattern === 'amazon.es')!.access).toBe('read');

    await access.answer({ ...request, id: 'r2' }, false, 'account');
    expect(post).toHaveBeenLastCalledWith('/access/requests/r2', { approve: false });
  });

  it('asks the API what Jarvis may do at an address', async () => {
    const get = vi
      .spyOn(api, 'get')
      .mockResolvedValue({ host: 'a.com', access: 'read', pattern: '*' } as never);
    await useSiteAccess().check('https://a.com/?q=1 2');
    expect(get).toHaveBeenCalledWith('/access/check?address=https%3A%2F%2Fa.com%2F%3Fq%3D1%202');
  });
});

describe('AccessLevelPicker', () => {
  it('picks a level by click and by arrow keys', async () => {
    const wrapper = mountWithPinia(AccessLevelPicker, {
      ...global,
      props: { modelValue: 'read', showHint: true },
    });
    const radios = wrapper.findAll('[role="radio"]');
    expect(radios).toHaveLength(5);
    expect(radios[1].attributes('aria-checked')).toBe('true');
    expect(wrapper.text()).toContain('Leer');

    await radios[3].trigger('click');
    await wrapper.find('[role="radiogroup"]').trigger('keydown', { key: 'ArrowRight' });
    await wrapper.find('[role="radiogroup"]').trigger('keydown', { key: 'ArrowLeft' });
    await wrapper.find('[role="radiogroup"]').trigger('keydown', { key: 'Enter' });
    expect(wrapper.emitted('update:modelValue')).toEqual([['write'], ['browse'], ['blocked']]);
  });

  it('stops at the ends', async () => {
    const wrapper = mountWithPinia(AccessLevelPicker, {
      ...global,
      props: { modelValue: 'account', compact: true },
    });
    await wrapper.find('[role="radiogroup"]').trigger('keydown', { key: 'ArrowRight' });
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    expect(wrapper.find('.label').exists()).toBe(false);
  });
});

describe('AccessPanel', () => {
  it('shows the requests, the list and the default', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(LIST as never);
    const wrapper = mountWithPinia(AccessPanel, global);
    await flushPromises();

    expect(wrapper.find('.request').text()).toContain('amazon.es');
    expect(wrapper.find('.request').text()).toContain('compare prices');
    expect(wrapper.findAll('.site').map((s) => s.find('.host').text())).toEqual([
      'evil.com',
      'github.com',
    ]);
    expect(wrapper.find('.hero-stats').text()).toContain('1');
  });

  it('adds a site from the form, previewing its host', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ default: 'account', sites: [], pending: [] } as never);
    const put = vi.spyOn(api, 'put').mockResolvedValue({
      id: 'n1',
      pattern: 'github.com',
      access: 'browse',
      reason: null,
    } as never);
    const wrapper = mountWithPinia(AccessPanel, global);
    await flushPromises();

    const input = wrapper.find('.address input');
    await input.setValue('nope');
    expect(wrapper.find('.address').classes()).toContain('invalid');
    await input.setValue('https://www.github.com/me');
    expect(wrapper.find('.preview').text()).toBe('github.com');
    await wrapper.find('form.add').trigger('submit');
    await flushPromises();

    expect(put).toHaveBeenCalledWith('/access/sites', {
      address: 'https://www.github.com/me',
      access: 'browse',
    });
    expect(wrapper.findAll('.site')).toHaveLength(1);
    expect((input.element as HTMLInputElement).value).toBe('');
  });

  it('fills the form from a suggestion', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ default: 'account', sites: [], pending: [] } as never);
    const wrapper = mountWithPinia(AccessPanel, global);
    await flushPromises();
    await wrapper.find('.suggestion').trigger('click');
    expect((wrapper.find('.address input').element as HTMLInputElement).value).toBe('google.com');
  });

  it('asks twice before removing a site', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(LIST as never);
    const del = vi.spyOn(api, 'del').mockResolvedValue(undefined as never);
    const wrapper = mountWithPinia(AccessPanel, global);
    await flushPromises();

    const remove = wrapper.find('.site .remove');
    await remove.trigger('click');
    expect(del).not.toHaveBeenCalled();
    expect(remove.classes()).toContain('confirm');
    await remove.trigger('click');
    await flushPromises();
    expect(del).toHaveBeenCalledWith('/access/sites/s1');
  });

  it('approves a request at the level picked on its card', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(LIST as never);
    const post = vi.spyOn(api, 'post').mockResolvedValue({} as never);
    const wrapper = mountWithPinia(AccessPanel, global);
    await flushPromises();

    const card = wrapper.find('.request');
    await card.findAll('[role="radio"]')[1].trigger('click');
    await card.find('.btn.primary').trigger('click');
    await flushPromises();

    expect(post).toHaveBeenCalledWith('/access/requests/r1', { approve: true, access: 'read' });
    expect(wrapper.find('.request').exists()).toBe(false);
  });

  it('tests an address and names the rule that decides', async () => {
    const get = vi.spyOn(api, 'get').mockImplementation(((path: string) =>
      Promise.resolve(
        path.startsWith('/access/check')
          ? { host: 'api.github.com', access: 'write', pattern: 'github.com' }
          : LIST,
      )) as never);
    const wrapper = mountWithPinia(AccessPanel, global);
    await flushPromises();

    const tester = wrapper.find('form.tester');
    await tester.find('input').setValue('localhost');
    await tester.trigger('submit');
    expect(wrapper.text()).toContain(i18n.global.t('siteAccess.add.invalid'));

    await tester.find('input').setValue('https://api.github.com');
    await tester.trigger('submit');
    await flushPromises();
    expect(get).toHaveBeenCalledWith('/access/check?address=https%3A%2F%2Fapi.github.com');
    expect(wrapper.find('.test-result').text()).toContain('github.com');
  });

  it('says so when the server has no list', async () => {
    vi.spyOn(api, 'get').mockRejectedValue(new Error('404'));
    const wrapper = mountWithPinia(AccessPanel, global);
    await flushPromises();
    expect(wrapper.find('.notice').text()).toContain(i18n.global.t('siteAccess.unavailable'));
  });

  it('looks for new requests while it is open', async () => {
    vi.useFakeTimers();
    const get = vi.spyOn(api, 'get').mockResolvedValue(LIST as never);
    mountWithPinia(AccessPanel, global);
    await flushPromises();
    const before = get.mock.calls.length;
    await vi.advanceTimersByTimeAsync(15_000);
    expect(get.mock.calls.length).toBe(before + 1);
  });
});
