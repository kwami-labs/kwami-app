/** Work beyond a call: where it goes, the cloud's switch, asking from the app, sync. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import BrainCloud from '@/components/panels/settings/models/BrainCloud.vue';
import { ApiError } from '@/lib/apiClient';
import { brainCloudEn } from '@/i18n/brainCloud.locale';
import { useWorkspaceStore } from '@/stores/workspace';

enableAutoUnmount(afterEach);

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn() }));

vi.mock('@/lib/apiClient', async (original) => ({
  ...(await original<typeof import('@/lib/apiClient')>()),
  api,
}));

const en = brainCloudEn.brainCloud;

function places(over: Record<string, unknown> = {}) {
  return {
    pc: { online: false, claude_login: false },
    cloud: { online: true, enabled: true },
    sync: { pending: 0 },
    auto: 'cloud',
    ...over,
  };
}

function apiError(status: number) {
  return new ApiError({ message: 'x', status, code: 'unknown', method: 'GET', url: '/x' } as never);
}

function respond(
  where: unknown = places(),
  jobs: Record<string, unknown>[] = [],
  items: Record<string, unknown>[] = [],
) {
  api.get.mockImplementation(async (path: string) => {
    if (path === '/brain/where') {
      if (where instanceof Error) throw where;
      return where;
    }
    if (path === '/brain/jobs') return { jobs };
    return { items };
  });
  api.put.mockResolvedValue({ enabled: true });
  api.post.mockResolvedValue({ id: 'j1', thread_id: 't1', target: 'auto', where: 'cloud' });
}

async function render() {
  const wrapper = mount(BrainCloud, {
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en: brainCloudEn } })],
      stubs: {
        BaseButton: {
          emits: ['click'],
          template: '<button @click="$emit(\'click\')"><slot /></button>',
        },
        BaseSelect: {
          props: ['modelValue', 'options'],
          emits: ['update:modelValue'],
          template:
            '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option></select>',
        },
        BaseToggle: {
          props: ['modelValue', 'label'],
          emits: ['update:modelValue'],
          template:
            '<input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
        },
        'iconify-icon': true,
      },
    },
  });
  await flushPromises();
  return wrapper;
}

function button(wrapper: Awaited<ReturnType<typeof render>>, label: string) {
  const found = wrapper.findAll('button').find((b) => b.text() === label);
  if (!found) throw new Error(`no button ${label}`);
  return found;
}

beforeEach(() => {
  vi.clearAllMocks();
  setActivePinia(createPinia());
  useWorkspaceStore().activeWorkspaceId = 'k1';
});

describe('BrainCloud', () => {
  it('says where the PC and the cloud stand, and where new work goes', async () => {
    respond(places({ sync: { pending: 2 } }));
    const wrapper = await render();
    expect(wrapper.text()).toContain(en.pcOff);
    expect(wrapper.text()).toContain(en.cloudReady);
    expect(wrapper.text()).toContain(en.auto.cloud);
    expect(wrapper.text()).toContain('waiting for the PC: 2');
  });

  it('names the Claude account when the PC has one', async () => {
    respond(places({ pc: { online: true, claude_login: true }, auto: 'pc' }));
    expect((await render()).text()).toContain(en.pcOnLogin);
    respond(
      places({
        pc: { online: true, claude_login: false },
        cloud: { online: false, enabled: false },
      }),
    );
    const wrapper = await render();
    expect(wrapper.text()).toContain(en.pcOn);
    expect(wrapper.text()).toContain(en.cloudAway);
  });

  it('stops asking a server that cannot do it', async () => {
    respond(apiError(503));
    const wrapper = await render();
    expect(wrapper.text()).toContain(en.unavailable);
    expect(wrapper.findAll('button')).toHaveLength(0);
  });

  it('keeps quiet through a blip', async () => {
    respond(new Error('down'));
    const wrapper = await render();
    expect(wrapper.text()).not.toContain(en.unavailable);
  });

  it('switches the cloud on and off', async () => {
    respond();
    const wrapper = await render();
    await wrapper.find('input[type="checkbox"]').setValue(false);
    await flushPromises();
    expect(api.put).toHaveBeenCalledWith('/brain/cloud', { enabled: false });
    api.put.mockRejectedValueOnce(new Error('down'));
    await wrapper.find('input[type="checkbox"]').setValue(true);
    await flushPromises();
    expect(wrapper.text()).toContain(en.failed);
  });

  it('asks for work and says who will do it', async () => {
    respond();
    const wrapper = await render();
    await wrapper.find('textarea').setValue('  Resume mi semana ');
    await wrapper.find('select').setValue('cloud');
    await button(wrapper, en.ask).trigger('click');
    await flushPromises();
    expect(api.post).toHaveBeenCalledWith('/brain/jobs', {
      kwami_id: 'k1',
      task: 'Resume mi semana',
      target: 'cloud',
    });
    expect(wrapper.text()).toContain(en.queued.cloud);
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('');
  });

  it('asks nothing with no words or no kwami', async () => {
    respond();
    const wrapper = await render();
    await button(wrapper, en.ask).trigger('click');
    useWorkspaceStore().activeWorkspaceId = null as never;
    await wrapper.find('textarea').setValue('algo');
    await button(wrapper, en.ask).trigger('click');
    await flushPromises();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('tells a full queue from any other failure', async () => {
    respond();
    const wrapper = await render();
    api.post.mockRejectedValueOnce(apiError(429));
    await wrapper.find('textarea').setValue('algo');
    await button(wrapper, en.ask).trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain(en.tooMany);
    api.post.mockRejectedValueOnce(new Error('down'));
    await wrapper.find('textarea').setValue('algo');
    await button(wrapper, en.ask).trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain(en.failed);
  });

  it('lists recent work, where it ran, and cancels what is not over', async () => {
    respond(places(), [
      { id: 'a', title: 'Informe', status: 'running', ran_on: 'cloud', progress: 'Leyendo' },
      { id: 'b', title: 'Copia', status: 'done', ran_on: 'pc', progress: '' },
      { id: 'c', title: 'Nuevo', status: 'queued', ran_on: '', progress: '' },
    ]);
    const wrapper = await render();
    expect(wrapper.text()).toContain('Informe');
    expect(wrapper.text()).toContain(en.ranOnCloud);
    expect(wrapper.text()).toContain(en.ranOnPc);
    expect(wrapper.text()).toContain('Leyendo');
    const cancels = wrapper.findAll('button').filter((b) => b.text() === en.cancel);
    expect(cancels).toHaveLength(2);
    api.post.mockRejectedValueOnce(new Error('over'));
    await cancels[0]!.trigger('click');
    await flushPromises();
    expect(api.post).toHaveBeenCalledWith('/brain/jobs/a/cancel');
  });

  it('says so when there is no work yet, and when there is no kwami', async () => {
    respond();
    expect((await render()).text()).toContain(en.noJobs);
    useWorkspaceStore().activeWorkspaceId = null as never;
    api.get.mockClear();
    await render();
    expect(api.get).not.toHaveBeenCalledWith('/brain/jobs', expect.anything());
  });

  it('lists what the cloud made and leaves what waits in the cloud on request', async () => {
    respond(
      places(),
      [],
      [
        { id: 's1', kind: 'files', title: '', status: 'pending', result: '' },
        { id: 's2', kind: 'patch', title: 'Arreglo', status: 'applied', result: 'PR abierto' },
        { id: 's3', kind: 'files', title: 'Viejo', status: 'discarded', result: '' },
      ],
    );
    const wrapper = await render();
    expect(wrapper.text()).toContain(en.syncKind.files);
    expect(wrapper.text()).toContain('PR abierto');
    expect(wrapper.text()).not.toContain('Viejo');
    api.post.mockRejectedValueOnce(new Error('gone'));
    await button(wrapper, en.discard).trigger('click');
    await flushPromises();
    expect(api.post).toHaveBeenCalledWith('/brain/sync/s1/discard');
  });

  it('keeps the places when only the lists fail', async () => {
    respond();
    api.get.mockImplementation(async (path: string) => {
      if (path === '/brain/where') return places();
      throw new Error('down');
    });
    const wrapper = await render();
    expect(wrapper.text()).toContain(en.cloudReady);
  });

  it('looks again every so often until it is gone', async () => {
    vi.useFakeTimers();
    try {
      respond();
      const wrapper = await render();
      const before = api.get.mock.calls.length;
      await vi.advanceTimersByTimeAsync(20_000);
      expect(api.get.mock.calls.length).toBeGreaterThan(before);
      wrapper.unmount();
      const after = api.get.mock.calls.length;
      await vi.advanceTimersByTimeAsync(40_000);
      expect(api.get.mock.calls.length).toBe(after);
    } finally {
      vi.useRealTimers();
    }
  });
});
