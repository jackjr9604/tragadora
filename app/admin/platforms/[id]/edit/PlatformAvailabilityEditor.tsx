'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AvailabilityStatus, RestrictionBasis } from '@/lib/platform-availability'

type Market = 'cfd' | 'futures' | 'crypto' | 'options'
type Rule = {
  key: string
  id?: string
  country_code: string
  market: Market | null
  status: AvailabilityStatus
  restriction_basis: RestrictionBasis
  source_url: string
  verified_at: string
  rule_summary: string
}
type Country = { code: string; name: string }

const supabase = createClient()
const emptyRule = (): Rule => ({ key: crypto.randomUUID(), country_code: '', market: null, status: 'unknown', restriction_basis: 'unspecified', source_url: '', verified_at: '', rule_summary: '' })
const inputClass = 'min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm'
const marketOptions: Array<{ value: Market; label: string }> = [
  { value: 'cfd', label: 'CFD' },
  { value: 'futures', label: 'Futures' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'options', label: 'Options' },
]

export function PlatformAvailabilityEditor({ platformId }: { platformId: string }) {
  const [rules, setRules] = useState<Rule[]>([])
  const [originalIds, setOriginalIds] = useState<string[]>([])
  const [countries, setCountries] = useState<Country[]>([])
  const [markets, setMarkets] = useState<Market[]>([])
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    const [rulesResult, countriesResult, marketsResult] = await Promise.all([
      supabase.from('platform_availability').select('id,country_code,market,status,restriction_basis,source_url,verified_at,rule_summary').eq('platform_id', platformId).order('country_code'),
      supabase.from('countries').select('code,name').order('name'),
      supabase.from('platform_markets').select('market').eq('platform_id', platformId),
    ])
    setCountries((countriesResult.data ?? []) as Country[])
    setMarkets((marketsResult.data ?? []).map((item) => item.market as Market))
    if (rulesResult.error) {
      setReady(false)
      setMessage('La edición de disponibilidad requiere aplicar primero la migración local propuesta. No se alteraron reglas existentes.')
    } else {
      const loaded = (rulesResult.data ?? []).map((item): Rule => ({
        key: item.id,
        id: item.id,
        country_code: item.country_code,
        market: item.market as Market | null,
        status: item.status as AvailabilityStatus,
        restriction_basis: item.restriction_basis as RestrictionBasis,
        source_url: item.source_url ?? '',
        verified_at: item.verified_at?.slice(0, 10) ?? '',
        rule_summary: item.rule_summary ?? '',
      }))
      setRules(loaded)
      setOriginalIds(loaded.map((rule) => rule.id).filter((id): id is string => Boolean(id)))
      setReady(true)
      setMessage('')
    }
    setLoading(false)
  }, [platformId])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  function patchRule(key: string, changes: Partial<Rule>) {
    setRules((current) => current.map((rule) => rule.key === key ? { ...rule, ...changes } : rule))
  }

  async function save() {
    setMessage('')
    const identities = new Set<string>()
    for (const rule of rules) {
      if (!rule.country_code) { setMessage('Selecciona un país para cada regla.'); return }
      if (rule.market && !markets.includes(rule.market)) { setMessage('El mercado debe pertenecer a esta firma.'); return }
      const identity = `${rule.country_code}:${rule.market ?? 'general'}`
      if (identities.has(identity)) { setMessage('No puede haber dos reglas para el mismo país y mercado.'); return }
      identities.add(identity)
      if (rule.status !== 'unknown' && (!rule.source_url.trim() || !rule.verified_at)) {
        setMessage('Una regla disponible o restringida requiere fuente oficial y fecha de verificación.'); return
      }
      if (rule.source_url && !/^https:\/\//i.test(rule.source_url.trim())) { setMessage('La fuente debe ser una URL HTTPS.'); return }
    }
    setSaving(true)
    const removedIds = originalIds.filter((id) => !rules.some((rule) => rule.id === id))
    for (const rule of rules) {
      const payload = {
        platform_id: platformId,
        country_code: rule.country_code,
        market: rule.market,
        status: rule.status,
        restriction_basis: rule.restriction_basis,
        source_url: rule.source_url.trim() || null,
        verified_at: rule.verified_at ? `${rule.verified_at}T12:00:00Z` : null,
        rule_summary: rule.rule_summary.trim() || null,
      }
      const result = rule.id
        ? await supabase.from('platform_availability').update(payload).eq('id', rule.id).eq('platform_id', platformId)
        : await supabase.from('platform_availability').insert(payload)
      if (result.error) { setMessage(result.error.message); setSaving(false); return }
    }
    if (removedIds.length) {
      const result = await supabase.from('platform_availability').delete().eq('platform_id', platformId).in('id', removedIds)
      if (result.error) { setMessage(result.error.message); setSaving(false); return }
    }
    await load()
    setMessage('Disponibilidad guardada.')
    setSaving(false)
  }

  return <section className="rounded-xl border border-slate-200 bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-semibold">Disponibilidad geográfica</h2><p className="text-sm text-slate-500">País de residencia, mercado y evidencia verificada. Sin regla no equivale a disponible.</p></div>
      {ready && <button type="button" className="rounded-lg border border-slate-300 px-4 py-2 text-sm" onClick={() => setRules((current) => [...current, emptyRule()])}>+ Añadir regla</button>}
    </div>
    {loading ? <p className="mt-4 text-sm text-slate-500">Cargando…</p> : ready && <div className="mt-4 space-y-4">{rules.length === 0 && <p className="text-sm text-slate-500">Sin reglas: disponibilidad desconocida.</p>}{rules.map((rule) => <div key={rule.key} className="grid gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="grid gap-1 text-xs font-medium">País<select className={inputClass} value={rule.country_code} onChange={(event) => patchRule(rule.key, { country_code: event.target.value })}><option value="">Seleccionar</option>{countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}</select></label>
      <label className="grid gap-1 text-xs font-medium">Mercado<select className={inputClass} value={rule.market ?? ''} onChange={(event) => patchRule(rule.key, { market: event.target.value ? event.target.value as Market : null })}><option value="">General</option>{marketOptions.map((option) => <option key={option.value} value={option.value} disabled={!markets.includes(option.value)}>{option.label}</option>)}</select></label>
      <label className="grid gap-1 text-xs font-medium">Estado<select className={inputClass} value={rule.status} onChange={(event) => patchRule(rule.key, { status: event.target.value as AvailabilityStatus })}><option value="unknown">Desconocido</option><option value="available">Disponible</option><option value="restricted">Restringido</option></select></label>
      <label className="grid gap-1 text-xs font-medium">Criterio<select className={inputClass} value={rule.restriction_basis} onChange={(event) => patchRule(rule.key, { restriction_basis: event.target.value as RestrictionBasis })}><option value="unspecified">No especificado</option><option value="residence">Residencia</option><option value="nationality">Nacionalidad</option><option value="physical_location">Ubicación física</option></select></label>
      <label className="grid gap-1 text-xs font-medium sm:col-span-2">URL de fuente oficial<input className={inputClass} type="url" value={rule.source_url} onChange={(event) => patchRule(rule.key, { source_url: event.target.value })} /></label>
      <label className="grid gap-1 text-xs font-medium">Verificado el<input className={inputClass} type="date" value={rule.verified_at} onChange={(event) => patchRule(rule.key, { verified_at: event.target.value })} /></label>
      <label className="grid gap-1 text-xs font-medium sm:col-span-2 lg:col-span-4">Resumen propio<input className={inputClass} value={rule.rule_summary} onChange={(event) => patchRule(rule.key, { rule_summary: event.target.value })} /></label>
      <button type="button" className="w-fit text-sm text-red-700" onClick={() => setRules((current) => current.filter((item) => item.key !== rule.key))}>Quitar regla</button>
    </div>)}<button type="button" disabled={saving} className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50" onClick={() => void save()}>{saving ? 'Guardando…' : 'Guardar disponibilidad'}</button></div>}
    {message && <p role="status" className="mt-3 text-sm text-slate-600">{message}</p>}
  </section>
}
