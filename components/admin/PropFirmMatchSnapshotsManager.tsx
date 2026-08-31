'use client'

import { FormEvent, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

type PeriodKey = '24h' | '7d' | '30d' | '365d' | 'all'
type Snapshot = {
  id: string
  period_key: PeriodKey
  amount: number | null
  payout_count: number | null
  largest_payout: number | null
  average_payout: number | null
  median_time_minutes: number | null
  currency: string
  source_url: string | null
  collected_at: string
  raw_data: Record<string, unknown> | null
}
type FormState = {
  amount: string
  payoutCount: string
  largestPayout: string
  averagePayout: string
  medianTimeMinutes: string
  currency: string
  sourceUrl: string
  capturedAt: string
}

const periods: Array<{ key: PeriodKey; label: string }> = [
  { key: '24h', label: '24 h' },
  { key: '7d', label: '7 días' },
  { key: '30d', label: '30 días' },
  { key: '365d', label: '365 días' },
  { key: 'all', label: 'All Time' },
]
const FALLBACK_URL = 'https://propfirmmatch.com/payouts'
const supabase = createClient()

export function PropFirmMatchSnapshotsManager({ platformId }: { platformId: string }) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [sourceUrl, setSourceUrl] = useState(FALLBACK_URL)
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey | null>(null)
  const [form, setForm] = useState<FormState>(() => emptyForm(FALLBACK_URL))
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false)
  const [error, setError] = useState(''), [message, setMessage] = useState('')
  const byPeriod = useMemo(() => new Map(snapshots.map((snapshot) => [snapshot.period_key, snapshot])), [snapshots])

  useEffect(() => { void load() }, [platformId])

  async function load() {
    setLoading(true)
    const [metricsResult, mappingResult] = await Promise.all([
      supabase.from('platform_payout_metrics').select('id, period_key, amount, payout_count, largest_payout, average_payout, median_time_minutes, currency, source_url, collected_at, raw_data').eq('platform_id', platformId).eq('metric_type', 'payout_summary').eq('source_type', 'third_party_public').eq('source_name', 'Prop Firm Match').eq('is_current', true),
      supabase.from('external_platform_mappings').select('external_url').eq('platform_id', platformId).eq('provider', 'propfirmmatch').eq('active', true).maybeSingle(),
    ])
    if (metricsResult.error) setError(friendlyMigrationError(metricsResult.error.message))
    else setSnapshots((metricsResult.data ?? []) as Snapshot[])
    const mappedUrl = mappingResult.data?.external_url || FALLBACK_URL
    setSourceUrl(mappedUrl)
    setLoading(false)
  }

  function openForm(period: PeriodKey) {
    const current = byPeriod.get(period)
    setSelectedPeriod(period)
    setError(''); setMessage('')
    setForm(current ? formFromSnapshot(current, sourceUrl) : emptyForm(sourceUrl))
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedPeriod) return
    setSaving(true); setError(''); setMessage('')
    const amount = requiredNumber(form.amount), payoutCount = requiredInteger(form.payoutCount)
    const largestPayout = requiredNumber(form.largestPayout), averagePayout = requiredNumber(form.averagePayout)
    const medianTimeMinutes = requiredNumber(form.medianTimeMinutes)
    const values = [amount, payoutCount, largestPayout, averagePayout, medianTimeMinutes]
    if (values.some((value) => !Number.isFinite(value) || value < 0)) {
      setError('Todas las métricas deben ser números mayores o iguales a cero.'); setSaving(false); return
    }
    if (amount === 0 && payoutCount === 0 && !window.confirm('Confirma que Prop Firm Match muestra explícitamente cero payouts para este periodo. Una ausencia de datos no debe guardarse como cero.')) {
      setSaving(false); return
    }
    if (payoutCount > 0) {
      const calculatedAverage = amount / payoutCount
      const difference = Math.abs(averagePayout - calculatedAverage)
      const importantDifference = difference > Math.max(1, calculatedAverage * 0.005)
      if (importantDifference && !window.confirm(`El promedio ingresado (${averagePayout}) difiere de amount / payout_count (${calculatedAverage.toFixed(2)}). ¿Guardar de todas formas por redondeo de PFM?`)) {
        setSaving(false); return
      }
    }

    const capturedAt = new Date(form.capturedAt).toISOString()
    const result = await supabase.from('platform_payout_metrics').insert({
      platform_id: platformId,
      metric_type: 'payout_summary',
      period_key: selectedPeriod,
      amount,
      payout_count: payoutCount,
      largest_payout: largestPayout,
      average_payout: averagePayout,
      median_time_minutes: medianTimeMinutes,
      currency: form.currency.trim().toUpperCase() || 'USD',
      source_type: 'third_party_public',
      source_name: 'Prop Firm Match',
      source_url: form.sourceUrl.trim() || sourceUrl,
      verification_level: 'tracked_external',
      collected_at: capturedAt,
      is_current: true,
      raw_data: { provider: 'propfirmmatch', captureMethod: 'manual', capturedAt, periodKey: selectedPeriod, enteredByAdmin: true },
    })
    if (result.error) setError(friendlyMigrationError(result.error.message))
    else {
      setMessage(`Nuevo snapshot de ${periodLabel(selectedPeriod)} insertado. El anterior quedó en el histórico.`)
      setSelectedPeriod(null)
      await load()
    }
    setSaving(false)
  }

  if (loading) return <p className="text-sm text-slate-500">Cargando snapshots de Prop Firm Match…</p>

  return <div className="space-y-5">
    <div className="overflow-x-auto rounded-xl border"><table className="min-w-[1050px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><Th>Periodo</Th><Th>Total payouts</Th><Th>Cantidad</Th><Th>Mayor payout</Th><Th>Promedio</Th><Th>Mediana</Th><Th>Capturado</Th><Th>Estado</Th><Th>Acciones</Th></tr></thead><tbody>{periods.map((period) => { const snapshot = byPeriod.get(period.key); const stale = snapshot ? Date.now() - new Date(snapshot.collected_at).getTime() > 48 * 60 * 60 * 1000 : false; return <tr key={period.key} className="border-t"><Td strong>{period.label}</Td><Td>{money(snapshot?.amount, snapshot?.currency)}</Td><Td>{count(snapshot?.payout_count)}</Td><Td>{money(snapshot?.largest_payout, snapshot?.currency)}</Td><Td>{money(snapshot?.average_payout, snapshot?.currency)}</Td><Td>{duration(snapshot?.median_time_minutes)}</Td><Td>{snapshot ? relativeTime(snapshot.collected_at) : 'Sin snapshot'}</Td><Td>{!snapshot ? <Badge tone="neutral">Sin datos externos</Badge> : stale ? <Badge tone="warning">Datos PFM desactualizados</Badge> : <Badge tone="success">Actual</Badge>} {snapshot && <p className="mt-1 text-xs text-slate-400">{snapshot.raw_data?.captureMethod === 'manual' ? 'Manual' : 'Collector'}</p>}</Td><Td><button type="button" onClick={() => openForm(period.key)} className="rounded-lg bg-black px-3 py-2 text-xs font-medium text-white">{snapshot ? 'Nuevo snapshot' : 'Agregar snapshot'}</button></Td></tr> })}</tbody></table></div>
    <a href={sourceUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-lg border px-4 py-2 text-sm font-medium">Abrir Prop Firm Match</a>
    {selectedPeriod && <form onSubmit={save} className="rounded-xl border bg-slate-50 p-5"><h3 className="font-semibold">Nuevo snapshot · {periodLabel(selectedPeriod)}</h3><p className="mt-1 text-sm text-slate-500">Siempre se insertará una fila nueva. No se modifica físicamente el snapshot anterior.</p><div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4"><Input label="Total payouts" value={form.amount} onChange={(amount) => setForm({ ...form, amount })} type="number" /><Input label="Cantidad" value={form.payoutCount} onChange={(payoutCount) => setForm({ ...form, payoutCount })} type="number" step="1" /><Input label="Mayor payout" value={form.largestPayout} onChange={(largestPayout) => setForm({ ...form, largestPayout })} type="number" /><Input label="Promedio" value={form.averagePayout} onChange={(averagePayout) => setForm({ ...form, averagePayout })} type="number" /><Input label="Mediana (minutos)" value={form.medianTimeMinutes} onChange={(medianTimeMinutes) => setForm({ ...form, medianTimeMinutes })} type="number" /><Input label="Moneda" value={form.currency} onChange={(currency) => setForm({ ...form, currency })} /><Input label="URL de fuente" value={form.sourceUrl} onChange={(url) => setForm({ ...form, sourceUrl: url })} type="url" /><Input label="Capturado" value={form.capturedAt} onChange={(capturedAt) => setForm({ ...form, capturedAt })} type="datetime-local" /></div><div className="mt-5 flex gap-3"><button disabled={saving} className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? 'Guardando…' : 'Insertar snapshot'}</button><button type="button" onClick={() => setSelectedPeriod(null)} className="rounded-lg border bg-white px-4 py-2 text-sm">Cancelar</button></div></form>}
    {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {message && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</p>}
  </div>
}

function emptyForm(sourceUrl: string): FormState { return { amount: '', payoutCount: '', largestPayout: '', averagePayout: '', medianTimeMinutes: '', currency: 'USD', sourceUrl, capturedAt: localDateTime() } }
function formFromSnapshot(snapshot: Snapshot, fallbackUrl: string): FormState { return { amount: value(snapshot.amount), payoutCount: value(snapshot.payout_count), largestPayout: value(snapshot.largest_payout), averagePayout: value(snapshot.average_payout), medianTimeMinutes: value(snapshot.median_time_minutes), currency: snapshot.currency || 'USD', sourceUrl: snapshot.source_url || fallbackUrl, capturedAt: localDateTime() } }
function Input({ label, value, onChange, type = 'text', step = 'any' }: { label: string; value: string; onChange: (value: string) => void; type?: string; step?: string }) { return <label className="text-sm font-medium">{label}<input value={value} onChange={(event) => onChange(event.target.value)} type={type} min={type === 'number' ? 0 : undefined} step={type === 'number' ? step : undefined} required className="mt-1 w-full rounded-lg border bg-white p-3 font-normal" /></label> }
function Th({ children }: { children: ReactNode }) { return <th className="whitespace-nowrap p-3">{children}</th> }
function Td({ children, strong = false }: { children: ReactNode; strong?: boolean }) { return <td className={`whitespace-nowrap p-3 ${strong ? 'font-semibold' : ''}`}>{children}</td> }
function Badge({ children, tone }: { children: ReactNode; tone: 'neutral' | 'warning' | 'success' }) { const style = tone === 'warning' ? 'bg-amber-100 text-amber-800' : tone === 'success' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'; return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${style}`}>{children}</span> }
function periodLabel(key: PeriodKey) { return periods.find((period) => period.key === key)?.label ?? key }
function requiredNumber(input: string) { return input.trim() === '' ? Number.NaN : Number(input) }
function requiredInteger(input: string) { const number = requiredNumber(input); return Number.isInteger(number) ? number : Number.NaN }
function value(input: number | null) { return input === null ? '' : String(input) }
function money(input: number | null | undefined, currency = 'USD') { return input === null || input === undefined ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(input) }
function count(input: number | null | undefined) { return input === null || input === undefined ? '—' : input.toLocaleString('es-CO') }
function duration(input: number | null | undefined) { if (input === null || input === undefined) return '—'; if (input < 60) return `${input} min`; if (input < 1_440) return `${formatNumber(input / 60)} h`; return `${formatNumber(input / 1_440)} d` }
function formatNumber(input: number) { return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(input) }
function localDateTime() { const date = new Date(); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 16) }
function relativeTime(value: string) { const hours = Math.max(0, (Date.now() - new Date(value).getTime()) / 3_600_000); if (hours < 1) return 'Actualizado hace menos de 1 hora'; if (hours < 24) return `Actualizado hace ${Math.floor(hours)} h`; return `Actualizado hace ${Math.floor(hours / 24)} d` }
function friendlyMigrationError(message: string) { return /platform_payout_metrics|external_platform_mappings|period_key/i.test(message) ? 'Ejecuta primero la migración 202608290001_payout_metrics_periods_and_pfm_mappings.sql en Supabase.' : message }
