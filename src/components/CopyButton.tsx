import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, Copy, X } from 'lucide-react'
import { Button, type ButtonVariant } from './Button'

export interface CopyButtonProps {
  value: string
  /** Accessible label while idle, e.g. "Copy fingerprint for Alice". */
  label: string
  /** Accessible label shown briefly after a successful copy. */
  copiedLabel?: string
  /** Button variant. Defaults to tertiary. */
  variant?: ButtonVariant
  className?: string
  /** Optional visible text. When omitted the button is icon-only. */
  children?: ReactNode
}

type CopyState = 'idle' | 'copied' | 'failed'

const RESET_DELAY = 1800

export function CopyButton({
  value,
  label,
  copiedLabel = 'Copied',
  variant = 'tertiary',
  className,
  children,
}: CopyButtonProps) {
  const [state, setState] = useState<CopyState>('idle')
  const resetTimer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(resetTimer.current), [])

  const handleCopy = async () => {
    let next: CopyState = 'copied'
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      next = 'failed'
    }
    setState(next)
    window.clearTimeout(resetTimer.current)
    resetTimer.current = window.setTimeout(() => setState('idle'), RESET_DELAY)
  }

  return (
    <Button
      variant={variant}
      size="sm"
      className={[
        children ? '' : 'sb-btn--icon',
        state === 'copied' ? 'sb-copy--ok' : '',
        state === 'failed' ? 'sb-copy--failed' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={
        state === 'copied'
          ? copiedLabel
          : state === 'failed'
            ? 'Copy failed — copy manually'
            : label
      }
      title={state === 'failed' ? 'Copy failed' : 'Copy'}
      onClick={() => void handleCopy()}
    >
      {state === 'copied' ? (
        <Check size={16} aria-hidden="true" />
      ) : state === 'failed' ? (
        <X size={16} aria-hidden="true" />
      ) : (
        <Copy size={16} aria-hidden="true" />
      )}
      {children}
    </Button>
  )
}
