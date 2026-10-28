import { payoutFreshness, type PayoutFreshnessInput } from '@/lib/payout-freshness'
import { payoutFreshnessCopy } from '@/lib/payout-freshness-copy'
import { publicLocale, publicUiLanguage } from '@/lib/public-i18n'

export function PayoutFreshnessNotice({ summary, language, compact = false }: {
  summary: PayoutFreshnessInput & { displayTotalSourceName?: string | null }
  language: string; compact?: boolean
}) {
  const state = payoutFreshness(summary)
  const copy = payoutFreshnessCopy[publicUiLanguage(language)]
  const format = (value: string | null) => value
    ? <time dateTime={value}>{new Intl.DateTimeFormat(publicLocale(language), { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' }).format(new Date(value))}</time>
    : copy.unknown
  return <div role="note" aria-label={copy.title} className={compact ? 'mt-2 space-y-1 text-[11px] leading-4 text-slate-400' : 'rounded-xl border border-amber-300/25 bg-amber-300/5 p-4 text-sm leading-6 text-slate-300'}>
    {!compact && <p className="font-semibold text-white">{copy.title}</p>}
    {summary.displayTotalSourceName && <p>{copy.source}: {summary.displayTotalSourceName}</p>}
    <p>{copy.updated}: {format(state.updatedAt)}</p>
    <p>{copy.checked}: {format(state.checkedAt)}</p>
    {(state.stale || state.unknown) && <p className="font-medium text-amber-200">{state.stale ? copy.stale : copy.missing}</p>}
    {!compact && <><p className="mt-2">{copy.explanation}</p><p className="mt-1 text-xs text-slate-400">{copy.scope}</p></>}
  </div>
}
