import { headers } from 'next/headers'
import { OffersExperience } from '@/components/public/offers/OffersExperience'
import { PublicPageShell } from '@/components/public/PublicPageShell'
import { resolvePublicLanguage } from '@/lib/language'
import { getPublicOffers } from '@/lib/public-offers'
import { PageHero } from '@/components/public/PageHero'
import { getPageContent } from '@/lib/site-content'
import { publicOffersCopy, publicUiLanguage } from '@/lib/public-i18n'
import type { Metadata } from 'next'
import { publicSeoMetadata } from '@/lib/public-seo'

export const revalidate = 60

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }): Promise<Metadata> {
  const language = await resolvePublicLanguage((await searchParams).lang), copy = publicOffersCopy[publicUiLanguage(language)], content = await getPageContent('ofertas', language)
  const value = (field: string, fallback: string) => typeof content.hero?.[field] === 'string' && String(content.hero[field]).trim() ? String(content.hero[field]) : fallback
  return publicSeoMetadata({ path: '/ofertas', language, title: value('title', copy.pageTitle), description: value('subtitle', copy.pageSubtitle) })
}

export default async function OffersPage({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) {
  const language = await resolvePublicLanguage((await searchParams).lang)
  const countryCode = (await headers()).get('x-vercel-ip-country')
  const [offers, content] = await Promise.all([getPublicOffers(language, countryCode), getPageContent('ofertas', language)])
  const copy = publicOffersCopy[publicUiLanguage(language)]

  return (
    <PublicPageShell language={language}>
      <PageHero content={content} fallbackTitle={copy.pageTitle} fallbackSubtitle={copy.pageSubtitle} primaryHref="#ofertas" secondaryHref={`/prop-firms?lang=${language}`} compact />
      <div id="ofertas" className="scroll-mt-24"><OffersExperience offers={offers} language={language} nowIso={new Date().toISOString()} /></div>
    </PublicPageShell>
  )
}
