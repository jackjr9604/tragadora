import type { PublicOffer } from '@/lib/public-offers'

export function offerBenefit(offer: PublicOffer) {
  if (offer.discountValue > 0) {
    return offer.discountType === 'percentage'
      ? `${offer.discountValue}% OFF`
      : `$${offer.discountValue} OFF`
  }
  if (offer.includesFreeAccount) return offer.freeAccountLabel || 'Cuenta gratis'
  return offer.shortHighlight || 'Beneficio activo'
}

export function offerExpiresSoon(offer: PublicOffer, nowMs: number) {
  if (!offer.expiresAt) return false
  const remaining = new Date(offer.expiresAt).getTime() - nowMs
  return remaining >= 0 && remaining <= 7 * 24 * 60 * 60 * 1000
}

export function offerDateLabel(value: string, language: string) {
  return new Intl.DateTimeFormat(language, {
    day: 'numeric',
    month: 'short',
    timeZone: 'America/Bogota',
  }).format(new Date(value))
}
