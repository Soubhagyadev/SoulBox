import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import { useKeyVault } from '../context/keyVault'
import { getFingerprintFromPem, importPublicKeyPem } from '../lib/crypto'
import { describeError } from '../lib/errorCopy'
import { Button } from './Button'
import { StatusMessage } from './StatusMessage'

export type Recipient =
  | { source: 'vault'; id: string; name: string; fingerprint: string }
  | { source: 'file'; name: string; pem: string; fingerprint: string }
  | null

export interface RecipientKeyPickerProps {
  recipient: Recipient
  onChange: (recipient: Recipient) => void
  disabled?: boolean
}

export function RecipientKeyPicker({
  recipient,
  onChange,
  disabled = false,
}: RecipientKeyPickerProps) {
  const { keys } = useKeyVault()
  const vaultKeys = keys.filter((key) => key.publicKeyPem)

  const [keyError, setKeyError] = useState<string | null>(null)
  const [loadingKey, setLoadingKey] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)

  const handleVaultKeyChange = async (id: string) => {
    setKeyError(null)
    if (!id) {
      onChange(null)
      return
    }
    const key = vaultKeys.find((candidate) => candidate.id === id)
    if (!key) return
    try {
      setLoadingKey(true)
      const { fingerprint } = await getFingerprintFromPem(key.publicKeyPem)
      onChange({ source: 'vault', id: key.id, name: key.name, fingerprint })
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
      onChange({ source: 'file', name: chosen.name, pem, fingerprint })
    } catch (error) {
      onChange(null)
      setKeyError(describeError(error).message)
    } finally {
      setLoadingKey(false)
    }
  }

  return (
    <>
      {vaultKeys.length > 0 ? (
        <div className="sb-field">
          <label className="sb-field__label" htmlFor="recipient-key">
            Recipient&apos;s public key
          </label>
          <select
            id="recipient-key"
            className="sb-select"
            value={recipient?.source === 'vault' ? recipient.id : ''}
            disabled={disabled}
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
          You have no saved public keys yet. <Link to="/keys">Create or import a key</Link>, or
          import a public key file below.
        </p>
      )}

      <div className="sb-actions" style={{ marginTop: 'var(--space-4)' }}>
        <Button
          variant="secondary"
          onClick={() => importInputRef.current?.click()}
          disabled={disabled}
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
              Files will be encrypted for <strong>{recipient.name}</strong>. Review this key&apos;s
              fingerprint in Key management when you need to verify it.
            </p>
          </StatusMessage>
        </div>
      ) : null}
    </>
  )
}
