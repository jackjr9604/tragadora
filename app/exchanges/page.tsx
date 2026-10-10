import type { Metadata } from 'next'
import { ExchangeDirectory } from '@/components/public/ExchangeDirectory'
import { PageHero } from '@/components/public/PageHero'
import { PublicPageShell } from '@/components/public/PublicPageShell'
import { getPublicExchanges } from '@/lib/exchanges'
import { resolvePublicLanguage } from '@/lib/language'
import { getPageContent } from '@/lib/site-content'
import { getPublicUi } from '@/lib/public-i18n'

export const metadata: Metadata = { title: 'Exchanges | Tradagora', description: 'Plataformas para comprar, vender y operar activos digitales.' }
export const revalidate = 60

export default async function Page({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) {
  const language = await resolvePublicLanguage((await searchParams).lang)
  const t = getPublicUi(language)
  const [items, content] = await Promise.all([getPublicExchanges(language), getPageContent('exchanges', language)])
  return <PublicPageShell language={language}><PageHero content={content} language={language} fallbackTitle={t('hero.exchanges.title')} fallbackSubtitle={t('hero.exchanges.subtitle')} primaryHref="#exchanges" secondaryHref={`/herramientas?lang=${language}`} compact /><main id="exchanges" className="mx-auto max-w-[1440px] scroll-mt-24 px-4 py-8 sm:px-6 lg:px-8"><ExchangeDirectory items={items} language={language} /></main></PublicPageShell>
}
