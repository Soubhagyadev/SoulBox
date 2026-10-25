import { useCallback, useState } from 'react'
import { Download, FileText, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react'
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
  importPublicKeyPem,
  HIDDEN_PACKAGE_FILE_NAME,
  MAX_FILE_SIZE,
  packageFileName,
  packageToBlob,
  type SealBoxPackage,
} from '../lib/crypto'
import { downloadBlob, formatBytes, readFileWithProgress } from '../lib/files'
import { describeError, type ErrorCopy } from '../lib/errorCopy'
import { recordEvent } from '../lib/analytics'

type Phase = 'idle' | 'reading' | 'encrypting' | 'success' | 'error'

export function EncryptPage() {
  const { getPublicCryptoKey } = useKeyVault()

  const [file, setFile] = useState<File | null>(null)
  const [recipient, setRecipient] = useState<Recipient>(null)
  const [hideMetadata, setHideMetadata] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState<number | undefined>(undefined)
  const [error, setError] = useState<ErrorCopy | null>(null)
  const [result, setResult] = useState<{ pkg: SealBoxPackage; fileName: string } | null>(null)

  const busy = phase === 'reading' || phase === 'encrypting'

  const resetOutcome = () => {
    setResult(null)
    setError(null)
    if (phase === 'success' || phase === 'error') setPhase('idle')
  }

  const handleSelectFile = (files: File[]) => {
    setFile(files[0])
    resetOutcome()
  }

  const handleReject = (reasons: string[]) => {
    setFile(null)
    setPhase('error')
    setResult(null)
    setError({ title: 'File not accepted', message: reasons.join(' ') })
  }

  const handleEncrypt = useCallback(async () => {
    if (!file || !recipient) return
    setError(null)
    setResult(null)
    try {
      setPhase('reading')
      setProgress(0)
      const bytes = await readFileWithProgress(file, setProgress)

      setPhase('encrypting')
      setProgress(undefined)
      const publicKey =
        recipient.source === 'vault'
          ? await getPublicCryptoKey(recipient.id)
          : await importPublicKeyPem(recipient.pem)

      const pkg = await encryptFile({
        data: bytes,
        fileName: file.name,
        fileType: file.type,
        recipientPublicKey: publicKey,
        hideMetadata,
      })
      setResult({
        pkg,
        fileName: hideMetadata ? HIDDEN_PACKAGE_FILE_NAME : packageFileName(file.name),
      })
      recordEvent('encrypt', { bytes: bytes.byteLength })
      setPhase('success')
    } catch (err) {
      setError(describeError(err))
      setPhase('error')
    }
  }, [file, recipient, hideMetadata, getPublicCryptoKey])

  const handleReset = () => {
    setFile(null)
    setRecipient(null)
    setHideMetadata(false)
    setResult(null)
    setError(null)
    setProgress(undefined)
    setPhase('idle')
  }

  return (
    <div className="sb-container sb-workflow">
      <header className="sb-workflow__header">
        <h1 className="sb-page-title">Encrypt a file</h1>
        <p className="sb-muted" style={{ marginTop: 'var(--space-2)' }}>
          Choose a file and the recipient’s public key. SealBox encrypts the file in your browser and
          gives you a package you can share.
        </p>
      </header>

      <div className="sb-workflow__grid sb-workflow__grid--single">
        <div className="sb-stack">
          <Card>
            <h2 className="sb-section-title" style={{ marginBottom: 'var(--space-4)' }}>
              1. Select a file
            </h2>
            {file ? (
              <div className="sb-file-summary">
                <span className="sb-file-summary__icon" aria-hidden="true">
                  <FileText size={22} strokeWidth={1.75} />
                </span>
                <div className="sb-file-summary__meta">
                  <p className="sb-file-summary__name" title={file.name}>
                    {file.name}
                  </p>
                  <p className="sb-file-summary__sub">
                    {formatBytes(file.size)}
                    {file.type ? ` · ${file.type}` : ''}
                  </p>
                </div>
                <Button
                  variant="tertiary"
                  size="sm"
                  onClick={() => {
                    setFile(null)
                    resetOutcome()
                  }}
                  icon={<Trash2 size={16} aria-hidden="true" />}
                >
                  Remove file
                </Button>
              </div>
            ) : (
              <FileDropZone
                onSelect={handleSelectFile}
                onReject={handleReject}
                maxSize={MAX_FILE_SIZE}
                disabled={busy}
                title="Choose a file to encrypt"
                hint={`Drag a file here or choose one from your device. Maximum size ${formatBytes(
                  MAX_FILE_SIZE,
                )}.`}
                buttonLabel="Choose file"
              />
            )}
          </Card>

          <Card>
            <h2 className="sb-section-title" style={{ marginBottom: 'var(--space-2)' }}>
              2. Choose the recipient’s public key
            </h2>
            <p className="sb-muted sb-text-sm" style={{ marginBottom: 'var(--space-4)' }}>
              Use the recipient’s verified public key. A public key is safe to share.
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
              3. Encrypt
            </h2>

            {busy ? (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <ProgressBar
                  label={phase === 'reading' ? 'Reading file…' : 'Encrypting file…'}
                  value={phase === 'reading' ? progress : undefined}
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
                <StatusMessage variant="success" title="Encryption completed">
                  Your encrypted package is ready. Share it with the recipient.
                </StatusMessage>
                <Card compact muted style={{ marginTop: 'var(--space-4)' }}>
                  <dl className="sb-details">
                    <dt>Package file</dt>
                    <dd className="sb-mono">{result.fileName}</dd>
                    {result.pkg.metadata === 'hidden' ? (
                      <>
                        <dt>Metadata</dt>
                        <dd>Hidden inside the package</dd>
                      </>
                    ) : (
                      <>
                        <dt>Original name</dt>
                        <dd>{result.pkg.fileName}</dd>
                        <dt>Original size</dt>
                        <dd>{formatBytes(result.pkg.fileSize)}</dd>
                      </>
                    )}
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
                disabled={!file || !recipient || busy}
                loading={busy}
                icon={<ShieldCheck size={18} aria-hidden="true" />}
              >
                {busy ? 'Encrypting file…' : 'Encrypt file'}
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

              {file || recipient ? (
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
