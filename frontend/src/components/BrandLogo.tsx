interface BrandLogoProps {
  className?: string
}

export function BrandLogo({ className = '' }: BrandLogoProps) {
  return (
    <img
      className={`h-[1.625rem] w-[5.25rem] ${className}`}
      src="/brand/rotik-logo.svg"
      alt="Rotik"
      width="84"
      height="26"
    />
  )
}
