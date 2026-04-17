/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND_URL?: string
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
