import { useEffect, useRef } from 'react'
import { Link, NavLink } from 'react-router-dom'
import {
  ChartNoAxesColumn,
  FileKey,
  FileLock2,
  FolderLock,
  KeyRound,
  Menu,
  Settings,
  X,
} from 'lucide-react'
import { LogoMark } from './LogoMark'

const NAV_ITEMS = [
  { to: '/encrypt', label: 'Encrypt file', icon: FileLock2 },
  { to: '/batch', label: 'Batch encryption', icon: FolderLock },
  { to: '/decrypt', label: 'Decrypt file', icon: FileKey },
  { to: '/keys', label: 'Key management', icon: KeyRound },
  { to: '/analytics', label: 'Analytics', icon: ChartNoAxesColumn },
  { to: '/settings', label: 'Settings', icon: Settings },
]

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

export interface SidebarProps {
  /** Drawer state. Ignored on desktop, where the sidebar is permanent. */
  open: boolean
  onOpen: () => void
  onClose: () => void
}

export function Sidebar({ open, onOpen, onClose }: SidebarProps) {
  const sidebarRef = useRef<HTMLElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const hadFocusInside = useRef(false)

  useEffect(() => {
    if (open) {
      hadFocusInside.current = true
      return
    }
    if (hadFocusInside.current) {
      hadFocusInside.current = false
      toggleRef.current?.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    const node = sidebarRef.current
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    node?.querySelector<HTMLElement>('.sb-drawer-close')?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !node) return
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => element.offsetParent !== null || element === document.activeElement,
      )
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.body.style.overflow = originalOverflow
    }
  }, [open, onClose])

  return (
    <>
      <div className="sb-app__bar">
        <button
          ref={toggleRef}
          type="button"
          className="sb-btn sb-btn--secondary sb-btn--sm sb-btn--icon"
          aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={open}
          aria-controls="sb-sidebar"
          onClick={open ? onClose : onOpen}
        >
          {open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
        </button>
        <Link to="/" className="sb-brand" aria-label="SealBox home">
          <span className="sb-brand__mark" aria-hidden="true">
            <LogoMark size={20} />
          </span>
          SealBox
        </Link>
      </div>

      {open ? (
        <div className="sb-drawer-overlay" onClick={onClose} aria-hidden="true" />
      ) : null}

      <aside className="sb-sidebar" id="sb-sidebar" data-open={open || undefined} ref={sidebarRef}>
        <div className="sb-sidebar__header">
          <Link to="/" className="sb-brand" aria-label="SealBox home" onClick={onClose}>
            <span className="sb-brand__mark" aria-hidden="true">
              <LogoMark size={20} />
            </span>
            SealBox
          </Link>
          <button
            type="button"
            className="sb-btn sb-btn--tertiary sb-btn--sm sb-btn--icon sb-drawer-close"
            aria-label="Close navigation"
            onClick={onClose}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <nav className="sb-sidebar__nav" aria-label="Primary">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className="sb-sidebar__link" onClick={onClose}>
              <Icon size={18} strokeWidth={1.9} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="sb-sidebar__footer">
          <Link to="/encrypt" className="sb-btn sb-btn--primary sb-btn--block" onClick={onClose}>
            Encrypt a file
          </Link>
          <p className="sb-sidebar__note">
            Files are encrypted in your browser. Your keys stay on this device.
          </p>
        </div>
      </aside>
    </>
  )
}
