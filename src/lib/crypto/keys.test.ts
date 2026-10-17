import { describe, expect, it } from 'vitest'
import {
  derivePublicKeyFromPrivate,
  exportPrivateKeyPem,
  exportPublicKeyPem,
  fromPem,
  generateKeyPair,
  getFingerprintFromPem,
  getKeyFingerprint,
  importPrivateKeyPem,
  importPublicKeyPem,
  looksLikePem,
  shortFingerprint,
} from './keys'
import { isSealBoxCryptoError } from './errors'

describe('key management', () => {
  it('generates a key pair and round-trips the public key through PEM', async () => {
    const pair = await generateKeyPair()
    const pem = await exportPublicKeyPem(pair.publicKey)

    expect(looksLikePem(pem)).toBe(true)
    expect(pem).toContain('BEGIN PUBLIC KEY')

    const imported = await importPublicKeyPem(pem)
    const [original, restored] = await Promise.all([
      getKeyFingerprint(pair.publicKey),
      getKeyFingerprint(imported),
    ])
    expect(restored.fingerprint).toBe(original.fingerprint)
  })

  it('round-trips the private key through PEM', async () => {
    const pair = await generateKeyPair()
    const pem = await exportPrivateKeyPem(pair.privateKey)
    expect(pem).toContain('BEGIN PRIVATE KEY')

    const imported = await importPrivateKeyPem(pem)
    const derivedPublic = await derivePublicKeyFromPrivate(imported)
    const originalIdentity = await getKeyFingerprint(pair.publicKey)
    const derivedIdentity = await getKeyFingerprint(derivedPublic)
    expect(derivedIdentity.fingerprint).toBe(originalIdentity.fingerprint)
  })

  it('produces a stable fingerprint from a public key PEM', async () => {
    const pair = await generateKeyPair()
    const pem = await exportPublicKeyPem(pair.publicKey)
    const first = await getFingerprintFromPem(pem)
    const second = await getFingerprintFromPem(pem)
    expect(first.fingerprint).toBe(second.fingerprint)
    expect(first.fingerprint).toMatch(/^[0-9A-F]{2}(:[0-9A-F]{2})+$/)
    expect(first.shortFingerprint).toContain('…')
  })

  it('rejects a private key passed where a public key is expected', async () => {
    const pair = await generateKeyPair()
    const privatePem = await exportPrivateKeyPem(pair.privateKey)
    await expect(importPublicKeyPem(privatePem)).rejects.toSatisfy(
      (error: unknown) => isSealBoxCryptoError(error) && error.code === 'INVALID_KEY',
    )
  })

  it('rejects malformed PEM input', () => {
    expect(() => fromPem('not a key at all')).toThrowError(/does not look like a PEM/)
  })

  it('keeps a short fingerprint unchanged when there are few groups', () => {
    expect(shortFingerprint('AA:BB:CC')).toBe('AA:BB:CC')
  })
})
