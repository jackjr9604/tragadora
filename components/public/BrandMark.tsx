import { TradagoraBrand } from '@/components/shared/TradagoraBrand'

export function BrandMark({ compact = false, responsive = false }: { compact?: boolean; responsive?: boolean }) {
  return <span className="inline-flex items-center">
    <TradagoraBrand
      variant={compact ? 'icon' : 'light'}
      priority
      sizes={compact ? '44px' : responsive ? '(max-width: 639px) 132px, (max-width: 1023px) 154px, 172px' : '176px'}
      className={compact ? 'w-11' : responsive ? 'w-[132px] sm:w-[154px] lg:w-[172px]' : 'w-44'}
    />
  </span>
}
