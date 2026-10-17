import { isSealBoxCryptoError, type SealBoxErrorCode } from './crypto'

export interface ErrorCopy {
  title: string
  message: string
}

const COPY: Record<SealBoxErrorCode, ErrorCopy> = {
  INVALID_PACKAGE: {
    title: 'This package cannot be opened',
    message:
      'The file is not a valid SealBox package, or it is damaged. Choose a package created by the Encrypt step.',
  },
  UNSUPPORTED_FORMAT: {
    title: 'Unsupported package format',
    message: 'This package uses a format this version of SealBox cannot read.',
  },
  WRONG_KEY: {
    title: 'This private key does not match',
    message:
      'The selected private key could not decrypt the package. Check that it belongs to the intended recipient.',
  },
  AUTHENTICATION_FAILED: {
    title: 'Verification failed',
    message:
      'The package could not be verified. It may have been altered or corrupted after it was created.',
  },
  INVALID_KEY: {
    title: 'Invalid key',
    message:
      'The key file could not be read. Check that it is an unmodified PEM public or private key.',
  },
  PASSPHRASE_REQUIRED: {
    title: 'Passphrase required',
    message: 'This private key is protected. Enter the passphrase to unlock it.',
  },
  WRONG_PASSPHRASE: {
    title: 'Incorrect passphrase',
    message: 'The passphrase did not unlock this private key. Check it and try again.',
  },
  FILE_TOO_LARGE: {
    title: 'File too large',
    message:
      'This file is larger than the 100 MB limit for in-browser encryption. Choose a smaller file.',
  },
  UNSUPPORTED_FILE: {
    title: 'Unsupported file',
    message: 'This file type or package format is not supported.',
  },
  CRYPTO_UNAVAILABLE: {
    title: 'Encryption is unavailable',
    message:
      'This browser does not provide the Web Crypto API. Try a current version of Chrome, Edge, Firefox, or Safari over HTTPS.',
  },
  UNKNOWN: {
    title: 'Something went wrong',
    message: 'The operation could not be completed. Try again, and review the file and key details.',
  },
}

export function describeError(error: unknown): ErrorCopy {
  if (isSealBoxCryptoError(error)) {
    return COPY[error.code] ?? COPY.UNKNOWN
  }
  if (error instanceof Error && error.message) {
    return { title: 'Something went wrong', message: error.message }
  }
  return COPY.UNKNOWN
}
