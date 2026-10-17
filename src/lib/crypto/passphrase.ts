import { SealBoxCryptoError } from './errors'
import {
  base64ToBytes,
  bytesToBase64,
  bytesToString,
  stringToBytes,
  toArrayBuffer,
} from './encoding'
import { fromPem, toPem, RSA_HASH } from './keys'

export const PBKDF2_ITERATIONS = 310_000
const SALT_LENGTH = 16
const IV_LENGTH = 12
const ENCRYPTED_PRIVATE_KEY_LABEL = 'ENCRYPTED PRIVATE KEY'

interface EncryptedPrivateKeyEnvelope {
  version: 1
  kdf: 'PBKDF2-SHA256'
  iterations: number
  salt: string
  cipher: 'AES-256-GCM'
  iv: string
  data: string
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

async function deriveKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
) {
  const { subtle } = getCrypto()
  const baseKey = await subtle.importKey('raw', stringToBytes(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ])
  return subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: RSA_HASH },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export function isEncryptedPrivateKeyPem(pem: string): boolean {
  return pem.includes(`-----BEGIN ${ENCRYPTED_PRIVATE_KEY_LABEL}-----`)
}

/**
 * Wrap a PKCS#8 private key with a passphrase using PBKDF2 + AES-256-GCM.
 * The result is a self-describing PEM envelope.
 */
export async function protectPrivateKeyPem(
  privateKey: CryptoKey,
  passphrase: string,
): Promise<string> {
  if (passphrase.length < 8) {
    throw new SealBoxCryptoError(
      'WRONG_PASSPHRASE',
      'Choose a passphrase of at least 8 characters.',
    )
  }
  const { subtle } = getCrypto()
  const pkcs8 = await subtle.exportKey('pkcs8', privateKey)
  const salt = getCrypto().getRandomValues(new Uint8Array(SALT_LENGTH))
  const iv = getCrypto().getRandomValues(new Uint8Array(IV_LENGTH))
  const wrappingKey = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS)
  const ciphertext = await subtle.encrypt({ name: 'AES-GCM', iv }, wrappingKey, pkcs8)

  const envelope: EncryptedPrivateKeyEnvelope = {
    version: 1,
    kdf: 'PBKDF2-SHA256',
    iterations: PBKDF2_ITERATIONS,
    salt: bytesToBase64(salt),
    cipher: 'AES-256-GCM',
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(ciphertext)),
  }

  return toPem(ENCRYPTED_PRIVATE_KEY_LABEL, toArrayBuffer(stringToBytes(JSON.stringify(envelope))))
}

/**
 * Unwrap a passphrase-protected private key PEM and import it as a CryptoKey.
 */
export async function unprotectPrivateKeyPem(
  pem: string,
  passphrase: string,
): Promise<CryptoKey> {
  const { subtle } = getCrypto()
  const { label, der } = fromPem(pem)
  if (label !== ENCRYPTED_PRIVATE_KEY_LABEL) {
    throw new SealBoxCryptoError('INVALID_KEY', 'This is not an encrypted private key.')
  }

  let envelope: EncryptedPrivateKeyEnvelope
  try {
    envelope = JSON.parse(bytesToString(der)) as EncryptedPrivateKeyEnvelope
  } catch (cause) {
    throw new SealBoxCryptoError('INVALID_KEY', 'The encrypted private key is malformed.', {
      cause,
    })
  }

  if (envelope.kdf !== 'PBKDF2-SHA256' || envelope.cipher !== 'AES-256-GCM') {
    throw new SealBoxCryptoError(
      'UNSUPPORTED_FORMAT',
      'This private key uses an unsupported protection format.',
    )
  }

  const salt = base64ToBytes(envelope.salt)
  const iv = base64ToBytes(envelope.iv)
  const wrappingKey = await deriveKey(passphrase, salt, envelope.iterations)

  let pkcs8: ArrayBuffer
  try {
    pkcs8 = await subtle.decrypt({ name: 'AES-GCM', iv }, wrappingKey, base64ToBytes(envelope.data))
  } catch (cause) {
    throw new SealBoxCryptoError(
      'WRONG_PASSPHRASE',
      'The passphrase is incorrect, or the key file has been altered.',
      { cause },
    )
  }

  try {
    return await subtle.importKey(
      'pkcs8',
      pkcs8,
      { name: 'RSA-OAEP', hash: RSA_HASH },
      true,
      ['decrypt'],
    )
  } catch (cause) {
    throw new SealBoxCryptoError('INVALID_KEY', 'The private key could not be imported.', {
      cause,
    })
  }
}
