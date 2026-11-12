import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import {
  checkForUpdate,
  currentBuild,
  forceFreshReload,
  setUpdateRegistration,
} from '../../src/lib/appUpdate';
import AppUpdateSection from '../../src/components/panels/settings/account/AppUpdateSection.vue';
import { flushPromises } from '../helpers/mount';

function fakeRegistration(found: 'installing' | 'waiting' | null, fails = false) {
  const registration = {
    installing: null as unknown,
    waiting: null as unknown,
    update: vi.fn(async () => {
      if (fails) throw new Error('network');
      if (found) registration[found] = {};
    }),
  };
  return registration as unknown as ServiceWorkerRegistration & {
    update: ReturnType<typeof vi.fn>;
  };
}

afterEach(() => {
  setUpdateRegistration(null);
  vi.restoreAllMocks();
});

describe('currentBuild', () => {
  it('exposes the commit and time injected at build time', () => {
    const build = currentBuild();
    expect(build.sha).toMatch(/^([0-9a-f]{7}|dev)$/);
    expect(Number.isNaN(new Date(build.builtAt).getTime())).toBe(false);
  });
});

describe('checkForUpdate', () => {
  it('is unavailable without a registered worker', async () => {
    await expect(checkForUpdate()).resolves.toBe('unavailable');
  });

  it('reports a new worker that is installing or waiting', async () => {
    setUpdateRegistration(fakeRegistration('installing'));
    await expect(checkForUpdate()).resolves.toBe('updating');
    setUpdateRegistration(fakeRegistration('waiting'));
    await expect(checkForUpdate()).resolves.toBe('updating');
  });

  it('reports the latest build when nothing new was found', async () => {
    const registration = fakeRegistration(null);
    setUpdateRegistration(registration);
    await expect(checkForUpdate()).resolves.toBe('latest');
    expect(registration.update).toHaveBeenCalledTimes(1);
  });

  it('reports offline when the browser is offline or the check fails', async () => {
    setUpdateRegistration(fakeRegistration(null, true));
    await expect(checkForUpdate()).resolves.toBe('offline');

    const registration = fakeRegistration(null);
    setUpdateRegistration(registration);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await expect(checkForUpdate()).resolves.toBe('offline');
    expect(registration.update).not.toHaveBeenCalled();
  });
});

describe('forceFreshReload', () => {
  it('unregisters the workers, empties the caches and reloads', async () => {
    const unregister = vi.fn(async () => true);
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { getRegistrations: vi.fn(async () => [{ unregister }, { unregister }]) },
      configurable: true,
    });
    const del = vi.fn(async () => true);
    vi.stubGlobal('caches', { keys: vi.fn(async () => ['a', 'b']), delete: del });
    const reload = vi.fn();

    await forceFreshReload(reload);

    expect(unregister).toHaveBeenCalledTimes(2);
    expect(del).toHaveBeenCalledWith('a');
    expect(del).toHaveBeenCalledWith('b');
    expect(reload).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('still reloads when workers and caches cannot be reached', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { getRegistrations: vi.fn(async () => Promise.reject(new Error('denied'))) },
      configurable: true,
    });
    vi.stubGlobal('caches', { keys: vi.fn(async () => Promise.reject(new Error('denied'))) });
    const reload = vi.fn();

    await forceFreshReload(reload);

    expect(reload).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});

describe('AppUpdateSection', () => {
  it('shows the running build and the result of a check', async () => {
    setUpdateRegistration(fakeRegistration(null));
    const wrapper = mount(AppUpdateSection);
    expect(wrapper.get('[data-testid="app-build"]').text()).toContain(
      `Build ${currentBuild().sha}`,
    );
    expect(wrapper.find('[data-testid="app-update-result"]').exists()).toBe(false);

    await wrapper.get('[data-testid="app-update-check"]').trigger('click');
    await flushPromises();

    expect(wrapper.get('[data-testid="app-update-result"]').text()).toContain(
      'You have the latest version.',
    );
  });

  it('says a new version is on its way when one is found', async () => {
    setUpdateRegistration(fakeRegistration('waiting'));
    const wrapper = mount(AppUpdateSection);
    await wrapper.get('[data-testid="app-update-check"]').trigger('click');
    await flushPromises();
    expect(wrapper.get('[data-testid="app-update-result"]').text()).toContain('downloading');
  });

  it('runs the clean reload from its button', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { getRegistrations: vi.fn(async () => []) },
      configurable: true,
    });
    vi.stubGlobal('caches', { keys: vi.fn(async () => []), delete: vi.fn() });
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });

    const wrapper = mount(AppUpdateSection);
    await wrapper.get('[data-testid="app-update-force"]').trigger('click');
    await flushPromises();

    expect(reload).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
