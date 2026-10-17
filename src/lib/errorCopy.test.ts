import { describe, expect, it } from 'vitest'
import { describeError } from './errorCopy'
import { SealBoxCryptoError } from './crypto'

describe('describeError', () => {
  it('maps typed crypto errors to specific copy', () => {
    expect(describeError(new SealBoxCryptoError('WRONG_KEY', 'x')).title).toMatch(/private key/i)
    expect(describeError(new SealBoxCryptoError('WRONG_PASSPHRASE', 'x')).title).toMatch(
      /passphrase/i,
    )
    expect(describeError(new SealBoxCryptoError('AUTHENTICATION_FAILED', 'x')).title).toMatch(
      /verification failed/i,
    )
    expect(describeError(new SealBoxCryptoError('FILE_TOO_LARGE', 'x')).title).toMatch(/too large/i)
  })

  it('falls back to a generic message for plain errors', () => {
    expect(describeError(new Error('boom')).message).toBe('boom')
  })

  it('falls back for unknown values', () => {
    expect(describeError('nope').title).toBe('Something went wrong')
  })
})
