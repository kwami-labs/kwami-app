import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import BaseButton from '../../src/components/ui/BaseButton.vue';

describe('BaseButton', () => {
  it('renders slot content and defaults to the secondary/md variant', () => {
    const wrapper = mount(BaseButton, { slots: { default: 'Save' } });

    expect(wrapper.text()).toContain('Save');
    expect(wrapper.classes()).toContain('variant-secondary');
    expect(wrapper.classes()).toContain('size-md');
  });

  it('applies variant, size and block modifiers', () => {
    const wrapper = mount(BaseButton, {
      props: { variant: 'danger', size: 'lg', block: true },
      slots: { default: 'Delete' },
    });

    expect(wrapper.classes()).toEqual(expect.arrayContaining(['variant-danger', 'size-lg', 'block']));
  });

  it('emits click when enabled', async () => {
    const wrapper = mount(BaseButton, { slots: { default: 'Go' } });
    await wrapper.trigger('click');
    expect(wrapper.emitted('click')).toHaveLength(1);
  });

  it('is disabled and emits nothing when disabled', async () => {
    const wrapper = mount(BaseButton, { props: { disabled: true }, slots: { default: 'Go' } });

    expect(wrapper.attributes('disabled')).toBeDefined();
    await wrapper.trigger('click');
    expect(wrapper.emitted('click')).toBeUndefined();
  });

  it('disables itself while loading', async () => {
    const wrapper = mount(BaseButton, { props: { loading: true }, slots: { default: 'Go' } });

    expect(wrapper.attributes('disabled')).toBeDefined();
    await wrapper.trigger('click');
    expect(wrapper.emitted('click')).toBeUndefined();
  });

  it('marks itself icon-only when given an icon and no slot content', () => {
    const wrapper = mount(BaseButton, { props: { icon: 'ph:x-bold' } });
    expect(wrapper.classes()).toContain('icon-only');
  });
});
