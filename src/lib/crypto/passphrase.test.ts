import { describe, expect, it } from 'vitest'
import {
  generateKeyPair,
  derivePublicKeyFromPrivate,
  getKeyFingerprint,
  exportPrivateKeyPem,
  importPrivateKeyPem,
} from './keys'
import {
  isEncryptedPrivateKeyPem,
  protectPrivateKeyPem,
  unprotectPrivateKeyPem,
} from './passphrase'
import { isSealBoxCryptoError } from './errors'

describe('passphrase-protected private keys', () => {
  it('wraps and unwraps a private key without changing the key material', async () => {
    const pair = await generateKeyPair()
    const protectedPem = await protectPrivateKeyPem(pair.privateKey, 'correct horse battery')

    expect(isEncryptedPrivateKeyPem(protectedPem)).toBe(true)
    expect(protectedPem).toContain('BEGIN ENCRYPTED PRIVATE KEY')
    expect(protectedPem).not.toContain('BEGIN PRIVATE KEY-----')

    const unwrapped = await unprotectPrivateKeyPem(protectedPem, 'correct horse battery')
    const derived = await derivePublicKeyFromPrivate(unwrapped)
    const [original, restored] = await Promise.all([
      getKeyFingerprint(pair.publicKey),
      getKeyFingerprint(derived),
    ])
    expect(restored.fingerprint).toBe(original.fingerprint)
  })

  it('rejects the wrong passphrase', async () => {
    const pair = await generateKeyPair()
    const protectedPem = await protectPrivateKeyPem(pair.privateKey, 'correct horse battery')

    await expect(
      unprotectPrivateKeyPem(protectedPem, 'wrong passphrase here'),
    ).rejects.toSatisfy(
      (error: unknown) => isSealBoxCryptoError(error) && error.code === 'WRONG_PASSPHRASE',
    )
  })

  it('requires a minimum passphrase length', async () => {
    const pair = await generateKeyPair()
    await expect(protectPrivateKeyPem(pair.privateKey, 'short')).rejects.toSatisfy(
      (error: unknown) => isSealBoxCryptoError(error) && error.code === 'WRONG_PASSPHRASE',
    )
  })

  it('does not treat a plain private key as protected', async () => {
    const pair = await generateKeyPair()
    const plain = await exportPrivateKeyPem(pair.privateKey)
    expect(isEncryptedPrivateKeyPem(plain)).toBe(false)
    await expect(importPrivateKeyPem(plain)).resolves.toBeDefined()
  })
})
