import type { HTMLAttributes, ReactNode } from 'react'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  compact?: boolean
  muted?: boolean
}

export function Card({ compact, muted, className, children, ...rest }: CardProps) {
  const classes = [
    'sb-card',
    compact ? 'sb-card--compact' : '',
    muted ? 'sb-card--muted' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  )
}

export interface CardHeaderProps {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  id?: string
}

export function CardHeader({ title, description, action, id }: CardHeaderProps) {
  return (
    <div className="sb-card__header">
      <div>
        <h3 className="sb-card-title" id={id}>
          {title}
        </h3>
        {description ? (
          <p className="sb-muted sb-text-sm" style={{ marginTop: 'var(--space-1)' }}>
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  )
}
