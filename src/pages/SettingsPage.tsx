import { useState, useSyncExternalStore } from 'react'
import { Monitor, Moon, Sun, Trash2 } from 'lucide-react'
import { useKeyVault } from '../context/keyVault'
import { Button } from '../components/Button'
import { Dialog } from '../components/Dialog'
import { StatusMessage } from '../components/StatusMessage'
import { describeError, type ErrorCopy } from '../lib/errorCopy'
import { recordEvent } from '../lib/analytics'
import {
  getThemePreference,
  setThemePreference,
  subscribeToTheme,
  type ThemePreference,
} from '../lib/preferences'

const THEME_OPTIONS = [
  { value: 'system', label: 'System', hint: 'Match your device appearance.', icon: Monitor },
  { value: 'light', label: 'Light', hint: 'Always use the light palette.', icon: Sun },
  { value: 'dark', label: 'Dark', hint: 'Always use the dark palette.', icon: Moon },
] as const satisfies ReadonlyArray<{
  value: ThemePreference
  label: string
  hint: string
  icon: typeof Monitor
}>

interface Notice extends ErrorCopy {
  variant: 'success' | 'danger'
}

export function SettingsPage() {
  const { keys, status, removeKey } = useKeyVault()
  const theme = useSyncExternalStore(subscribeToTheme, getThemePreference)
  const [clearOpen, setClearOpen] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  const keyCount = keys.length
  const canClear = status === 'ready' && keyCount > 0

  const handleClearKeys = async () => {
    setNotice(null)
    const count = keyCount
    try {
      setClearing(true)
      for (const key of keys) {
        await removeKey(key.id)
      }
      recordEvent('key-delete', { files: count })
      setClearOpen(false)
      setNotice({
        variant: 'success',
        title: 'Key vault cleared',
        message: `${count === 1 ? '1 key was' : `${count} keys were`} removed from this browser. Encrypted packages you already downloaded are not affected.`,
      })
    } catch (error) {
      setClearOpen(false)
      setNotice({ variant: 'danger', ...describeError(error) })
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="sb-container sb-container--narrow sb-workflow">
      <header className="sb-workflow__header">
        <h1 className="sb-page-title">Settings</h1>
        <p className="sb-muted" style={{ marginTop: 'var(--space-2)' }}>
          Choose how SealBox looks and manage the data stored in this browser. Settings never leave
          your device.
        </p>
      </header>

      {notice ? (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <StatusMessage variant={notice.variant} title={notice.title}>
            {notice.message}
          </StatusMessage>
        </div>
      ) : null}

      <div className="sb-settings-stack">
        <section className="sb-settings" aria-labelledby="settings-appearance">
          <h2 className="sb-section-title" id="settings-appearance">
            Appearance
          </h2>
          <p className="sb-muted sb-text-sm" style={{ marginTop: 'var(--space-1)' }}>
            Your theme preference is saved in this browser.
          </p>

          <fieldset className="sb-fieldset">
            <legend className="sb-visually-hidden">Theme</legend>
            <div className="sb-theme-options">
              {THEME_OPTIONS.map((option) => {
                const Icon = option.icon
                return (
                  <label className="sb-theme-option" key={option.value}>
                    <input
                      className="sb-visually-hidden"
                      type="radio"
                      name="theme"
                      value={option.value}
                      checked={theme === option.value}
                      onChange={() => setThemePreference(option.value)}
                    />
                    <span className="sb-theme-option__icon" aria-hidden="true">
                      <Icon size={18} strokeWidth={1.9} />
                    </span>
                    <span className="sb-theme-option__body">
                      <span className="sb-theme-option__title">{option.label}</span>
                      <span className="sb-theme-option__hint">{option.hint}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>
        </section>

        <section className="sb-settings" aria-labelledby="settings-vault">
          <h2 className="sb-section-title" id="settings-vault">
            Key vault data
          </h2>
          <p className="sb-muted sb-text-sm" style={{ marginTop: 'var(--space-1)' }}>
            {status === 'loading'
              ? 'Checking the keys stored in this browser…'
              : status === 'error'
                ? 'Saved keys could not be loaded from this browser.'
                : keyCount === 0
                  ? 'No keys are stored in this browser.'
                  : keyCount === 1
                    ? '1 key is stored in this browser.'
                    : `${keyCount} keys are stored in this browser.`}
          </p>

          <div className="sb-settings__danger">
            <div>
              <h3 className="sb-card-title">Delete all keys</h3>
              <p className="sb-muted sb-text-sm" style={{ marginTop: 'var(--space-1)' }}>
                Permanently removes every public and private key from this browser. Export anything
                you need first — deleted private keys cannot be recovered.
              </p>
            </div>
            <Button
              variant="danger"
              icon={<Trash2 size={16} aria-hidden="true" />}
              disabled={!canClear}
              onClick={() => {
                setNotice(null)
                setClearOpen(true)
              }}
            >
              Delete all keys
            </Button>
          </div>
        </section>
      </div>

      <Dialog
        open={clearOpen}
        onClose={() => {
          if (!clearing) setClearOpen(false)
        }}
        dismissible={!clearing}
        title="Delete all keys"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setClearOpen(false)}
              disabled={clearing}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => void handleClearKeys()}
              loading={clearing}
              icon={<Trash2 size={16} aria-hidden="true" />}
            >
              Delete every key
            </Button>
          </>
        }
      >
        <StatusMessage variant="warning" title="This cannot be undone" live="off">
          You are about to delete {keyCount === 1 ? '1 key' : `${keyCount} keys`} from this browser.
          Anyone using them will lose the ability to decrypt files addressed to those keys unless a
          backup exists.
        </StatusMessage>
      </Dialog>
    </div>
  )
}
