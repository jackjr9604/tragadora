import type { PublicOffer } from '@/lib/public-offers'
import { getPublicUi, publicLocale } from '@/lib/public-i18n'
import type { PublicLanguage } from '@/lib/public-language'

export function offerBenefit(offer: PublicOffer, language?: PublicLanguage) {
  if (offer.discountValue > 0) {
    return offer.discountType === 'percentage'
      ? `${offer.discountValue}% OFF`
      : `$${offer.discountValue} OFF`
  }
  const t = getPublicUi(language)
  if (offer.includesFreeAccount) return offer.freeAccountLabel || t('offers.freeAccount')
  return offer.shortHighlight || t('offers.activeBenefit')
}

export function offerExpiresSoon(offer: PublicOffer, nowMs: number) {
  if (!offer.expiresAt) return false
  const remaining = new Date(offer.expiresAt).getTime() - nowMs
  return remaining >= 0 && remaining <= 7 * 24 * 60 * 60 * 1000
}

export function offerDateLabel(value: string, language?: PublicLanguage) {
  return new Intl.DateTimeFormat(publicLocale(language), {
    day: 'numeric',
    month: 'short',
    timeZone: 'America/Bogota',
  }).format(new Date(value))
}
