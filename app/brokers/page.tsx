import { BrokerDirectory } from '@/components/public/BrokerDirectory'
import { PublicPageShell } from '@/components/public/PublicPageShell'
import { getPublicBrokers } from '@/lib/brokers'
import { resolvePublicLanguage } from '@/lib/language'
import { PageHero } from '@/components/public/PageHero'
import { getPageContent } from '@/lib/site-content'
import { getPublicUi } from '@/lib/public-i18n'

export const revalidate = 60

export default async function BrokersPage({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) {
  const language = await resolvePublicLanguage((await searchParams).lang)
  const t = getPublicUi(language)
  const [brokers, content] = await Promise.all([getPublicBrokers(language), getPageContent('brokers', language)])
  return <PublicPageShell language={language}>
    <PageHero content={content} language={language} fallbackTitle={t('hero.brokers.title')} fallbackSubtitle={t('hero.brokers.subtitle')} primaryHref="#directorio" secondaryHref={`/comparador?lang=${language}`} compact />
    <section id="directorio" className="mx-auto w-full max-w-[1440px] scroll-mt-24 px-4 py-8 sm:px-6 lg:px-8 lg:py-10"><BrokerDirectory brokers={brokers} language={language} /></section>
  </PublicPageShell>
}
