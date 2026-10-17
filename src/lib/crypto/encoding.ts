/**
 * Byte/string encoding helpers used by the cryptography layer.
 * Chunked so large files do not overflow the call stack via spread args.
 */

const CHUNK_SIZE = 0x8000 // 32 KiB

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

export function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function stringToBytes(value: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(value)
}

export function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}

export function concatBytes(...arrays: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const total = arrays.reduce((sum, array) => sum + array.length, 0)
  const result = new Uint8Array(total)
  let offset = 0
  for (const array of arrays) {
    result.set(array, offset)
    offset += array.length
  }
  return result
}

/** Convert an ArrayBuffer view to a standalone ArrayBuffer copy. */
export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return copy
}

export function bytesToHex(bytes: Uint8Array): string {
  let hex = ''
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0')
  }
  return hex
}

/** Turn a hex digest into a colon-separated, uppercase fingerprint. */
export function hexToFingerprint(hex: string, groupSize = 2): string {
  const groups: string[] = []
  for (let i = 0; i < hex.length; i += groupSize) {
    groups.push(hex.slice(i, i + groupSize).toUpperCase())
  }
  return groups.join(':')
}
