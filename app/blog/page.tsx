import type { Metadata } from 'next'
import { BlogCatalog } from '@/components/public/DiscoveryCatalogs'
import { PageHero } from '@/components/public/PageHero'
import { PublicPageShell } from '@/components/public/PublicPageShell'
import { getBlogPosts } from '@/lib/discovery'
import { resolvePublicLanguage } from '@/lib/language'
import { getPageContent } from '@/lib/site-content'
import { getPublicUi } from '@/lib/public-i18n'

export const metadata: Metadata = { title: 'Blog | Tradagora', description: 'Ideas, análisis y recursos para traders.' }
export const revalidate = 60

export default async function Page({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) {
  const language = await resolvePublicLanguage((await searchParams).lang)
  const t = getPublicUi(language)
  const [posts, content] = await Promise.all([getBlogPosts(), getPageContent('blog', language)])
  return <PublicPageShell language={language}><PageHero content={content} language={language} fallbackTitle={t('hero.blog.title')} fallbackSubtitle={t('hero.blog.subtitle')} primaryHref="#articulos" secondaryHref={`/herramientas?lang=${language}`} compact /><main id="articulos" className="mx-auto max-w-[1440px] scroll-mt-24 px-4 py-8 sm:px-6 lg:px-8"><BlogCatalog posts={posts} language={language} /></main></PublicPageShell>
}
