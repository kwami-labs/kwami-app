/**
 * The reorganizer deletes and merges what is ticked, so what starts ticked
 * matters: a pair of different kinds of thing ("Apple" the company, "Apple" the
 * fruit) is not, and the report says what was left alone rather than claiming a
 * clean run.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import ReorganizePreview from '@/components/memory/ReorganizePreview.vue';
import { en } from '@/i18n/translations/en';

enableAutoUnmount(afterEach);

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() }));
const toast = vi.hoisted(() => ({
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));

vi.mock('@/lib/apiClient', async (original) => ({
  ...(await original<typeof import('@/lib/apiClient')>()),
  api,
}));
vi.mock('vue-toastification', () => ({ useToast: () => toast }));

const PREVIEW = {
  orphans: [{ uuid: 'n-o', name: 'Loose', summary: null }],
  duplicates: [
    {
      score: 100,
      compatible: true,
      keep: { uuid: 'n-1', name: 'Barcelona', edge_count: 3 },
      remove: { uuid: 'n-2', name: 'barcelona', edge_count: 1 },
    },
    {
      score: 100,
      compatible: false,
      keep: { uuid: 'n-3', name: 'Apple', edge_count: 2, labels: ['Organization'] },
      remove: { uuid: 'n-4', name: 'Apple', edge_count: 1, labels: ['Object'] },
    },
  ],
  communities_estimate: 2,
};

async function open() {
  const wrapper = mount(ReorganizePreview, {
    props: { userId: 'kwami_u_k' },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })],
      stubs: {
        ConfirmDialog: {
          props: ['open', 'confirmLabel', 'confirmText'],
          emits: ['confirm'],
          template:
            '<div v-if="open"><slot /><button class="confirm" @click="$emit(\'confirm\')">{{ confirmLabel || confirmText }}</button></div>',
        },
      },
    },
  });
  await (wrapper.vm as unknown as { fetchPreview: () => Promise<void> }).fetchPreview();
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  setActivePinia(createPinia());
  api.post.mockReset();
  Object.values(toast).forEach((f) => f.mockReset());
});

describe('ReorganizePreview', () => {
  it('does not pre-select a pair of different kinds of thing', async () => {
    api.post.mockResolvedValueOnce(PREVIEW);
    const wrapper = await open();

    const boxes = wrapper.findAll('input[type="checkbox"]');
    expect(boxes.map((b) => (b.element as HTMLInputElement).checked)).toEqual([true, true, false]);
    expect(wrapper.text()).toContain('different types');
  });

  it('applies only what is ticked', async () => {
    api.post
      .mockResolvedValueOnce(PREVIEW)
      .mockResolvedValueOnce({ report: { orphans_removed: 1, merges_performed: 1 } });
    const wrapper = await open();

    await wrapper.get('button.confirm').trigger('click');
    await flushPromises();

    expect(api.post.mock.calls[1]![1]).toEqual({
      orphan_uuids: ['n-o'],
      merge_pairs: [{ keep_uuid: 'n-1', remove_uuid: 'n-2' }],
    });
    expect(toast.success).toHaveBeenCalledWith('Done! 1 orphans removed, 1 merges', {
      timeout: 5000,
    });
  });

  it('says what was kept and what was left untouched', async () => {
    api.post.mockResolvedValueOnce(PREVIEW).mockResolvedValueOnce({
      report: {
        orphans_removed: 0,
        merges_performed: 0,
        orphans_kept: 1,
        errors: ['Edge recreate failed: rejected'],
      },
    });
    const wrapper = await open();

    await wrapper.get('button.confirm').trigger('click');
    await flushPromises();

    expect(toast.success).not.toHaveBeenCalled();
    const [message] = toast.warning.mock.calls[0]!;
    expect(message).toContain('1 kept: they now have facts.');
    expect(message).toContain('1 left untouched rather than risk losing facts.');
  });
});
