import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'

export type StatusVariant = 'info' | 'success' | 'warning' | 'danger'

const ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
} as const

export interface StatusMessageProps {
  variant?: StatusVariant
  title?: ReactNode
  children?: ReactNode
  actions?: ReactNode
  /** Override the default live-region role for the variant. */
  live?: 'polite' | 'assertive' | 'off'
}

export function StatusMessage({
  variant = 'info',
  title,
  children,
  actions,
  live,
}: StatusMessageProps) {
  const Icon = ICONS[variant]
  const role = live === 'off' ? undefined : live ?? (variant === 'danger' ? 'alert' : 'status')

  return (
    <div className={`sb-status sb-status--${variant}`} role={role}>
      <span className="sb-status__icon" aria-hidden="true">
        <Icon size={20} strokeWidth={2} />
      </span>
      <div className="sb-status__body">
        {title ? <p className="sb-status__title">{title}</p> : null}
        {children ? <div className="sb-status__message">{children}</div> : null}
        {actions ? <div className="sb-status__actions">{actions}</div> : null}
      </div>
    </div>
  )
}
