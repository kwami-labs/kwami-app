/** The user's agents: listed, created, edited, run, scheduled and deleted from the panel. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import BrainAgents from '@/components/panels/settings/models/BrainAgents.vue';
import { ApiError } from '@/lib/apiClient';
import { brainCloudEn } from '@/i18n/brainCloud.locale';
import { useWorkspaceStore } from '@/stores/workspace';

enableAutoUnmount(afterEach);

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn() }));

vi.mock('@/lib/apiClient', async (original) => ({
  ...(await original<typeof import('@/lib/apiClient')>()),
  api,
}));

const en = brainCloudEn.brainAgents;
const AGENT = {
  id: 'a1',
  name: 'facturas',
  description: 'Revisa las facturas',
  prompt: 'Lee y resume',
  model: 'claude-sonnet-5-5',
  tools: ['Read'],
  effort: 'medium',
  target: 'cloud',
  enabled: true,
};

function apiError(status: number, body?: unknown) {
  return new ApiError({
    message: 'x',
    status,
    code: 'unknown',
    body,
    method: 'POST',
    url: '/x',
  } as never);
}

function respond(agents: Record<string, unknown>[] = [AGENT]) {
  api.get.mockResolvedValue({
    agents,
    models: ['claude-haiku-5-5', 'claude-sonnet-5-5'],
    tools: ['Read', 'Bash'],
  });
  api.post.mockResolvedValue({});
  api.put.mockResolvedValue({});
  api.del.mockResolvedValue(undefined);
}

async function render() {
  const wrapper = mount(BrainAgents, {
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en: brainCloudEn } })],
      stubs: {
        BaseButton: {
          emits: ['click'],
          template: '<button @click="$emit(\'click\')"><slot /></button>',
        },
        BaseInput: {
          props: ['modelValue', 'label'],
          emits: ['update:modelValue'],
          template:
            '<input class="base-input" :data-label="label" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        },
        BaseSelect: {
          props: ['modelValue', 'options', 'label'],
          emits: ['update:modelValue'],
          template:
            '<select :data-label="label" :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option></select>',
        },
        BaseToggle: {
          props: ['modelValue'],
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

type Wrapper = Awaited<ReturnType<typeof render>>;

function button(wrapper: Wrapper, label: string) {
  const found = wrapper.findAll('button').find((b) => b.text() === label);
  if (!found) throw new Error(`no button ${label}`);
  return found;
}

function field(wrapper: Wrapper, label: string) {
  const found = wrapper.find(`[data-label="${label}"]`);
  if (!found.exists()) throw new Error(`no field ${label}`);
  return found;
}

beforeEach(() => {
  vi.clearAllMocks();
  setActivePinia(createPinia());
  useWorkspaceStore().activeWorkspaceId = 'k1';
});

describe('BrainAgents', () => {
  it('lists the agents with what they run on and where', async () => {
    respond();
    const wrapper = await render();
    expect(wrapper.text()).toContain('facturas');
    expect(wrapper.text()).toContain('claude-sonnet-5-5');
    expect(wrapper.text()).toContain(brainCloudEn.brainCloud.target.cloud);
  });

  it('says when there are none, and when the server cannot keep them', async () => {
    respond([]);
    expect((await render()).text()).toContain(en.empty);
    api.get.mockRejectedValue(apiError(503));
    const wrapper = await render();
    expect(wrapper.text()).toContain(en.unavailable);
    api.get.mockRejectedValue(new Error('down'));
    expect((await render()).text()).not.toContain(en.unavailable);
  });

  it('creates an agent with the tools chosen', async () => {
    respond([]);
    const wrapper = await render();
    await button(wrapper, en.add).trigger('click');
    await field(wrapper, en.name).setValue(' informes ');
    await field(wrapper, en.description).setValue('Escribe informes');
    await wrapper.find('textarea').setValue('Escribe un informe semanal');
    await field(wrapper, en.model).setValue('claude-haiku-5-5');
    await field(wrapper, en.effort).setValue('high');
    await field(wrapper, en.where).setValue('pc');
    const tools = wrapper.findAll('button.tool');
    await tools.find((b) => b.text() === 'Bash')!.trigger('click');
    await tools.find((b) => b.text() === 'Read')!.trigger('click');
    await wrapper.find('input[type="checkbox"]').setValue(false);
    await button(wrapper, en.save).trigger('click');
    await flushPromises();
    expect(api.post).toHaveBeenCalledWith('/brain/agents', {
      name: 'informes',
      description: 'Escribe informes',
      prompt: 'Escribe un informe semanal',
      model: 'claude-haiku-5-5',
      tools: ['Glob', 'Grep', 'Bash'],
      effort: 'high',
      target: 'pc',
      enabled: false,
    });
    expect(wrapper.find('textarea').exists()).toBe(false);
  });

  it('refuses a bad name before asking the server', async () => {
    respond([]);
    const wrapper = await render();
    await button(wrapper, en.add).trigger('click');
    await field(wrapper, en.name).setValue('Con Espacios');
    await button(wrapper, en.save).trigger('click');
    expect(wrapper.text()).toContain(en.badName);
    expect(api.post).not.toHaveBeenCalled();
  });

  it('shows what the server refused, or a plain failure', async () => {
    respond([]);
    const wrapper = await render();
    await button(wrapper, en.add).trigger('click');
    await field(wrapper, en.name).setValue('informes');
    api.post.mockRejectedValueOnce(apiError(400, { detail: 'name: already in use' }));
    await button(wrapper, en.save).trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('name: already in use');
    api.post.mockRejectedValueOnce(new Error('down'));
    await button(wrapper, en.save).trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain(en.failed);
  });

  it('edits an agent and can drop the edit', async () => {
    respond();
    const wrapper = await render();
    await button(wrapper, en.edit).trigger('click');
    expect((field(wrapper, en.name).element as HTMLInputElement).value).toBe('facturas');
    await field(wrapper, en.description).setValue('Otra cosa');
    await button(wrapper, en.save).trigger('click');
    await flushPromises();
    expect(api.put).toHaveBeenCalledWith(
      '/brain/agents/a1',
      expect.objectContaining({ name: 'facturas', description: 'Otra cosa', tools: ['Read'] }),
    );
    await button(wrapper, en.edit).trigger('click');
    await button(wrapper, en.cancel).trigger('click');
    expect(wrapper.find('textarea').exists()).toBe(false);
  });

  it('runs an agent, with or without words of its own', async () => {
    respond();
    const wrapper = await render();
    const input = wrapper.findAll('input.base-input')[0]!;
    await input.setValue('Solo octubre');
    await button(wrapper, en.run).trigger('click');
    await flushPromises();
    expect(api.post).toHaveBeenCalledWith('/brain/agents/a1/run', {
      kwami_id: 'k1',
      task: 'Solo octubre',
    });
    expect(wrapper.text()).toContain('Queued for facturas.');
    api.post.mockRejectedValueOnce(apiError(429));
    await button(wrapper, en.run).trigger('click');
    await flushPromises();
    expect(api.post).toHaveBeenLastCalledWith('/brain/agents/a1/run', { kwami_id: 'k1', task: '' });
    expect(wrapper.text()).toContain(brainCloudEn.brainCloud.tooMany);
    api.post.mockRejectedValueOnce(new Error('down'));
    await button(wrapper, en.run).trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain(brainCloudEn.brainCloud.failed);
  });

  it('schedules an agent every day at a time', async () => {
    respond();
    const wrapper = await render();
    await wrapper.find('input[type="time"]').setValue('07:30');
    await button(wrapper, en.scheduleSave).trigger('click');
    await flushPromises();
    expect(api.post).toHaveBeenCalledWith('/assistant/tasks', {
      kwami_id: 'k1',
      kind: 'work',
      title: 'facturas',
      recurrence: 'daily',
      local_time: '07:30',
      agent_id: 'a1',
      target: 'cloud',
    });
    expect(wrapper.text()).toContain('every day at 07:30');
    api.post.mockRejectedValueOnce(new Error('down'));
    await button(wrapper, en.scheduleSave).trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain(en.failed);
  });

  it('does nothing that needs a kwami without one', async () => {
    respond();
    useWorkspaceStore().activeWorkspaceId = null as never;
    const wrapper = await render();
    await button(wrapper, en.run).trigger('click');
    await button(wrapper, en.scheduleSave).trigger('click');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('deletes an agent, even the one being edited', async () => {
    respond();
    const wrapper = await render();
    await button(wrapper, en.edit).trigger('click');
    await button(wrapper, en.remove).trigger('click');
    await flushPromises();
    expect(api.del).toHaveBeenCalledWith('/brain/agents/a1');
    expect(wrapper.find('textarea').exists()).toBe(false);
    api.del.mockRejectedValueOnce(new Error('down'));
    await button(wrapper, en.remove).trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain(en.failed);
  });

  it('leaves a switched-off agent without run or schedule', async () => {
    respond([{ ...AGENT, enabled: false }]);
    const wrapper = await render();
    expect(wrapper.findAll('button').some((b) => b.text() === en.run)).toBe(false);
    expect(wrapper.find('input[type="time"]').exists()).toBe(false);
  });
});
