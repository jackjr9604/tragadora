import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { ChallengeTargetCalculator, DrawdownCalculator, ProfitSplitCalculator } from '@/components/tools/Calculators'
import { ToolIcon } from '@/components/tools/ToolIcon'
import { PublicPageShell } from '@/components/public/PublicPageShell'
import { resolvePublicLanguage } from '@/lib/language'
import { getPublishedTool } from '@/lib/tools'

const REGISTRY = { drawdown: DrawdownCalculator, 'profit-split': ProfitSplitCalculator, 'challenge-target': ChallengeTargetCalculator } as const
export const revalidate = 60

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const tool = await getPublishedTool((await params).slug)
  return tool ? { title: `${tool.name} | Tradagora`, description: tool.short_description || undefined } : { title: 'Herramienta no encontrada | Tradagora' }
}

export default async function ToolPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ lang?: string | string[] }> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const language = await resolvePublicLanguage(query.lang)
  const tool = await getPublishedTool(slug)
  if (!tool) notFound()
  if (tool.tool_type === 'external' && tool.external_url) redirect(tool.external_url)
  if (tool.tool_type !== 'internal') notFound()
  const Calculator = REGISTRY[slug as keyof typeof REGISTRY]
  if (!Calculator) notFound()
  return <PublicPageShell language={language}><main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12"><Link href="/herramientas" className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-amber-300"><ArrowLeft className="size-4" />Volver a herramientas</Link><header className="mt-7 flex items-start gap-4"><span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-300/[.07] text-amber-300"><ToolIcon iconKey={tool.icon_key} /></span><div><p className="tg-eyebrow">{tool.category || 'Herramienta'}</p><h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">{tool.name}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">{tool.short_description}</p></div></header><section className="mt-8"><Calculator /></section><p className="mt-6 text-xs leading-5 text-slate-500">Los cálculos son orientativos. Verifica siempre las reglas oficiales de tu broker o prop firm.</p></main></PublicPageShell>
}
