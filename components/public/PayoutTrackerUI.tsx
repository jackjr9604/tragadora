import Link from 'next/link'
import { ArrowUpRight, Info } from 'lucide-react'
import { payoutPeriods, type PayoutPeriodKey } from '@/lib/payout-periods'
import type { PayoutFirmSummary, VerificationLevel } from '@/lib/payout-tracker'

export function PeriodTabs({ active, basePath, language }: { active: PayoutPeriodKey; basePath: string; language: string }) {
  const publicPeriods = payoutPeriods.filter((period) => period.key !== '365d')
  return <nav aria-label="Periodo de payouts" className="flex flex-wrap gap-2">{publicPeriods.map((period) => <Link key={period.key} href={`${basePath}?lang=${language}&period=${period.key}`} className={`rounded-xl px-4 py-2 text-sm font-semibold ${active === period.key ? 'bg-white text-slate-950' : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`}>{period.key === '24h' ? '24 horas' : period.key === 'all' ? 'Todo el tiempo' : period.label}</Link>)}</nav>
}

export function CoverageBadge({ level }: { level: VerificationLevel | null }) {
  const styles: Record<VerificationLevel, { label: string; className: string }> = {
    verified: { label: 'Verificado por Tradagora', className: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300' },
    tracked_external: { label: 'Fuente externa', className: 'border-cyan-400/25 bg-cyan-400/10 text-cyan-300' },
    blockchain_external: { label: 'Datos externos conocidos', className: 'border-cyan-400/25 bg-cyan-400/10 text-cyan-300' },
    firm_reported: { label: 'Reportado por la firma', className: 'border-amber-300/25 bg-amber-300/10 text-amber-200' },
    unverified: { label: 'Fuente externa', className: 'border-slate-400/25 bg-slate-400/10 text-slate-300' },
  }
  const value = level ? styles[level] : { label: 'Sin total conocido', className: 'border-white/10 bg-white/5 text-slate-400' }
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${value.className}`}>{value.label}</span>
}

export function TrackerLogo({ summary, large = false }: { summary: PayoutFirmSummary; large?: boolean }) {
  const size = large ? 'size-16 rounded-2xl' : 'size-10 rounded-xl'
  if (summary.logoUrl) {
    // Las imágenes son administradas por Supabase y pueden usar hosts dinámicos.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={summary.logoUrl} alt={summary.logoAlt || summary.name} className={`${size} border border-white/10 bg-white object-contain p-1`} />
  }
  return <span className={`${size} inline-flex items-center justify-center border border-white/10 bg-white/5 font-bold text-slate-300`}>{summary.name.slice(0, 2).toUpperCase()}</span>
}

export function SummaryTable({ summaries, language }: { summaries: PayoutFirmSummary[]; language: string }) {
  return <><p className="mb-2 text-xs text-slate-500 md:hidden">Desliza horizontalmente para ver todas las métricas.</p><div className="w-full min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#111c2e]"><div className="w-full overflow-x-auto">
    <table className="w-full min-w-[900px] text-sm">
      <thead className="border-b border-white/10 bg-white/[.025] text-left text-xs uppercase tracking-wider text-slate-500"><tr><th className="p-4">Firma</th><th className="p-4">Total</th><th className="p-4">Payouts</th><th className="p-4">Mayor</th><th className="p-4">Promedio</th><th className="p-4">Acción</th></tr></thead>
      <tbody>{summaries.map((summary) => <tr key={summary.platformId} className="border-b border-white/5 last:border-0 hover:bg-white/[.025]"><td className="p-4"><div className="flex items-center gap-3"><TrackerLogo summary={summary} /><div><p className="font-semibold text-white">{summary.name}</p><p className="mt-1 text-xs text-slate-500">{summary.markets.map(marketLabel).join(' · ') || 'Mercado sin confirmar'}</p></div></div></td><td className="p-4"><MetricValue value={summary.displayTotalAmount} currency={summary.knownCurrency} /></td><td className="p-4 font-mono">{countValue(summary.knownPayoutCount)}</td><td className="p-4"><MetricValue value={summary.knownLargestPayout} currency={summary.knownCurrency} /></td><td className="p-4"><MetricValue value={summary.knownAveragePayout} currency={summary.knownCurrency} /></td><td className="p-4"><Link href={`/payouts/${summary.slug}?lang=${language}&period=${summary.periodKey}`} className="inline-flex items-center gap-1 rounded-lg border border-cyan-300/20 px-3 py-2 font-semibold text-cyan-300">Ver detalle <ArrowUpRight className="size-3.5" /></Link></td></tr>)}</tbody>
    </table>
    {!summaries.length && <p className="p-12 text-center text-slate-400">No encontramos firmas con estos filtros.</p>}
  </div></div></>
}

export function CoverageValue({ summary }: { summary: PayoutFirmSummary }) {
  if (summary.verificationCoveragePercentage === null) return <span className="text-xs text-slate-500">Sin total comparable</span>
  if (summary.verifiedExceedsKnown) return <div><strong className="font-mono text-amber-300">100%+</strong><p className="mt-1 max-w-52 text-xs text-amber-200/70">El volumen verificado supera el último snapshot externo.</p></div>
  return <strong className="font-mono text-cyan-300">{summary.verificationCoveragePercentage.toFixed(1)}%</strong>
}

export function KnownTotalInfo() {
  return <span title="Los datos externos de referencia provienen actualmente de MondoTraders y nunca se suman con el volumen verificado por Tradagora." className="inline-flex cursor-help items-center gap-1"><Info className="size-3.5" /> Referencia externa</span>
}

export function TrendChart({ points }: { points: Array<{ day: string; amount: number; count: number }> }) {
  if (!points.length) return <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-slate-500">Sin datos suficientes para este periodo.</p>
  const max = Math.max(...points.map((point) => point.amount), 1)
  return <div><div className="flex h-56 items-end gap-1 overflow-x-auto border-b border-white/10 pb-2">{points.map((point) => <div key={point.day} title={`${formatDate(point.day)} · ${money(point.amount)} · ${point.count} payouts`} className="group flex h-full min-w-2 flex-1 items-end"><div style={{ height: `${Math.max((point.amount / max) * 100, 2)}%` }} className="w-full rounded-t bg-cyan-400/55 transition group-hover:bg-cyan-300" /></div>)}</div><div className="mt-3 grid grid-cols-[1fr_auto_1fr] gap-2 text-xs text-slate-500"><span>{formatDate(points[0].day)}</span><span className="text-center">Monto verificado por día</span><span className="text-right">{formatDate(points.at(-1)?.day ?? points[0].day)}</span></div></div>
}

export function MetricValue({ value, accent = false, currency = 'USD' }: { value: number | null; accent?: boolean; currency?: string | null }) {
  return value === null ? <span className="text-slate-500">—</span> : <strong className={`font-mono ${accent ? 'text-emerald-400' : 'text-slate-100'}`}>{money(value, currency ?? 'USD')}</strong>
}

function countValue(value: number | null) { return value === null ? <span className="text-xs text-slate-500">Sin datos</span> : value.toLocaleString('es-CO') }
export function money(value: number, currency = 'USD') { return new Intl.NumberFormat('en-US', { style: 'currency', currency, notation: value >= 1_000_000 ? 'compact' : 'standard', maximumFractionDigits: value >= 1_000_000 ? 1 : 0 }).format(value) }
export function formatDate(value: string) { return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: 'America/Bogota' }).format(new Date(value)) }
export function marketLabel(value: string) { return ({ cfd: 'Forex / CFD', futures: 'Futures', crypto: 'Crypto', options: 'Options' } as Record<string, string>)[value] ?? value }
export function sourceTypeLabel(value: string | null) { return ({ tragadora_blockchain: 'Blockchain verificado', tragadora_api: 'API verificada', official_api: 'API oficial', third_party_api: 'API de tercero', official_firm: 'Fuente oficial', third_party_public: 'Fuente pública externa', manual: 'Carga manual' } as Record<string, string>)[value ?? ''] ?? value ?? 'Sin fuente' }
