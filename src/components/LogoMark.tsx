export interface LogoMarkProps {
  /** Rendered size in pixels (the mark is square). */
  size?: number
  className?: string
}

/**
 * SealBox brand mark: a box lid and body joined by a wax-style seal.
 * White shapes use `currentColor`; the seal outline and keyhole use the
 * surrounding primary color so the disc reads as a stamped seal.
 */
export function LogoMark({ size = 20, className }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3" y="3.5" width="18" height="6.5" rx="1.8" fill="currentColor" />
      <rect x="5.5" y="12.5" width="13" height="8.5" rx="1.8" fill="currentColor" />
      <circle
        cx="12"
        cy="11.25"
        r="4.9"
        fill="currentColor"
        stroke="var(--color-primary)"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="9.9" r="1.55" fill="var(--color-primary)" />
      <rect x="11.2" y="10.6" width="1.6" height="3.6" rx="0.8" fill="var(--color-primary)" />
    </svg>
  )
}
