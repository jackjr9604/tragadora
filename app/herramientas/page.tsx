import type { Metadata } from 'next'
import { PublicPageShell } from '@/components/public/PublicPageShell'
import { ToolsDirectory } from '@/components/tools/ToolsDirectory'
import { resolvePublicLanguage } from '@/lib/language'
import { getPublishedTools } from '@/lib/tools'
import { getPageContent, pageValue } from '@/lib/site-content'
import { getPublicUi } from '@/lib/public-i18n'

export const metadata: Metadata = { title: 'Herramientas de trading | Tradagora', description: 'Recursos, plataformas y servicios útiles para traders.', alternates: { canonical: '/herramientas' } }
export const revalidate = 60

export default async function ToolsPage({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) {
  const language = await resolvePublicLanguage((await searchParams).lang)
  const t = getPublicUi(language)
  const [tools, content] = await Promise.all([getPublishedTools(language), getPageContent('herramientas', language)])
  return <PublicPageShell language={language}>
    <header className="tg-hero"><div className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6 sm:py-14 lg:px-8"><span className="tg-eyebrow">{pageValue(content, 'hero', 'badge', t('hero.tools.badge'))}</span><h1 className="mt-3 max-w-4xl text-4xl font-bold leading-[1.02] text-white sm:text-5xl lg:text-6xl">{pageValue(content, 'hero', 'title', t('hero.tools.title'))}</h1><p className="mt-4 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">{pageValue(content, 'hero', 'subtitle', t('hero.tools.subtitle'))}</p></div></header>
    <section id="herramientas" className="mx-auto w-full max-w-[1440px] scroll-mt-24 px-4 py-8 sm:px-6 lg:px-8 lg:py-12"><ToolsDirectory tools={tools} language={language} /></section>
  </PublicPageShell>
}
