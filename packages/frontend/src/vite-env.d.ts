/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND_URL?: string
  readonly VITE_OASIS_NETWORK?: 'testnet' | 'mainnet'
  readonly VITE_OASIS_RPC_URL?: string
  readonly VITE_OASIS_RPC_FALLBACK_URLS?: string
  readonly VITE_CONTRACT_ADDRESS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

type EthereumRequestArgs = {
  method: string
  params?: unknown[] | Record<string, unknown>
}

interface EthereumProvider {
  request<T = unknown>(args: EthereumRequestArgs): Promise<T>
  on?(event: string, listener: (...args: unknown[]) => void): void
  removeListener?(event: string, listener: (...args: unknown[]) => void): void
}

interface Window {
  ethereum?: EthereumProvider
}
