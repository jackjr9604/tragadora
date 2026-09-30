import type { Metadata } from 'next'
import { PageHero } from '@/components/public/PageHero'
import { PublicPageShell } from '@/components/public/PublicPageShell'
import { CommunitiesCatalog } from '@/components/public/DiscoveryCatalogs'
import { getCommunities } from '@/lib/discovery'
import { resolvePublicLanguage } from '@/lib/language'
import { getPageContent } from '@/lib/site-content'

export const metadata: Metadata = { title: 'Comunidades para traders | Tradagora', description: 'Encuentra espacios para aprender, compartir y conectar con otros traders.' }
export const revalidate = 60

export default async function Page({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) {
  const language = await resolvePublicLanguage((await searchParams).lang)
  const [items, content] = await Promise.all([getCommunities(), getPageContent('comunidades', language)])
  return <PublicPageShell language={language}><PageHero content={content} fallbackTitle="Espacios para aprender y conectar." fallbackSubtitle="Encuentra comunidades relevantes para traders." primaryHref="#comunidades" secondaryHref={`/blog?lang=${language}`} compact /><main id="comunidades" className="mx-auto max-w-[1440px] scroll-mt-24 px-4 py-8 sm:px-6 lg:px-8"><CommunitiesCatalog items={items} /></main></PublicPageShell>
}
