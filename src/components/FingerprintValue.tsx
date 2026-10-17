import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from './Button'
import { CopyButton } from './CopyButton'

export interface FingerprintValueProps {
  value: string
  /** Optional key name used to make the action labels specific. */
  label?: string
  className?: string
}

export function FingerprintValue({ value, label, className }: FingerprintValueProps) {
  const [revealed, setRevealed] = useState(false)
  const name = label ? `fingerprint for ${label}` : 'fingerprint'

  return (
    <div className={['sb-fingerprint', className].filter(Boolean).join(' ')}>
      <code className="sb-fingerprint__value">{revealed ? value : '••:••:••:••'}</code>
      <Button
        variant="tertiary"
        size="sm"
        className="sb-btn--icon"
        aria-label={revealed ? `Hide ${name}` : `Show ${name}`}
        title={revealed ? 'Hide fingerprint' : 'Show fingerprint'}
        onClick={() => setRevealed((current) => !current)}
      >
        {revealed ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
      </Button>
      <CopyButton value={value} label={`Copy ${name}`} />
    </div>
  )
}
