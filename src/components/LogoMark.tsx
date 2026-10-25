export interface LogoMarkProps {
  /** Rendered size in pixels (the mark is square). */
  size?: number
  className?: string
}

export function LogoMark({ size = 20, className }: LogoMarkProps) {
  return (
    <img
      src="/favicon.svg"
      alt=""
      width={size}
      height={size}
      className={className}
    />
  )
}
