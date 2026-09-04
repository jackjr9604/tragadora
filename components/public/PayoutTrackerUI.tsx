import Link from 'next/link'
import { ChevronRight, Info } from 'lucide-react'
import { payoutPeriods, type PayoutPeriodKey } from '@/lib/payout-periods'
import type { PayoutFirmSummary, VerificationLevel } from '@/lib/payout-tracker'

export function PeriodTabs({ active, basePath, language, detail = false, extraParams }: { active: PayoutPeriodKey; basePath: string; language: string; detail?: boolean; extraParams?: Record<string, string> }) {
  const publicPeriods = payoutPeriods.filter((period) => detail ? period.key !== '24h' : period.key !== '365d')
  return <nav aria-label="Periodo de payouts" className="flex flex-wrap gap-2">{publicPeriods.map((period) => {
    const query = new URLSearchParams({ lang: language, period: period.key, ...extraParams })
    return <Link key={period.key} href={`${basePath}?${query}`} aria-current={active === period.key ? 'page' : undefined} className={`relative rounded-xl border px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c454] ${active === period.key ? 'border-amber-300/35 bg-[#152238] text-[#f4cf72] shadow-[inset_0_-2px_0_#f0c454,0_0_18px_rgba(200,148,36,.08)]' : 'border-white/10 bg-white/[.035] text-slate-400 hover:border-amber-300/20 hover:text-white'}`}>{period.key === '24h' ? '24 horas' : period.key === 'all' ? 'Todo el tiempo' : period.label}</Link>
  })}</nav>
}

export function CoverageBadge({ level }: { level: VerificationLevel | null }) {
  const styles: Record<VerificationLevel, { label: string; className: string }> = {
    verified: { label: 'Verificado por Tradagora', className: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300' },
    tracked_external: { label: 'Fuente externa', className: 'border-white/10 bg-white/5 text-slate-300' },
    blockchain_external: { label: 'Datos externos conocidos', className: 'border-white/10 bg-white/5 text-slate-300' },
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
  return <div>
    <div className="hidden grid-cols-[minmax(250px,1.45fr)_minmax(120px,.8fr)_minmax(100px,.65fr)_minmax(120px,.75fr)_minmax(120px,.75fr)_44px] gap-4 px-5 pb-3 text-[11px] font-semibold uppercase tracking-[.14em] text-slate-500 lg:grid"><span>Firma</span><span>Total</span><span>Payouts</span><span>Mayor</span><span>Promedio</span><span className="sr-only">Acción</span></div>
    <div className="hidden space-y-2 lg:block">{summaries.map((summary) => <PayoutDesktopRow key={summary.platformId} summary={summary} language={language} />)}</div>
    <div className="space-y-3 lg:hidden">{summaries.map((summary) => <PayoutMobileCard key={summary.platformId} summary={summary} language={language} />)}</div>
    {!summaries.length && <p className="tg-empty rounded-2xl p-12 text-center text-slate-400">No encontramos firmas con estos filtros.</p>}
  </div>
}

function PayoutDesktopRow({ summary, language }: { summary: PayoutFirmSummary; language: string }) {
  return <Link href={`/payouts/${summary.slug}?lang=${language}&period=${summary.periodKey}`} aria-label={`Ver payouts de ${summary.name}`} className="group grid min-h-20 grid-cols-[minmax(250px,1.45fr)_minmax(120px,.8fr)_minmax(100px,.65fr)_minmax(120px,.75fr)_minmax(120px,.75fr)_44px] items-center gap-4 rounded-xl border border-amber-300/20 bg-[linear-gradient(105deg,rgba(15,31,50,.92),rgba(8,19,32,.96))] px-5 py-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-amber-300/45 hover:shadow-[0_12px_30px_rgba(0,0,0,.22),0_0_20px_rgba(200,148,36,.06)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c454]">
    <FirmIdentity summary={summary} /><MetricValue value={summary.displayTotalAmount} currency={summary.knownCurrency} accent /><span className="font-mono text-slate-100">{countValue(summary.knownPayoutCount)}</span><MetricValue value={summary.knownLargestPayout} currency={summary.knownCurrency} /><MetricValue value={summary.knownAveragePayout} currency={summary.knownCurrency} /><ChevronRight className="size-5 text-[#f0c454] transition-transform group-hover:translate-x-1" />
  </Link>
}

function PayoutMobileCard({ summary, language }: { summary: PayoutFirmSummary; language: string }) {
  return <Link href={`/payouts/${summary.slug}?lang=${language}&period=${summary.periodKey}`} aria-label={`Ver payouts de ${summary.name}`} className="group block rounded-2xl border border-amber-300/20 bg-[linear-gradient(145deg,rgba(15,31,50,.94),rgba(8,19,32,.97))] p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c454]">
    <div className="flex items-start gap-3"><FirmIdentity summary={summary} /><ChevronRight className="ml-auto mt-2 size-5 shrink-0 text-[#f0c454]" /></div><div className="mt-5 border-t border-white/8 pt-4"><p className="text-[10px] uppercase tracking-[.14em] text-slate-500">Total</p><div className="mt-1 text-2xl"><MetricValue value={summary.displayTotalAmount} currency={summary.knownCurrency} accent /></div></div><div className="mt-4 grid grid-cols-2 gap-4"><MobileMetric label="Payouts">{countValue(summary.knownPayoutCount)}</MobileMetric><MobileMetric label="Mayor"><MetricValue value={summary.knownLargestPayout} currency={summary.knownCurrency} /></MobileMetric><MobileMetric label="Promedio"><MetricValue value={summary.knownAveragePayout} currency={summary.knownCurrency} /></MobileMetric></div>
  </Link>
}

function FirmIdentity({ summary }: { summary: PayoutFirmSummary }) { return <div className="flex min-w-0 items-center gap-3"><TrackerLogo summary={summary} /><div className="min-w-0"><p className="truncate font-semibold text-white">{summary.name}</p><p className="mt-1 truncate text-xs text-slate-500">{summary.markets.map(marketLabel).join(' · ') || 'Mercado sin confirmar'}</p></div></div> }
function MobileMetric({ label, children }: { label: string; children: React.ReactNode }) { return <div><p className="text-[10px] uppercase tracking-[.14em] text-slate-500">{label}</p><div className="mt-1 font-mono text-slate-100">{children}</div></div> }

export function CoverageValue({ summary }: { summary: PayoutFirmSummary }) {
  if (summary.verificationCoveragePercentage === null) return <span className="text-xs text-slate-500">Sin total comparable</span>
  if (summary.verifiedExceedsKnown) return <div><strong className="font-mono text-amber-300">100%+</strong><p className="mt-1 max-w-52 text-xs text-amber-200/70">El volumen verificado supera el último snapshot externo.</p></div>
  return <strong className="font-mono text-slate-100">{summary.verificationCoveragePercentage.toFixed(1)}%</strong>
}

export function KnownTotalInfo() { return <span title="Los datos externos de referencia se mantienen separados del volumen verificado directamente por Tradagora." className="inline-flex cursor-help items-center gap-1"><Info className="size-3.5" /> Referencia externa</span> }

export function TrendChart({ points }: { points: Array<{ day: string; amount: number; count: number }> }) {
  if (!points.length) return <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-slate-500">Sin datos suficientes para este periodo.</p>
  const max = Math.max(...points.map((point) => point.amount), 1)
  return <div><div className="flex h-56 items-end gap-1 overflow-x-auto border-b border-white/10 pb-2">{points.map((point) => <div key={point.day} title={`${formatDate(point.day)} · ${money(point.amount)} · ${point.count} payouts`} className="group flex h-full min-w-2 flex-1 items-end"><div style={{ height: `${Math.max((point.amount / max) * 100, 2)}%` }} className="w-full rounded-t bg-cyan-400/55 transition group-hover:bg-cyan-300" /></div>)}</div><div className="mt-3 grid grid-cols-[1fr_auto_1fr] gap-2 text-xs text-slate-500"><span>{formatDate(points[0].day)}</span><span className="text-center">Actividad diaria registrada</span><span className="text-right">{formatDate(points.at(-1)?.day ?? points[0].day)}</span></div></div>
}

export function MetricValue({ value, accent = false, currency = 'USD' }: { value: number | null; accent?: boolean; currency?: string | null }) { return value === null ? <span className="text-slate-500">—</span> : <strong className={`font-mono ${accent ? 'text-emerald-400' : 'text-slate-100'}`}>{money(value, currency ?? 'USD')}</strong> }
function countValue(value: number | null) { return value === null ? <span className="text-xs text-slate-500">Sin datos</span> : value.toLocaleString('es-CO') }
export function money(value: number, currency = 'USD') { return new Intl.NumberFormat('en-US', { style: 'currency', currency, notation: value >= 1_000_000 ? 'compact' : 'standard', maximumFractionDigits: value >= 1_000_000 ? 1 : 0 }).format(value) }
export function formatDate(value: string) { return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: 'America/Bogota' }).format(new Date(value)) }
export function marketLabel(value: string) { return ({ cfd: 'Forex / CFD', futures: 'Futures', crypto: 'Crypto', options: 'Options' } as Record<string, string>)[value] ?? value }
export function sourceTypeLabel(value: string | null) { return ({ tragadora_blockchain: 'Blockchain verificado', tragadora_api: 'API verificada', official_api: 'API oficial', third_party_api: 'API de tercero', official_firm: 'Fuente oficial', third_party_public: 'Fuente pública externa', manual: 'Carga manual' } as Record<string, string>)[value ?? ''] ?? value ?? 'Sin fuente' }
