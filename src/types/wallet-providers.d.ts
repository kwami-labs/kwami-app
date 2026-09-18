/**
 * Injected browser wallet providers.
 *
 * Phantom (Solana) and MetaMask (Ethereum) attach themselves to `window`, so
 * they ship no package types. Declaring them here keeps `window.solana` and
 * `window.ethereum` honest at the call sites instead of casting through `any`.
 *
 * Only the surface the app actually uses is modelled.
 */
export interface SolanaProvider {
  isPhantom?: boolean;
  connect(): Promise<{ publicKey?: { toString(): string } }>;
  disconnect?(): Promise<void>;
  signAndSendTransaction?(transaction: unknown): Promise<{ signature: string }>;
  /**
   * Sign-in-with-Solana message signing, used by `supabase.auth.signInWithWeb3`.
   * Declared so this type structurally overlaps auth-js's `SolanaWallet` and can
   * be handed to it directly.
   */
  signMessage?(message: Uint8Array, encoding?: string): Promise<Uint8Array> | undefined;
}

export interface EthereumProvider {
  isMetaMask?: boolean;
  /**
   * Phantom injects an EVM provider too, and it lands on `window.ethereum` when
   * it wins the race. Present so "is this really MetaMask?" can be answered
   * without guessing.
   */
  isPhantom?: boolean;
  /**
   * The pre-EIP-6963 way several wallets coexisted: the loser of the
   * `window.ethereum` race stacks itself here. Still populated by some wallets.
   */
  providers?: EthereumProvider[];
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

/** EIP-6963 announcement payload. */
export interface Eip6963ProviderInfo {
  uuid: string;
  name: string;
  /** Data URI of the wallet's own icon. */
  icon: string;
  /** Reverse-DNS wallet id, e.g. `io.metamask`. The only stable wallet key. */
  rdns: string;
}

export interface Eip6963ProviderDetail {
  info: Eip6963ProviderInfo;
  provider: EthereumProvider;
}

declare global {
  interface Window {
    solana?: SolanaProvider;
    ethereum?: EthereumProvider;
    /**
     * Phantom's own namespace. `window.solana` is first-come-first-served among
     * installed wallets, so this is the only reliable handle on Phantom when the
     * user has more than one.
     */
    phantom?: { solana?: SolanaProvider; ethereum?: EthereumProvider };
  }

  interface WindowEventMap {
    /** Fired by each installed EVM wallet in reply to `eip6963:requestProvider`. */
    'eip6963:announceProvider': CustomEvent<Eip6963ProviderDetail>;
  }
}
