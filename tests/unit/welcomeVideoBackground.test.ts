/**
 * The login screen's video backdrop.
 *
 * Three things here are only obvious in hindsight: a clip that fails to load
 * must leave the painted gradient showing rather than a black rectangle over
 * half the screen; switching clips has to clear that failure or one dead URL
 * strands the screen for the session; and a full-bleed moving backdrop is the
 * clearest case there is for honouring `prefers-reduced-motion`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import WelcomeVideoBackground from '../../src/components/auth/WelcomeVideoBackground.vue';
import { useWelcomeBackground } from '../../src/composables/useWelcomeBackground';
import { sceneVideoPresets } from '../../src/presets/scene/video-presets';

const FIRST = sceneVideoPresets[0]!;
const SECOND = sceneVideoPresets[1]!;

const realMatchMedia = window.matchMedia;

/** jsdom implements none of the media methods; without these the mount throws. */
function stubMediaElement() {
  HTMLMediaElement.prototype.load = vi.fn();
  HTMLMediaElement.prototype.play = vi.fn(async () => undefined);
  HTMLMediaElement.prototype.pause = vi.fn();
}

function prefersReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  stubMediaElement();
  prefersReducedMotion(false);
  useWelcomeBackground().setVideo(null);
});

afterEach(() => {
  window.matchMedia = realMatchMedia;
  useWelcomeBackground().setVideo(null);
});

describe('WelcomeVideoBackground', () => {
  it('paints nothing while the screen is on its gradient', () => {
    const wrapper = mount(WelcomeVideoBackground);

    expect(wrapper.find('video').exists()).toBe(false);
  });

  it('plays the chosen clip, muted and looping so it can autoplay at all', async () => {
    useWelcomeBackground().setVideo(FIRST.id);
    const wrapper = mount(WelcomeVideoBackground);
    await wrapper.vm.$nextTick();

    const video = wrapper.find('video');
    expect(video.attributes('src')).toBe(FIRST.url);
    // Browsers refuse to autoplay a clip with sound, so `muted` is what makes
    // the backdrop start at all. Asserted on the property, not the attribute:
    // Vue binds `muted` as a DOM property, so the attribute is never written.
    expect((video.element as HTMLVideoElement).muted).toBe(true);
    expect(video.attributes('loop')).toBeDefined();
    expect(video.attributes('playsinline')).toBeDefined();
  });

  it('is hidden from assistive tech, being pure decoration', async () => {
    useWelcomeBackground().setVideo(FIRST.id);
    const wrapper = mount(WelcomeVideoBackground);
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.video-bg').attributes('aria-hidden')).toBe('true');
  });

  it('falls back to the gradient when the clip will not load', async () => {
    useWelcomeBackground().setVideo(FIRST.id);
    const wrapper = mount(WelcomeVideoBackground);
    await wrapper.vm.$nextTick();

    await wrapper.find('video').trigger('error');

    expect(wrapper.find('video').exists()).toBe(false);
    expect(wrapper.find('.video-bg').exists()).toBe(false);
  });

  it('gives the next clip a fresh chance after one fails', async () => {
    useWelcomeBackground().setVideo(FIRST.id);
    const wrapper = mount(WelcomeVideoBackground);
    await wrapper.vm.$nextTick();
    await wrapper.find('video').trigger('error');
    expect(wrapper.find('video').exists()).toBe(false);

    useWelcomeBackground().setVideo(SECOND.id);
    await wrapper.vm.$nextTick();

    expect(wrapper.find('video').attributes('src')).toBe(SECOND.url);
  });

  it('holds on a still frame when the viewer asked for less motion', async () => {
    prefersReducedMotion(true);
    useWelcomeBackground().setVideo(FIRST.id);
    const wrapper = mount(WelcomeVideoBackground);
    await wrapper.vm.$nextTick();

    const video = wrapper.find('video');
    expect(video.attributes('autoplay')).toBeUndefined();

    // The picture the viewer asked for still arrives; only the motion is cut.
    await video.trigger('loadeddata');
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    expect(video.attributes('src')).toBe(FIRST.url);
  });

  it('autoplays normally when no motion preference is set', async () => {
    useWelcomeBackground().setVideo(FIRST.id);
    const wrapper = mount(WelcomeVideoBackground);
    await wrapper.vm.$nextTick();

    const video = wrapper.find('video');
    expect(video.attributes('autoplay')).toBeDefined();

    await video.trigger('loadeddata');
    expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();
  });
});

describe('useWelcomeBackground', () => {
  it('rejects an id that is not in the catalogue rather than blanking the screen', () => {
    const bg = useWelcomeBackground();

    bg.setVideo('not-a-real-clip');

    expect(bg.videoId.value).toBeNull();
    expect(bg.video.value).toBeNull();
  });

  it('remembers a clip across a reload, and forgets it when cleared', () => {
    const bg = useWelcomeBackground();

    bg.setVideo(FIRST.id);
    expect(localStorage.getItem('kwami.welcomeBackground')).toBe(FIRST.id);

    bg.setVideo(null);
    expect(localStorage.getItem('kwami.welcomeBackground')).toBeNull();
  });

  it('shares one catalogue with the workspace scene background', () => {
    // Not a tautology: the point is that adding a clip to the scene presets
    // reaches the login screen for free, and nobody keeps a second list here.
    expect(useWelcomeBackground().presets).toBe(sceneVideoPresets);
  });
});
