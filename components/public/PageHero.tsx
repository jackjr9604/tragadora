import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'
import type { PageContent } from '@/lib/site-content'
import { pageValue, sectionEnabled } from '@/lib/site-content'
import { getPublicUi, publicPath } from '@/lib/public-i18n'
import type { PublicLanguage } from '@/lib/public-language'

export function PageHero({ content, language, fallbackBadge = 'Tradagora', fallbackTitle, fallbackSubtitle, primaryHref, secondaryHref, compact = false, children }: { content: PageContent; language?: PublicLanguage; fallbackBadge?: string; fallbackTitle: string; fallbackSubtitle: string; primaryHref: string; secondaryHref?: string; compact?: boolean; children?: ReactNode }) {
  if (!sectionEnabled(content, 'hero')) return null
  const resolvedLanguage = language ?? (typeof content.$meta?.language === 'string' ? content.$meta.language : 'es')
  const t = getPublicUi(resolvedLanguage)
  const align = content.hero?.align === 'center' ? 'text-center' : content.hero?.align === 'right' ? 'text-right' : 'text-left'
  const actions = align === 'text-center' ? 'justify-center' : align === 'text-right' ? 'justify-end' : ''
  const titleSize = content.hero?.title_size === 'small' ? 'text-3xl sm:text-4xl' : content.hero?.title_size === 'large' ? 'text-4xl sm:text-5xl' : 'text-4xl sm:text-5xl lg:text-6xl'
  return <section className="tg-hero"><div className={`mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 ${compact ? 'py-10 sm:py-12' : 'py-14 sm:py-16 lg:py-20'} ${align}`}><span className="tg-eyebrow">{pageValue(content, 'hero', 'badge', fallbackBadge)}</span><h1 className={`mt-3 max-w-4xl font-bold leading-[1.02] text-white ${titleSize} ${align === 'text-left' ? '' : 'mx-auto'}`}>{pageValue(content, 'hero', 'title', fallbackTitle)}</h1><p className={`mt-4 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg ${align === 'text-left' ? '' : 'mx-auto'}`}>{pageValue(content, 'hero', 'subtitle', fallbackSubtitle)}</p><div className={`mt-7 flex flex-wrap gap-3 ${actions}`}><Link href={primaryHref.startsWith('#') ? primaryHref : publicPath(primaryHref, resolvedLanguage)} className="tg-button-gold px-5 py-3">{pageValue(content, 'hero', 'primary_cta', t('footer.explore'))} <ArrowRight className="size-4" /></Link>{secondaryHref && <Link href={secondaryHref.startsWith('#') ? secondaryHref : publicPath(secondaryHref, resolvedLanguage)} className="tg-button-secondary px-5 py-3">{pageValue(content, 'hero', 'secondary_cta', t('nav.methodology'))}</Link>}</div>{children}</div></section>
}
