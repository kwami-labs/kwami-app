/**
 * What the agent puts on Jarvis's screen by itself (2026-11-17): a song or a video it found
 * plays in the video window instead of a browser opening beside it (`hud_open`), and the
 * voice's playback controls reach that window (`hud_media`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { mount, type VueWrapper } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { useHudStore } from '@/stores/hud';
import { HUD_MEDIA_EVENT, type HudMediaCommand, useHud } from '@/composables/useHud';
import VideoWidget from '@/components/hud/widgets/VideoWidget.vue';
import { hudEn } from '@/i18n/hud.locale';

vi.mock('@/lib/hud/agentLink', () => ({ sendToAgent: vi.fn() }));

const i18n = () => createI18n({ legacy: false, locale: 'en', messages: { en: hudEn } });

function say(detail: Record<string, unknown>) {
  window.dispatchEvent(new CustomEvent('kwami:agent_message', { detail }));
}

const mounted: VueWrapper[] = [];
const listeners: EventListener[] = [];

function heard(): HudMediaCommand[] {
  const commands: HudMediaCommand[] = [];
  const listener: EventListener = (event) =>
    commands.push((event as CustomEvent<HudMediaCommand>).detail);
  listeners.push(listener);
  window.addEventListener(HUD_MEDIA_EVENT, listener);
  return commands;
}

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  for (const listener of listeners.splice(0)) {
    window.removeEventListener(HUD_MEDIA_EVENT, listener);
  }
});

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
  useHudStore().setViewport({ width: 1600, height: 900 });
  const Host = defineComponent({
    setup() {
      useHud();
      return () => h('div');
    },
  });
  mounted.push(mount(Host, { global: { plugins: [i18n()] } }));
});

describe('the agent opens things on screen', () => {
  it('plays a YouTube video it found in the video window, as Jarvis’s', () => {
    say({
      type: 'hud_open',
      kind: 'video',
      url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
      title: 'lofi hip hop radio',
    });
    const [video] = useHudStore().widgets;
    expect(video).toMatchObject({ kind: 'video', source: 'agent', title: 'lofi hip hop radio' });
  });

  it('opens nothing that is not a web address', () => {
    say({ type: 'hud_open', kind: 'web', url: 'javascript:alert(1)' });
    say({ type: 'hud_open', kind: 'web', url: 'file:///C:/secret.txt' });
    expect(useHudStore().widgets).toHaveLength(0);
  });

  it('opens nothing when the user turned the screen off', () => {
    const hud = useHudStore();
    hud.prefs.enabled = false;
    say({ type: 'hud_open', kind: 'video', url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk' });
    expect(hud.widgets).toHaveLength(0);
  });
});

describe('the voice drives the video window', () => {
  it('sends each control to the newest video on screen', () => {
    const commands = heard();
    say({ type: 'hud_open', kind: 'video', url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa' });
    say({ type: 'hud_open', kind: 'video', url: 'https://www.youtube.com/watch?v=bbbbbbbbbbb' });
    const newest = [...useHudStore().widgets].sort((a, b) => b.z - a.z)[0];
    say({ type: 'hud_media', action: 'pause' });
    say({ type: 'hud_media', action: 'volume', level: 0.3 });
    expect(commands).toEqual([
      { id: newest.id, action: 'pause', level: undefined },
      { id: newest.id, action: 'volume', level: 0.3 },
    ]);
  });

  it('ignores a control it does not know, or with no video to send it to', () => {
    const commands = heard();
    say({ type: 'hud_media', action: 'pause' });
    say({ type: 'hud_open', kind: 'video', url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa' });
    say({ type: 'hud_media', action: 'delete_everything' });
    expect(commands).toEqual([]);
  });
});

describe('the video window', () => {
  function player(url: string) {
    const hud = useHudStore();
    const widget = hud.open({ kind: 'video', url, title: 'clip', source: 'agent' });
    const wrapper = mount(VideoWidget, {
      props: { widget, index: 0 },
      attachTo: document.body,
      global: { plugins: [i18n()], stubs: { HudWindow: { template: '<div><slot /></div>' } } },
    });
    return { widget, wrapper };
  }

  function command(id: string, action: HudMediaCommand['action'], level?: number) {
    window.dispatchEvent(new CustomEvent(HUD_MEDIA_EVENT, { detail: { id, action, level } }));
  }

  it('drives YouTube through its player API, and only its own window', () => {
    const { widget, wrapper } = player('https://www.youtube.com/watch?v=jfKfPfyJRdk');
    const frame = wrapper.find('iframe').element as HTMLIFrameElement;
    const post = vi.spyOn(frame.contentWindow as Window, 'postMessage');
    const sent = () => post.mock.calls.map(([data]) => JSON.parse(String(data)).func);

    command('someone-else', 'pause');
    expect(post).not.toHaveBeenCalled();

    command(widget.id, 'pause');
    command(widget.id, 'resume');
    command(widget.id, 'mute');
    command(widget.id, 'mute');
    command(widget.id, 'unmute');
    command(widget.id, 'volume', 0.5);
    command(widget.id, 'stop');
    command(widget.id, 'restart');
    expect(sent()).toEqual([
      'pauseVideo',
      'playVideo',
      'mute',
      'unMute',
      'setVolume',
      'pauseVideo',
      'seekTo',
      'seekTo',
      'playVideo',
    ]);
    wrapper.unmount();
    command(widget.id, 'pause');
    expect(post).toHaveBeenCalledTimes(9);
  });

  it('drives a video file directly', () => {
    const { widget, wrapper } = player('https://example.com/clip.mp4');
    const media = wrapper.find('video').element as HTMLVideoElement;
    const pause = vi.spyOn(media, 'pause').mockImplementation(() => {});
    const play = vi.spyOn(media, 'play').mockImplementation(() => Promise.resolve());
    command(widget.id, 'pause');
    command(widget.id, 'restart');
    command(widget.id, 'volume', 2);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(1);
    expect(media.volume).toBe(1);
  });
});
