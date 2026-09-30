import { Suspense } from 'react'
import { getPageContent } from '@/lib/site-content'
import { resolvePublicLanguage } from '@/lib/language'
import { getPropFirmDirectory } from '@/lib/prop-firm-directory'
import { PropFirmDirectory } from '@/components/public/PropFirmDirectory'
import { PublicPageShell } from '@/components/public/PublicPageShell'
import { GlobalOffersStrip } from '@/components/public/offers/GlobalOffersStrip'
import { PageHero } from '@/components/public/PageHero'

export const revalidate = 60

export default async function PropFirmsPage({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) {
  const language = await resolvePublicLanguage((await searchParams).lang)
  const [content, firms] = await Promise.all([
    getPageContent('prop-firms', language),
    getPropFirmDirectory(),
  ])

  return <PublicPageShell language={language}>
    <PageHero content={content} fallbackTitle="Prop Firms para comparar con criterio." fallbackSubtitle="Busca, filtra y compara firmas antes de elegir." primaryHref="#directorio" secondaryHref={`/comparador?lang=${language}`} compact />
    <Suspense fallback={null}><GlobalOffersStrip language={language} /></Suspense>
    <section id="directorio" className="mx-auto w-full max-w-[1440px] px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
      <PropFirmDirectory firms={firms} language={language} />
    </section>
  </PublicPageShell>
}
