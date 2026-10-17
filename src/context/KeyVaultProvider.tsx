import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  derivePublicKeyFromPrivate,
  exportPrivateKeyPem,
  exportPublicKeyPem,
  generateKeyPair as generateKeyPairCrypto,
  getKeyFingerprint,
  importPrivateKeyPem,
  importPublicKeyPem,
  isEncryptedPrivateKeyPem,
  protectPrivateKeyPem,
  unprotectPrivateKeyPem,
  RSA_ALGORITHM_LABEL,
} from '../lib/crypto'
import { createKeyId, type KeyVaultStorage, type StoredKey } from '../lib/storage/keyVault'
import { createKeyVaultStorage } from '../lib/storage/createKeyVaultStorage'
import {
  KeyVaultContext,
  type ImportKeyInput,
  type KeyVaultContextValue,
} from './keyVault'

export interface KeyVaultProviderProps {
  children: ReactNode
  storage?: KeyVaultStorage
}

export function KeyVaultProvider({ children, storage }: KeyVaultProviderProps) {
  const vault = useMemo(() => storage ?? createKeyVaultStorage(), [storage])
  const [keys, setKeys] = useState<StoredKey[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const stored = await vault.list()
      stored.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      setKeys(stored)
      setStatus('ready')
      setError(null)
    } catch {
      setStatus('error')
      setError('Saved keys could not be loaded from this browser.')
    }
  }, [vault])

  useEffect(() => {
    // Loading the vault is an external-system sync; state updates happen after await.
    // oxlint-disable-next-line react/set-state-in-effect
    void reload()
  }, [reload])

  const findKey = useCallback(
    (id: string): StoredKey => {
      const key = keys.find((candidate) => candidate.id === id)
      if (!key) throw new Error('That key is no longer available.')
      return key
    },
    [keys],
  )

  const generateKeyPair = useCallback(
    async (name: string): Promise<StoredKey> => {
      const pair = await generateKeyPairCrypto()
      const [publicKeyPem, privateKeyPem] = await Promise.all([
        exportPublicKeyPem(pair.publicKey),
        exportPrivateKeyPem(pair.privateKey),
      ])
      const stored: StoredKey = {
        id: createKeyId(),
        name: name.trim() || 'Untitled key',
        createdAt: new Date().toISOString(),
        algorithm: RSA_ALGORITHM_LABEL,
        publicKeyPem,
        privateKeyPem,
      }
      await vault.put(stored)
      await reload()
      return stored
    },
    [reload, vault],
  )

  const importKey = useCallback(
    async (input: ImportKeyInput): Promise<StoredKey> => {
      const { name, publicKeyPem, privateKeyPem, passphrase } = input
      if (!publicKeyPem && !privateKeyPem) {
        throw new Error('Provide a public key, a private key, or both.')
      }

      let resolvedPublicPem = publicKeyPem ?? ''
      let storedPrivatePem: string | null = null

      if (privateKeyPem) {
        const cryptoKey = isEncryptedPrivateKeyPem(privateKeyPem)
          ? await unprotectPrivateKeyPem(privateKeyPem, passphrase ?? '')
          : await importPrivateKeyPem(privateKeyPem)
        storedPrivatePem = privateKeyPem
        if (!resolvedPublicPem) {
          const derived = await derivePublicKeyFromPrivate(cryptoKey)
          resolvedPublicPem = await exportPublicKeyPem(derived)
        }
      } else if (resolvedPublicPem) {
        await importPublicKeyPem(resolvedPublicPem)
      }

      const stored: StoredKey = {
        id: createKeyId(),
        name: name.trim() || 'Imported key',
        createdAt: new Date().toISOString(),
        algorithm: RSA_ALGORITHM_LABEL,
        publicKeyPem: resolvedPublicPem,
        privateKeyPem: storedPrivatePem,
      }
      await vault.put(stored)
      await reload()
      return stored
    },
    [reload, vault],
  )

  const removeKey = useCallback(
    async (id: string) => {
      await vault.remove(id)
      await reload()
    },
    [reload, vault],
  )

  const exportPublicKey = useCallback(async (id: string) => findKey(id).publicKeyPem, [findKey])

  const exportPrivateKey = useCallback(
    async (id: string, passphrase?: string) => {
      const stored = findKey(id)
      if (!stored.privateKeyPem) {
        throw new Error('This entry does not include a private key.')
      }
      if (isEncryptedPrivateKeyPem(stored.privateKeyPem)) {
        if (!passphrase) {
          throw new Error('Enter the passphrase that protects this private key.')
        }
        const key = await unprotectPrivateKeyPem(stored.privateKeyPem, passphrase)
        return exportPrivateKeyPem(key)
      }
      if (passphrase) {
        const key = await importPrivateKeyPem(stored.privateKeyPem)
        return protectPrivateKeyPem(key, passphrase)
      }
      return stored.privateKeyPem
    },
    [findKey],
  )

  const getPublicCryptoKey = useCallback(
    async (id: string) => importPublicKeyPem(findKey(id).publicKeyPem),
    [findKey],
  )

  const getPrivateCryptoKey = useCallback(
    async (id: string, passphrase?: string) => {
      const stored = findKey(id)
      if (!stored.privateKeyPem) {
        throw new Error('This entry does not include a private key.')
      }
      if (isEncryptedPrivateKeyPem(stored.privateKeyPem)) {
        if (!passphrase) {
          throw new Error('Enter the passphrase that protects this private key.')
        }
        return unprotectPrivateKeyPem(stored.privateKeyPem, passphrase)
      }
      return importPrivateKeyPem(stored.privateKeyPem)
    },
    [findKey],
  )

  const getFingerprint = useCallback(
    async (id: string) => {
      const key = await getPublicCryptoKey(id)
      return getKeyFingerprint(key)
    },
    [getPublicCryptoKey],
  )

  const isEncryptedKey = useCallback(
    (id: string) => {
      const stored = keys.find((candidate) => candidate.id === id)
      return stored?.privateKeyPem ? isEncryptedPrivateKeyPem(stored.privateKeyPem) : false
    },
    [keys],
  )

  const value = useMemo<KeyVaultContextValue>(
    () => ({
      keys,
      status,
      error,
      reload,
      generateKeyPair,
      importKey,
      removeKey,
      exportPublicKey,
      exportPrivateKey,
      getPublicCryptoKey,
      getPrivateCryptoKey,
      getFingerprint,
      isEncryptedKey,
    }),
    [
      keys,
      status,
      error,
      reload,
      generateKeyPair,
      importKey,
      removeKey,
      exportPublicKey,
      exportPrivateKey,
      getPublicCryptoKey,
      getPrivateCryptoKey,
      getFingerprint,
      isEncryptedKey,
    ],
  )

  return <KeyVaultContext.Provider value={value}>{children}</KeyVaultContext.Provider>
}
