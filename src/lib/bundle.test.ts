import { describe, expect, it } from 'vitest'
import { createBundle, isZipFile, readBundle } from './bundle'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

describe('bundle', () => {
  it('round-trips files with nested paths', () => {
    const zipped = createBundle([
      { name: 'docs/readme.txt', bytes: encoder.encode('alpha') },
      { name: 'docs/data.bin', bytes: new Uint8Array([0, 1, 2]) },
    ])

    const bundle = readBundle(zipped)
    expect(bundle).not.toBeNull()
    expect(bundle?.entries.map((entry) => entry.name).sort()).toEqual([
      'docs/data.bin',
      'docs/readme.txt',
    ])
    expect(bundle?.totalSize).toBe(8)
    const readme = bundle?.entries.find((entry) => entry.name === 'docs/readme.txt')
    expect(readme ? decoder.decode(readme.bytes) : null).toBe('alpha')
  })

  it('returns null when the bytes are not a ZIP archive', () => {
    expect(readBundle(encoder.encode('definitely not a zip file'))).toBeNull()
  })

  it('detects ZIP bundles by MIME type or extension', () => {
    expect(isZipFile('bundle.zip', '')).toBe(true)
    expect(isZipFile('bundle.sealbox', 'application/zip')).toBe(true)
    expect(isZipFile('report.pdf', 'application/pdf')).toBe(false)
  })
})
