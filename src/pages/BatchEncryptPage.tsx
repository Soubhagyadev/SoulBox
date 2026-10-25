import { useCallback, useRef, useState } from 'react'
import {
  Download,
  FileText,
  FolderOpen,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react'
import { useKeyVault } from '../context/keyVault'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { FileDropZone } from '../components/FileDropZone'
import { MetadataPrivacyToggle } from '../components/MetadataPrivacyToggle'
import { ProgressBar } from '../components/ProgressBar'
import { RecipientKeyPicker, type Recipient } from '../components/RecipientKeyPicker'
import { StatusMessage } from '../components/StatusMessage'
import {
  encryptFile,
  HIDDEN_PACKAGE_FILE_NAME,
  importPublicKeyPem,
  MAX_FILE_SIZE,
  PACKAGE_EXTENSION,
  packageToBlob,
  SealBoxCryptoError,
  type SealBoxPackage,
} from '../lib/crypto'
import { createBundle, MAX_BUNDLE_FILES, type BundleEntry } from '../lib/bundle'
import { downloadBlob, formatBytes, readFileWithProgress } from '../lib/files'
import { describeError, type ErrorCopy } from '../lib/errorCopy'
import { recordEvent } from '../lib/analytics'

type Phase = 'idle' | 'reading' | 'packing' | 'encrypting' | 'success' | 'error'

interface SelectedFile {
  file: File
  path: string
}

interface BatchResult {
  pkg: SealBoxPackage
  fileName: string
  bundleFileName: string
  fileCount: number
  totalSize: number
}

function uniquePath(path: string, used: Set<string>): string {
  if (!used.has(path)) return path
  const slash = path.lastIndexOf('/')
  const directory = slash >= 0 ? path.slice(0, slash + 1) : ''
  const name = path.slice(slash + 1)
  const dot = name.lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  const extension = dot > 0 ? name.slice(dot) : ''
  let counter = 2
  let candidate = `${directory}${base} (${counter})${extension}`
  while (used.has(candidate)) {
    counter += 1
    candidate = `${directory}${base} (${counter})${extension}`
  }
  return candidate
}

function bundleBaseName(items: SelectedFile[]): string {
  const first = items[0]?.path
  const slash = first?.indexOf('/') ?? -1
  if (first && slash > 0) {
    const root = first.slice(0, slash)
    if (items.every((item) => item.path.startsWith(`${root}/`))) {
      return root.replace(/[\\/:*?"<>|]/g, '-')
    }
  }
  return `sealbox-batch-${items.length}-files`
}

export function BatchEncryptPage() {
  const { getPublicCryptoKey } = useKeyVault()

  const [items, setItems] = useState<SelectedFile[]>([])
  const [recipient, setRecipient] = useState<Recipient>(null)
  const [hideMetadata, setHideMetadata] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [readProgress, setReadProgress] = useState<number | undefined>(undefined)
  const [error, setError] = useState<ErrorCopy | null>(null)
  const [notice, setNotice] = useState<ErrorCopy | null>(null)
  const [result, setResult] = useState<BatchResult | null>(null)

  const folderInputRef = useRef<HTMLInputElement>(null)

  const busy = phase === 'reading' || phase === 'packing' || phase === 'encrypting'
  const totalSize = items.reduce((total, item) => total + item.file.size, 0)
  const canEncrypt = items.length > 0 && Boolean(recipient) && !busy

  const resetOutcome = () => {
    setResult(null)
    setError(null)
    if (phase === 'success' || phase === 'error') setPhase('idle')
  }

  const addFiles = (incoming: File[]) => {
    if (incoming.length === 0) return
    resetOutcome()
    setNotice(null)

    const used = new Set(items.map((item) => item.path))
    const next = [...items]
    const skipped: string[] = []
    let size = items.reduce((total, item) => total + item.file.size, 0)

    for (const file of incoming) {
      if (next.length >= MAX_BUNDLE_FILES) {
        skipped.push(`A bundle can hold at most ${MAX_BUNDLE_FILES} files.`)
        break
      }
      if (file.size > MAX_FILE_SIZE) {
        skipped.push(
          `“${file.name}” is larger than the ${formatBytes(MAX_FILE_SIZE)} bundle limit.`,
        )
        continue
      }
      if (size + file.size > MAX_FILE_SIZE) {
        skipped.push(
          `“${file.name}” would push the bundle past the ${formatBytes(MAX_FILE_SIZE)} limit.`,
        )
        continue
      }
      const path = uniquePath(file.webkitRelativePath || file.name, used)
      used.add(path)
      next.push({ file, path })
      size += file.size
    }

    setItems(next)
    if (skipped.length > 0) {
      setNotice({ title: 'Some files were skipped', message: skipped.join(' ') })
    }
  }

  const handleFolderPick = (fileList: FileList | null) => {
    if (!fileList) return
    addFiles(Array.from(fileList))
  }

  const removeItem = (path: string) => {
    setItems((current) => current.filter((item) => item.path !== path))
    resetOutcome()
  }

  const handleEncrypt = useCallback(async () => {
    if (items.length === 0 || !recipient) return
    setError(null)
    setNotice(null)
    setResult(null)
    try {
      setPhase('reading')
      setReadProgress(0)

      const entries: BundleEntry[] = []
      let processed = 0
      for (const item of items) {
        const offset = processed
        const bytes = await readFileWithProgress(item.file, (fraction) => {
          setReadProgress(
            totalSize > 0 ? (offset + fraction * item.file.size) / totalSize : 1,
          )
        })
        entries.push({ name: item.path, bytes })
        processed += item.file.size
      }
      setReadProgress(1)

      setPhase('packing')
      setReadProgress(undefined)
      const bundle = createBundle(entries)
      if (bundle.byteLength > MAX_FILE_SIZE) {
        throw new SealBoxCryptoError(
          'FILE_TOO_LARGE',
          'The packed bundle is larger than the 100 MB limit for in-browser encryption.',
        )
      }

      setPhase('encrypting')
      const publicKey =
        recipient.source === 'vault'
          ? await getPublicCryptoKey(recipient.id)
          : await importPublicKeyPem(recipient.pem)

      const baseName = bundleBaseName(items)
      const bundleFileName = `${baseName}.zip`
      const pkg = await encryptFile({
        data: bundle,
        fileName: bundleFileName,
        fileType: 'application/zip',
        recipientPublicKey: publicKey,
        hideMetadata,
      })

      setResult({
        pkg,
        fileName: hideMetadata ? HIDDEN_PACKAGE_FILE_NAME : `${baseName}${PACKAGE_EXTENSION}`,
        bundleFileName,
        fileCount: items.length,
        totalSize,
      })
      recordEvent('batch-encrypt', { bytes: totalSize, files: items.length })
      setPhase('success')
    } catch (err) {
      setError(describeError(err))
      setPhase('error')
    }
  }, [items, recipient, hideMetadata, totalSize, getPublicCryptoKey])

  const handleReset = () => {
    setItems([])
    setRecipient(null)
    setHideMetadata(false)
    setResult(null)
    setError(null)
    setNotice(null)
    setReadProgress(undefined)
    setPhase('idle')
  }

  return (
    <div className="sb-container sb-workflow">
      <header className="sb-workflow__header">
        <h1 className="sb-page-title">Folder &amp; batch encryption</h1>
        <p className="sb-muted" style={{ marginTop: 'var(--space-2)' }}>
          Pack several files or a whole folder into one encrypted bundle for a recipient. Folder
          structure is preserved inside the bundle.
        </p>
      </header>

      <div className="sb-workflow__grid sb-workflow__grid--single">
        <div className="sb-stack">
          <Card>
            <h2 className="sb-section-title" style={{ marginBottom: 'var(--space-4)' }}>
              1. Select files or a folder
            </h2>

            <FileDropZone
              onSelect={addFiles}
              onReject={(reasons) =>
                setNotice({ title: 'Some files were skipped', message: reasons.join(' ') })
              }
              multiple
              maxSize={MAX_FILE_SIZE}
              disabled={busy}
              title={items.length > 0 ? 'Add more files' : 'Choose files to encrypt'}
              hint={`Drag files here or choose them from your device. Up to ${MAX_BUNDLE_FILES} files and ${formatBytes(
                MAX_FILE_SIZE,
              )} total.`}
              buttonLabel={items.length > 0 ? 'Add files' : 'Choose files'}
            />

            <div className="sb-actions" style={{ marginTop: 'var(--space-3)' }}>
              <Button
                variant="secondary"
                onClick={() => folderInputRef.current?.click()}
                disabled={busy}
                icon={<FolderOpen size={16} aria-hidden="true" />}
              >
                Choose folder
              </Button>
              <span className="sb-text-xs sb-muted">
                Folder paths are kept inside the encrypted bundle.
              </span>
              <input
                ref={folderInputRef}
                type="file"
                multiple
                className="sb-visually-hidden"
                tabIndex={-1}
                onChange={(event) => {
                  handleFolderPick(event.target.files)
                  event.target.value = ''
                }}
                {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
              />
            </div>

            {notice ? (
              <div style={{ marginTop: 'var(--space-4)' }}>
                <StatusMessage variant="warning" title={notice.title}>
                  {notice.message}
                </StatusMessage>
              </div>
            ) : null}

            {items.length > 0 ? (
              <div style={{ marginTop: 'var(--space-5)' }}>
                <div className="sb-batch-summary">
                  <p className="sb-text-sm">
                    <strong>{items.length}</strong> {items.length === 1 ? 'file' : 'files'} ·{' '}
                    {formatBytes(totalSize)}
                  </p>
                  <Button
                    variant="tertiary"
                    size="sm"
                    onClick={() => {
                      setItems([])
                      resetOutcome()
                    }}
                    disabled={busy}
                  >
                    Clear all
                  </Button>
                </div>
                <ul className="sb-batch-list" role="list">
                  {items.map((item) => (
                    <li className="sb-batch-item" key={item.path}>
                      <span className="sb-batch-item__icon" aria-hidden="true">
                        <FileText size={16} strokeWidth={1.9} />
                      </span>
                      <div className="sb-batch-item__meta">
                        <p className="sb-batch-item__name" title={item.path}>
                          {item.path}
                        </p>
                        <p className="sb-batch-item__sub">{formatBytes(item.file.size)}</p>
                      </div>
                      <Button
                        variant="tertiary"
                        size="sm"
                        className="sb-btn--icon"
                        aria-label={`Remove ${item.path}`}
                        title={`Remove ${item.path}`}
                        disabled={busy}
                        onClick={() => removeItem(item.path)}
                      >
                        <X size={16} aria-hidden="true" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>

          <Card>
            <h2 className="sb-section-title" style={{ marginBottom: 'var(--space-2)' }}>
              2. Choose the recipient’s public key
            </h2>
            <p className="sb-muted sb-text-sm" style={{ marginBottom: 'var(--space-4)' }}>
              Every file in the bundle is encrypted for this recipient. A public key is safe to
              share.
            </p>
            <RecipientKeyPicker
              recipient={recipient}
              disabled={busy}
              onChange={(next) => {
                setRecipient(next)
                resetOutcome()
              }}
            />

            <div style={{ marginTop: 'var(--space-4)' }}>
              <MetadataPrivacyToggle
                checked={hideMetadata}
                onChange={(checked) => {
                  setHideMetadata(checked)
                  resetOutcome()
                }}
                disabled={busy}
              />
            </div>
          </Card>

          <Card>
            <h2 className="sb-section-title" style={{ marginBottom: 'var(--space-4)' }}>
              3. Encrypt the bundle
            </h2>

            {busy ? (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <ProgressBar
                  label={
                    phase === 'reading'
                      ? 'Reading files…'
                      : phase === 'packing'
                        ? 'Packing files into a bundle…'
                        : 'Encrypting bundle…'
                  }
                  value={phase === 'reading' ? readProgress : undefined}
                />
              </div>
            ) : null}

            {error ? (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <StatusMessage
                  variant="danger"
                  title={error.title}
                  actions={
                    <Button variant="secondary" size="sm" onClick={resetOutcome}>
                      Try again
                    </Button>
                  }
                >
                  {error.message}
                </StatusMessage>
              </div>
            ) : null}

            {result ? (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <StatusMessage variant="success" title="Bundle encrypted">
                  {result.fileCount === 1
                    ? '1 file is sealed in the bundle.'
                    : `${result.fileCount} files are sealed in the bundle.`}{' '}
                  Share the package with the recipient.
                </StatusMessage>
                <Card compact muted style={{ marginTop: 'var(--space-4)' }}>
                  <dl className="sb-details">
                    <dt>Package file</dt>
                    <dd className="sb-mono">{result.fileName}</dd>
                    <dt>Bundle</dt>
                    <dd>{result.bundleFileName}</dd>
                    <dt>Files</dt>
                    <dd>{result.fileCount}</dd>
                    <dt>Original size</dt>
                    <dd>{formatBytes(result.totalSize)}</dd>
                    {result.pkg.metadata === 'hidden' ? (
                      <>
                        <dt>Metadata</dt>
                        <dd>Hidden inside the package</dd>
                      </>
                    ) : null}
                    <dt>Encryption</dt>
                    <dd>
                      {result.pkg.cipher} · key wrapped with {result.pkg.keyWrap}
                    </dd>
                  </dl>
                </Card>
              </div>
            ) : null}

            <div className="sb-actions">
              <Button
                variant="primary"
                size="lg"
                onClick={() => void handleEncrypt()}
                disabled={!canEncrypt}
                loading={busy}
                icon={<ShieldCheck size={18} aria-hidden="true" />}
              >
                {busy ? 'Encrypting bundle…' : 'Encrypt bundle'}
              </Button>

              {result ? (
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => downloadBlob(packageToBlob(result.pkg), result.fileName)}
                  icon={<Download size={18} aria-hidden="true" />}
                >
                  Download package
                </Button>
              ) : null}

              {items.length > 0 || recipient ? (
                <Button
                  variant="tertiary"
                  size="lg"
                  onClick={handleReset}
                  disabled={busy}
                  icon={<RefreshCw size={16} aria-hidden="true" />}
                >
                  Start over
                </Button>
              ) : null}
            </div>
          </Card>
        </div>


      </div>
    </div>
  )
}
