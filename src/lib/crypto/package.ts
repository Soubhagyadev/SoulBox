import { SealBoxCryptoError } from './errors'
import { base64ToBytes, bytesToBase64, bytesToString, stringToBytes } from './encoding'
import { getKeyFingerprint } from './keys'

export const PACKAGE_FORMAT = 'SEALBOX-PACKAGE'
export const PACKAGE_VERSION = 2
export const PACKAGE_EXTENSION = '.sealbox'
export const PACKAGE_MIME = 'application/x-sb-package'
export const HIDDEN_PACKAGE_FILE_NAME = 'sealbox-package.sealbox'

export const AES_ALGORITHM_LABEL = 'AES-256-GCM'
export const KEY_WRAP_ALGORITHM_LABEL = 'RSA-OAEP-SHA256'
export const AES_KEY_LENGTH = 256
export const AES_IV_LENGTH = 12

/** Whole-file AES-GCM means the file must fit in memory. */
export const MAX_FILE_SIZE = 100 * 1024 * 1024

export type PackageMetadataMode = 'visible' | 'hidden'

interface SealBoxPackageBase {
  format: typeof PACKAGE_FORMAT
  version: number
  cipher: string
  keyWrap: string
  encryptedKey: string
  iv: string
  data: string
}

/**
 * Packages with visible metadata expose the original name, type, size,
 * creation time, and recipient fingerprint. Version 1 packages always used
 * this mode; version 2 can opt into hidden metadata.
 */
export interface VisibleSealBoxPackage extends SealBoxPackageBase {
  version: 1 | 2
  metadata?: 'visible'
  createdAt: string
  recipientFingerprint: string
  fileName: string
  fileType: string
  fileSize: number
}

/**
 * Hidden-metadata packages encrypt the original name, type, size, creation
 * time, and recipient fingerprint with a second AES-GCM ciphertext.
 */
export interface HiddenSealBoxPackage extends SealBoxPackageBase {
  version: 2
  metadata: 'hidden'
  encryptedMetadata: string
  metadataIv: string
}

export type SealBoxPackage = VisibleSealBoxPackage | HiddenSealBoxPackage

export interface EncryptFileInput {
  data: Uint8Array
  fileName: string
  fileType?: string
  recipientPublicKey: CryptoKey
  /** Encrypt the original file details and recipient fingerprint inside the package. */
  hideMetadata?: boolean
}

export interface DecryptedFile {
  bytes: Uint8Array
  fileName: string
  fileType: string
  metadata: PackageMetadataMode
}

interface HiddenMetadata {
  fileName: string
  fileType: string
  fileSize: number
  createdAt: string
  recipientFingerprint: string
}

function getCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) {
    throw new SealBoxCryptoError(
      'CRYPTO_UNAVAILABLE',
      'This browser does not expose the Web Crypto API required for encryption.',
    )
  }
  return globalThis.crypto
}

function invalidHiddenMetadata(): never {
  throw new SealBoxCryptoError(
    'INVALID_PACKAGE',
    'The hidden metadata in this package is missing or malformed.',
  )
}

function parseHiddenMetadata(bytes: Uint8Array): HiddenMetadata {
  let parsed: unknown
  try {
    parsed = JSON.parse(bytesToString(bytes))
  } catch {
    invalidHiddenMetadata()
  }
  if (typeof parsed !== 'object' || parsed === null) invalidHiddenMetadata()

  const candidate = parsed as Record<string, unknown>
  if (
    typeof candidate.fileName !== 'string' ||
    typeof candidate.fileType !== 'string' ||
    typeof candidate.fileSize !== 'number' ||
    !Number.isFinite(candidate.fileSize) ||
    candidate.fileSize < 0 ||
    typeof candidate.createdAt !== 'string' ||
    Number.isNaN(Date.parse(candidate.createdAt)) ||
    typeof candidate.recipientFingerprint !== 'string'
  ) {
    invalidHiddenMetadata()
  }

  return {
    fileName: candidate.fileName,
    fileType: candidate.fileType,
    fileSize: candidate.fileSize,
    createdAt: candidate.createdAt,
    recipientFingerprint: candidate.recipientFingerprint,
  }
}

/**
 * Hybrid encryption: a one-time AES-256-GCM key encrypts the file contents,
 * and the recipient's RSA public key wraps that AES key. The plaintext never
 * leaves this function.
 *
 * With `hideMetadata`, a second AES-GCM ciphertext carries the original file
 * details, creation time, and recipient fingerprint. Only the package's
 * approximate size remains inferable from the ciphertext length.
 */
export async function encryptFile(input: EncryptFileInput): Promise<SealBoxPackage> {
  const { data, fileName, fileType = '', recipientPublicKey, hideMetadata = false } = input
  const { subtle } = getCrypto()

  if (data.byteLength === 0) {
    throw new SealBoxCryptoError('UNSUPPORTED_FILE', 'The selected file is empty.')
  }
  if (data.byteLength > MAX_FILE_SIZE) {
    throw new SealBoxCryptoError(
      'FILE_TOO_LARGE',
      'This file is larger than the 100 MB limit for in-browser encryption.',
    )
  }

  const { fingerprint } = await getKeyFingerprint(recipientPublicKey)
  const createdAt = new Date().toISOString()

  const aesKey = await subtle.generateKey(
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    true,
    ['encrypt', 'decrypt'],
  )
  const iv = getCrypto().getRandomValues(new Uint8Array(AES_IV_LENGTH))

  let ciphertext: ArrayBuffer
  try {
    ciphertext = await subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, data as BufferSource)
  } catch (cause) {
    throw new SealBoxCryptoError('UNKNOWN', 'The file could not be encrypted.', { cause })
  }

  const rawAesKey = await subtle.exportKey('raw', aesKey)
  let wrappedKey: ArrayBuffer
  try {
    wrappedKey = await subtle.encrypt({ name: 'RSA-OAEP' }, recipientPublicKey, rawAesKey)
  } catch (cause) {
    throw new SealBoxCryptoError(
      'INVALID_KEY',
      'The recipient public key could not be used to wrap the encryption key.',
      { cause },
    )
  }

  const base: SealBoxPackageBase = {
    format: PACKAGE_FORMAT,
    version: PACKAGE_VERSION,
    cipher: AES_ALGORITHM_LABEL,
    keyWrap: KEY_WRAP_ALGORITHM_LABEL,
    encryptedKey: bytesToBase64(new Uint8Array(wrappedKey)),
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(ciphertext)),
  }

  if (!hideMetadata) {
    return {
      ...base,
      version: 2,
      metadata: 'visible',
      createdAt,
      recipientFingerprint: fingerprint,
      fileName,
      fileType,
      fileSize: data.byteLength,
    }
  }

  const hiddenMetadata: HiddenMetadata = {
    fileName,
    fileType,
    fileSize: data.byteLength,
    createdAt,
    recipientFingerprint: fingerprint,
  }
  const metadataIv = getCrypto().getRandomValues(new Uint8Array(AES_IV_LENGTH))
  let encryptedMetadata: ArrayBuffer
  try {
    encryptedMetadata = await subtle.encrypt(
      { name: 'AES-GCM', iv: metadataIv },
      aesKey,
      stringToBytes(JSON.stringify(hiddenMetadata)) as BufferSource,
    )
  } catch (cause) {
    throw new SealBoxCryptoError('UNKNOWN', 'The package metadata could not be encrypted.', {
      cause,
    })
  }

  return {
    ...base,
    version: 2,
    metadata: 'hidden',
    encryptedMetadata: bytesToBase64(new Uint8Array(encryptedMetadata)),
    metadataIv: bytesToBase64(metadataIv),
  }
}

/**
 * Recover the original file. Throws typed errors for a wrong key versus a
 * tampered or corrupt package so the UI can explain what actually failed.
 */
export async function decryptPackage(
  pkg: SealBoxPackage,
  privateKey: CryptoKey,
): Promise<DecryptedFile> {
  const { subtle } = getCrypto()

  const wrappedKey = base64ToBytes(pkg.encryptedKey)
  const iv = base64ToBytes(pkg.iv)
  const ciphertext = base64ToBytes(pkg.data)

  let rawAesKey: ArrayBuffer
  try {
    rawAesKey = await subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, wrappedKey as BufferSource)
  } catch (cause) {
    throw new SealBoxCryptoError(
      'WRONG_KEY',
      'This private key could not unwrap the package key. Check that it belongs to the intended recipient.',
      { cause },
    )
  }

  let aesKey: CryptoKey
  try {
    aesKey = await subtle.importKey('raw', rawAesKey, { name: 'AES-GCM' }, false, ['decrypt'])
  } catch (cause) {
    throw new SealBoxCryptoError('INVALID_PACKAGE', 'The package contains an invalid key.', {
      cause,
    })
  }

  let hiddenMetadata: HiddenMetadata | null = null
  if (pkg.metadata === 'hidden') {
    let metadataPlaintext: ArrayBuffer
    try {
      metadataPlaintext = await subtle.decrypt(
        { name: 'AES-GCM', iv: base64ToBytes(pkg.metadataIv) },
        aesKey,
        base64ToBytes(pkg.encryptedMetadata) as BufferSource,
      )
    } catch (cause) {
      throw new SealBoxCryptoError(
        'AUTHENTICATION_FAILED',
        'The package metadata could not be verified or decrypted. The package may be corrupted or altered.',
        { cause },
      )
    }
    hiddenMetadata = parseHiddenMetadata(new Uint8Array(metadataPlaintext))
  }

  let plaintext: ArrayBuffer
  try {
    plaintext = await subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ciphertext as BufferSource)
  } catch (cause) {
    throw new SealBoxCryptoError(
      'AUTHENTICATION_FAILED',
      'The file could not be verified or decrypted. The package may be corrupted or altered.',
      { cause },
    )
  }

  if (hiddenMetadata && hiddenMetadata.fileSize !== plaintext.byteLength) {
    throw new SealBoxCryptoError(
      'INVALID_PACKAGE',
      'The package metadata does not match the encrypted file contents.',
    )
  }

  let fileName = ''
  let fileType = ''
  if (hiddenMetadata) {
    fileName = hiddenMetadata.fileName
    fileType = hiddenMetadata.fileType
  } else if (pkg.metadata !== 'hidden') {
    fileName = pkg.fileName
    fileType = pkg.fileType
  }

  return {
    bytes: new Uint8Array(plaintext),
    fileName: fileName || 'decrypted-file',
    fileType,
    metadata: hiddenMetadata ? 'hidden' : 'visible',
  }
}

export function serializePackage(pkg: SealBoxPackage): string {
  return JSON.stringify(pkg, null, 2)
}

export function packageToBlob(pkg: SealBoxPackage): Blob {
  return new Blob([serializePackage(pkg)], { type: PACKAGE_MIME })
}

/** Suggested download name for a package, e.g. `report.pdf.sealbox`. */
export function packageFileName(originalName: string): string {
  const base = originalName.replace(/\.[^./\\]+$/, '') || originalName || 'package'
  return `${base}${PACKAGE_EXTENSION}`
}

function isPackageBase(candidate: Record<string, unknown>): boolean {
  return (
    candidate.format === PACKAGE_FORMAT &&
    typeof candidate.version === 'number' &&
    Number.isInteger(candidate.version) &&
    candidate.version >= 1 &&
    typeof candidate.cipher === 'string' &&
    typeof candidate.keyWrap === 'string' &&
    typeof candidate.encryptedKey === 'string' &&
    typeof candidate.iv === 'string' &&
    typeof candidate.data === 'string'
  )
}

function hasVisibleMetadata(candidate: Record<string, unknown>): boolean {
  return (
    typeof candidate.createdAt === 'string' &&
    !Number.isNaN(Date.parse(candidate.createdAt)) &&
    typeof candidate.recipientFingerprint === 'string' &&
    typeof candidate.fileName === 'string' &&
    typeof candidate.fileType === 'string' &&
    typeof candidate.fileSize === 'number' &&
    Number.isFinite(candidate.fileSize) &&
    candidate.fileSize >= 0
  )
}

export function isSealBoxPackage(value: unknown): value is SealBoxPackage {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  if (!isPackageBase(candidate)) return false
  if (candidate.version === 1) {
    return candidate.metadata === undefined && hasVisibleMetadata(candidate)
  }
  if (candidate.version === PACKAGE_VERSION) {
    if (candidate.metadata === 'hidden') {
      return (
        typeof candidate.encryptedMetadata === 'string' &&
        typeof candidate.metadataIv === 'string'
      )
    }
    if (candidate.metadata === 'visible') return hasVisibleMetadata(candidate)
  }
  return false
}

export function parsePackage(text: string): SealBoxPackage {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (cause) {
    throw new SealBoxCryptoError(
      'INVALID_PACKAGE',
      'This is not a SealBox package. Choose a file created by the Encrypt step.',
      { cause },
    )
  }

  if (typeof parsed === 'object' && parsed !== null && 'format' in parsed) {
    const format = (parsed as { format: unknown }).format
    if (format !== PACKAGE_FORMAT) {
      throw new SealBoxCryptoError(
        'UNSUPPORTED_FORMAT',
        'This file is a different kind of package and cannot be decrypted here.',
      )
    }
  }

  if (typeof parsed === 'object' && parsed !== null && 'version' in parsed) {
    const version = (parsed as { version: unknown }).version
    if (typeof version === 'number' && version > PACKAGE_VERSION) {
      throw new SealBoxCryptoError(
        'UNSUPPORTED_FORMAT',
        'This package was created by a newer version of SealBox and is not supported here.',
      )
    }
  }

  if (!isSealBoxPackage(parsed)) {
    throw new SealBoxCryptoError(
      'INVALID_PACKAGE',
      'This package is missing required fields and cannot be decrypted.',
    )
  }

  return parsed
}

/** Parse a package from raw bytes (the `.sealbox` file contents). */
export function parsePackageBytes(bytes: Uint8Array): SealBoxPackage {
  return parsePackage(bytesToString(bytes))
}
