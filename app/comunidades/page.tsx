import type { Metadata } from 'next'
import { PageHero } from '@/components/public/PageHero'
import { PublicPageShell } from '@/components/public/PublicPageShell'
import { CommunitiesCatalog } from '@/components/public/DiscoveryCatalogs'
import { getCommunities } from '@/lib/discovery'
import { resolvePublicLanguage } from '@/lib/language'
import { getPageContent } from '@/lib/site-content'
import { getPublicUi } from '@/lib/public-i18n'
import { publicSeoMetadata } from '@/lib/public-seo'

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }): Promise<Metadata> {
  const language = await resolvePublicLanguage((await searchParams).lang), t = getPublicUi(language), content = await getPageContent('comunidades', language)
  const value = (field: string, fallback: string) => typeof content.hero?.[field] === 'string' && String(content.hero[field]).trim() ? String(content.hero[field]) : fallback
  return publicSeoMetadata({ path: '/comunidades', language, title: value('title', t('hero.communities.title')), description: value('subtitle', t('hero.communities.subtitle')) })
}
export const revalidate = 60

export default async function Page({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) {
  const language = await resolvePublicLanguage((await searchParams).lang)
  const t = getPublicUi(language)
  const [items, content] = await Promise.all([getCommunities(language), getPageContent('comunidades', language)])
  return <PublicPageShell language={language}><PageHero content={content} language={language} fallbackTitle={t('hero.communities.title')} fallbackSubtitle={t('hero.communities.subtitle')} primaryHref="#comunidades" secondaryHref={`/blog?lang=${language}`} compact /><main id="comunidades" className="mx-auto max-w-[1440px] scroll-mt-24 px-4 py-8 sm:px-6 lg:px-8"><CommunitiesCatalog items={items} language={language} /></main></PublicPageShell>
}
