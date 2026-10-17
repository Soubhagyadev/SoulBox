import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'

export interface EmptyStateProps {
  icon?: ReactNode
  title: string
  children?: ReactNode
  action?: ReactNode
}

export function EmptyState({ icon, title, children, action }: EmptyStateProps) {
  return (
    <div className="sb-empty">
      <span className="sb-empty__icon" aria-hidden="true">
        {icon ?? <Inbox size={24} strokeWidth={1.75} />}
      </span>
      <p className="sb-empty__title">{title}</p>
      {children ? <p className="sb-empty__text">{children}</p> : null}
      {action}
    </div>
  )
}
