import { SealBoxCryptoError } from './errors'
import {
  base64ToBytes,
  bytesToBase64,
  bytesToHex,
  hexToFingerprint,
  toArrayBuffer,
} from './encoding'

export const RSA_MODULUS_LENGTH = 2048
export const RSA_HASH = 'SHA-256'
export const RSA_ALGORITHM_LABEL = `RSA-OAEP-${RSA_MODULUS_LENGTH}`

export interface KeyIdentity {
  /** Stable SHA-256 fingerprint of the public key (colon-separated hex). */
  fingerprint: string
  /** Short, human-comparable portion of the fingerprint. */
  shortFingerprint: string
}

function getCrypto(): Crypto {
  if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.subtle) {
    throw new SealBoxCryptoError(
      'CRYPTO_UNAVAILABLE',
      'This browser does not expose the Web Crypto API required for encryption.',
    )
  }
  return globalThis.crypto
}

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  const { subtle } = getCrypto()
  return subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: RSA_MODULUS_LENGTH,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: RSA_HASH,
    },
    true,
    ['encrypt', 'decrypt'],
  )
}

export async function exportPublicKeyPem(key: CryptoKey): Promise<string> {
  const { subtle } = getCrypto()
  const der = await subtle.exportKey('spki', key)
  return toPem('PUBLIC KEY', der)
}

export async function exportPrivateKeyPem(key: CryptoKey): Promise<string> {
  const { subtle } = getCrypto()
  const der = await subtle.exportKey('pkcs8', key)
  return toPem('PRIVATE KEY', der)
}

export async function importPublicKeyPem(pem: string): Promise<CryptoKey> {
  const { subtle } = getCrypto()
  const { label, der } = fromPem(pem)
  if (label !== 'PUBLIC KEY') {
    throw new SealBoxCryptoError(
      'INVALID_KEY',
      'That file is not a public key. Choose a file that contains a "PUBLIC KEY" block.',
    )
  }
  try {
    return await subtle.importKey(
      'spki',
      toArrayBuffer(der),
      { name: 'RSA-OAEP', hash: RSA_HASH },
      true,
      ['encrypt'],
    )
  } catch (cause) {
    throw new SealBoxCryptoError(
      'INVALID_KEY',
      'The public key could not be read. It may be corrupted or in an unsupported format.',
      { cause },
    )
  }
}

export async function importPrivateKeyPem(pem: string): Promise<CryptoKey> {
  const { subtle } = getCrypto()
  const { label, der } = fromPem(pem)
  if (label !== 'PRIVATE KEY') {
    if (label === 'ENCRYPTED PRIVATE KEY') {
      throw new SealBoxCryptoError(
        'PASSPHRASE_REQUIRED',
        'This private key is protected by a passphrase. Enter the passphrase to unlock it.',
      )
    }
    throw new SealBoxCryptoError(
      'INVALID_KEY',
      'That file is not a private key. Choose a file that contains a "PRIVATE KEY" block.',
    )
  }
  try {
    return await subtle.importKey(
      'pkcs8',
      toArrayBuffer(der),
      { name: 'RSA-OAEP', hash: RSA_HASH },
      true,
      ['decrypt'],
    )
  } catch (cause) {
    throw new SealBoxCryptoError(
      'INVALID_KEY',
      'The private key could not be read. It may be corrupted or in an unsupported format.',
      { cause },
    )
  }
}

/** Fingerprint is derived from the public key's SPKI bytes only. */
export async function getKeyFingerprint(publicKey: CryptoKey): Promise<KeyIdentity> {
  const { subtle } = getCrypto()
  const der = await subtle.exportKey('spki', publicKey)
  const digest = await subtle.digest('SHA-256', der)
  const hex = bytesToHex(new Uint8Array(digest))
  const fingerprint = hexToFingerprint(hex)
  return { fingerprint, shortFingerprint: shortFingerprint(fingerprint) }
}

/** Get the fingerprint from an exported public key PEM. */
export async function getFingerprintFromPem(pem: string): Promise<KeyIdentity> {
  const key = await importPublicKeyPem(pem)
  return getKeyFingerprint(key)
}

/**
 * Reconstruct the matching public key from a private key. RSA JWKs carry the
 * public modulus and exponent, so the public half can be recovered without
 * ever exposing private material.
 */
export async function derivePublicKeyFromPrivate(privateKey: CryptoKey): Promise<CryptoKey> {
  const { subtle } = getCrypto()
  let jwk: JsonWebKey
  try {
    jwk = await subtle.exportKey('jwk', privateKey)
  } catch (cause) {
    throw new SealBoxCryptoError(
      'INVALID_KEY',
      'The public key could not be derived from this private key.',
      { cause },
    )
  }
  const publicJwk: JsonWebKey = {
    kty: 'RSA',
    n: jwk.n,
    e: jwk.e,
    alg: 'RSA-OAEP-256',
    ext: true,
    key_ops: ['encrypt'],
  }
  return subtle.importKey('jwk', publicJwk, { name: 'RSA-OAEP', hash: RSA_HASH }, true, ['encrypt'])
}

/** First three and last two byte groups, e.g. `A1:B2:C3:…:9F:0D`. */
export function shortFingerprint(fingerprint: string): string {
  const groups = fingerprint.split(':')
  if (groups.length <= 5) return fingerprint
  return `${groups.slice(0, 3).join(':')} … ${groups.slice(-2).join(':')}`
}

export function toPem(label: string, der: ArrayBuffer): string {
  const base64 = bytesToBase64(new Uint8Array(der))
  const lines = base64.match(/.{1,64}/g) ?? []
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`
}

export interface ParsedPem {
  label: string
  der: Uint8Array
}

export function fromPem(pem: string): ParsedPem {
  const match = /-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/.exec(pem.trim())
  if (!match) {
    throw new SealBoxCryptoError(
      'INVALID_KEY',
      'This does not look like a PEM key file. Expected a "-----BEGIN … KEY-----" block.',
    )
  }
  const label = match[1]
  const body = match[2].replace(/\s+/g, '')
  try {
    return { label, der: base64ToBytes(body) }
  } catch (cause) {
    throw new SealBoxCryptoError('INVALID_KEY', 'The key file contains invalid base64 data.', {
      cause,
    })
  }
}

/** True when the string looks like a PEM block of any kind. */
export function looksLikePem(value: string): boolean {
  return /-----BEGIN [A-Z0-9 ]+-----/.test(value)
}
