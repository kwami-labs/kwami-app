/**
 * Theme transfer, pipeline metrics and wallet creation.
 *
 * Two of these have a "looks like it worked" failure mode worth pinning:
 * `themeStore.importTheme` returns false on malformed JSON rather than
 * throwing, and the metrics panel shows an em dash rather than a number until
 * a turn completes. A tool reporting off the call in either case tells the
 * user about a change they cannot see, or reads a dash out loud as a latency.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { useWorkspaceExtrasAgentTools } from '@/composables/useWorkspaceExtrasAgentTools';
import { useThemeStore } from '@/stores/theme';
import { useWalletStore } from '@/stores/wallet';
import { useMetricsState } from '@/composables/useMetricsState';
import { extrasEn, extrasEs } from '@/i18n/extras.locale';

type ToolDef = {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

const registered = new Map<string, ToolDef>();

vi.mock('@/composables/useAgentActionState', () => ({
  useAgentActionState: () => ({
    recordAction: vi.fn(),
    recordError: vi.fn(),
    requestConfirmation: vi.fn(async () => true),
  }),
}));

const Host = defineComponent({
  setup() {
    const { registerWorkspaceExtrasTools } = useWorkspaceExtrasAgentTools();
    registerWorkspaceExtrasTools({
      registerTool: (def: ToolDef) => registered.set(def.name, def),
    } as never);
    return () => h('div');
  },
});

function call(name: string, args: Record<string, unknown> = {}) {
  const tool = registered.get(name);
  if (!tool) throw new Error(`tool ${name} was never registered`);
  return tool.handler(args);
}

beforeEach(() => {
  registered.clear();
  vi.clearAllMocks();
  localStorage.clear();
  setActivePinia(createPinia());
  useMetricsState().resetMetrics();
  mount(Host);
});

describe('registration', () => {
  it('registers every tool', () => {
    for (const name of [
      'export_theme',
      'import_theme',
      'get_performance_metrics',
      'reset_performance_metrics',
      'create_wallet',
    ]) {
      expect(registered.has(name), `${name} is missing`).toBe(true);
    }
  });

  it('gives every tool a resolved description rather than a key path', () => {
    for (const [name, def] of registered) {
      expect(def.description, `${name} has no description`).toBeTruthy();
      expect(def.description, `${name} description is an i18n key`).not.toMatch(/^extras\./);
    }
  });

  it('still offers nothing that can move money', () => {
    for (const name of registered.keys()) {
      expect(name).not.toMatch(/transfer|withdraw|send_funds|fund|purchase|buy|release/);
    }
  });

  it('tells the model the wallet it creates cannot spend', () => {
    expect(registered.get('create_wallet')?.description).toMatch(/canSpend/);
  });
});

describe('theme transfer', () => {
  it('exports something that imports back', async () => {
    const exported = await call('export_theme');
    expect(exported.success).toBe(true);
    const applied = await call('import_theme', { theme: exported.theme });
    expect(applied.applied).toBe(true);
  });

  it('reports a rejected import as a failure rather than a change', async () => {
    const theme = useThemeStore();
    const before = theme.mode;
    const result = await call('import_theme', { theme: 'not json at all' });
    // importTheme returns false rather than throwing, so reporting off the
    // call would claim a change the user cannot see.
    expect(result.success).toBe(false);
    expect(result.applied).toBe(false);
    expect(theme.mode).toBe(before);
  });

  it('refuses an empty import', async () => {
    const result = await call('import_theme', { theme: '   ' });
    expect(result.success).toBe(false);
  });
});

describe('performance metrics', () => {
  it('flags that there is nothing to report before a turn completes', async () => {
    const result = await call('get_performance_metrics');
    // The panel shows an em dash; reading that out as a latency is nonsense.
    expect(result.hasData).toBe(false);
    expect(String(result.message)).not.toContain('—');
  });

  it('reports real numbers once a turn has landed', async () => {
    const metrics = useMetricsState();
    metrics.latency.overall = '820ms';
    metrics.stats.turns = 3;

    const result = await call('get_performance_metrics');
    expect(result.hasData).toBe(true);
    expect(result.turns).toBe(3);
    expect(String(result.message)).toContain('820ms');
  });

  it('resets the counters', async () => {
    const metrics = useMetricsState();
    metrics.stats.turns = 5;
    await call('reset_performance_metrics');
    expect(metrics.stats.turns).toBe(0);
  });
});

describe('create_wallet', () => {
  it('creates one and says it cannot spend', async () => {
    const wallet = useWalletStore();
    wallet.createWallet = vi.fn(async () => {
      wallet.wallet = { network: 'solana-devnet' } as never;
    }) as typeof wallet.createWallet;

    const result = await call('create_wallet');
    expect(result.created).toBe(true);
    expect(result.network).toBe('solana-devnet');
    expect(result.canSpend).toBe(false);
  });

  it('does nothing when one already exists', async () => {
    const wallet = useWalletStore();
    wallet.wallet = { network: 'solana' } as never;
    wallet.createWallet = vi.fn() as typeof wallet.createWallet;

    const result = await call('create_wallet');
    expect(result.created).toBe(false);
    expect(wallet.createWallet).not.toHaveBeenCalled();
  });

  it('reports a failure rather than a wallet', async () => {
    const wallet = useWalletStore();
    wallet.createWallet = vi.fn(async () => {
      throw new Error('no provider configured');
    }) as typeof wallet.createWallet;

    const result = await call('create_wallet');
    expect(result.success).toBe(false);
    expect(result.created).toBe(false);
  });

  it('reports a silent no-result rather than claiming success', async () => {
    const wallet = useWalletStore();
    // Resolves without filling the store in — the same shape of quiet no-op
    // that workspaceStore.deleteKwami has.
    wallet.createWallet = vi.fn(async () => {}) as typeof wallet.createWallet;

    const result = await call('create_wallet');
    expect(result.success).toBe(false);
    expect(result.created).toBe(false);
  });
});

describe('locale messages', () => {
  const bundles: Record<string, Record<string, unknown>> = { en: extrasEn, es: extrasEs };

  function leafKeys(node: unknown, prefix = ''): string[] {
    if (typeof node === 'string') return [prefix];
    if (node && typeof node === 'object') {
      return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
        leafKeys(value, prefix ? `${prefix}.${key}` : key),
      );
    }
    return [];
  }

  for (const [locale, bundle] of Object.entries(bundles)) {
    it(`compiles every ${locale} message without losing a branch`, () => {
      const i18n = createI18n({ legacy: false, locale, messages: { [locale]: bundle } });
      for (const key of leafKeys(bundle)) {
        const raw = key.split('.').reduce<unknown>(
          (node, part) => (node as Record<string, unknown> | undefined)?.[part],
          bundle,
        ) as string;
        let rendered = '';
        expect(() => {
          rendered = i18n.global.t(key, { overall: 'x', network: 'x', error: 'x' });
        }, key).not.toThrow();
        expect(rendered.length, `${key} lost characters`).toBeGreaterThanOrEqual(raw.length - 40);
      }
    });
  }

  it('describes both locales with the same keys', () => {
    expect(leafKeys(extrasEs).sort()).toEqual(leafKeys(extrasEn).sort());
  });
});
