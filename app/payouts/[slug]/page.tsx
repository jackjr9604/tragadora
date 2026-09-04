import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { notFound } from 'next/navigation'
import { FirmPayoutDashboard } from '@/components/public/FirmPayoutDashboard'
import { TrackerLogo, marketLabel } from '@/components/public/PayoutTrackerUI'
import { PublicPageShell } from '@/components/public/PublicPageShell'
import { payoutPeriod } from '@/lib/payout-periods'
import { getLatestPayoutTicker, getPayoutFirmDetail } from '@/lib/payout-tracker'
import { resolvePublicLanguage } from '@/lib/language'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 60
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ lang?: string | string[]; period?: string | string[] }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('platforms').select('name').eq('slug', slug).eq('type', 'prop_firm').maybeSingle()
  return data ? { title: `${data.name} Payouts | Tradagora`, description: `Historial, métricas y actividad de payouts de ${data.name}.` } : {}
}

export default async function PayoutFirmPage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const language = await resolvePublicLanguage(query.lang)
  const requested = scalar(query.period)
  const period = requested === '24h' ? '7d' : payoutPeriod(requested, 'all')
  const [detail, ticker] = await Promise.all([getPayoutFirmDetail(slug, period), getLatestPayoutTicker()])
  if (!detail) notFound()
  const { summary, context } = detail
  return <PublicPageShell payouts={ticker} language={language}>
    <section className="tradagora-pattern border-b border-white/8"><div className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6 lg:px-8 lg:py-9"><Link href={`/payouts?lang=${language}`} className="text-xs text-cyan-300">← Volver al Payout Tracker</Link><div className="mt-4 grid gap-5 rounded-2xl border border-white/10 bg-[#0c1727]/85 p-4 shadow-xl shadow-black/10 backdrop-blur-[2px] sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"><div className="flex min-w-0 items-start gap-4"><TrackerLogo summary={summary} large /><div className="min-w-0"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-[#f7c64b]">Payout tracker</p><h1 className="mt-0.5 text-3xl font-bold sm:text-4xl">{summary.name}</h1><p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-400">{headerFacts(summary.markets.map(marketLabel), context.country, context.foundedAt ? operatingYears(context.foundedAt) : null, context.profitSplit === null ? null : `Hasta ${context.profitSplit}% split`).map((fact, index) => <span key={fact}>{index > 0 && <span className="mr-2 text-[#f7c64b]/25">·</span>}{fact}</span>)}</p>{context.payoutMethods.length > 0 && <p className="mt-2 text-xs text-slate-500"><span className="text-slate-400">Retiros:</span> {context.payoutMethods.slice(0, 5).join(' · ')}</p>}</div></div><Link href={`/go/${summary.slug}`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#f7c64b] px-5 py-3 font-bold text-slate-950 shadow-lg shadow-amber-950/20 transition hover:bg-[#ffd66c]">Visitar firma <ArrowUpRight className="size-4" /></Link></div></div></section>
    <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8"><FirmPayoutDashboard detail={detail} period={period} basePath={`/payouts/${slug}`} language={language} /></main>
  </PublicPageShell>
}
function scalar(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] ?? '' : value ?? '' }
function operatingYears(value: string) { const founded = new Date(`${value}T00:00:00Z`), now = new Date(); let years = now.getUTCFullYear() - founded.getUTCFullYear(); if (now.getUTCMonth() < founded.getUTCMonth() || (now.getUTCMonth() === founded.getUTCMonth() && now.getUTCDate() < founded.getUTCDate())) years--; return `${Math.max(0, years)} ${years === 1 ? 'año' : 'años'} operando` }
function headerFacts(markets: string[], ...values: Array<string | null>) { return [...markets, ...values.filter((value): value is string => Boolean(value))] }
