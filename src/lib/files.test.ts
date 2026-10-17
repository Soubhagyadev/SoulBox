import { describe, expect, it } from 'vitest'
import {
  baseName,
  formatBytes,
  matchesAccept,
  stripPackageExtension,
} from './files'

describe('formatBytes', () => {
  it('formats common sizes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(1024 * 1024)).toBe('1 MB')
    expect(formatBytes(5 * 1024 * 1024 * 1024)).toBe('5 GB')
  })

  it('handles invalid input', () => {
    expect(formatBytes(Number.NaN)).toBe('—')
    expect(formatBytes(-1)).toBe('—')
  })
})

describe('matchesAccept', () => {
  const txt = new File(['hello'], 'notes.txt', { type: 'text/plain' })
  const png = new File(['x'], 'photo.png', { type: 'image/png' })

  it('accepts everything when no accept value is provided', () => {
    expect(matchesAccept(txt)).toBe(true)
  })

  it('matches by extension', () => {
    expect(matchesAccept(txt, '.txt')).toBe(true)
    expect(matchesAccept(png, '.txt')).toBe(false)
  })

  it('matches by MIME type', () => {
    expect(matchesAccept(png, 'image/png')).toBe(true)
    expect(matchesAccept(txt, 'image/png')).toBe(false)
  })

  it('matches MIME wildcards', () => {
    expect(matchesAccept(png, 'image/*')).toBe(true)
    expect(matchesAccept(txt, 'image/*')).toBe(false)
  })

  it('accepts any rule in a list', () => {
    expect(matchesAccept(txt, '.sealbox,.txt')).toBe(true)
  })
})

describe('name helpers', () => {
  it('extracts the base name', () => {
    expect(baseName('/home/user/report.pdf')).toBe('report.pdf')
    expect(baseName('C:\\files\\report.pdf')).toBe('report.pdf')
    expect(baseName('report.pdf')).toBe('report.pdf')
  })

  it('strips the package extension', () => {
    expect(stripPackageExtension('report.sealbox')).toBe('report')
    expect(stripPackageExtension('report.SEALBOX')).toBe('report')
    expect(stripPackageExtension('report.pdf')).toBe('report.pdf')
  })
})
