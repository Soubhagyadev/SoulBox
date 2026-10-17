export interface ProgressBarProps {
  /** 0–1, or undefined for an indeterminate bar. */
  value?: number
  label: string
  showPercent?: boolean
}

export function ProgressBar({ value, label, showPercent = true }: ProgressBarProps) {
  const indeterminate = value === undefined
  const percent = indeterminate ? undefined : Math.round(Math.min(Math.max(value, 0), 1) * 100)

  return (
    <div className="sb-progress">
      <div className="sb-progress__meta">
        <span>{label}</span>
        {!indeterminate && showPercent ? <span>{percent}%</span> : null}
      </div>
      <div
        className="sb-progress__track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={indeterminate ? undefined : 0}
        aria-valuemax={indeterminate ? undefined : 100}
        aria-valuenow={indeterminate ? undefined : percent}
        aria-valuetext={indeterminate ? label : `${percent}%`}
      >
        <div
          className={
            indeterminate
              ? 'sb-progress__bar sb-progress__bar--indeterminate'
              : 'sb-progress__bar'
          }
          style={{ width: indeterminate ? undefined : `${percent}%` }}
        />
      </div>
    </div>
  )
}
