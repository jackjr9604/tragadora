'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

type PeriodKey = '24h' | '7d' | '30d' | 'all'
type Snapshot = {
  id: string
  period_key: PeriodKey
  amount: number | null
  payout_count: number | null
  largest_payout: number | null
  average_payout: number | null
  median_time_minutes: number | null
  currency: string
  collected_at: string
}

const periods: Array<{ key: PeriodKey; label: string }> = [
  { key: '24h', label: '24 h' },
  { key: '7d', label: '7 días' },
  { key: '30d', label: '30 días' },
  { key: 'all', label: 'All Time' },
]
const supabase = createClient()

export function MondoTradersMetricsPanel({ platformId }: { platformId: string }) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void supabase.from('platform_payout_metrics')
      .select('id, period_key, amount, payout_count, largest_payout, average_payout, median_time_minutes, currency, collected_at')
      .eq('platform_id', platformId)
      .eq('source_name', 'MondoTraders')
      .eq('source_type', 'third_party_public')
      .eq('verification_level', 'blockchain_external')
      .eq('metric_type', 'payout_summary')
      .eq('is_current', true)
      .in('period_key', periods.map((period) => period.key))
      .order('collected_at', { ascending: false })
      .then((result) => {
        if (cancelled) return
        if (result.error) setError(result.error.message)
        else setSnapshots((result.data ?? []) as Snapshot[])
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [platformId])

  const byPeriod = useMemo(() => new Map(snapshots.map((snapshot) => [snapshot.period_key, snapshot])), [snapshots])
  const latest = snapshots.reduce<string | null>((current, snapshot) => !current || snapshot.collected_at > current ? snapshot.collected_at : current, null)

  if (loading) return <p className="text-sm text-slate-500">Cargando métricas MondoTraders…</p>
  return <div className="space-y-5">
    <div className="rounded-xl border bg-slate-50 p-4"><p className="text-sm text-slate-500">Última sincronización Mondo</p><p className="mt-1 font-semibold">{latest ? dateTime(latest) : 'Sin datos'}</p></div>
    <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><Th>Periodo</Th><Th>Total pagado</Th><Th>Payouts</Th><Th>Mayor payout</Th><Th>Promedio</Th><Th>Tiempo de payout</Th><Th>Capturado</Th><Th>Estado</Th></tr></thead><tbody>{periods.map((period) => { const snapshot = byPeriod.get(period.key); return <tr key={period.key} className="border-t"><Td strong>{period.label}</Td><Td>{money(snapshot?.amount, snapshot?.currency)}</Td><Td>{count(snapshot?.payout_count)}</Td><Td>{money(snapshot?.largest_payout, snapshot?.currency)}</Td><Td>{money(snapshot?.average_payout, snapshot?.currency)}</Td><Td>{duration(snapshot?.median_time_minutes)}</Td><Td>{snapshot ? dateTime(snapshot.collected_at) : '—'}</Td><Td><Status collectedAt={snapshot?.collected_at} /></Td></tr> })}</tbody></table></div>
    <div className="rounded-xl border border-dashed p-4 text-sm text-slate-600"><p className="font-medium text-slate-900">Sincronización disponible desde collector local</p><code className="mt-2 block rounded-lg bg-slate-900 px-3 py-2 text-slate-100">npm run collect:mondo</code></div>
    {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
  </div>
}

function Status({ collectedAt }: { collectedAt?: string }) { if (!collectedAt) return <Badge tone="neutral">Sin datos</Badge>; return Date.now() - new Date(collectedAt).getTime() > 48 * 60 * 60 * 1000 ? <Badge tone="warning">Desactualizado</Badge> : <Badge tone="success">Actualizado</Badge> }
function Badge({ children, tone }: { children: ReactNode; tone: 'neutral' | 'warning' | 'success' }) { const style = tone === 'warning' ? 'bg-amber-100 text-amber-800' : tone === 'success' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'; return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${style}`}>{children}</span> }
function Th({ children }: { children: ReactNode }) { return <th className="whitespace-nowrap p-3">{children}</th> }
function Td({ children, strong = false }: { children: ReactNode; strong?: boolean }) { return <td className={`whitespace-nowrap p-3 ${strong ? 'font-semibold' : ''}`}>{children}</td> }
function money(value: number | null | undefined, currency = 'USD') { return value == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 0 }).format(value) }
function count(value: number | null | undefined) { return value == null ? '—' : value.toLocaleString('es-CO') }
function duration(value: number | null | undefined) { if (value == null) return '—'; if (value < 60) return `${value} min`; return `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(value / 60)} h` }
function dateTime(value: string) { return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' }).format(new Date(value)) }
