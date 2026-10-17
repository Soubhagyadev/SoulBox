import { describe, expect, it } from 'vitest'
import {
  base64ToBytes,
  bytesToBase64,
  bytesToHex,
  bytesToString,
  concatBytes,
  hexToFingerprint,
  stringToBytes,
  toArrayBuffer,
} from './encoding'

describe('encoding', () => {
  it('round-trips bytes through base64', () => {
    const bytes = new Uint8Array([0, 1, 2, 253, 254, 255])
    expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(Array.from(bytes))
  })

  it('handles payloads larger than the chunk size without overflowing', () => {
    const large = new Uint8Array(200_000)
    for (let i = 0; i < large.length; i += 1) large[i] = i % 256
    const restored = base64ToBytes(bytesToBase64(large))
    expect(restored.length).toBe(large.length)
    expect(restored[199_999]).toBe(large[199_999])
  })

  it('round-trips unicode strings', () => {
    const value = 'Recipient 🔐 café — ünïcode'
    expect(bytesToString(stringToBytes(value))).toBe(value)
  })

  it('concatenates byte arrays', () => {
    const result = concatBytes(new Uint8Array([1, 2]), new Uint8Array([3]), new Uint8Array([]))
    expect(Array.from(result)).toEqual([1, 2, 3])
  })

  it('converts to a standalone ArrayBuffer copy', () => {
    const source = new Uint8Array([9, 8, 7])
    const buffer = toArrayBuffer(source)
    expect(new Uint8Array(buffer)).toEqual(source)
  })

  it('formats a hex digest as a colon-separated fingerprint', () => {
    expect(bytesToHex(new Uint8Array([0x0a, 0xff]))).toBe('0aff')
    expect(hexToFingerprint('a1b2c3d4')).toBe('A1:B2:C3:D4')
  })
})
