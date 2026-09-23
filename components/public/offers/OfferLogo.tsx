import type { PublicOffer } from '@/lib/public-offers'

export function OfferLogo({ offer, large = false }: { offer: PublicOffer; large?: boolean }) {
  const size = large ? 'size-12 rounded-xl' : 'size-10 rounded-lg'
  if (!offer.platform.logoUrl) {
    return <span className={`${size} flex shrink-0 items-center justify-center border border-white/10 bg-white/5 font-bold text-amber-200`}>{offer.platform.name.slice(0, 2).toUpperCase()}</span>
  }
  // Las imágenes son administradas por Supabase y pueden usar hosts dinámicos.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={offer.platform.logoUrl} alt={offer.platform.logoAlt || offer.platform.name} width={large ? 48 : 40} height={large ? 48 : 40} loading="lazy" decoding="async" className={`${size} shrink-0 border border-white/10 bg-white object-contain p-1`} />
}
