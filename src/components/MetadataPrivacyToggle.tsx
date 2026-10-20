import { EyeOff } from 'lucide-react'

interface MetadataPrivacyToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

export function MetadataPrivacyToggle({
  checked,
  onChange,
  disabled = false,
}: MetadataPrivacyToggleProps) {
  return (
    <label className="sb-check-option">
      <input
        type="checkbox"
        className="sb-check-option__input"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="sb-check-option__icon" aria-hidden="true">
        <EyeOff size={18} strokeWidth={1.9} />
      </span>
      <span className="sb-check-option__body">
        <span className="sb-check-option__title">Hide metadata</span>
        <span className="sb-check-option__hint">
          Encrypt the original name, type, size, creation time, and recipient fingerprint inside
          the package. The download gets a generic name. Package length can still hint at file
          size.
        </span>
      </span>
    </label>
  )
}
