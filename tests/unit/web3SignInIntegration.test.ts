/**
 * What the login screen actually asks a wallet to do.
 *
 * `useWeb3SignIn.test.ts` mocks `signInWithWeb3` outright, which is the right
 * shape for testing the composable's own decisions — detection, install links,
 * error copy — and is also why a broken integration could sit here unnoticed:
 * every one of those tests passes whether or not auth-js is ever given
 * something it can use. Nothing exercised the layer where the app and the
 * wallet actually meet.
 *
 * So this file mocks nothing below the wallet. It runs the real `GoTrueClient`
 * against wallet stubs shaped like the injected providers, with only `fetch`
 * held back, and asserts on what reaches the wallet and what reaches the wire.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import { GoTrueClient } from '@supabase/auth-js';
import { useWeb3SignIn, resetEthereumProviders } from '../../src/composables/useWeb3SignIn';
import { resetWalletApproval, useWalletApproval } from '../../src/composables/useWalletApproval';
import { en } from '../../src/i18n/translations/en';

/** Every request auth-js made to the token endpoint. */
const posted: string[] = [];

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: new GoTrueClient({
      url: 'https://stub.supabase.co/auth/v1',
      fetch: (async (_url: string, init: RequestInit) => {
        posted.push(String(init.body));
        // The signatures here are stubs, so the server's answer is the one it
        // gives a signature it cannot verify. What matters is what we sent.
        return new Response(
          JSON.stringify({ error: 'invalid_grant', error_description: 'Signature does not match' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }) as unknown as typeof fetch,
    }),
  },
}));

function harness() {
  const Host = defineComponent({ setup: () => ({ web3: useWeb3SignIn() }), template: '<div />' });
  return mount(Host).vm.web3;
}

const win = window as unknown as Record<string, unknown>;

/**
 * Phantom as it really presents itself: `signIn` is connect-and-sign, and it
 * returns the message it showed alongside the signature.
 */
function phantomWithSignIn(overrides: Record<string, unknown> = {}) {
  return {
    isPhantom: true,
    isConnected: false,
    connect: vi.fn(async () => ({ publicKey: { toString: () => 'stub' } })),
    signIn: vi.fn(async (input: Record<string, unknown>) => ({
      address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
      // A string is one of the two shapes auth-js accepts, and the one that
      // survives a test environment where `TextEncoder` and `Uint8Array` come
      // from different realms.
      signedMessage: `signed:${String(input.domain)}`,
      signature: new Uint8Array(64),
    })),
    ...overrides,
  };
}

/** An older Solana wallet: no SIWS, so it has to be connected first. */
function walletWithoutSignIn() {
  const stub: Record<string, unknown> = {
    isPhantom: true,
    isConnected: false,
    connect: vi.fn(async () => {
      stub.isConnected = true;
      return { publicKey: { toString: () => 'stub' } };
    }),
    publicKey: { toBase58: () => '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM' },
    signMessage: vi.fn(async () => new Uint8Array(64)),
  };
  return stub;
}

function metamask(overrides: Record<string, unknown> = {}) {
  return {
    isMetaMask: true,
    request: vi.fn(async ({ method }: { method: string }) => {
      if (method === 'eth_requestAccounts') return ['0x71C7656EC7ab88b098defB751B7401B5f6d8976F'];
      if (method === 'eth_chainId') return '0x1';
      if (method === 'personal_sign') return `0x${'11'.repeat(65)}`;
      throw new Error(`unexpected ${method}`);
    }),
    ...overrides,
  };
}

beforeEach(() => {
  posted.length = 0;
  delete win.phantom;
  delete win.solana;
  delete win.ethereum;
  resetEthereumProviders();
  resetWalletApproval();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('signing in with Phantom', () => {
  it('asks for one approval, not two', async () => {
    // The regression this pins: `signIn` *is* the connect step, and calling
    // `connect()` first put a second request to the same extension in flight
    // for the same click. A wallet reports that kind of collision as an
    // internal error, which is all the page ever saw.
    const provider = phantomWithSignIn();
    win.phantom = { solana: provider };

    await harness().signIn('phantom');

    expect(provider.signIn).toHaveBeenCalledTimes(1);
    expect(provider.connect).not.toHaveBeenCalled();
  });

  it('still connects a wallet that cannot sign in', async () => {
    const provider = walletWithoutSignIn();
    win.phantom = { solana: provider };

    await harness().signIn('phantom');

    // No SIWS, so auth-js falls back to signMessage — which needs a public key,
    // which needs a connection.
    expect(provider.connect).toHaveBeenCalledTimes(1);
    expect(provider.signMessage).toHaveBeenCalled();
  });

  it('hands the wallet this page and this app to show the visitor', async () => {
    const provider = phantomWithSignIn();
    win.phantom = { solana: provider };

    await harness().signIn('phantom');

    const input = provider.signIn.mock.calls[0]![0] as Record<string, string>;
    expect(input.domain).toBe(window.location.host);
    expect(input.uri).toBe(window.location.href);
    expect(input.statement).toBe(en.auth.web3Statement);
    expect(input.version).toBe('1');
    // A statement with a newline in it would break the wallet's own parser.
    expect(input.statement).not.toContain('\n');
  });

  it('sends the message the wallet says it showed, not one the app rebuilt', async () => {
    win.phantom = { solana: phantomWithSignIn() };

    await harness().signIn('phantom');

    expect(posted).toHaveLength(1);
    const body = JSON.parse(posted[0]!);
    expect(body.chain).toBe('solana');
    expect(body.message).toBe(`signed:${window.location.host}`);
  });
});

describe('signing in with MetaMask', () => {
  it('reaches the wire with a SIWE message carrying this origin', async () => {
    win.ethereum = metamask();

    await harness().signIn('metamask');

    expect(posted).toHaveLength(1);
    const body = JSON.parse(posted[0]!);
    expect(body.chain).toBe('ethereum');
    expect(body.message).toContain(`${window.location.host} wants you to sign in`);
    expect(body.message).toContain(en.auth.web3Statement);
    expect(body.message).toContain('Version: 1');
    expect(body.message).toContain('Chain ID: 1');
  });
});

describe('the page while a wallet has the floor', () => {
  it('stands down for the whole exchange and gets back up after it', async () => {
    const { isAwaitingWallet } = useWalletApproval();
    const seen: boolean[] = [];
    const provider = phantomWithSignIn({
      signIn: vi.fn(async () => {
        // Sampled from inside the wallet call, which is the only moment that
        // matters: this is when the extension needs the main thread.
        seen.push(isAwaitingWallet.value);
        return {
          address: 'stub',
          signedMessage: 'signed',
          signature: new Uint8Array(64),
        };
      }),
    });
    win.phantom = { solana: provider };

    expect(isAwaitingWallet.value).toBe(false);
    await harness().signIn('phantom');

    expect(seen).toEqual([true]);
    expect(isAwaitingWallet.value).toBe(false);
  });

  it('gets back up when the wallet throws', async () => {
    const { isAwaitingWallet } = useWalletApproval();
    win.phantom = {
      solana: phantomWithSignIn({
        signIn: vi.fn(async () => {
          throw Object.assign(new Error('Unexpected error'), { code: -32603 });
        }),
      }),
    };

    const web3 = harness();
    await web3.signIn('phantom');

    // Otherwise a wallet that failed once would leave the screen frozen for
    // the rest of the session, and the retry would have nothing to fix.
    expect(isAwaitingWallet.value).toBe(false);
    expect(web3.error.value).toBe(en.auth.web3WalletError.replace('{wallet}', 'Phantom'));
  });

  it('gets back up when the visitor never answers and the wallet is left open', async () => {
    const { isAwaitingWallet } = useWalletApproval();
    let release: (() => void) | null = null;
    win.phantom = {
      solana: phantomWithSignIn({
        signIn: vi.fn(
          () =>
            new Promise((_, reject) => {
              release = () => reject(Object.assign(new Error('User rejected the request')));
            }),
        ),
      }),
    };

    const pending = harness().signIn('phantom');
    expect(isAwaitingWallet.value).toBe(true);
    release!();
    await pending;

    expect(isAwaitingWallet.value).toBe(false);
  });
});
