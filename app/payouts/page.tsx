import type { Metadata } from 'next'
import { Search } from 'lucide-react'
import { PublicPageShell } from '@/components/public/PublicPageShell'
import { PeriodTabs, SummaryTable } from '@/components/public/PayoutTrackerUI'
import { payoutPeriod, payoutPeriodLabel } from '@/lib/payout-periods'
import { getLatestPayoutTicker, getPayoutTrackerSummaries, type PayoutFirmSummary } from '@/lib/payout-tracker'
import { resolvePublicLanguage } from '@/lib/language'

export const revalidate = 60
export const metadata: Metadata = { title: 'Payout Tracker de Prop Firms | Tradagora', description: 'Compara datos externos de referencia con payouts verificados independientemente por Tradagora.' }
type SearchParams = { lang?: string | string[]; period?: string | string[]; q?: string | string[]; market?: string | string[]; sort?: string | string[] }

export default async function PayoutsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const language = await resolvePublicLanguage(params.lang)
  const period = payoutPeriod(scalar(params.period), '30d')
  const [allSummaries, ticker] = await Promise.all([getPayoutTrackerSummaries(period), getLatestPayoutTicker()])
  const query = scalar(params.q).trim().toLocaleLowerCase('es')
  const market = scalar(params.market) || 'all'
  const sort = scalar(params.sort) || 'total'
  const summaries = allSummaries.filter((item) => !query || item.name.toLocaleLowerCase('es').includes(query)).filter((item) => market === 'all' || item.markets.includes(market)).sort(sorter(sort))

  return <PublicPageShell payouts={ticker} language={language}>
    <section className="tg-hero"><div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-14"><p className="tg-eyebrow">Payout Tracker</p><h1 className="mt-3 max-w-4xl text-4xl font-bold leading-tight sm:text-5xl">Ranking de payouts de Prop Firms.</h1><p className="mt-4 max-w-3xl text-base leading-7 text-slate-400">Explora las cifras de payouts de las principales Prop Firms. Los datos de referencia provienen de seguimiento externo y pueden consultarse por periodo.</p><div className="mt-7"><PeriodTabs active={period} basePath="/payouts" language={language} /></div></div></section>
    <section className="mx-auto w-full min-w-0 max-w-[1440px] overflow-hidden px-4 py-8 sm:px-6 lg:px-8 lg:py-10"><div className="mb-6"><h2 className="text-2xl font-bold">Payouts · {payoutPeriodLabel(period)}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Estas cifras son referencias externas y no representan verificaciones propias de Tradagora. Consulta cada firma para ver el análisis detallado.</p></div><form className="tg-surface mb-5 grid min-w-0 gap-3 rounded-2xl p-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,.8fr)_minmax(0,.8fr)_auto]"><input type="hidden" name="lang" value={language} /><input type="hidden" name="period" value={period} /><label className="relative min-w-0"><Search className="absolute left-3 top-3.5 size-4 text-slate-500" /><input name="q" defaultValue={scalar(params.q)} placeholder="Buscar Prop Firm" className="tg-filter w-full min-w-0 rounded-xl py-3 pl-10 pr-3 text-sm" /></label><Select name="market" value={market} options={[["all", "Todos los mercados"], ["cfd", "Forex / CFD"], ["futures", "Futures"], ["crypto", "Crypto"]]} /><Select name="sort" value={sort} options={[["total", "Ordenar por total"], ["payouts", "Ordenar por payouts"], ["largest", "Ordenar por mayor"], ["average", "Ordenar por promedio"]]} /><button className="tg-button-gold w-full px-5 py-3 text-sm md:w-auto">Aplicar</button></form><SummaryTable summaries={summaries} language={language} /></section>
  </PublicPageShell>
}

function Select({ name, value, options }: { name: string; value: string; options: Array<[string, string]> }) { return <select name={name} defaultValue={value} className="tg-filter w-full min-w-0 rounded-xl px-3 py-3 text-sm">{options.map(([option, label]) => <option key={option} value={option}>{label}</option>)}</select> }
function scalar(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] ?? '' : value ?? '' }
function sorter(sort: string) { const value = (item: PayoutFirmSummary) => sort === 'payouts' ? item.knownPayoutCount ?? -1 : sort === 'largest' ? item.knownLargestPayout ?? -1 : sort === 'average' ? item.knownAveragePayout ?? -1 : item.displayTotalAmount ?? -1; return (a: PayoutFirmSummary, b: PayoutFirmSummary) => value(b) - value(a) || a.name.localeCompare(b.name, 'es') }
