'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { HomeRankings } from '@/lib/home-data'
import { PlatformLogo } from './PlatformLogo'
import { compactMoney } from './public-format'
import { getPublicUi, publicLocale, publicPath, publicUiLanguage } from '@/lib/public-i18n'
import type { PublicLanguage } from '@/lib/public-language'
import { payoutFreshnessCopy } from '@/lib/payout-freshness-copy'
import { PayoutFreshnessNotice } from './PayoutFreshnessNotice'

export function HomePayoutRankings({ rankings, badge, title, subtitle, language }: { rankings: HomeRankings; badge: string; title: string; subtitle: string; language: PublicLanguage }) {
  const t = getPublicUi(language)
  const [period, setPeriod] = useState<'30d' | 'all'>('30d')
  const rows = period === '30d' ? rankings.thirtyDays : rankings.allTime
  if (!rankings.thirtyDays.length && !rankings.allTime.length) return null
  const byAmount = [...rows].sort((a, b) => b.amount - a.amount).slice(0, 5)
  const byCount = [...rows].sort((a, b) => b.payoutCount - a.payoutCount).slice(0, 5)

  return (
    <section className="border-y border-white/8 bg-[#0c1626] py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div><p className="font-mono text-xs uppercase tracking-[.18em] text-[#f7c64b]">{badge}</p><h2 className="mt-3 text-3xl font-bold">{title}</h2><p className="mt-2 text-sm text-slate-400">{subtitle}</p></div>
          <div className="flex rounded-xl border border-white/10 bg-[#111c2e] p-1">
            <PeriodButton active={period === '30d'} onClick={() => setPeriod('30d')}>{t('payout.days30')}</PeriodButton>
            <PeriodButton active={period === 'all'} onClick={() => setPeriod('all')}>{t('payout.history')}</PeriodButton>
          </div>
        </div>
        {rows.length ? <div className="mt-8 grid gap-5 lg:grid-cols-2"><Ranking title={t('payout.highestAmount')} rows={byAmount} metric="amount" language={language} /><Ranking title={t('payout.highestCount')} rows={byCount} metric="count" language={language} /></div> : <p className="mt-8 rounded-2xl border border-white/10 p-8 text-slate-400">{t('payout.noPeriodData')}</p>}
        <p role="note" className="mt-4 rounded-xl border border-amber-300/20 p-3 text-sm text-amber-200">{payoutFreshnessCopy[publicUiLanguage(language)].home}</p>
        <p className="mt-4 text-xs text-slate-500">{t('payout.externalSnapshots')}</p>
      </div>
    </section>
  )
}

function PeriodButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`rounded-lg px-4 py-2 text-sm font-semibold ${active ? 'bg-[#f7c64b] text-slate-950' : 'text-slate-400'}`}>{children}</button>
}

function Ranking({ title, rows, metric, language }: { title: string; rows: HomeRankings['thirtyDays']; metric: 'amount' | 'count'; language: PublicLanguage }) {
  return <div className="rounded-2xl border border-white/10 bg-[#111c2e] p-5"><h3 className="font-bold">{title}</h3><ol className="mt-4 space-y-2">{rows.map((row, index) => <li key={row.platform.id}><Link href={publicPath(`/prop-firms/${row.platform.slug}`, language)} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[.025] p-3 transition hover:border-[#f7c64b]/40"><span className="w-5 font-mono text-xs text-[#f7c64b]">{index + 1}</span><PlatformLogo platform={row.platform} small /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{row.platform.name}</p><PayoutFreshnessNotice summary={{ displayTotalUpdatedAt: row.capturedAt ?? null, displayTotalSourceType: "third_party_public", displayTotalSourceName: "MondoTraders" }} language={language} compact /></div><strong className={metric === 'amount' ? 'font-mono text-emerald-400' : 'font-mono text-white'}>{metric === 'amount' ? compactMoney.format(row.amount) : row.payoutCount.toLocaleString(publicLocale(language))}</strong></Link></li>)}</ol></div>
}
