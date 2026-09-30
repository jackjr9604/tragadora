import type { Metadata } from 'next'
import { PublicPageShell } from '@/components/public/PublicPageShell'
import { ToolsDirectory } from '@/components/tools/ToolsDirectory'
import { resolvePublicLanguage } from '@/lib/language'
import { getPublishedTools } from '@/lib/tools'
import { PageHero } from '@/components/public/PageHero'
import { getPageContent } from '@/lib/site-content'

export const metadata: Metadata = { title: 'Herramientas para traders | Tradagora', description: 'Calculadoras y recursos prácticos para planear y evaluar tu operativa.' }
export const revalidate = 60

export default async function ToolsPage({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) {
  const language = await resolvePublicLanguage((await searchParams).lang)
  const [tools, content] = await Promise.all([getPublishedTools(), getPageContent('herramientas', language)])
  return <PublicPageShell language={language}>
    <PageHero content={content} fallbackTitle="Utilidades para traders." fallbackSubtitle="Recursos prácticos para planear, calcular y evaluar tus operaciones." primaryHref="#herramientas" secondaryHref={`/blog?lang=${language}`} compact />
    <section id="herramientas" className="mx-auto w-full max-w-[1440px] scroll-mt-24 px-4 py-8 sm:px-6 lg:px-8 lg:py-10"><ToolsDirectory tools={tools} /></section>
  </PublicPageShell>
}
