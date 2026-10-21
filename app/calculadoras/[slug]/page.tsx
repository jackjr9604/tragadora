import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { ChallengeTargetCalculator, DrawdownCalculator, ProfitSplitCalculator } from '@/components/tools/Calculators'
import { ToolIcon } from '@/components/tools/ToolIcon'
import { PublicPageShell } from '@/components/public/PublicPageShell'
import { resolvePublicLanguage } from '@/lib/language'
import { getPublishedTool } from '@/lib/tools'
import { publicCalculatorCopy, publicPath, publicUiLanguage } from '@/lib/public-i18n'
import { publicSeoMetadata } from '@/lib/public-seo'

const REGISTRY = { drawdown: DrawdownCalculator, 'profit-split': ProfitSplitCalculator, 'challenge-target': ChallengeTargetCalculator } as const
export const revalidate = 60

export async function generateMetadata({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ lang?: string | string[] }> }): Promise<Metadata> {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const language = await resolvePublicLanguage(query.lang)
  const text = publicCalculatorCopy[publicUiLanguage(language)]
  const tool = await getPublishedTool(slug, language)
  return tool ? publicSeoMetadata({ path: `/calculadoras/${tool.slug}`, language, title: tool.seo_title || tool.name, description: tool.seo_description || tool.short_description }) : { title: `${text.notFound} | Tradagora` }
}

export default async function CalculatorPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ lang?: string | string[] }> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const language = await resolvePublicLanguage(query.lang)
  const tool = await getPublishedTool(slug, language)
  if (!tool) notFound()
  if (tool.tool_type !== 'internal') redirect(publicPath('/herramientas', language))
  const Calculator = REGISTRY[slug as keyof typeof REGISTRY]
  if (!Calculator) notFound()
  const text = publicCalculatorCopy[publicUiLanguage(language)]
  return <PublicPageShell language={language}><main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12"><Link href={`/calculadoras?lang=${language}`} className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-amber-300"><ArrowLeft className="size-4" />{text.back}</Link><header className="mt-7 flex items-start gap-4"><span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-300/[.07] text-amber-300"><ToolIcon iconKey={tool.icon_key} /></span><div><p className="tg-eyebrow">Tradagora</p><h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">{tool.name}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">{tool.short_description}</p></div></header><section className="mt-8"><Calculator language={language} /></section><p className="mt-6 text-xs leading-5 text-slate-500">{text.estimateNote}</p></main></PublicPageShell>
}
