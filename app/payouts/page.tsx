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
  const summaries = allSummaries
    .filter((item) => !query || item.name.toLocaleLowerCase('es').includes(query))
    .filter((item) => market === 'all' || item.markets.includes(market))
    .sort(sorter(sort))

  return <PublicPageShell payouts={ticker} language={language}>
    <section className="border-b border-white/8 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.13),transparent_38%)]"><div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24"><p className="font-mono text-xs uppercase tracking-[.22em] text-cyan-300">Payout Tracker</p><h1 className="mt-4 max-w-4xl text-4xl font-bold tracking-tight sm:text-6xl">Ranking de payouts de Prop Firms.</h1><p className="mt-6 max-w-3xl text-lg leading-8 text-slate-400">Explora las cifras de payouts de las principales Prop Firms. Los datos de referencia de este listado se obtienen de MondoTraders y pueden consultarse por periodo.</p><div className="mt-8"><PeriodTabs active={period} basePath="/payouts" language={language} /></div></div></section>
    <section className="mx-auto w-full min-w-0 max-w-7xl overflow-hidden px-4 py-12 sm:px-6 lg:px-8 lg:pb-24"><div className="mb-6"><h2 className="text-2xl font-bold">Payouts · {payoutPeriodLabel(period)}</h2><p className="mt-2 max-w-3xl text-slate-400">Estas cifras son referencias externas y no representan verificaciones propias de Tradagora. Consulta cada firma para ver el análisis detallado.</p></div><form className="mb-5 grid min-w-0 gap-3 rounded-2xl border border-white/10 bg-[#111c2e] p-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,.8fr)_minmax(0,.8fr)_auto]"><input type="hidden" name="lang" value={language} /><input type="hidden" name="period" value={period} /><label className="relative min-w-0"><Search className="absolute left-3 top-3.5 size-4 text-slate-500" /><input name="q" defaultValue={scalar(params.q)} placeholder="Buscar Prop Firm" className="w-full min-w-0 rounded-xl border border-white/10 bg-[#09111f] py-3 pl-10 pr-3 text-sm outline-none focus:border-cyan-400/50" /></label><Select name="market" value={market} options={[["all", "Todos los mercados"], ["cfd", "Forex / CFD"], ["futures", "Futures"], ["crypto", "Crypto"]]} /><Select name="sort" value={sort} options={[["total", "Ordenar por total"], ["payouts", "Ordenar por payouts"], ["largest", "Ordenar por mayor"], ["average", "Ordenar por promedio"]]} /><button className="w-full rounded-xl bg-[#f7c64b] px-5 py-3 text-sm font-bold text-slate-950 md:w-auto">Aplicar</button></form><SummaryTable summaries={summaries} language={language} /></section>
  </PublicPageShell>
}

function Select({ name, value, options }: { name: string; value: string; options: Array<[string, string]> }) { return <select name={name} defaultValue={value} className="w-full min-w-0 rounded-xl border border-white/10 bg-[#09111f] px-3 py-3 text-sm">{options.map(([option, label]) => <option key={option} value={option}>{label}</option>)}</select> }
function scalar(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] ?? '' : value ?? '' }
function sorter(sort: string) { const value = (item: PayoutFirmSummary) => sort === 'payouts' ? item.knownPayoutCount ?? -1 : sort === 'largest' ? item.knownLargestPayout ?? -1 : sort === 'average' ? item.knownAveragePayout ?? -1 : item.displayTotalAmount ?? -1; return (a: PayoutFirmSummary, b: PayoutFirmSummary) => value(b) - value(a) || a.name.localeCompare(b.name, 'es') }
