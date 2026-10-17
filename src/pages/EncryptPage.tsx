import { useCallback, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2,
  Download,
  FileText,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { useKeyVault } from '../context/keyVault'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { FileDropZone } from '../components/FileDropZone'
import { ProgressBar } from '../components/ProgressBar'
import { StatusMessage } from '../components/StatusMessage'
import {
  encryptFile,
  getFingerprintFromPem,
  importPublicKeyPem,
  MAX_FILE_SIZE,
  packageFileName,
  packageToBlob,
  type SealBoxPackage,
} from '../lib/crypto'
import { downloadBlob, formatBytes, readFileWithProgress } from '../lib/files'
import { describeError, type ErrorCopy } from '../lib/errorCopy'

type Phase = 'idle' | 'reading' | 'encrypting' | 'success' | 'error'

type Recipient =
  | { source: 'vault'; id: string; name: string; fingerprint: string }
  | { source: 'file'; name: string; pem: string; fingerprint: string }
  | null

export function EncryptPage() {
  const { keys, getPublicCryptoKey } = useKeyVault()
  const vaultKeys = keys.filter((key) => key.publicKeyPem)

  const [file, setFile] = useState<File | null>(null)
  const [recipient, setRecipient] = useState<Recipient>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState<number | undefined>(undefined)
  const [error, setError] = useState<ErrorCopy | null>(null)
  const [result, setResult] = useState<{ pkg: SealBoxPackage; fileName: string } | null>(null)
  const [keyError, setKeyError] = useState<string | null>(null)
  const [loadingKey, setLoadingKey] = useState(false)

  const importInputRef = useRef<HTMLInputElement>(null)

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

  const handleVaultKeyChange = async (id: string) => {
    setKeyError(null)
    if (!id) {
      setRecipient(null)
      return
    }
    const key = vaultKeys.find((candidate) => candidate.id === id)
    if (!key) return
    try {
      setLoadingKey(true)
      const { fingerprint } = await getFingerprintFromPem(key.publicKeyPem)
      setRecipient({ source: 'vault', id: key.id, name: key.name, fingerprint })
      resetOutcome()
    } catch {
      setKeyError('That saved key could not be read. Re-import it in Key management.')
    } finally {
      setLoadingKey(false)
    }
  }

  const handleImportRecipient = async (files: File[]) => {
    const chosen = files[0]
    if (!chosen) return
    setKeyError(null)
    try {
      setLoadingKey(true)
      const pem = await chosen.text()
      await importPublicKeyPem(pem)
      const { fingerprint } = await getFingerprintFromPem(pem)
      setRecipient({ source: 'file', name: chosen.name, pem, fingerprint })
      resetOutcome()
    } catch (err) {
      setRecipient(null)
      setKeyError(describeError(err).message)
    } finally {
      setLoadingKey(false)
    }
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
      })
      setResult({ pkg, fileName: packageFileName(file.name) })
      setPhase('success')
    } catch (err) {
      setError(describeError(err))
      setPhase('error')
    }
  }, [file, recipient, getPublicCryptoKey])

  const handleReset = () => {
    setFile(null)
    setRecipient(null)
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

      <div className="sb-workflow__grid">
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

            {vaultKeys.length > 0 ? (
              <div className="sb-field">
                <label className="sb-field__label" htmlFor="recipient-key">
                  Recipient&apos;s public key
                </label>
                <select
                  id="recipient-key"
                  className="sb-select"
                  value={recipient?.source === 'vault' ? recipient.id : ''}
                  disabled={busy}
                  onChange={(event) => void handleVaultKeyChange(event.target.value)}
                >
                  <option value="">Select a saved public key…</option>
                  {vaultKeys.map((key) => (
                    <option key={key.id} value={key.id}>
                      {key.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="sb-muted sb-text-sm">
                You have no saved public keys yet.{' '}
                <Link to="/keys">Create or import a key</Link>, or import a public key file below.
              </p>
            )}

            <div className="sb-actions" style={{ marginTop: 'var(--space-4)' }}>
              <Button
                variant="secondary"
                onClick={() => importInputRef.current?.click()}
                disabled={busy}
                icon={<KeyRound size={16} aria-hidden="true" />}
              >
                Import public key file
              </Button>
              <input
                ref={importInputRef}
                type="file"
                accept=".pem,.pub,.key,.txt,application/x-pem-file"
                className="sb-visually-hidden"
                tabIndex={-1}
                onChange={(event) => {
                  const files = event.target.files ? Array.from(event.target.files) : []
                  void handleImportRecipient(files)
                  event.target.value = ''
                }}
              />
            </div>

            {keyError ? (
              <div style={{ marginTop: 'var(--space-4)' }}>
                <StatusMessage variant="danger" title="Key problem">
                  {keyError}
                </StatusMessage>
              </div>
            ) : null}

            {loadingKey ? (
              <p className="sb-muted sb-text-sm" style={{ marginTop: 'var(--space-4)' }}>
                Reading key…
              </p>
            ) : null}

            {recipient ? (
              <div style={{ marginTop: 'var(--space-4)' }}>
                <StatusMessage variant="info" title="Recipient key ready">
                  <p className="sb-text-sm">
                    Files will be encrypted for <strong>{recipient.name}</strong>. Review this
                    key&apos;s fingerprint in Key management when you need to verify it.
                  </p>
                </StatusMessage>
              </div>
            ) : null}
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
                    <dt>Original name</dt>
                    <dd>{result.pkg.fileName}</dd>
                    <dt>Original size</dt>
                    <dd>{formatBytes(result.pkg.fileSize)}</dd>
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

        <aside className="sb-workflow__aside">
          <Card compact muted>
            <h2 className="sb-card-title" style={{ fontSize: 'var(--text-base)' }}>
              What happens to your file
            </h2>
            <ul className="sb-fact-list" role="list" style={{ marginTop: 'var(--space-3)' }}>
              <li className="sb-fact">
                <span className="sb-fact__icon" aria-hidden="true">
                  <CheckCircle2 size={18} />
                </span>
                <p className="sb-text-sm sb-muted">
                  A random AES-256-GCM key encrypts the file. That key is wrapped with the
                  recipient’s RSA public key.
                </p>
              </li>
              <li className="sb-fact">
                <span className="sb-fact__icon" aria-hidden="true">
                  <CheckCircle2 size={18} />
                </span>
                <p className="sb-text-sm sb-muted">
                  The plaintext file is never uploaded. Encryption happens in this browser tab.
                </p>
              </li>
              <li className="sb-fact">
                <span className="sb-fact__icon" aria-hidden="true">
                  <CheckCircle2 size={18} />
                </span>
                <p className="sb-text-sm sb-muted">
                  The package keeps the file name, size, and recipient fingerprint as visible
                  metadata.
                </p>
              </li>
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  )
}
