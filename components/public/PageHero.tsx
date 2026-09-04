import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { PageContent } from '@/lib/site-content'
import { pageValue } from '@/lib/site-content'

export function PageHero({ content, fallbackTitle, fallbackSubtitle, primaryHref, secondaryHref, compact = false }: { content: PageContent; fallbackTitle: string; fallbackSubtitle: string; primaryHref: string; secondaryHref?: string; compact?: boolean }) {
  return <section className="tg-hero"><div className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 ${compact ? 'py-10 sm:py-12' : 'py-14 sm:py-16 lg:py-20'}`}><span className="tg-eyebrow">{pageValue(content, 'hero', 'badge', 'Tradagora')}</span><h1 className="mt-3 max-w-4xl text-4xl font-bold leading-[1.02] text-white sm:text-5xl lg:text-6xl">{pageValue(content, 'hero', 'title', fallbackTitle)}</h1><p className="mt-4 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">{pageValue(content, 'hero', 'subtitle', fallbackSubtitle)}</p><div className="mt-7 flex flex-wrap gap-3"><Link href={primaryHref} className="tg-button-gold px-5 py-3">{pageValue(content, 'hero', 'primary_cta', 'Explorar')} <ArrowRight className="size-4" /></Link>{secondaryHref && <Link href={secondaryHref} className="tg-button-secondary px-5 py-3">{pageValue(content, 'hero', 'secondary_cta', 'Ver metodología')}</Link>}</div></div></section>
}
