import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
  loading?: boolean
  icon?: ReactNode
  iconRight?: ReactNode
}

export function Button({
  variant = 'secondary',
  size = 'md',
  block = false,
  loading = false,
  icon,
  iconRight,
  children,
  className,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [
    'sb-btn',
    `sb-btn--${variant}`,
    size !== 'md' ? `sb-btn--${size}` : '',
    block ? 'sb-btn--block' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="sb-btn__spinner" aria-hidden="true" /> : icon}
      {children}
      {!loading && iconRight}
    </button>
  )
}
