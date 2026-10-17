/**
 * Typed errors for the cryptography layer so the UI can map failures to
 * accurate, non-alarmist copy (see EFT_Design_Spec.md §7, §11).
 */

export type SealBoxErrorCode =
  | 'INVALID_PACKAGE'
  | 'UNSUPPORTED_FORMAT'
  | 'WRONG_KEY'
  | 'AUTHENTICATION_FAILED'
  | 'INVALID_KEY'
  | 'PASSPHRASE_REQUIRED'
  | 'WRONG_PASSPHRASE'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FILE'
  | 'CRYPTO_UNAVAILABLE'
  | 'UNKNOWN'

export class SealBoxCryptoError extends Error {
  readonly code: SealBoxErrorCode

  constructor(code: SealBoxErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'SealBoxCryptoError'
    this.code = code
  }
}

export function isSealBoxCryptoError(error: unknown): error is SealBoxCryptoError {
  return error instanceof SealBoxCryptoError
}
