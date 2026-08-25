import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { getHomeData } from '@/lib/home-data'
import { getPageContent } from '@/lib/site-content'
import { resolvePublicLanguage } from '@/lib/public-language'
import { PageHero } from '@/components/public/PageHero'
import { PlatformLogo } from '@/components/public/PlatformLogo'
import { PublicPageShell } from '@/components/public/PublicPageShell'

export const revalidate = 60
export default async function PropFirmsPage({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) {
  const language = resolvePublicLanguage((await searchParams).lang)
  const [data, content] = await Promise.all([getHomeData(), getPageContent('prop-firms', language)])
  return <PublicPageShell payouts={data.latestPayouts} language={language}><PageHero content={content} fallbackTitle="Prop Firms para comparar con criterio." fallbackSubtitle="Revisa datos, condiciones y actividad antes de elegir." primaryHref="#directorio" /><section id="directorio" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8"><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{data.platforms.map((platform) => <article key={platform.id} className="rounded-2xl border border-white/10 bg-[#111c2e] p-6"><div className="flex items-center gap-3"><PlatformLogo platform={platform} /><div><h2 className="font-bold">{platform.name}</h2><p className="text-xs text-slate-500">Puntuación {platform.score ?? '—'}</p></div></div><p className="mt-5 min-h-12 text-sm leading-6 text-slate-400">{platform.description || 'Consulta las condiciones disponibles para esta firma.'}</p><div className="mt-4 flex flex-wrap gap-2 text-xs">{platform.profitSplit !== null && <span className="rounded-full bg-white/5 px-3 py-1.5">Hasta {platform.profitSplit}% split</span>}{platform.supportsEa && <span className="rounded-full bg-white/5 px-3 py-1.5">EA permitido</span>}</div><Link href={`/go/${platform.slug}`} className="mt-6 flex items-center justify-between rounded-xl bg-[#f7c64b] px-4 py-3 text-sm font-bold text-slate-950">Visitar sitio oficial <ArrowUpRight className="size-4" /></Link></article>)}</div></section></PublicPageShell>
}
