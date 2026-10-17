import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button } from './Button'

export interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  /** Allow closing with Escape / overlay click. Defaults to true. */
  dismissible?: boolean
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  dismissible = true,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const previouslyFocused = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  const handleClose = useCallback(() => {
    if (dismissible) onCloseRef.current()
  }, [dismissible])

  useEffect(() => {
    if (!open) return

    previouslyFocused.current = document.activeElement as HTMLElement | null

    const node = dialogRef.current
    const focusable = node?.querySelectorAll<HTMLElement>(FOCUSABLE)
    const first = focusable?.[0]
    ;(first ?? node)?.focus()

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        handleClose()
        return
      }
      if (event.key !== 'Tab' || !node) return
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => element.offsetParent !== null || element === document.activeElement,
      )
      if (items.length === 0) return
      const firstItem = items[0]
      const lastItem = items[items.length - 1]
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault()
        lastItem.focus()
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault()
        firstItem.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.body.style.overflow = originalOverflow
      previouslyFocused.current?.focus?.()
    }
  }, [open, handleClose])

  if (!open) return null

  return createPortal(
    <div
      className="sb-dialog-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleClose()
      }}
    >
      <div
        ref={dialogRef}
        className="sb-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="sb-dialog__header">
          <h2 className="sb-dialog__title" id={titleId}>
            {title}
          </h2>
          {dismissible ? (
            <Button
              variant="tertiary"
              size="sm"
              className="sb-btn--icon"
              onClick={onClose}
              aria-label="Close dialog"
            >
              <X size={18} aria-hidden="true" />
            </Button>
          ) : null}
        </div>
        <div className="sb-dialog__body">{children}</div>
        {footer ? <div className="sb-dialog__footer">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  )
}
