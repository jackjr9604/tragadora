import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { PageContent } from '@/lib/site-content'
import { pageValue } from '@/lib/site-content'

export function PageHero({ content, fallbackTitle, fallbackSubtitle, primaryHref, secondaryHref }: { content: PageContent; fallbackTitle: string; fallbackSubtitle: string; primaryHref: string; secondaryHref?: string }) {
  return <section className="home-grid border-b border-white/8"><div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28"><span className="inline-flex rounded-full border border-cyan-300/25 bg-cyan-300/[.07] px-3 py-2 font-mono text-[11px] uppercase tracking-[.18em] text-cyan-300">{pageValue(content, 'hero', 'badge', 'Tradagora')}</span><h1 className="mt-6 max-w-4xl text-5xl font-bold leading-[1.02] tracking-[-.05em] text-white sm:text-6xl">{pageValue(content, 'hero', 'title', fallbackTitle)}</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-slate-400">{pageValue(content, 'hero', 'subtitle', fallbackSubtitle)}</p><div className="mt-8 flex flex-wrap gap-3"><Link href={primaryHref} className="inline-flex items-center gap-2 rounded-xl bg-[#f7c64b] px-5 py-3.5 font-bold text-[#101827]">{pageValue(content, 'hero', 'primary_cta', 'Explorar')} <ArrowRight className="size-4" /></Link>{secondaryHref && <Link href={secondaryHref} className="rounded-xl border border-white/12 px-5 py-3.5 font-semibold text-white">{pageValue(content, 'hero', 'secondary_cta', 'Ver metodología')}</Link>}</div></div></section>
}
