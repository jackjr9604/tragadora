import Image from 'next/image'
import logoDark from '@/public/brand/tradagora-logo-dark.png'
import logoLight from '@/public/brand/tradagora-logo-light.png'

type Props = {
  variant?: 'light' | 'dark' | 'icon'
  className?: string
  priority?: boolean
  sizes?: string
}

export function TradagoraBrand({ variant = 'light', className = '', priority = false, sizes }: Props) {
  const isIcon = variant === 'icon'
  return <Image
    src={isIcon ? '/brand/tradagora-icon.png' : variant === 'dark' ? logoDark : logoLight}
    alt="Tradagora"
    width={isIcon ? 1453 : 2086}
    height={isIcon ? 1083 : 754}
    priority={priority}
    sizes={sizes}
    className={`h-auto object-contain ${className}`}
  />
}
