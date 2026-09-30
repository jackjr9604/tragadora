import Image from 'next/image'
import logoDark from '@/public/brand/tradagora-logo-dark.png'
import logoLight from '@/public/brand/tradagora-logo-light.png'

type Props = {
  variant?: 'light' | 'dark' | 'icon'
  src?: string
  alt?: string
  className?: string
  priority?: boolean
  sizes?: string
}

export function TradagoraBrand({ variant = 'light', src, alt = 'Tradagora', className = '', priority = false, sizes }: Props) {
  const isIcon = variant === 'icon'
  if (src) {
    // La URL puede proceder del bucket público administrado desde Multimedia.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={`h-auto object-contain ${className}`} />
  }
  return <Image
    src={isIcon ? '/brand/tradagora-icon.png' : variant === 'dark' ? logoDark : logoLight}
    alt={alt}
    width={isIcon ? 1453 : 2086}
    height={isIcon ? 1083 : 754}
    priority={priority}
    sizes={sizes}
    className={`h-auto object-contain ${className}`}
  />
}
