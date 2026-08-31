'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Status = { firms: number; snapshots: number; latest: string | null }
const supabase = createClient()

export function MondoTradersStatusPanel() {
  const [status, setStatus] = useState<Status>({ firms: 0, snapshots: 0, latest: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    void Promise.all([
      supabase.from('external_platform_mappings').select('platform_id', { count: 'exact' }).eq('provider', 'mondotraders').eq('active', true),
      supabase.from('platform_payout_metrics').select('collected_at', { count: 'exact' }).eq('source_name', 'MondoTraders').eq('source_type', 'third_party_public').eq('verification_level', 'blockchain_external').eq('metric_type', 'payout_summary').eq('is_current', true).in('period_key', ['24h', '7d', '30d', 'all']).order('collected_at', { ascending: false }).limit(1),
    ]).then(([mappings, metrics]) => {
      if (cancelled) return
      const failure = mappings.error ?? metrics.error
      if (failure) setError(failure.message)
      else setStatus({ firms: mappings.count ?? 0, snapshots: metrics.count ?? 0, latest: metrics.data?.[0]?.collected_at ?? null })
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])
  const stale = status.latest ? Date.now() - new Date(status.latest).getTime() > 48 * 60 * 60 * 1000 : false
  return <section className="mb-8 rounded-xl bg-white p-6 shadow"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><h2 className="text-xl font-semibold">MondoTraders · Estado de métricas externas</h2><p className="mt-1 text-sm text-slate-500">Referencia externa separada de los collectors blockchain propios.</p></div><span className={`inline-flex self-start rounded-full px-3 py-1 text-sm font-medium ${!status.latest ? 'bg-slate-100 text-slate-600' : stale ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>{!status.latest ? 'Sin datos' : stale ? 'Desactualizado' : 'Actualizado'}</span></div>{loading ? <p className="mt-5 text-sm text-slate-500">Cargando estado…</p> : <div className="mt-5 grid gap-4 sm:grid-cols-3"><Stat label="Firmas mapeadas" value={status.firms.toLocaleString('es-CO')} /><Stat label="Snapshots current" value={status.snapshots.toLocaleString('es-CO')} /><Stat label="Última sincronización" value={status.latest ? dateTime(status.latest) : '—'} /></div>}<div className="mt-5 rounded-xl border border-dashed p-4 text-sm text-slate-600"><p className="font-medium text-slate-900">Sincronización disponible desde collector local</p><code className="mt-2 block rounded-lg bg-slate-900 px-3 py-2 text-slate-100">npm run collect:mondo</code></div>{error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}</section>
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border bg-slate-50 p-4"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 font-semibold">{value}</p></div> }
function dateTime(value: string) { return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' }).format(new Date(value)) }
