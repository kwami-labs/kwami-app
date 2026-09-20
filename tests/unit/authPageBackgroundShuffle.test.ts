/**
 * Double-clicking the login backdrop rolls another clip.
 *
 * The preferences pill already exposes the same shuffle. This file holds the
 * shorter gesture: empty space, not the avatar, not the login chrome, and
 * not while the panel is open (that click is how the panel closes).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { enableAutoUnmount } from '@vue/test-utils';
import { mountWithPinia } from '../helpers/mount';
import AuthPage from '../../src/components/auth/AuthPage.vue';
import { useWelcomeBackground } from '../../src/composables/useWelcomeBackground';
import { useWelcomeKwamiHit } from '../../src/composables/useWelcomeKwamiHit';
import { sceneVideoPresets } from '../../src/presets/scene/video-presets';

const FIRST = sceneVideoPresets[0]!;

const stubs = {
  WelcomeBlob: true,
  WelcomeVideoBackground: true,
  SoundtrackPill: true,
  AuthPreferencesPill: true,
  LoginButton: {
    props: ['open'],
    emits: ['update:open'],
    template: '<button class="login-cta" @click="$emit(\'update:open\', true)">Login</button>',
  },
};

function mountPage() {
  return mountWithPinia(AuthPage, {
    attachTo: document.body,
    global: { stubs },
  });
}

enableAutoUnmount(afterEach);

beforeEach(() => {
  useWelcomeBackground().setVideo(null);
});

afterEach(() => {
  useWelcomeBackground().setVideo(null);
  // Drop a leftover hit-test from a test that registered one and failed
  // before it could unregister — module-level, same as the video id.
  useWelcomeKwamiHit().register(() => false)();
});

describe('AuthPage background double-click', () => {
  it('shows a small hint for the gesture, and hides it once the panel is open', async () => {
    const wrapper = mountPage();

    const lines = wrapper.get('.video-hint').findAll('span');
    expect(lines[0]!.text()).toBe('Double-click');
    expect(lines[1]!.text()).toBe('to change the video');
    expect(wrapper.get('.video-hint').classes()).not.toContain('video-hint--hidden');

    await wrapper.get('.login-cta').trigger('click');

    expect(wrapper.get('.video-hint').classes()).toContain('video-hint--hidden');
  });

  it('picks a clip when the empty backdrop is double-clicked', async () => {
    const wrapper = mountPage();

    await wrapper.get('.page').trigger('dblclick');

    expect(useWelcomeBackground().videoId.value).not.toBeNull();
  });

  it('picks a different clip than the one already on', async () => {
    const bg = useWelcomeBackground();
    bg.setVideo(FIRST.id);
    const wrapper = mountPage();

    for (let i = 0; i < 20; i += 1) {
      const before = bg.videoId.value;
      await wrapper.get('.page').trigger('dblclick');
      expect(bg.videoId.value).not.toBe(before);
    }
  });

  it('leaves the clip alone when the double-click is on the login button', async () => {
    const bg = useWelcomeBackground();
    bg.setVideo(FIRST.id);
    const wrapper = mountPage();

    await wrapper.get('.login-cta').trigger('dblclick');

    expect(bg.videoId.value).toBe(FIRST.id);
  });

  it('leaves the clip alone when the double-click lands on the avatar', async () => {
    const { register } = useWelcomeKwamiHit();
    const stop = register(() => true);
    const bg = useWelcomeBackground();
    bg.setVideo(FIRST.id);
    const wrapper = mountPage();

    await wrapper.get('.page').trigger('dblclick');

    expect(bg.videoId.value).toBe(FIRST.id);
    stop();
  });

  it('does not shuffle while the login panel is open', async () => {
    const bg = useWelcomeBackground();
    bg.setVideo(FIRST.id);
    const wrapper = mountPage();

    await wrapper.get('.login-cta').trigger('click');
    await wrapper.get('.page').trigger('dblclick');

    expect(bg.videoId.value).toBe(FIRST.id);
  });
});
