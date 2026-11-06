import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import ToolArgsForm from '@/components/panels/settings/tools/ToolArgsForm.vue';
import ToolTester from '@/components/panels/settings/tools/ToolTester.vue';
import type { ToolParam } from '@/lib/toolSchema';
import type { ToolGroupId } from '@/lib/toolRegistration';

const lastEmitted = (w: ReturnType<typeof mount>, event: string) =>
  (w.emitted(event) ?? []).at(-1)?.[0];

describe('ToolArgsForm', () => {
  const params: ToolParam[] = [
    { name: 'city', type: 'string', required: true },
    { name: 'days', type: 'integer', required: false },
    { name: 'metric', type: 'boolean', required: false },
    { name: 'units', type: 'string', required: false, enum: ['c', 'f'] },
    { name: 'extra', type: 'any', required: false },
  ];

  it('gives each type its control and emits typed values, leaving blanks out', async () => {
    const w = mount(ToolArgsForm, { props: { params, idPrefix: 't' } });
    expect(w.find('#t-city').element.tagName).toBe('INPUT');
    expect(w.find('#t-days').attributes('type')).toBe('number');
    expect(w.find('#t-metric').element.tagName).toBe('SELECT');
    expect(w.findAll('#t-units option').map((o) => o.text())).toEqual(['Any', 'c', 'f']);
    expect(w.find('#t-extra').element.tagName).toBe('TEXTAREA');

    await w.find('#t-city').setValue('Madrid');
    await w.find('#t-days').setValue('3.7');
    await w.find('#t-metric').setValue('false');
    await w.find('#t-extra').setValue('{"a":[1]}');
    expect(lastEmitted(w, 'update:modelValue')).toEqual({
      city: 'Madrid',
      days: 3,
      metric: false,
      extra: { a: [1] },
    });
    expect(lastEmitted(w, 'update:valid')).toBe(true);
  });

  it('flags JSON that does not parse and keeps it out', async () => {
    const w = mount(ToolArgsForm, { props: { params, idPrefix: 't' } });
    await w.find('#t-extra').setValue('{nope');
    expect(lastEmitted(w, 'update:valid')).toBe(false);
    expect(lastEmitted(w, 'update:modelValue')).toEqual({});
    expect(w.find('.error').exists()).toBe(true);
  });
});

describe('ToolTester', () => {
  const tools = [
    { name: 'get_weather', description: 'Weather.', parameters: { city: { type: 'string' } } },
    { name: 'send_email', description: 'Sends.', parameters: { to: { type: 'string' } } },
  ];
  const groups: Record<string, ToolGroupId> = { get_weather: 'custom', send_email: 'email' };

  function mountTester(run: (name: string, args: Record<string, unknown>) => Promise<unknown>) {
    return mount(ToolTester, {
      props: { tools, groupOf: (n: string) => groups[n] ?? 'other', run, modelValue: '' },
    });
  }

  it('lists tools under their groups', () => {
    const w = mountTester(vi.fn());
    expect(w.findAll('optgroup').map((g) => g.attributes('label'))).toEqual([
      'Your tools',
      'Email',
    ]);
  });

  it('runs the chosen tool with the form values and shows the answer', async () => {
    const run = vi.fn(async () => ({ temp: 21 }));
    const w = mountTester(run);
    await w.setProps({ modelValue: 'get_weather' });
    await w.find('#tool-tester-city').setValue('Madrid');
    await w
      .findAll('button')
      .find((b) => b.text() === 'Run')!
      .trigger('click');
    await flushPromises();

    expect(run).toHaveBeenCalledWith('get_weather', { city: 'Madrid' });
    expect(w.find('.result').classes()).toContain('ok');
    expect(w.find('.result .body').text()).toContain('"temp": 21');
  });

  // Handlers report trouble in what they return, because that is what the model reads.
  it.each([[{ ok: false, error: 'CORS' }], [{ success: false }], [{ error: 'nope' }]])(
    'reads %j as a failure',
    async (answer) => {
      const w = mountTester(vi.fn(async () => answer));
      await w.setProps({ modelValue: 'send_email' });
      await w
        .findAll('button')
        .find((b) => b.text() === 'Run')!
        .trigger('click');
      await flushPromises();
      expect(w.find('.result').classes()).toContain('failed');
    },
  );

  it('shows a thrown error as a failure and keeps a short history', async () => {
    const w = mountTester(
      vi.fn(async () => {
        throw new Error('Tool not found: x');
      }),
    );
    await w.setProps({ modelValue: 'send_email' });
    await w
      .findAll('button')
      .find((b) => b.text() === 'Run')!
      .trigger('click');
    await flushPromises();
    expect(w.find('.result .body').text()).toBe('Tool not found: x');
    expect(w.find('.history').text()).toContain('send_email');
  });
});
