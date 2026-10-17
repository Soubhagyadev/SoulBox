export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exponent
  const rounded = exponent === 0 ? value : Number(value.toFixed(decimals))
  return `${rounded} ${units[exponent]}`
}

export function readFileWithProgress(
  file: Blob,
  onProgress?: (fraction: number) => void,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(event.loaded / event.total)
      }
    }
    reader.onload = () => {
      onProgress?.(1)
      const result = reader.result
      if (result instanceof ArrayBuffer) {
        resolve(new Uint8Array(result))
      } else {
        reject(new Error('Unexpected file read result.'))
      }
    }
    reader.onerror = () => reject(reader.error ?? new Error('The file could not be read.'))
    reader.onabort = () => reject(new Error('The file read was cancelled.'))
    reader.readAsArrayBuffer(file)
  })
}

export function baseName(name: string): string {
  const parts = name.split(/[\\/]/)
  return parts[parts.length - 1] || name
}

function extensionOf(name: string): string {
  const match = /\.([^.]+)$/.exec(name)
  return match ? `.${match[1].toLowerCase()}` : ''
}

/** Check a file against an `accept` attribute value (extensions or MIME types). */
export function matchesAccept(file: File, accept?: string): boolean {
  if (!accept) return true
  const rules = accept
    .split(',')
    .map((rule) => rule.trim().toLowerCase())
    .filter(Boolean)
  if (rules.length === 0) return true
  const ext = extensionOf(file.name)
  const type = file.type.toLowerCase()
  return rules.some((rule) => {
    if (rule.startsWith('.')) return ext === rule
    if (rule.endsWith('/*')) return type.startsWith(rule.slice(0, -1))
    return type === rule
  })
}

/** Strip a trailing `.sealbox` extension to recover the original file name. */
export function stripPackageExtension(name: string): string {
  return name.replace(/\.sealbox$/i, '')
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Give the browser a tick before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
