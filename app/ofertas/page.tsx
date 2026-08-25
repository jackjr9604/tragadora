import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { getHomeData } from '@/lib/home-data'
import { getPageContent } from '@/lib/site-content'
import { resolvePublicLanguage } from '@/lib/public-language'
import { PageHero } from '@/components/public/PageHero'
import { PlatformLogo } from '@/components/public/PlatformLogo'
import { PublicPageShell } from '@/components/public/PublicPageShell'

export const revalidate = 60
export default async function OffersPage({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) {
  const language = resolvePublicLanguage((await searchParams).lang)
  const [data, content] = await Promise.all([getHomeData(), getPageContent('ofertas', language)])
  return <PublicPageShell payouts={data.latestPayouts} language={language}><PageHero content={content} fallbackTitle="Ofertas activas para traders." fallbackSubtitle="Consulta descuentos configurados y su vigencia." primaryHref="#ofertas" /><section id="ofertas" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8"><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{data.offers.map((offer) => <article key={offer.id} className="rounded-2xl border border-white/10 bg-[#111c2e] p-6"><div className="flex items-center gap-3"><PlatformLogo platform={offer.platform} small /><p className="font-semibold">{offer.platform.name}</p></div><strong className="mt-6 block text-4xl text-[#f7c64b]">{offer.discountValue}{offer.discountType === 'percentage' ? '%' : ' USD'}</strong><h2 className="mt-2 text-lg font-bold">{offer.title}</h2>{offer.description && <p className="mt-3 text-sm leading-6 text-slate-400">{offer.description}</p>}{offer.promoCode && <p className="mt-4 rounded-lg border border-dashed border-cyan-300/25 p-3 font-mono text-cyan-300">Código: {offer.promoCode}</p>}<Link href={`/go/${offer.platform.slug}`} className="mt-6 inline-flex items-center gap-2 font-bold">Ver oferta <ArrowUpRight className="size-4" /></Link></article>)}</div></section></PublicPageShell>
}
