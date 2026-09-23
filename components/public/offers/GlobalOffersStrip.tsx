import { headers } from 'next/headers'
import type { PublicLanguage } from '@/lib/public-language'
import { getPublicOffers } from '@/lib/public-offers'
import { FeaturedOffersStrip } from './FeaturedOffersStrip'
import { OfferActivityToast } from './OfferActivityToast'

export async function GlobalOffersStrip({ language }: { language: PublicLanguage }) {
  const countryCode = (await headers()).get('x-vercel-ip-country')
  const offers = await getPublicOffers(language, countryCode)
  const featured = offers.filter((offer) => offer.isFeatured)
  if (!offers.length) return null
  return <><FeaturedOffersStrip offers={featured} language={language} global /><OfferActivityToast offers={offers} /></>
}
