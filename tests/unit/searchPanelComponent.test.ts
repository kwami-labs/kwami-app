/**
 * The search panel as rendered, not just as state.
 *
 * The store tests in searchPanel.test.ts prove the layout logic; they would
 * all still pass if the component were never mounted or never shown. These
 * assert the thing the user actually gets: that it appears in the windowed
 * layouts and not in the docked one, that the orbit cards and the window are
 * never both on screen, and that a drag on the header moves it.
 */
import { nextTick } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import SearchPanel from '@/components/search/SearchPanel.vue';
import { useSearchStore } from '@/stores/search';

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, writable: true, configurable: true });
  Object.defineProperty(window, 'innerHeight', {
    value: height,
    writable: true,
    configurable: true,
  });
}

function seed(count = 2) {
  const store = useSearchStore();
  store.setResults({
    query: 'espresso machines',
    results: Array.from({ length: count }, (_, i) => ({
      title: `Result ${i + 1}`,
      url: `https://example.com/${i + 1}`,
      content: `Snippet ${i + 1}`,
    })),
    answer: 'Here is what I found.',
  });
  return store;
}

/**
 * jsdom has no pointer capture, and the component calls it on every drag.
 * Without these the gesture throws before it moves anything.
 */
function stubPointerCapture(el: Element) {
  Object.assign(el, {
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    hasPointerCapture: vi.fn(() => true),
  });
}

// jsdom 30 makes MouseEvent.button read-only. @vue/test-utils assigns options
// after constructing the event, which throws. Build the event ourselves so
// `button` is set in the constructor.
async function pointer(el: Element, type: string, init: PointerEventInit) {
  el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, ...init }));
  await nextTick();
}

beforeEach(() => {
  localStorage.clear();
  setViewport(1280, 800);
  setActivePinia(createPinia());
});

describe('visibility', () => {
  it('stays hidden in the docked layout, where the orbit cards are showing', () => {
    seed();
    const wrapper = mount(SearchPanel);
    // Both visible at once would be the same results drawn twice.
    expect(wrapper.find('#kwami-search-panel').exists()).toBe(false);
  });

  it('appears once the layout is floating', async () => {
    const store = seed();
    const wrapper = mount(SearchPanel);
    store.setLayout('floating');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('#kwami-search-panel').exists()).toBe(true);
  });

  it('stays hidden when there is nothing to show', async () => {
    const store = useSearchStore();
    store.setLayout('floating');
    const wrapper = mount(SearchPanel);
    await wrapper.vm.$nextTick();
    // An empty window floating over the avatar is worse than no window.
    expect(wrapper.find('#kwami-search-panel').exists()).toBe(false);
  });

  it('appears while a search is still running, so it does not look ignored', async () => {
    const store = useSearchStore();
    store.setLayout('floating');
    store.setSearching(true, 'flights to lisbon');
    const wrapper = mount(SearchPanel);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('#kwami-search-panel').exists()).toBe(true);
  });

  it('renders every result and the answer', async () => {
    const store = seed(3);
    store.setLayout('floating');
    const wrapper = mount(SearchPanel);
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll('.search-panel__item')).toHaveLength(3);
    expect(wrapper.text()).toContain('Here is what I found.');
  });
});

describe('dragging', () => {
  it('moves the panel when the header is dragged', async () => {
    const store = seed();
    store.setLayout('floating');
    store.setRect({ x: 200, y: 200 });
    const wrapper = mount(SearchPanel, { attachTo: document.body });
    await wrapper.vm.$nextTick();

    const header = wrapper.find('.search-panel__header');
    stubPointerCapture(header.element);

    await pointer(header.element, 'pointerdown', {
      pointerId: 1,
      button: 0,
      clientX: 300,
      clientY: 300,
    });
    await pointer(header.element, 'pointermove', { pointerId: 1, clientX: 360, clientY: 340 });
    await pointer(header.element, 'pointerup', { pointerId: 1 });

    expect(store.rect.x).toBe(260);
    expect(store.rect.y).toBe(240);
    // The shield flag must come back down, or the panel stays inert.
    expect(store.isManipulating).toBe(false);
    wrapper.unmount();
  });

  it('ignores a right-click on the header', async () => {
    const store = seed();
    store.setLayout('floating');
    store.setRect({ x: 200, y: 200 });
    const wrapper = mount(SearchPanel, { attachTo: document.body });
    await wrapper.vm.$nextTick();

    const header = wrapper.find('.search-panel__header');
    stubPointerCapture(header.element);
    // A right-click on a title bar is a context menu, not a drag.
    await pointer(header.element, 'pointerdown', {
      pointerId: 1,
      button: 2,
      clientX: 300,
      clientY: 300,
    });
    await pointer(header.element, 'pointermove', { pointerId: 1, clientX: 400, clientY: 400 });

    expect(store.rect.x).toBe(200);
    wrapper.unmount();
  });

  it('can be moved with the keyboard, not only by dragging', async () => {
    const store = seed();
    store.setLayout('floating');
    store.setRect({ x: 200, y: 200 });
    const wrapper = mount(SearchPanel);
    await wrapper.vm.$nextTick();

    // A panel that can only be moved by dragging is a panel some users
    // cannot move at all.
    await wrapper.find('.search-panel__header').trigger('keydown', { key: 'ArrowRight' });
    expect(store.rect.x).toBe(224);
  });

  it('resizes from the corner handle', async () => {
    const store = seed();
    store.setLayout('floating');
    store.setRect({ width: 600, height: 500 });
    const wrapper = mount(SearchPanel, { attachTo: document.body });
    await wrapper.vm.$nextTick();

    const handle = wrapper.find('.search-panel__resize');
    stubPointerCapture(handle.element);
    await pointer(handle.element, 'pointerdown', {
      pointerId: 2,
      button: 0,
      clientX: 800,
      clientY: 600,
    });
    await pointer(handle.element, 'pointermove', { pointerId: 2, clientX: 850, clientY: 640 });
    await pointer(handle.element, 'pointerup', { pointerId: 2 });

    expect(store.rect.width).toBe(650);
    expect(store.rect.height).toBe(540);
    wrapper.unmount();
  });
});

describe('chrome', () => {
  it('gives every toolbar control a name of its own', async () => {
    const store = seed();
    store.setLayout('floating');
    const wrapper = mount(SearchPanel);
    await wrapper.vm.$nextTick();

    // The durable half of the fix. Renaming the two positional selectors in
    // this file helped once; this catches the next button someone adds
    // without a modifier, which is what would push an index-based selector
    // in an e2e spec onto the wrong control -- silently, and still green.
    for (const button of wrapper.findAll('.search-panel__button')) {
      expect(
        button.classes().some((name) => name.startsWith('search-panel__button--')),
        `a toolbar button has no modifier class: ${button.attributes('aria-label')}`,
      ).toBe(true);
    }
    for (const link of wrapper.findAll('.search-panel__link')) {
      expect(
        link.classes().some((name) => /^search-panel__link--(?!muted$)/.test(name)),
        `a link has no identifying modifier: ${link.text()}`,
      ).toBe(true);
    }
  });

  it('expands and collapses back to the layout it came from', async () => {
    const store = seed();
    store.setLayout('floating');
    const wrapper = mount(SearchPanel);
    await wrapper.vm.$nextTick();

    await wrapper.find('.search-panel__header').trigger('dblclick');
    expect(store.layout).toBe('fullscreen');

    await wrapper.find('.search-panel__header').trigger('dblclick');
    expect(store.layout).toBe('floating');
  });

  it('leaves fullscreen on Escape, which is the only chrome left', async () => {
    const store = seed();
    store.setLayout('fullscreen');
    const wrapper = mount(SearchPanel);
    await wrapper.vm.$nextTick();

    await wrapper.find('#kwami-search-panel').trigger('keydown', { key: 'Escape' });
    expect(store.layout).toBe('docked');
  });

  it('closing returns to the orbit cards rather than binning the search', async () => {
    const store = seed();
    store.setLayout('floating');
    const wrapper = mount(SearchPanel);
    await wrapper.vm.$nextTick();

    // By name, not by position: a button added to the toolbar later would
    // silently retarget an index-based selector and keep passing.
    await wrapper.find('.search-panel__button--close').trigger('click');
    expect(store.layout).toBe('docked');
    // The user asked for a different presentation, not to throw it away.
    expect(store.results).toHaveLength(2);
  });

  it('asks the cloud browser when a result is opened', async () => {
    const store = seed();
    store.setLayout('floating');
    const wrapper = mount(SearchPanel);
    await wrapper.vm.$nextTick();

    const sent: string[] = [];
    const listener = (e: Event) =>
      sent.push(new TextDecoder().decode((e as CustomEvent).detail as Uint8Array));
    window.addEventListener('kwami:send_data', listener);
    await wrapper.find('.search-panel__link--open').trigger('click');
    window.removeEventListener('kwami:send_data', listener);

    expect(JSON.parse(sent[0]!)).toMatchObject({
      type: 'browser_open_request',
      url: 'https://example.com/1',
    });
    // Clicking is the same path the agent drives, so it focuses too.
    expect(store.focusedIndex).toBe(0);
  });
});
