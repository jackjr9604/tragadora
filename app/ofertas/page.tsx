import Link from 'next/link'
import { headers } from 'next/headers'
import { ArrowUpRight } from 'lucide-react'
import { getHomeData } from '@/lib/home-data'
import { getPageContent } from '@/lib/site-content'
import { resolvePublicLanguage } from '@/lib/language'
import { PageHero } from '@/components/public/PageHero'
import { PlatformLogo } from '@/components/public/PlatformLogo'
import { PublicPageShell } from '@/components/public/PublicPageShell'

export const revalidate = 60

export default async function OffersPage({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) {
  const language = await resolvePublicLanguage((await searchParams).lang)
  const countryCode = (await headers()).get('x-vercel-ip-country')
  const [data, content] = await Promise.all([
    getHomeData(language, countryCode),
    getPageContent('ofertas', language),
  ])

  return (
    <PublicPageShell payouts={data.latestPayouts} language={language}>
      <PageHero
        content={content}
        fallbackTitle="Ofertas activas para traders."
        fallbackSubtitle="Consulta descuentos configurados y su vigencia."
        primaryHref="#ofertas"
      />
      <section id="ofertas" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.offers.map((offer) => (
            <article key={offer.id} className="rounded-2xl border border-white/10 bg-[#111c2e] p-6">
              <div className="flex items-center gap-3">
                <PlatformLogo platform={offer.platform} small />
                <p className="font-semibold">{offer.platform.name}</p>
                {offer.countryCode && <span className="ml-auto rounded-full border border-white/10 px-2 py-1 text-xs text-slate-400">{offer.countryCode}</span>}
              </div>
              <strong className="mt-6 block text-4xl text-[#f7c64b]">
                {offer.discountValue}{offer.discountType === 'percentage' ? '%' : ' USD'}
              </strong>
              <h2 className="mt-2 text-lg font-bold">{offer.title}</h2>
              {offer.description && <p className="mt-3 text-sm leading-6 text-slate-400">{offer.description}</p>}
              {offer.promoCode && <p className="mt-4 rounded-lg border border-dashed border-cyan-300/25 p-3 font-mono text-cyan-300">Código: {offer.promoCode}</p>}
              {offer.expiresAt && <p className="mt-3 text-xs text-slate-500">Vigente hasta {new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeZone: 'America/Bogota' }).format(new Date(offer.expiresAt))}</p>}
              <Link href={`/go/${offer.platform.slug}?offer=${offer.id}&lang=${language}`} className="mt-6 inline-flex items-center gap-2 font-bold">
                Ver oferta <ArrowUpRight className="size-4" />
              </Link>
            </article>
          ))}
        </div>
        {!data.offers.length && <p className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-slate-400">No hay ofertas activas disponibles para este idioma y ubicación.</p>}
      </section>
    </PublicPageShell>
  )
}
