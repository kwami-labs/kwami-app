import { afterEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import ToolCatalog from '@/components/panels/settings/tools/ToolCatalog.vue';
import type { ToolGroupId } from '@/lib/toolRegistration';
import { setLocale } from '@/i18n';

const TOOLS = [
  {
    name: 'set_search_panel',
    description: 'Moves the results panel. Long tail.',
    parameters: { control: { type: 'string', enum: ['layout', 'reset'] } },
  },
  {
    name: 'send_email',
    description: 'Sends an email to a recipient.',
    parameters: { to: { type: 'string' } },
  },
  { name: 'list_calendar_events', description: 'Lists calendar events.' },
  {
    name: 'get_weather',
    description: 'Weather from my own webhook.',
    parameters: { city: { type: 'string' } },
  },
];

const GROUPS: Record<string, ToolGroupId> = {
  set_search_panel: 'search',
  send_email: 'email',
  list_calendar_events: 'calendar',
  get_weather: 'custom',
};

function mountCatalog() {
  return mount(ToolCatalog, {
    props: { tools: TOOLS, groupOf: (name: string) => GROUPS[name] ?? 'other' },
  });
}

const groupTitles = (w: ReturnType<typeof mountCatalog>) =>
  w.findAll('.group-title').map((g) => g.text());

afterEach(() => setLocale('en'));

describe('ToolCatalog', () => {
  it('lists groups in the panel order, with counts', () => {
    const w = mountCatalog();
    expect(groupTitles(w)).toEqual(['Your tools', 'Search and browser', 'Email', 'Calendar']);
    expect(w.findAll('.group-count').map((c) => c.text())).toEqual(['1', '1', '1', '1']);
  });

  it('opens the user groups and keeps the app groups folded until asked', async () => {
    const w = mountCatalog();
    const open = () => w.findAll('.group.open .group-title').map((g) => g.text());
    expect(open()).toEqual(['Your tools']);

    await w.findAll('.group-head')[2].trigger('click');
    expect(open()).toEqual(['Your tools', 'Email']);
  });

  it('searches names, descriptions and parameters, ignoring accents and case', async () => {
    setLocale('es');
    const w = mountCatalog();
    await w.find('.search-input').setValue('CALENDARIO');
    // "calendario" is the Spanish group title; the tool name is English.
    expect(groupTitles(w)).toEqual(['Calendario']);

    await w.find('.search-input').setValue('busqueda');
    expect(groupTitles(w)).toEqual(['Búsqueda y navegador']);

    await w.find('.search-input').setValue('city');
    expect(w.findAll('.tool-name').map((n) => n.text())).toEqual(['get_weather']);
  });

  it('says so when nothing matches', async () => {
    const w = mountCatalog();
    await w.find('.search-input').setValue('zzz');
    expect(w.find('.empty').text()).toContain('zzz');
  });

  it('filters to the tools the user added', async () => {
    const w = mountCatalog();
    const yours = w.findAll('.filter').find((f) => f.text().startsWith('Yours'));
    expect(yours?.text()).toContain('1');
    await yours!.trigger('click');
    expect(groupTitles(w)).toEqual(['Your tools']);
  });

  it('shows the parameters as rows and offers removal only for user tools', async () => {
    const w = mountCatalog();
    await w.find('.search-input').setValue('set_search_panel');
    await w.find('.row-head').trigger('click');
    expect(w.find('.param-name').text()).toBe('control');
    expect(w.findAll('.chip').map((c) => c.text())).toEqual(['layout', 'reset']);
    expect(w.text()).not.toContain('Remove');

    await w.find('.search-input').setValue('get_weather');
    await w.find('.row-head').trigger('click');
    await nextTick();
    const remove = w.findAll('button').find((b) => b.text() === 'Remove');
    expect(remove).toBeTruthy();
    await remove!.trigger('click');
    expect(w.emitted('remove')).toEqual([['get_weather']]);
  });

  it('hands a tool to the tester', async () => {
    const w = mountCatalog();
    await w.find('.search-input').setValue('send_email');
    await w.find('.row-head').trigger('click');
    await w
      .findAll('button')
      .find((b) => b.text() === 'Test')!
      .trigger('click');
    expect(w.emitted('test')).toEqual([['send_email']]);
  });

  it('keeps identifiers away from page translators', async () => {
    const w = mountCatalog();
    for (const name of w.findAll('.tool-name')) expect(name.attributes('translate')).toBe('no');
  });
});
