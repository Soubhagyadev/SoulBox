import { SealBoxCryptoError } from './errors'
import { base64ToBytes, bytesToBase64, bytesToString } from './encoding'
import { getKeyFingerprint } from './keys'

export const PACKAGE_FORMAT = 'SEALBOX-PACKAGE'
export const PACKAGE_VERSION = 1
export const PACKAGE_EXTENSION = '.sealbox'
export const PACKAGE_MIME = 'application/x-sb-package'

export const AES_ALGORITHM_LABEL = 'AES-256-GCM'
export const KEY_WRAP_ALGORITHM_LABEL = 'RSA-OAEP-SHA256'
export const AES_KEY_LENGTH = 256
export const AES_IV_LENGTH = 12

/** Whole-file AES-GCM means the file must fit in memory. */
export const MAX_FILE_SIZE = 100 * 1024 * 1024

/**
 * Serialised encrypted package. `data`, `iv`, and `encryptedKey` are
 * ciphertext or cryptographic material. `fileName`, `fileType`, `fileSize`,
 * `recipientFingerprint`, and `createdAt` are visible metadata — the UI must
 * disclose this (see EFT_Design_Spec.md §11).
 */
export interface SealBoxPackage {
  format: typeof PACKAGE_FORMAT
  version: number
  createdAt: string
  cipher: string
  keyWrap: string
  recipientFingerprint: string
  fileName: string
  fileType: string
  fileSize: number
  encryptedKey: string
  iv: string
  data: string
}

export interface EncryptFileInput {
  data: Uint8Array
  fileName: string
  fileType?: string
  recipientPublicKey: CryptoKey
}

export interface DecryptedFile {
  bytes: Uint8Array
  fileName: string
  fileType: string
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

/**
 * Hybrid encryption: a one-time AES-256-GCM key encrypts the file contents,
 * and the recipient's RSA public key wraps that AES key. The plaintext never
 * leaves this function.
 */
export async function encryptFile(input: EncryptFileInput): Promise<SealBoxPackage> {
  const { data, fileName, fileType = '', recipientPublicKey } = input
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

  return {
    format: PACKAGE_FORMAT,
    version: PACKAGE_VERSION,
    createdAt: new Date().toISOString(),
    cipher: AES_ALGORITHM_LABEL,
    keyWrap: KEY_WRAP_ALGORITHM_LABEL,
    recipientFingerprint: fingerprint,
    fileName,
    fileType,
    fileSize: data.byteLength,
    encryptedKey: bytesToBase64(new Uint8Array(wrappedKey)),
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(ciphertext)),
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

  return {
    bytes: new Uint8Array(plaintext),
    fileName: pkg.fileName || 'decrypted-file',
    fileType: pkg.fileType,
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

export function isSealBoxPackage(value: unknown): value is SealBoxPackage {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    candidate.format === PACKAGE_FORMAT &&
    typeof candidate.version === 'number' &&
    typeof candidate.encryptedKey === 'string' &&
    typeof candidate.iv === 'string' &&
    typeof candidate.data === 'string' &&
    typeof candidate.fileName === 'string' &&
    typeof candidate.fileSize === 'number'
  )
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

  if (!isSealBoxPackage(parsed)) {
    throw new SealBoxCryptoError(
      'INVALID_PACKAGE',
      'This package is missing required fields and cannot be decrypted.',
    )
  }

  if (parsed.version > PACKAGE_VERSION) {
    throw new SealBoxCryptoError(
      'UNSUPPORTED_FORMAT',
      'This package was created by a newer version of SealBox and is not supported here.',
    )
  }

  return parsed
}

/** Parse a package from raw bytes (the `.sealbox` file contents). */
export function parsePackageBytes(bytes: Uint8Array): SealBoxPackage {
  return parsePackage(bytesToString(bytes))
}
