import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import EmailAuthForm from '../../src/components/auth/EmailAuthForm.vue';
import { en } from '../../src/i18n/translations/en';
import { flushPromises } from '../helpers/mount';

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { signUp: vi.fn(), signInWithPassword: vi.fn() } },
}));

const { supabase } = await import('@/lib/supabase');
const signUp = vi.mocked(supabase.auth.signUp);
const signInWithPassword = vi.mocked(supabase.auth.signInWithPassword);

const field = (wrapper: ReturnType<typeof mount>, name: string) =>
  wrapper.find(`input[name="${name}"]`);

async function fill(wrapper: ReturnType<typeof mount>, name: string, value: string) {
  await field(wrapper, name).setValue(value);
}

beforeEach(() => {
  signUp.mockReset();
  signInWithPassword.mockReset();
  signUp.mockResolvedValue({
    data: { user: { identities: [{ provider: 'email' }] }, session: {} },
    error: null,
  } as never);
  signInWithPassword.mockResolvedValue({ data: { user: {}, session: {} }, error: null } as never);
});

describe('EmailAuthForm', () => {
  it('starts in sign-in mode with no confirmation field', () => {
    const wrapper = mount(EmailAuthForm);

    expect(field(wrapper, 'email').exists()).toBe(true);
    expect(field(wrapper, 'password').exists()).toBe(true);
    expect(field(wrapper, 'confirmPassword').exists()).toBe(false);
  });

  it('hints password managers at the right credential per mode', async () => {
    const wrapper = mount(EmailAuthForm);
    expect(field(wrapper, 'password').attributes('autocomplete')).toBe('current-password');

    await wrapper.find('.email-auth__switch-btn').trigger('click');

    expect(field(wrapper, 'password').attributes('autocomplete')).toBe('new-password');
  });

  it('reveals the confirmation field after switching to sign up', async () => {
    const wrapper = mount(EmailAuthForm);

    await wrapper.find('.email-auth__switch-btn').trigger('click');

    expect(field(wrapper, 'confirmPassword').exists()).toBe(true);
  });

  it('signs in on submit', async () => {
    const wrapper = mount(EmailAuthForm);
    await fill(wrapper, 'email', 'ada@kwami.io');
    await fill(wrapper, 'password', 'hunter2');

    await wrapper.find('form').trigger('submit');

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'ada@kwami.io',
      password: 'hunter2',
    });
  });

  it('signs up on submit once in sign-up mode', async () => {
    const wrapper = mount(EmailAuthForm);
    await wrapper.find('.email-auth__switch-btn').trigger('click');
    await fill(wrapper, 'email', 'ada@kwami.io');
    await fill(wrapper, 'password', 'hunter2');
    await fill(wrapper, 'confirmPassword', 'hunter2');

    await wrapper.find('form').trigger('submit');

    expect(signUp).toHaveBeenCalledOnce();
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('renders a validation failure as an alert without calling Supabase', async () => {
    const wrapper = mount(EmailAuthForm);
    await fill(wrapper, 'email', 'nope');
    await fill(wrapper, 'password', 'hunter2');

    await wrapper.find('form').trigger('submit');

    expect(wrapper.find('[role="alert"]').text()).toBe(en.auth.invalidEmail);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('renders the confirm-your-email outcome as a status, not an error', async () => {
    signUp.mockResolvedValue({
      data: { user: { identities: [{ provider: 'email' }] }, session: null },
      error: null,
    } as never);
    const wrapper = mount(EmailAuthForm);
    await wrapper.find('.email-auth__switch-btn').trigger('click');
    await fill(wrapper, 'email', 'ada@kwami.io');
    await fill(wrapper, 'password', 'hunter2');
    await fill(wrapper, 'confirmPassword', 'hunter2');

    await wrapper.find('form').trigger('submit');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[role="status"]').text()).toBe(en.auth.confirmByEmail);
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  /**
   * jsdom does not perform implicit form submission, so this asserts the
   * structure the browser needs for Enter-to-submit rather than simulating it:
   * a real <form> whose submit button is type=submit.
   */
  it('is a real form with a submit button, so Enter submits in a browser', () => {
    const wrapper = mount(EmailAuthForm);

    expect(wrapper.element.tagName).toBe('FORM');
    expect(wrapper.find('button.base-btn').attributes('type')).toBe('submit');
  });

  it('disables the submit button while the request is in flight', async () => {
    let release: (v: unknown) => void = () => {};
    signInWithPassword.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }) as never,
    );
    const wrapper = mount(EmailAuthForm);
    await fill(wrapper, 'email', 'ada@kwami.io');
    await fill(wrapper, 'password', 'hunter2');

    await wrapper.find('form').trigger('submit');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('button.base-btn').attributes('disabled')).toBeDefined();

    release({ data: { user: {}, session: {} }, error: null });
    await flushPromises();
    await wrapper.vm.$nextTick();
    expect(wrapper.find('button.base-btn').attributes('disabled')).toBeUndefined();
  });
});
