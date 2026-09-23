import type { Metadata } from 'next'
import { PublicPageShell } from '@/components/public/PublicPageShell'
import { ToolsDirectory } from '@/components/tools/ToolsDirectory'
import { resolvePublicLanguage } from '@/lib/language'
import { getPublishedTools } from '@/lib/tools'

export const metadata: Metadata = { title: 'Herramientas para traders | Tradagora', description: 'Calculadoras y recursos prácticos para planear y evaluar tu operativa.' }
export const revalidate = 60

export default async function ToolsPage({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) {
  const language = await resolvePublicLanguage((await searchParams).lang)
  const tools = await getPublishedTools()
  return <PublicPageShell language={language}>
    <section className="tg-hero"><div className="mx-auto max-w-[1440px] px-4 py-9 sm:px-6 sm:py-11 lg:px-8"><p className="tg-eyebrow">Herramientas</p><h1 className="mt-3 text-4xl font-bold text-white sm:text-5xl">Utilidades para traders.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">Recursos prácticos para planear, calcular y evaluar tus operaciones.</p></div></section>
    <section className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10"><ToolsDirectory tools={tools} /></section>
  </PublicPageShell>
}
