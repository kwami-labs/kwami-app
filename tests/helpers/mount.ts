import { mount, type MountingOptions } from '@vue/test-utils';
import { createTestingPinia, type TestingPinia } from '@pinia/testing';
import { vi } from 'vitest';
import type { Component } from 'vue';

/**
 * Mounts a component with a fresh testing Pinia.
 *
 * `stubActions: false` by default so store actions really run against MSW —
 * that is what makes these double as integration tests. Pass
 * `{ stubActions: true }` when you want to assert an action was *called*
 * without executing it.
 */
export function mountWithPinia<C extends Component>(
  component: C,
  options: MountingOptions<any> & { stubActions?: boolean; initialState?: Record<string, unknown> } = {},
): ReturnType<typeof mount> & { pinia: TestingPinia } {
  const { stubActions = false, initialState, ...mountOptions } = options;

  const pinia = createTestingPinia({
    createSpy: vi.fn,
    stubActions,
    initialState,
  });

  const wrapper = mount(component, {
    ...mountOptions,
    global: {
      ...mountOptions.global,
      plugins: [...(mountOptions.global?.plugins ?? []), pinia],
    },
  });

  return Object.assign(wrapper, { pinia });
}

/** Flush pending promise microtasks (for awaited fetches inside onMounted). */
export const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));
