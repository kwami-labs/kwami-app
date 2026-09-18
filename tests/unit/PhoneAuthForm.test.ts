import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import PhoneAuthForm from '../../src/components/auth/PhoneAuthForm.vue';
import { en } from '../../src/i18n/translations/en';
import { flushPromises } from '../helpers/mount';

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { signInWithOtp: vi.fn(), verifyOtp: vi.fn() } },
}));

const { supabase } = await import('@/lib/supabase');
const signInWithOtp = vi.mocked(supabase.auth.signInWithOtp);
const verifyOtp = vi.mocked(supabase.auth.verifyOtp);

const field = (wrapper: ReturnType<typeof mount>, name: string) =>
  wrapper.find(`input[name="${name}"]`);

async function fill(wrapper: ReturnType<typeof mount>, name: string, value: string) {
  await field(wrapper, name).setValue(value);
}

beforeEach(() => {
  signInWithOtp.mockReset();
  verifyOtp.mockReset();
  signInWithOtp.mockResolvedValue({ data: {}, error: null } as never);
  verifyOtp.mockResolvedValue({ data: { user: {}, session: {} }, error: null } as never);
});

describe('PhoneAuthForm', () => {
  it('starts on the phone field with no OTP input', () => {
    const wrapper = mount(PhoneAuthForm);

    expect(field(wrapper, 'phone').exists()).toBe(true);
    expect(field(wrapper, 'otp').exists()).toBe(false);
  });

  it('is a real form with a submit button, so Enter submits in a browser', () => {
    const wrapper = mount(PhoneAuthForm);

    expect(wrapper.element.tagName).toBe('FORM');
    expect(wrapper.find('button.base-btn').attributes('type')).toBe('submit');
  });

  it('renders a validation failure as an alert without calling Supabase', async () => {
    const wrapper = mount(PhoneAuthForm);
    await fill(wrapper, 'phone', 'not-a-number');

    await wrapper.find('form').trigger('submit');

    expect(wrapper.find('[role="alert"]').text()).toBe(en.auth.invalidPhone);
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it('sends the OTP then reveals the code field', async () => {
    const wrapper = mount(PhoneAuthForm);
    await fill(wrapper, 'phone', '+15551234567');

    await wrapper.find('form').trigger('submit');
    await wrapper.vm.$nextTick();

    expect(signInWithOtp).toHaveBeenCalledOnce();
    expect(field(wrapper, 'otp').exists()).toBe(true);
    expect(wrapper.find('[role="status"]').text()).toContain('+15551234567');
  });

  it('verifies the code on the second submit', async () => {
    const wrapper = mount(PhoneAuthForm);
    await fill(wrapper, 'phone', '+15551234567');
    await wrapper.find('form').trigger('submit');
    await wrapper.vm.$nextTick();
    await fill(wrapper, 'otp', '123456');

    await wrapper.find('form').trigger('submit');

    expect(verifyOtp).toHaveBeenCalledWith({
      phone: '+15551234567',
      token: '123456',
      type: 'sms',
    });
  });

  it('returns to the phone field when changing number', async () => {
    const wrapper = mount(PhoneAuthForm);
    await fill(wrapper, 'phone', '+15551234567');
    await wrapper.find('form').trigger('submit');
    await wrapper.vm.$nextTick();

    await wrapper.find('.phone-auth__change').trigger('click');
    await wrapper.vm.$nextTick();

    expect(field(wrapper, 'phone').exists()).toBe(true);
    expect(field(wrapper, 'otp').exists()).toBe(false);
  });

  it('disables the submit button while the request is in flight', async () => {
    let release: (v: unknown) => void = () => {};
    signInWithOtp.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }) as never,
    );
    const wrapper = mount(PhoneAuthForm);
    await fill(wrapper, 'phone', '+15551234567');

    await wrapper.find('form').trigger('submit');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('button.base-btn').attributes('disabled')).toBeDefined();

    release({ data: {}, error: null });
    await flushPromises();
    await wrapper.vm.$nextTick();
    expect(wrapper.find('button.base-btn').attributes('disabled')).toBeUndefined();
  });
});
