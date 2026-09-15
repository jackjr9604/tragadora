'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { HomeRankings } from '@/lib/home-data'
import { PlatformLogo } from './PlatformLogo'
import { compactMoney } from './public-format'

export function HomePayoutRankings({ rankings }: { rankings: HomeRankings }) {
  const [period, setPeriod] = useState<'30d' | 'all'>('30d')
  const rows = period === '30d' ? rankings.thirtyDays : rankings.allTime
  if (!rankings.thirtyDays.length && !rankings.allTime.length) return null
  const byAmount = [...rows].sort((a, b) => b.amount - a.amount).slice(0, 5)
  const byCount = [...rows].sort((a, b) => b.payoutCount - a.payoutCount).slice(0, 5)

  return (
    <section className="border-y border-white/8 bg-[#0c1626] py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div><p className="font-mono text-xs uppercase tracking-[.18em] text-[#f7c64b]">Datos agregados</p><h2 className="mt-3 text-3xl font-bold">Rankings de payouts reportados</h2><p className="mt-2 text-sm text-slate-400">Mondo publica métricas agregadas por firma y período; no son payouts verificados individualmente.</p></div>
          <div className="flex rounded-xl border border-white/10 bg-[#111c2e] p-1">
            <PeriodButton active={period === '30d'} onClick={() => setPeriod('30d')}>30 días</PeriodButton>
            <PeriodButton active={period === 'all'} onClick={() => setPeriod('all')}>Histórico</PeriodButton>
          </div>
        </div>
        {rows.length ? <div className="mt-8 grid gap-5 lg:grid-cols-2"><Ranking title="Mayor monto pagado" rows={byAmount} metric="amount" /><Ranking title="Mayor número de payouts" rows={byCount} metric="count" /></div> : <p className="mt-8 rounded-2xl border border-white/10 p-8 text-slate-400">Sin datos disponibles para este período.</p>}
        <p className="mt-4 text-xs text-slate-500">Fuente: Mondo · snapshots actuales del período seleccionado.</p>
      </div>
    </section>
  )
}

function PeriodButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`rounded-lg px-4 py-2 text-sm font-semibold ${active ? 'bg-[#f7c64b] text-slate-950' : 'text-slate-400'}`}>{children}</button>
}

function Ranking({ title, rows, metric }: { title: string; rows: HomeRankings['thirtyDays']; metric: 'amount' | 'count' }) {
  return <div className="rounded-2xl border border-white/10 bg-[#111c2e] p-5"><h3 className="font-bold">{title}</h3><ol className="mt-4 space-y-2">{rows.map((row, index) => <li key={row.platform.id}><Link href={`/prop-firms/${row.platform.slug}`} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[.025] p-3 transition hover:border-[#f7c64b]/40"><span className="w-5 font-mono text-xs text-[#f7c64b]">{index + 1}</span><PlatformLogo platform={row.platform} small /><span className="min-w-0 flex-1 truncate text-sm font-semibold">{row.platform.name}</span><strong className={metric === 'amount' ? 'font-mono text-emerald-400' : 'font-mono text-white'}>{metric === 'amount' ? compactMoney.format(row.amount) : row.payoutCount.toLocaleString('es-CO')}</strong></Link></li>)}</ol></div>
}
