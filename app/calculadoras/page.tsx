import type { Metadata } from 'next'
import { CalculatorsDirectory } from '@/components/tools/CalculatorsDirectory'
import { PublicPageShell } from '@/components/public/PublicPageShell'
import { resolvePublicLanguage } from '@/lib/language'
import { getPageContent, pageValue } from '@/lib/site-content'
import { getPublishedCalculators } from '@/lib/tools'
import { getPublicUi } from '@/lib/public-i18n'
import { publicSeoMetadata } from '@/lib/public-seo'

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }): Promise<Metadata> {
  const language = await resolvePublicLanguage((await searchParams).lang), t = getPublicUi(language), content = await getPageContent('calculadoras', language)
  const value = (field: string, fallback: string) => typeof content.hero?.[field] === 'string' && String(content.hero[field]).trim() ? String(content.hero[field]) : fallback
  return publicSeoMetadata({ path: '/calculadoras', language, title: value('title', t('hero.calculators.title')), description: value('subtitle', t('hero.calculators.subtitle')) })
}
export const revalidate = 60

export default async function CalculatorsPage({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) {
  const language = await resolvePublicLanguage((await searchParams).lang)
  const t = getPublicUi(language)
  const [calculators, content] = await Promise.all([getPublishedCalculators(language), getPageContent('calculadoras', language)])
  return <PublicPageShell language={language}>
    <header className="tg-hero"><div className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6 sm:py-14 lg:px-8"><span className="tg-eyebrow">{pageValue(content, 'hero', 'badge', t('hero.calculators.badge'))}</span><h1 className="mt-3 max-w-4xl text-4xl font-bold leading-[1.02] text-white sm:text-5xl lg:text-6xl">{pageValue(content, 'hero', 'title', t('hero.calculators.title'))}</h1><p className="mt-4 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">{pageValue(content, 'hero', 'subtitle', t('hero.calculators.subtitle'))}</p></div></header>
    <section className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8 lg:py-12"><CalculatorsDirectory calculators={calculators} language={language} /></section>
  </PublicPageShell>
}
