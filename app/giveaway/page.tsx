import type { Metadata } from 'next'
import { GiveawayExperience } from '@/components/public/GiveawayExperience'
import { PageHero } from '@/components/public/PageHero'
import { PublicPageShell } from '@/components/public/PublicPageShell'
import { getGiveaways } from '@/lib/discovery'
import { resolvePublicLanguage } from '@/lib/language'
import { getPageContent } from '@/lib/site-content'
import { getPublicUi } from '@/lib/public-i18n'

export const metadata: Metadata = { title: 'Giveaways | Tradagora', description: 'Campañas y giveaways para la comunidad de Tradagora.' }
export const revalidate = 60

export default async function Page({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) {
  const language = await resolvePublicLanguage((await searchParams).lang)
  const t = getPublicUi(language)
  const [items, content] = await Promise.all([getGiveaways(language), getPageContent('giveaway', language)])
  return <PublicPageShell language={language}><PageHero content={content} language={language} fallbackTitle={t('hero.giveaway.title')} fallbackSubtitle={t('hero.giveaway.subtitle')} primaryHref="#campanas" secondaryHref={`/comunidades?lang=${language}`} compact /><main id="campanas" className="mx-auto max-w-[1440px] scroll-mt-24 px-4 py-8 sm:px-6 lg:px-8 lg:py-12"><GiveawayExperience items={items} language={language} /></main></PublicPageShell>
}
