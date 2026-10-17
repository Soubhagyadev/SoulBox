import { useCallback, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, FileKey, FileText, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react'
import { useKeyVault } from '../context/keyVault'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { FileDropZone } from '../components/FileDropZone'
import { ProgressBar } from '../components/ProgressBar'
import { StatusMessage } from '../components/StatusMessage'
import { TextField } from '../components/TextField'
import {
  decryptPackage,
  importPrivateKeyPem,
  isEncryptedPrivateKeyPem,
  parsePackage,
  PACKAGE_EXTENSION,
  unprotectPrivateKeyPem,
  type SealBoxPackage,
} from '../lib/crypto'
import { baseName, downloadBlob, formatBytes } from '../lib/files'
import { describeError, type ErrorCopy } from '../lib/errorCopy'

type Phase = 'idle' | 'reading' | 'decrypting' | 'success' | 'error'

interface DecryptedResult {
  fileName: string
  fileType: string
  blob: Blob
}

export function DecryptPage() {
  const { keys, getPrivateCryptoKey, isEncryptedKey } = useKeyVault()
  const privateKeys = keys.filter((key) => key.privateKeyPem)

  const [pkg, setPkg] = useState<SealBoxPackage | null>(null)
  const [pkgName, setPkgName] = useState<string>('')
  const [keySource, setKeySource] = useState<'vault' | 'file'>('vault')
  const [selectedKeyId, setSelectedKeyId] = useState('')
  const [importedPem, setImportedPem] = useState<string | null>(null)
  const [passphrase, setPassphrase] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<ErrorCopy | null>(null)
  const [result, setResult] = useState<DecryptedResult | null>(null)

  const importInputRef = useRef<HTMLInputElement>(null)
  const busy = phase === 'reading' || phase === 'decrypting'

  const needsPassphrase =
    (keySource === 'vault' && selectedKeyId ? isEncryptedKey(selectedKeyId) : false) ||
    (keySource === 'file' && importedPem ? isEncryptedPrivateKeyPem(importedPem) : false)

  const resetOutcome = () => {
    setResult(null)
    setError(null)
    if (phase === 'success' || phase === 'error') setPhase('idle')
  }

  const handleSelectPackage = async (files: File[]) => {
    const chosen = files[0]
    if (!chosen) return
    setResult(null)
    setError(null)
    setPhase('reading')
    try {
      const text = await chosen.text()
      const parsed = parsePackage(text)
      setPkg(parsed)
      setPkgName(chosen.name)
      setPhase('idle')
    } catch (err) {
      setPkg(null)
      setPkgName('')
      setError(describeError(err))
      setPhase('error')
    }
  }

  const handleImportPrivateKey = async (files: File[]) => {
    const chosen = files[0]
    if (!chosen) return
    try {
      const pem = await chosen.text()
      if (!isEncryptedPrivateKeyPem(pem)) {
        await importPrivateKeyPem(pem)
      }
      setImportedPem(pem)
      setKeySource('file')
      setSelectedKeyId('')
      setPassphrase('')
      resetOutcome()
    } catch (err) {
      setImportedPem(null)
      setError(describeError(err))
      setPhase('error')
    }
  }

  const resolvePrivateKey = useCallback(async () => {
    if (keySource === 'vault') {
      return getPrivateCryptoKey(selectedKeyId, needsPassphrase ? passphrase : undefined)
    }
    if (!importedPem) throw new Error('Choose a private key to decrypt this package.')
    return isEncryptedPrivateKeyPem(importedPem)
      ? unprotectPrivateKeyPem(importedPem, passphrase)
      : importPrivateKeyPem(importedPem)
  }, [keySource, selectedKeyId, importedPem, needsPassphrase, passphrase, getPrivateCryptoKey])

  const handleDecrypt = useCallback(async () => {
    if (!pkg) return
    setError(null)
    setResult(null)
    try {
      setPhase('decrypting')
      const privateKey = await resolvePrivateKey()
      const decrypted = await decryptPackage(pkg, privateKey)
      setResult({
        fileName: baseName(decrypted.fileName),
        fileType: decrypted.fileType,
        blob: new Blob([decrypted.bytes as BlobPart], {
          type: decrypted.fileType || 'application/octet-stream',
        }),
      })
      setPhase('success')
    } catch (err) {
      setError(describeError(err))
      setPhase('error')
    }
  }, [pkg, resolvePrivateKey])

  const handleReset = () => {
    setPkg(null)
    setPkgName('')
    setSelectedKeyId('')
    setImportedPem(null)
    setPassphrase('')
    setResult(null)
    setError(null)
    setPhase('idle')
  }

  const hasKey = keySource === 'vault' ? Boolean(selectedKeyId) : Boolean(importedPem)

  return (
    <div className="sb-container sb-workflow">
      <header className="sb-workflow__header">
        <h1 className="sb-page-title">Decrypt a file</h1>
        <p className="sb-muted" style={{ marginTop: 'var(--space-2)' }}>
          Open an encrypted package with the private key it was addressed to. Decryption happens
          in your browser.
        </p>
      </header>

      <div className="sb-workflow__grid">
        <div className="sb-stack">
          <Card>
            <h2 className="sb-section-title" style={{ marginBottom: 'var(--space-4)' }}>
              1. Choose the encrypted package
            </h2>
            {pkg ? (
              <div className="sb-stack sb-stack--sm">
                <div className="sb-file-summary">
                  <span className="sb-file-summary__icon" aria-hidden="true">
                    <FileKey size={22} strokeWidth={1.75} />
                  </span>
                  <div className="sb-file-summary__meta">
                    <p className="sb-file-summary__name" title={pkgName}>
                      {pkgName}
                    </p>
                    <p className="sb-file-summary__sub">
                      {pkg.cipher} · created {new Date(pkg.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    variant="tertiary"
                    size="sm"
                    onClick={handleReset}
                    disabled={busy}
                    icon={<Trash2 size={16} aria-hidden="true" />}
                  >
                    Remove
                  </Button>
                </div>
                <dl className="sb-details">
                  <dt>Original name</dt>
                  <dd>{pkg.fileName || 'Unknown'}</dd>
                  <dt>Original size</dt>
                  <dd>{formatBytes(pkg.fileSize)}</dd>
                </dl>
                <p className="sb-text-xs sb-muted">
                  The file name and size above are visible metadata stored in the package. File
                  contents remain encrypted until you decrypt.
                </p>
              </div>
            ) : (
              <FileDropZone
                onSelect={(files) => void handleSelectPackage(files)}
                accept={`${PACKAGE_EXTENSION},application/json`}
                disabled={busy}
                icon="file"
                title={`Choose a ${PACKAGE_EXTENSION} package`}
                hint={`Select the encrypted package you received (${PACKAGE_EXTENSION} file).`}
                buttonLabel="Choose package"
              />
            )}
          </Card>

          <Card>
            <h2 className="sb-section-title" style={{ marginBottom: 'var(--space-2)' }}>
              2. Choose your private key
            </h2>
            <p className="sb-muted sb-text-sm" style={{ marginBottom: 'var(--space-4)' }}>
              Keep your private key secret. It is required to decrypt files addressed to you.
            </p>

            {privateKeys.length > 0 && keySource === 'vault' ? (
              <div className="sb-field">
                <label className="sb-field__label" htmlFor="private-key">
                  Your private key
                </label>
                <select
                  id="private-key"
                  className="sb-select"
                  value={selectedKeyId}
                  disabled={busy}
                  onChange={(event) => {
                    setSelectedKeyId(event.target.value)
                    setPassphrase('')
                    resetOutcome()
                  }}
                >
                  <option value="">Select a saved private key…</option>
                  {privateKeys.map((key) => (
                    <option key={key.id} value={key.id}>
                      {key.name}
                      {isEncryptedKey(key.id) ? ' (passphrase-protected)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {importedPem && keySource === 'file' ? (
              <StatusMessage variant="info" title="Private key loaded from file">
                {isEncryptedPrivateKeyPem(importedPem)
                  ? 'This key is passphrase-protected. Enter the passphrase below.'
                  : 'This key is not passphrase-protected.'}
              </StatusMessage>
            ) : null}

            <div className="sb-actions" style={{ marginTop: 'var(--space-4)' }}>
              <Button
                variant="secondary"
                onClick={() => importInputRef.current?.click()}
                disabled={busy}
                icon={<FileText size={16} aria-hidden="true" />}
              >
                Import private key file
              </Button>
              {keySource === 'file' && privateKeys.length > 0 ? (
                <Button
                  variant="tertiary"
                  onClick={() => {
                    setKeySource('vault')
                    setImportedPem(null)
                    setPassphrase('')
                    resetOutcome()
                  }}
                  disabled={busy}
                >
                  Use a saved key
                </Button>
              ) : null}
              {privateKeys.length === 0 ? (
                <Link to="/keys" className="sb-btn sb-btn--tertiary">
                  Manage keys
                </Link>
              ) : null}
              <input
                ref={importInputRef}
                type="file"
                accept=".pem,.key,.txt,application/x-pem-file"
                className="sb-visually-hidden"
                tabIndex={-1}
                onChange={(event) => {
                  const files = event.target.files ? Array.from(event.target.files) : []
                  void handleImportPrivateKey(files)
                  event.target.value = ''
                }}
              />
            </div>

            {needsPassphrase ? (
              <div style={{ marginTop: 'var(--space-4)' }}>
                <TextField
                  label="Passphrase"
                  type="password"
                  autoComplete="off"
                  hint="This passphrase unlocks your private key for this decryption. It is not stored."
                  value={passphrase}
                  disabled={busy}
                  onChange={(event) => setPassphrase(event.target.value)}
                />
              </div>
            ) : null}
          </Card>

          <Card>
            <h2 className="sb-section-title" style={{ marginBottom: 'var(--space-4)' }}>
              3. Decrypt
            </h2>

            {busy ? (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <ProgressBar label="Verifying and decrypting…" />
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
                <StatusMessage variant="success" title="Decryption completed">
                  The original file was recovered and verified.
                </StatusMessage>
                <Card compact muted style={{ marginTop: 'var(--space-4)' }}>
                  <dl className="sb-details">
                    <dt>File name</dt>
                    <dd>{result.fileName}</dd>
                    <dt>Type</dt>
                    <dd>{result.fileType || 'Unknown'}</dd>
                    <dt>Size</dt>
                    <dd>{formatBytes(result.blob.size)}</dd>
                  </dl>
                </Card>
              </div>
            ) : null}

            <div className="sb-actions">
              <Button
                variant="primary"
                size="lg"
                onClick={() => void handleDecrypt()}
                disabled={!pkg || !hasKey || busy || (needsPassphrase && passphrase.length === 0)}
                loading={busy}
                icon={<ShieldCheck size={18} aria-hidden="true" />}
              >
                {busy ? 'Decrypting file…' : 'Decrypt file'}
              </Button>

              {result ? (
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => downloadBlob(result.blob, result.fileName)}
                  icon={<Download size={18} aria-hidden="true" />}
                >
                  Download file
                </Button>
              ) : null}

              {pkg ? (
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
              Keep your private key safe
            </h2>
            <p className="sb-text-sm sb-muted" style={{ marginTop: 'var(--space-3)' }}>
              Never send your private key to another person or paste it into a chat. SealBox only reads
              the key you select or import in this browser.
            </p>
            <p className="sb-text-sm sb-muted" style={{ marginTop: 'var(--space-3)' }}>
              If you lose your private key, encrypted files addressed to it cannot be recovered.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  )
}
