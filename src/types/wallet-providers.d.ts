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
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
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
}
