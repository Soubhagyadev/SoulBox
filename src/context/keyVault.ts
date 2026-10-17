import { createContext, useContext } from 'react'
import type { KeyIdentity } from '../lib/crypto'
import type { StoredKey } from '../lib/storage/keyVault'

export interface ImportKeyInput {
  name: string
  publicKeyPem?: string
  privateKeyPem?: string
  passphrase?: string
}

export interface KeyVaultContextValue {
  keys: StoredKey[]
  status: 'loading' | 'ready' | 'error'
  error: string | null
  reload: () => Promise<void>
  generateKeyPair: (name: string) => Promise<StoredKey>
  importKey: (input: ImportKeyInput) => Promise<StoredKey>
  removeKey: (id: string) => Promise<void>
  exportPublicKey: (id: string) => Promise<string>
  exportPrivateKey: (id: string, passphrase?: string) => Promise<string>
  getPublicCryptoKey: (id: string) => Promise<CryptoKey>
  getPrivateCryptoKey: (id: string, passphrase?: string) => Promise<CryptoKey>
  getFingerprint: (id: string) => Promise<KeyIdentity>
  isEncryptedKey: (id: string) => boolean
}

export const KeyVaultContext = createContext<KeyVaultContextValue | null>(null)

export function useKeyVault(): KeyVaultContextValue {
  const context = useContext(KeyVaultContext)
  if (!context) {
    throw new Error('useKeyVault must be used within a KeyVaultProvider.')
  }
  return context
}
