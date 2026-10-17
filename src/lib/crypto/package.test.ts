import { describe, expect, it } from 'vitest'
import {
  decryptPackage,
  encryptFile,
  isSealBoxPackage,
  packageFileName,
  parsePackage,
  serializePackage,
  PACKAGE_FORMAT,
  PACKAGE_VERSION,
  type SealBoxPackage,
} from './package'
import { generateKeyPair } from './keys'
import { isSealBoxCryptoError } from './errors'
import { base64ToBytes, bytesToBase64, stringToBytes } from './encoding'

async function makeRecipient() {
  const pair = await generateKeyPair()
  return pair
}

describe('package encryption', () => {
  it('encrypts and decrypts a text file', async () => {
    const recipient = await makeRecipient()
    const content = 'The quick brown fox jumps over the lazy dog.'
    const pkg = await encryptFile({
      data: stringToBytes(content),
      fileName: 'note.txt',
      fileType: 'text/plain',
      recipientPublicKey: recipient.publicKey,
    })

    const decrypted = await decryptPackage(pkg, recipient.privateKey)
    expect(new TextDecoder().decode(decrypted.bytes)).toBe(content)
    expect(decrypted.fileName).toBe('note.txt')
    expect(decrypted.fileType).toBe('text/plain')
  })

  it('round-trips binary data including zero bytes', async () => {
    const recipient = await makeRecipient()
    const bytes = new Uint8Array([0, 0, 255, 128, 0, 7, 42, 0])
    const pkg = await encryptFile({
      data: bytes,
      fileName: 'blob.bin',
      recipientPublicKey: recipient.publicKey,
    })
    const decrypted = await decryptPackage(pkg, recipient.privateKey)
    expect(Array.from(decrypted.bytes)).toEqual(Array.from(bytes))
  })

  it('never includes the plaintext in the serialized package', async () => {
    const recipient = await makeRecipient()
    const secret = 'TOP-SECRET-PLAINTEXT-MARKER'
    const pkg = await encryptFile({
      data: stringToBytes(secret),
      fileName: 'secret.txt',
      recipientPublicKey: recipient.publicKey,
    })
    const serialized = serializePackage(pkg)
    expect(serialized).not.toContain(secret)
    expect(serialized).toContain('secret.txt')
  })

  it('records the recipient fingerprint as visible metadata', async () => {
    const recipient = await makeRecipient()
    const pkg = await encryptFile({
      data: stringToBytes('hello'),
      fileName: 'a.txt',
      recipientPublicKey: recipient.publicKey,
    })
    expect(pkg.recipientFingerprint).toMatch(/^[0-9A-F]{2}(:[0-9A-F]{2})+$/)
    expect(pkg.format).toBe(PACKAGE_FORMAT)
    expect(pkg.version).toBe(PACKAGE_VERSION)
  })

  it('refuses an empty file', async () => {
    const recipient = await makeRecipient()
    await expect(
      encryptFile({
        data: new Uint8Array(0),
        fileName: 'empty.txt',
        recipientPublicKey: recipient.publicKey,
      }),
    ).rejects.toSatisfy(
      (error: unknown) => isSealBoxCryptoError(error) && error.code === 'UNSUPPORTED_FILE',
    )
  })

  it('fails with WRONG_KEY when the private key does not match', async () => {
    const recipient = await makeRecipient()
    const other = await makeRecipient()
    const pkg = await encryptFile({
      data: stringToBytes('hello'),
      fileName: 'a.txt',
      recipientPublicKey: recipient.publicKey,
    })
    await expect(decryptPackage(pkg, other.privateKey)).rejects.toSatisfy(
      (error: unknown) => isSealBoxCryptoError(error) && error.code === 'WRONG_KEY',
    )
  })

  it('fails with AUTHENTICATION_FAILED when the ciphertext is altered', async () => {
    const recipient = await makeRecipient()
    const pkg = await encryptFile({
      data: stringToBytes('hello world'),
      fileName: 'a.txt',
      recipientPublicKey: recipient.publicKey,
    })
    const tampered: SealBoxPackage = {
      ...pkg,
      data: bytesToBase64(
        (() => {
          const bytes = base64ToBytes(pkg.data)
          bytes[0] ^= 0xff
          return bytes
        })(),
      ),
    }
    await expect(decryptPackage(tampered, recipient.privateKey)).rejects.toSatisfy(
      (error: unknown) => isSealBoxCryptoError(error) && error.code === 'AUTHENTICATION_FAILED',
    )
  })

  it('fails when the IV is altered', async () => {
    const recipient = await makeRecipient()
    const pkg = await encryptFile({
      data: stringToBytes('hello world'),
      fileName: 'a.txt',
      recipientPublicKey: recipient.publicKey,
    })
    const tampered: SealBoxPackage = {
      ...pkg,
      iv: bytesToBase64(new Uint8Array(12)),
    }
    await expect(decryptPackage(tampered, recipient.privateKey)).rejects.toSatisfy(
      (error: unknown) => isSealBoxCryptoError(error) && error.code === 'AUTHENTICATION_FAILED',
    )
  })
})

describe('package parsing', () => {
  it('round-trips a serialized package', async () => {
    const recipient = await makeRecipient()
    const pkg = await encryptFile({
      data: stringToBytes('hello'),
      fileName: 'a.txt',
      recipientPublicKey: recipient.publicKey,
    })
    expect(parsePackage(serializePackage(pkg))).toEqual(pkg)
  })

  it('rejects non-JSON input', () => {
    expect(() => parsePackage('not json')).toThrowError(/not a SealBox package/)
  })

  it('rejects a different package format', () => {
    expect(() => parsePackage(JSON.stringify({ format: 'SOMETHING-ELSE' }))).toThrowError(
      /different kind of package/,
    )
  })

  it('rejects a missing or invalid structure', () => {
    expect(() => parsePackage(JSON.stringify({ format: PACKAGE_FORMAT }))).toThrowError(
      /missing required fields/,
    )
  })

  it('rejects a newer package version', async () => {
    const recipient = await makeRecipient()
    const pkg = await encryptFile({
      data: stringToBytes('hello'),
      fileName: 'a.txt',
      recipientPublicKey: recipient.publicKey,
    })
    expect(() => parsePackage(JSON.stringify({ ...pkg, version: PACKAGE_VERSION + 1 }))).toThrowError(
      /newer version/,
    )
  })

  it('validates the package shape', () => {
    expect(isSealBoxPackage({ format: PACKAGE_FORMAT })).toBe(false)
    expect(isSealBoxPackage(null)).toBe(false)
    expect(isSealBoxPackage('nope')).toBe(false)
  })
})

describe('packageFileName', () => {
  it('appends the package extension', () => {
    expect(packageFileName('report.pdf')).toBe('report.sealbox')
    expect(packageFileName('archive.tar.gz')).toBe('archive.tar.sealbox')
    expect(packageFileName('noextension')).toBe('noextension.sealbox')
  })
})
