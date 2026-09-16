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
}

export interface EthereumProvider {
  isMetaMask?: boolean;
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

declare global {
  interface Window {
    solana?: SolanaProvider;
    ethereum?: EthereumProvider;
  }
}
