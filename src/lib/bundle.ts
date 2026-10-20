import { unzipSync, zipSync } from 'fflate'

export const MAX_BUNDLE_FILES = 500

export interface BundleEntry {
  name: string
  bytes: Uint8Array
}

export interface DecryptedBundle {
  entries: BundleEntry[]
  totalSize: number
}

export function createBundle(files: BundleEntry[]): Uint8Array {
  if (files.length === 0) {
    throw new Error('A bundle needs at least one file.')
  }
  const tree: Record<string, Uint8Array> = {}
  for (const file of files) {
    tree[file.name] = file.bytes
  }
  return zipSync(tree, { level: 0 })
}

export function readBundle(bytes: Uint8Array): DecryptedBundle | null {
  let extracted: Record<string, Uint8Array>
  try {
    extracted = unzipSync(bytes)
  } catch {
    return null
  }

  const entries = Object.entries(extracted)
    .filter(([name]) => !name.endsWith('/'))
    .map(([name, data]) => ({ name, bytes: data }))

  if (entries.length === 0 || entries.length > MAX_BUNDLE_FILES) return null

  return {
    entries,
    totalSize: entries.reduce((total, entry) => total + entry.bytes.byteLength, 0),
  }
}

export function isZipFile(fileName: string, fileType: string): boolean {
  return fileType.toLowerCase() === 'application/zip' || fileName.toLowerCase().endsWith('.zip')
}
