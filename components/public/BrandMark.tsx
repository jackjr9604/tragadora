import { TradagoraBrand } from '@/components/shared/TradagoraBrand'
import type { BrandingAsset } from '@/lib/branding-config'

export function BrandMark({ compact = false, responsive = false, desktop, mobile }: { compact?: boolean; responsive?: boolean; desktop?: BrandingAsset; mobile?: BrandingAsset }) {
  if (responsive && desktop && mobile) return <span className="inline-flex items-center">
    <TradagoraBrand src={mobile.url} alt={mobile.alt} priority className="w-[132px] sm:hidden" />
    <TradagoraBrand src={desktop.url} alt={desktop.alt} priority className="hidden w-[154px] sm:block lg:w-[172px]" />
  </span>
  return <span className="inline-flex items-center">
    <TradagoraBrand
      variant={compact ? 'icon' : 'light'}
      src={desktop?.url}
      alt={desktop?.alt}
      priority
      sizes={compact ? '44px' : responsive ? '(max-width: 639px) 132px, (max-width: 1023px) 154px, 172px' : '176px'}
      className={compact ? 'w-11' : responsive ? 'w-[132px] sm:w-[154px] lg:w-[172px]' : 'w-44'}
    />
  </span>
}
