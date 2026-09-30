import { headers } from 'next/headers'
import { OffersExperience } from '@/components/public/offers/OffersExperience'
import { PublicPageShell } from '@/components/public/PublicPageShell'
import { resolvePublicLanguage } from '@/lib/language'
import { getPublicOffers } from '@/lib/public-offers'
import { PageHero } from '@/components/public/PageHero'
import { getPageContent } from '@/lib/site-content'

export const revalidate = 60

export default async function OffersPage({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) {
  const language = await resolvePublicLanguage((await searchParams).lang)
  const countryCode = (await headers()).get('x-vercel-ip-country')
  const [offers, content] = await Promise.all([getPublicOffers(language, countryCode), getPageContent('ofertas', language)])

  return (
    <PublicPageShell language={language}>
      <PageHero content={content} fallbackTitle="Ofertas activas para traders" fallbackSubtitle="Compara descuentos, códigos promocionales y beneficios vigentes de Prop Firms." primaryHref="#ofertas" secondaryHref={`/prop-firms?lang=${language}`} compact />
      <div id="ofertas" className="scroll-mt-24"><OffersExperience offers={offers} language={language} nowIso={new Date().toISOString()} /></div>
    </PublicPageShell>
  )
}
