import Link from 'next/link'
import { ChevronRight, Info } from 'lucide-react'
import { payoutPeriodLabel, payoutPeriods, type PayoutPeriodKey } from '@/lib/payout-periods'
import type { PayoutFirmSummary, VerificationLevel } from '@/lib/payout-tracker'
import { firmProfileText, getPublicUi, publicFirmProfileCopy, publicLocale, publicUiLanguage } from '@/lib/public-i18n'

export function PeriodTabs({ active, basePath, language, detail = false, extraParams }: { active: PayoutPeriodKey; basePath: string; language: string; detail?: boolean; extraParams?: Record<string, string> }) {
  const t = getPublicUi(language)
  const publicPeriods = payoutPeriods.filter((period) => detail ? period.key !== '24h' : period.key !== '365d')
  return <nav aria-label={t('payout.period')} className="flex flex-wrap gap-2">{publicPeriods.map((period) => {
    const query = new URLSearchParams({ lang: language, period: period.key, ...extraParams })
    return <Link key={period.key} href={`${basePath}?${query}`} aria-current={active === period.key ? 'page' : undefined} className={`relative rounded-xl border px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c454] ${active === period.key ? 'border-amber-300/35 bg-[#152238] text-[#f4cf72] shadow-[inset_0_-2px_0_#f0c454,0_0_18px_rgba(200,148,36,.08)]' : 'border-white/10 bg-white/[.035] text-slate-400 hover:border-amber-300/20 hover:text-white'}`}>{payoutPeriodLabel(period.key, language)}</Link>
  })}</nav>
}

export function CoverageBadge({ level, language = 'es' }: { level: VerificationLevel | null; language?: string }) {
  const t = getPublicUi(language)
  const styles: Record<VerificationLevel, { label: string; className: string }> = {
    verified: { label: t('payout.verified'), className: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300' },
    tracked_external: { label: t('payout.external'), className: 'border-white/10 bg-white/5 text-slate-300' },
    blockchain_external: { label: t('payout.externalKnown'), className: 'border-white/10 bg-white/5 text-slate-300' },
    firm_reported: { label: t('payout.firmReported'), className: 'border-amber-300/25 bg-amber-300/10 text-amber-200' },
    unverified: { label: t('payout.external'), className: 'border-slate-400/25 bg-slate-400/10 text-slate-300' },
  }
  const value = level ? styles[level] : { label: t('payout.noKnownTotal'), className: 'border-white/10 bg-white/5 text-slate-400' }
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
  const t = getPublicUi(language)
  return <div>
    <div className="tg-data-header tg-data-grid hidden grid-cols-[minmax(250px,1.45fr)_minmax(120px,.8fr)_minmax(100px,.65fr)_minmax(120px,.75fr)_minmax(120px,.75fr)_44px] gap-4 px-5 py-3 text-[11px] font-semibold uppercase tracking-[.14em] text-slate-500 lg:grid"><span>{t('directory.firm')}</span><span>{t('payout.total')}</span><span>{t('payout.count')}</span><span>{t('payout.largest')}</span><span>{t('payout.average')}</span><span className="sr-only">{t('a11y.action')}</span></div>
    <div className="mt-2 hidden space-y-2 lg:block">{summaries.map((summary) => <PayoutDesktopRow key={summary.platformId} summary={summary} language={language} />)}</div>
    <div className="space-y-3 lg:hidden">{summaries.map((summary) => <PayoutMobileCard key={summary.platformId} summary={summary} language={language} />)}</div>
    {!summaries.length && <p className="tg-empty rounded-2xl p-12 text-center text-slate-400">{t('payout.noFilterResults')}</p>}
  </div>
}

function PayoutDesktopRow({ summary, language }: { summary: PayoutFirmSummary; language: string }) {
  const t = getPublicUi(language)
  return <Link href={`/payouts/${summary.slug}?lang=${language}&period=${summary.periodKey}`} aria-label={t('a11y.viewPayouts', { name: summary.name })} className="tg-data-grid group grid min-h-20 grid-cols-[minmax(250px,1.45fr)_minmax(120px,.8fr)_minmax(100px,.65fr)_minmax(120px,.75fr)_minmax(120px,.75fr)_44px] items-center gap-4 rounded-xl border border-amber-300/20 bg-[linear-gradient(105deg,rgba(15,31,50,.92),rgba(8,19,32,.96))] px-5 py-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-amber-300/45 hover:shadow-[0_12px_30px_rgba(0,0,0,.22),0_0_20px_rgba(200,148,36,.06)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c454]">
    <FirmIdentity summary={summary} language={language} /><MetricValue value={summary.displayTotalAmount} currency={summary.knownCurrency} language={language} accent /><span className="font-mono text-slate-100">{countValue(summary.knownPayoutCount, language)}</span><MetricValue value={summary.knownLargestPayout} currency={summary.knownCurrency} language={language} /><MetricValue value={summary.knownAveragePayout} currency={summary.knownCurrency} language={language} /><ChevronRight className="size-5 text-[#f0c454] transition-transform group-hover:translate-x-1" />
  </Link>
}

function PayoutMobileCard({ summary, language }: { summary: PayoutFirmSummary; language: string }) {
  const t = getPublicUi(language)
  return <Link href={`/payouts/${summary.slug}?lang=${language}&period=${summary.periodKey}`} aria-label={t('a11y.viewPayouts', { name: summary.name })} className="group block rounded-2xl border border-amber-300/20 bg-[linear-gradient(145deg,rgba(15,31,50,.94),rgba(8,19,32,.97))] p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c454]">
    <div className="flex items-start gap-3"><FirmIdentity summary={summary} language={language} /><ChevronRight className="ml-auto mt-2 size-5 shrink-0 text-[#f0c454]" /></div><div className="mt-5 border-t border-white/8 pt-4"><p className="text-[10px] uppercase tracking-[.14em] text-slate-500">{t('payout.total')}</p><div className="mt-1 text-2xl"><MetricValue value={summary.displayTotalAmount} currency={summary.knownCurrency} language={language} accent /></div></div><div className="mt-4 grid grid-cols-2 gap-4"><MobileMetric label={t('payout.count')}>{countValue(summary.knownPayoutCount, language)}</MobileMetric><MobileMetric label={t('payout.largest')}><MetricValue value={summary.knownLargestPayout} currency={summary.knownCurrency} language={language} /></MobileMetric><MobileMetric label={t('payout.average')}><MetricValue value={summary.knownAveragePayout} currency={summary.knownCurrency} language={language} /></MobileMetric></div>
  </Link>
}

function FirmIdentity({ summary, language }: { summary: PayoutFirmSummary; language: string }) { const t = getPublicUi(language); return <div className="flex min-w-0 items-center gap-3"><TrackerLogo summary={summary} /><div className="min-w-0"><p className="truncate font-semibold text-white">{summary.name}</p><p className="mt-1 truncate text-xs text-slate-500">{summary.markets.map((market) => marketLabel(market, language)).join(' · ') || t('market.unconfirmed')}</p></div></div> }
function MobileMetric({ label, children }: { label: string; children: React.ReactNode }) { return <div><p className="text-[10px] uppercase tracking-[.14em] text-slate-500">{label}</p><div className="mt-1 font-mono text-slate-100">{children}</div></div> }

export function CoverageValue({ summary, language = 'es' }: { summary: PayoutFirmSummary; language?: string }) {
  const t = getPublicUi(language)
  if (summary.verificationCoveragePercentage === null) return <span className="text-xs text-slate-500">{t('payout.noComparableTotal')}</span>
  if (summary.verifiedExceedsKnown) return <div><strong className="font-mono text-amber-300">100%+</strong><p className="mt-1 max-w-52 text-xs text-amber-200/70">{t('payout.exceedsKnown')}</p></div>
  return <strong className="font-mono text-slate-100">{summary.verificationCoveragePercentage.toFixed(1)}%</strong>
}

export function KnownTotalInfo({ language = 'es' }: { language?: string }) { const t = getPublicUi(language); return <span title={t('payout.externalReferenceHelp')} className="inline-flex cursor-help items-center gap-1"><Info className="size-3.5" /> {t('payout.externalReference')}</span> }

export function TrendChart({ points, language = 'es' }: { points: Array<{ day: string; amount: number; count: number }>; language?: string }) {
  const t = getPublicUi(language)
  if (!points.length) return <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-slate-500">{t('payout.insufficientData')}</p>
  const max = Math.max(...points.map((point) => point.amount), 1)
  const copy = publicFirmProfileCopy[publicUiLanguage(language)]
  return <div><div className="flex h-56 items-end gap-1 overflow-x-auto border-b border-white/10 pb-2">{points.map((point) => <div key={point.day} title={`${formatDate(point.day, language)} · ${money(point.amount, 'USD', language)} · ${firmProfileText(point.count === 1 ? copy.payoutPoint : copy.payoutPoints, { count: point.count })}`} className="group flex h-full min-w-2 flex-1 items-end"><div style={{ height: `${Math.max((point.amount / max) * 100, 2)}%` }} className="w-full rounded-t bg-cyan-400/55 transition group-hover:bg-cyan-300" /></div>)}</div><div className="mt-3 grid grid-cols-[1fr_auto_1fr] gap-2 text-xs text-slate-500"><span>{formatDate(points[0].day, language)}</span><span className="text-center">{t('payout.dailyActivity')}</span><span className="text-right">{formatDate(points.at(-1)?.day ?? points[0].day, language)}</span></div></div>
}

export function MetricValue({ value, accent = false, currency = 'USD', language = 'es' }: { value: number | null; accent?: boolean; currency?: string | null; language?: string }) { return value === null ? <span className="text-slate-500">—</span> : <strong className={`font-mono ${accent ? 'text-emerald-400' : 'text-slate-100'}`}>{money(value, currency ?? 'USD', language)}</strong> }
function countValue(value: number | null, language: string) { return value === null ? <span className="text-xs text-slate-500">{getPublicUi(language)('common.noData')}</span> : value.toLocaleString(publicLocale(language)) }
export function money(value: number, currency = 'USD', language = 'es') { return new Intl.NumberFormat(publicLocale(language), { style: 'currency', currency, notation: value >= 1_000_000 ? 'compact' : 'standard', maximumFractionDigits: value >= 1_000_000 ? 1 : 0 }).format(value) }
export function formatDate(value: string, language = 'es') { return new Intl.DateTimeFormat(publicLocale(language), { dateStyle: 'medium', timeZone: 'America/Bogota' }).format(new Date(value)) }
export function marketLabel(value: string, languageOrIndex: string | number = 'es') { const language = typeof languageOrIndex === 'string' ? languageOrIndex : 'es'; return publicFirmProfileCopy[publicUiLanguage(language)].marketsMap[value as keyof typeof publicFirmProfileCopy.es.marketsMap] ?? value }
export function sourceTypeLabel(value: string | null, language = 'es') { const t = getPublicUi(language); return ({ tragadora_blockchain: t('payout.source.blockchain'), tragadora_api: t('payout.source.verifiedApi'), official_api: t('payout.source.officialApi'), third_party_api: t('payout.source.thirdPartyApi'), official_firm: t('payout.source.officialFirm'), third_party_public: t('payout.source.externalPublic'), manual: t('payout.source.manual') } as Record<string, string>)[value ?? ''] ?? value ?? t('payout.noSource') }
