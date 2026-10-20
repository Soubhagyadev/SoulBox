import { useEffect, useRef, useState } from 'react'
import { Download, KeyRound, Plus, ShieldAlert, Trash2, Upload } from 'lucide-react'
import { useKeyVault } from '../context/keyVault'
import { Button } from '../components/Button'
import { CopyButton } from '../components/CopyButton'
import { Dialog } from '../components/Dialog'
import { EmptyState } from '../components/EmptyState'
import { FingerprintValue } from '../components/FingerprintValue'
import { StatusMessage } from '../components/StatusMessage'
import { TextField } from '../components/TextField'
import { getFingerprintFromPem } from '../lib/crypto'
import type { StoredKey } from '../lib/storage/keyVault'
import { baseName, downloadBlob } from '../lib/files'
import { describeError, type ErrorCopy } from '../lib/errorCopy'
import { recordEvent } from '../lib/analytics'

function downloadPem(pem: string, fileName: string) {
  downloadBlob(new Blob([pem], { type: 'application/x-pem-file' }), fileName)
}

function keyNameFromFile(fileName: string): string {
  return baseName(fileName).replace(/\.(pem|key|pub|txt)$/i, '') || 'Imported key'
}

function formatAdded(createdAt: string): string {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return 'Added recently'
  return `Added ${date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })}`
}

export function KeysPage() {
  const {
    keys,
    status,
    generateKeyPair,
    importKey,
    removeKey,
    exportPublicKey,
    exportPrivateKey,
  } = useKeyVault()

  const [fingerprints, setFingerprints] = useState<Record<string, string>>({})
  const [generateOpen, setGenerateOpen] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [createdKey, setCreatedKey] = useState<{ name: string; pem: string } | null>(null)
  const [notice, setNotice] = useState<{ variant: 'success' | 'danger'; title: string; message: string } | null>(null)

  const [exportTarget, setExportTarget] = useState<StoredKey | null>(null)
  const [exportPassphrase, setExportPassphrase] = useState('')
  const [exportError, setExportError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<StoredKey | null>(null)

  const [pendingPrivate, setPendingPrivate] = useState<{ name: string; pem: string } | null>(null)
  const [importPassphrase, setImportPassphrase] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  const publicInputRef = useRef<HTMLInputElement>(null)
  const privateInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const entries = await Promise.all(
        keys.map(async (key): Promise<[string, string]> => {
          try {
            const { fingerprint } = await getFingerprintFromPem(key.publicKeyPem)
            return [key.id, fingerprint]
          } catch {
            return [key.id, 'Fingerprint unavailable']
          }
        }),
      )
      if (!cancelled) setFingerprints(Object.fromEntries(entries))
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [keys])

  const sortedKeys = [...keys].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const handleGenerate = async () => {
    if (!newKeyName.trim()) {
      setNameError('Give this key a name so you can recognise it later.')
      return
    }
    setNameError(null)
    setNotice(null)
    try {
      setGenerating(true)
      const created = await generateKeyPair(newKeyName)
      recordEvent('key-create')
      setNewKeyName('')
      setGenerateOpen(false)
      if (created.privateKeyPem) {
        setCreatedKey({ name: created.name, pem: created.privateKeyPem })
      }
    } catch (err) {
      setNotice({ variant: 'danger', ...describeError(err) })
    } finally {
      setGenerating(false)
    }
  }

  const handleCloseCreatedKey = () => {
    if (createdKey) {
      setNotice({
        variant: 'success',
        title: 'Key pair created',
        message: `${createdKey.name} is ready. Its private key stays in this browser's key vault — back it up if you need it elsewhere.`,
      })
    }
    setCreatedKey(null)
  }

  const handleDownloadCreatedKey = () => {
    if (createdKey) {
      downloadPem(createdKey.pem, `${createdKey.name}-private.pem`)
    }
  }

  const handleImportPublic = async (file: File) => {
    setNotice(null)
    try {
      const pem = await file.text()
      const created = await importKey({ name: keyNameFromFile(file.name), publicKeyPem: pem })
      recordEvent('key-import')
      setNotice({
        variant: 'success',
        title: 'Public key imported',
        message: `${created.name} was added. A public key is safe to share.`,
      })
    } catch (err) {
      setNotice({ variant: 'danger', ...describeError(err) })
    }
  }

  const handlePrivateFileChosen = async (file: File) => {
    setNotice(null)
    setImportError(null)
    setImportPassphrase('')
    const pem = await file.text()
    setPendingPrivate({ name: keyNameFromFile(file.name), pem })
  }

  const handleConfirmPrivateImport = async () => {
    if (!pendingPrivate) return
    setImportError(null)
    try {
      setImporting(true)
      const created = await importKey({
        name: pendingPrivate.name,
        privateKeyPem: pendingPrivate.pem,
        passphrase: importPassphrase || undefined,
      })
      recordEvent('key-import')
      setPendingPrivate(null)
      setImportPassphrase('')
      setNotice({
        variant: 'success',
        title: 'Private key imported',
        message: `${created.name} was added to this browser's key vault.`,
      })
    } catch (err) {
      const copy: ErrorCopy = describeError(err)
      setImportError(copy.message)
    } finally {
      setImporting(false)
    }
  }

  const handleExportPublic = async (key: StoredKey) => {
    setNotice(null)
    try {
      const pem = await exportPublicKey(key.id)
      downloadPem(pem, `${key.name}-public.pem`)
    } catch (err) {
      setNotice({ variant: 'danger', ...describeError(err) })
    }
  }

  const handleExportPrivate = async () => {
    if (!exportTarget) return
    setExportError(null)
    try {
      setExporting(true)
      const pem = await exportPrivateKey(exportTarget.id, exportPassphrase || undefined)
      downloadPem(
        pem,
        `${exportTarget.name}-private${exportPassphrase ? '-encrypted' : ''}.pem`,
      )
      setExportTarget(null)
      setExportPassphrase('')
    } catch (err) {
      setExportError(describeError(err).message)
    } finally {
      setExporting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await removeKey(deleteTarget.id)
      recordEvent('key-delete')
      setNotice({
        variant: 'success',
        title: 'Key removed',
        message: `${deleteTarget.name} was removed from this browser.`,
      })
    } catch (err) {
      setNotice({ variant: 'danger', ...describeError(err) })
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <div className="sb-container sb-workflow">
      <header className="sb-workflow__header">
        <h1 className="sb-page-title">Key management</h1>
        <p className="sb-muted" style={{ marginTop: 'var(--space-2)' }}>
          Create or import keys. A <strong>public key</strong> can be shared with anyone who wants
          to send you an encrypted file. A <strong>private key</strong> must be kept secret — it is
          the only way to decrypt those files.
        </p>
      </header>

      {notice ? (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <StatusMessage variant={notice.variant} title={notice.title}>
            {notice.message}
          </StatusMessage>
        </div>
      ) : null}

      <section className="sb-vault" aria-labelledby="key-vault-heading">
        <div className="sb-vault__toolbar">
          <div>
            <h2 className="sb-section-title" id="key-vault-heading">
              Key vault
            </h2>
            <p className="sb-muted sb-text-sm" style={{ marginTop: 'var(--space-1)' }}>
              {keys.length === 0
                ? 'No keys stored in this browser yet.'
                : keys.length === 1
                  ? '1 key stored in this browser.'
                  : `${keys.length} keys stored in this browser.`}
            </p>
          </div>

          <div className="sb-cluster">
            <Button
              variant="primary"
              icon={<Plus size={16} aria-hidden="true" />}
              onClick={() => {
                setNameError(null)
                setGenerateOpen(true)
              }}
            >
              Generate key pair
            </Button>
            <Button
              variant="secondary"
              icon={<Upload size={16} aria-hidden="true" />}
              onClick={() => publicInputRef.current?.click()}
            >
              Import public key
            </Button>
            <Button
              variant="secondary"
              icon={<KeyRound size={16} aria-hidden="true" />}
              onClick={() => privateInputRef.current?.click()}
            >
              Import private key
            </Button>
            <input
              ref={publicInputRef}
              type="file"
              accept=".pem,.pub,.key,.txt,application/x-pem-file"
              className="sb-visually-hidden"
              tabIndex={-1}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void handleImportPublic(file)
                event.target.value = ''
              }}
            />
            <input
              ref={privateInputRef}
              type="file"
              accept=".pem,.key,.txt,application/x-pem-file"
              className="sb-visually-hidden"
              tabIndex={-1}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void handlePrivateFileChosen(file)
                event.target.value = ''
              }}
            />
          </div>
        </div>

        {status === 'error' ? (
          <StatusMessage variant="danger" title="Keys could not be loaded">
            Saved keys are unavailable. Reload the page and try again.
          </StatusMessage>
        ) : null}

        {sortedKeys.length === 0 ? (
          <EmptyState title="No keys yet">
            Generate a key pair or import a key file to get started.
          </EmptyState>
        ) : (
          <div className="sb-table-wrap">
            <table className="sb-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Type</th>
                  <th scope="col">Fingerprint</th>
                  <th scope="col">Security</th>
                  <th scope="col" className="sb-table__actions-heading">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedKeys.map((key) => {
                  const fingerprint = fingerprints[key.id]
                  const protectedKey = key.privateKeyPem?.includes('ENCRYPTED PRIVATE KEY')
                  return (
                    <tr key={key.id}>
                      <td>
                        <div className="sb-table__name">
                          <span className="sb-table__keyicon" aria-hidden="true">
                            <KeyRound size={16} strokeWidth={1.9} />
                          </span>
                          <div>
                            <p className="sb-table__title">{key.name}</p>
                            <p className="sb-table__meta">{formatAdded(key.createdAt)}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span
                          className={
                            key.privateKeyPem
                              ? 'sb-badge sb-badge--pair'
                              : 'sb-badge sb-badge--public'
                          }
                        >
                          {key.privateKeyPem ? 'Key pair' : 'Public key'}
                        </span>
                      </td>
                      <td>
                        {fingerprint ? (
                          <FingerprintValue value={fingerprint} label={key.name} />
                        ) : (
                          <span className="sb-muted sb-text-xs">Reading fingerprint…</span>
                        )}
                      </td>
                      <td>
                        {key.privateKeyPem ? (
                          <span className="sb-text-xs">
                            {protectedKey ? 'Passphrase-protected' : 'Stored in this browser'}
                          </span>
                        ) : (
                          <span className="sb-muted sb-text-xs">Safe to share</span>
                        )}
                      </td>
                      <td>
                        <div className="sb-table__actions">
                          <Button
                            variant="tertiary"
                            size="sm"
                            className="sb-btn--icon"
                            title={`Export public key for ${key.name}`}
                            aria-label={`Export public key for ${key.name}`}
                            onClick={() => void handleExportPublic(key)}
                          >
                            <Download size={16} aria-hidden="true" />
                          </Button>
                          {key.privateKeyPem ? (
                            <>
                              <Button
                                variant="tertiary"
                                size="sm"
                                className="sb-btn--icon"
                                title={`Export private key for ${key.name}`}
                                aria-label={`Export private key for ${key.name}`}
                                onClick={() => {
                                  setExportTarget(key)
                                  setExportPassphrase('')
                                  setExportError(null)
                                }}
                              >
                                <ShieldAlert size={16} aria-hidden="true" />
                              </Button>
                              <Button
                                variant="tertiary"
                                size="sm"
                                className="sb-btn--icon sb-btn--danger-icon"
                                title={`Delete ${key.name}`}
                                aria-label={`Delete ${key.name}`}
                                onClick={() => setDeleteTarget(key)}
                              >
                                <Trash2 size={16} aria-hidden="true" />
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        title="Generate a new key pair"
        footer={
          <>
            <Button variant="secondary" onClick={() => setGenerateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleGenerate()}
              loading={generating}
              icon={<Plus size={16} aria-hidden="true" />}
            >
              Create key pair
            </Button>
          </>
        }
      >
        <TextField
          label="Key name"
          placeholder="e.g. Work laptop"
          hint="Keys are generated in your browser and stored only in this browser. Export and back up your private key if you need it elsewhere."
          value={newKeyName}
          error={nameError ?? undefined}
          disabled={generating}
          onChange={(event) => setNewKeyName(event.target.value)}
        />
      </Dialog>

      <Dialog
        open={Boolean(createdKey)}
        onClose={handleCloseCreatedKey}
        title="Key pair created"
        footer={
          <Button variant="primary" onClick={handleCloseCreatedKey}>
            I have saved it
          </Button>
        }
      >
        <StatusMessage variant="warning" title="Save your private key now" live="off">
          This is the only time the private key will be shown in full. Copy or download it and
          store it somewhere safe — if you lose it, files encrypted for this key cannot be
          recovered. A copy also stays in this browser's key vault.
        </StatusMessage>
        <textarea
          className="sb-key-reveal"
          readOnly
          rows={7}
          spellCheck={false}
          aria-label="Private key"
          value={createdKey?.pem ?? ''}
          onFocus={(event) => event.currentTarget.select()}
        />
        <div className="sb-cluster" style={{ marginTop: 'var(--space-3)' }}>
          <CopyButton value={createdKey?.pem ?? ''} label="Copy private key" variant="secondary">
            Copy private key
          </CopyButton>
          <Button
            variant="secondary"
            size="sm"
            icon={<Download size={16} aria-hidden="true" />}
            onClick={handleDownloadCreatedKey}
          >
            Download .pem
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(exportTarget)}
        onClose={() => setExportTarget(null)}
        title="Export private key"
        footer={
          <>
            <Button variant="secondary" onClick={() => setExportTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => void handleExportPrivate()}
              loading={exporting}
              icon={<Download size={16} aria-hidden="true" />}
            >
              Export private key
            </Button>
          </>
        }
      >
        <StatusMessage variant="warning" title="This key is sensitive" live="off">
          Anyone who obtains this private key can decrypt files addressed to it. Store the exported
          file securely and never share it. Protecting it with a passphrase is strongly recommended.
        </StatusMessage>
        <div style={{ marginTop: 'var(--space-4)' }}>
          <TextField
            label="Protect with a passphrase (optional)"
            type="password"
            autoComplete="new-password"
            hint="If set, the exported key is encrypted with this passphrase. You will need it to import the key again."
            value={exportPassphrase}
            error={exportError ?? undefined}
            disabled={exporting}
            onChange={(event) => setExportPassphrase(event.target.value)}
          />
        </div>
      </Dialog>

      <Dialog
        open={Boolean(pendingPrivate)}
        onClose={() => setPendingPrivate(null)}
        title="Import private key"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingPrivate(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleConfirmPrivateImport()}
              loading={importing}
              icon={<KeyRound size={16} aria-hidden="true" />}
            >
              Import private key
            </Button>
          </>
        }
      >
        <p className="sb-text-sm">
          {pendingPrivate?.name} will be stored in this browser’s key vault. Only import private
          keys you trust.
        </p>
        <div style={{ marginTop: 'var(--space-4)' }}>
          <TextField
            label="Passphrase (if the key is protected)"
            type="password"
            autoComplete="off"
            hint="Leave blank if this private key is not passphrase-protected."
            value={importPassphrase}
            error={importError ?? undefined}
            disabled={importing}
            onChange={(event) => setImportPassphrase(event.target.value)}
          />
        </div>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete key"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => void handleDelete()}
              icon={<ShieldAlert size={16} aria-hidden="true" />}
            >
              Delete key
            </Button>
          </>
        }
      >
        <p className="sb-text-sm">
          Delete <strong>{deleteTarget?.name}</strong> from this browser? If you have not exported
          the private key, you will permanently lose the ability to decrypt files addressed to it.
        </p>
      </Dialog>
    </div>
  )
}
