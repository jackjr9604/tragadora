import type { Metadata } from 'next'
import { BlogCatalog } from '@/components/public/DiscoveryCatalogs'
import { PageHero } from '@/components/public/PageHero'
import { PublicPageShell } from '@/components/public/PublicPageShell'
import { getBlogPosts } from '@/lib/discovery'
import { resolvePublicLanguage } from '@/lib/language'
import { getPageContent } from '@/lib/site-content'
import { getPublicUi } from '@/lib/public-i18n'

export const revalidate = 60

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }): Promise<Metadata> {
  const language = await resolvePublicLanguage((await searchParams).lang)
  const t = getPublicUi(language)
  const content = await getPageContent('blog', language)
  const title = typeof content.hero?.title === 'string' && content.hero.title.trim() ? content.hero.title : t('hero.blog.title')
  const description = typeof content.hero?.subtitle === 'string' && content.hero.subtitle.trim() ? content.hero.subtitle : t('hero.blog.subtitle')
  return { title: `${title} | Tradagora`, description }
}

export default async function Page({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) {
  const language = await resolvePublicLanguage((await searchParams).lang)
  const t = getPublicUi(language)
  const [posts, content] = await Promise.all([getBlogPosts(language), getPageContent('blog', language)])
  return <PublicPageShell language={language}><PageHero content={content} language={language} fallbackTitle={t('hero.blog.title')} fallbackSubtitle={t('hero.blog.subtitle')} primaryHref="#articulos" secondaryHref={`/herramientas?lang=${language}`} compact /><main id="articulos" className="mx-auto max-w-[1440px] scroll-mt-24 px-4 py-8 sm:px-6 lg:px-8"><BlogCatalog posts={posts} language={language} /></main></PublicPageShell>
}
