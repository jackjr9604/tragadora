'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MediaPicker, type PickedMedia } from '@/components/admin/MediaPicker'
import { createClient } from '@/lib/supabase/client'

type CatalogItem = { id: string; name: string; status: boolean }
type Country = { code: string; name: string }
export type BrokerFormValue = {
  id: string
  name: string
  slug: string
  websiteUrl: string
  status: string
  countryCode: string
  description: string
  logo: PickedMedia | null
  foundedYear: string
  minimumDeposit: string
  minimumDepositCurrency: string
  regulationSummary: string
  regulationSourceUrl: string
  isFeatured: boolean
  displayOrder: string
  markets: string[]
  tradingPlatformIds: string[]
}

const MARKET_OPTIONS = [['cfd', 'CFD / Forex'], ['futures', 'Futures'], ['crypto', 'Crypto'], ['options', 'Opciones']] as const
const INPUT = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200'

export function BrokerForm({ initial, countries, tradingPlatforms }: { initial?: BrokerFormValue; countries: Country[]; tradingPlatforms: CatalogItem[] }) {
  const router = useRouter()
  const db = createClient()
  const editing = Boolean(initial)
  const [name, setName] = useState(initial?.name ?? '')
  const [slug, setSlug] = useState(initial?.slug ?? '')
  const [websiteUrl, setWebsiteUrl] = useState(initial?.websiteUrl ?? '')
  const [status, setStatus] = useState(initial?.status ?? 'active')
  const [countryCode, setCountryCode] = useState(initial?.countryCode ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [logo, setLogo] = useState<PickedMedia | null>(initial?.logo ?? null)
  const [foundedYear, setFoundedYear] = useState(initial?.foundedYear ?? '')
  const [minimumDeposit, setMinimumDeposit] = useState(initial?.minimumDeposit ?? '')
  const [minimumDepositCurrency, setMinimumDepositCurrency] = useState(initial?.minimumDepositCurrency ?? 'USD')
  const [regulationSummary, setRegulationSummary] = useState(initial?.regulationSummary ?? '')
  const [regulationSourceUrl, setRegulationSourceUrl] = useState(initial?.regulationSourceUrl ?? '')
  const [isFeatured, setIsFeatured] = useState(initial?.isFeatured ?? false)
  const [displayOrder, setDisplayOrder] = useState(initial?.displayOrder ?? '100')
  const [markets, setMarkets] = useState<string[]>(initial?.markets ?? [])
  const [selectedTradingPlatforms, setSelectedTradingPlatforms] = useState<string[]>(initial?.tradingPlatformIds ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('')
    const fail = (message: string) => { setError(message); setSaving(false) }
    const platformPayload = { name: name.trim(), slug: slug.trim(), type: 'broker', website_url: websiteUrl.trim() || null, logo_media_id: logo?.id ?? null, status, origin_country_code: countryCode || null }
    let platformId = initial?.id
    if (platformId) {
      const result = await db.from('platforms').update(platformPayload).eq('id', platformId).eq('type', 'broker')
      if (result.error) return fail(result.error.message)
    } else {
      const result = await db.from('platforms').insert(platformPayload).select('id').single()
      if (result.error) return fail(result.error.message)
      platformId = result.data.id
    }
    const details = await db.from('broker_details').upsert({
      platform_id: platformId,
      founded_year: foundedYear.trim() ? Number(foundedYear) : null,
      minimum_deposit: minimumDeposit.trim() ? Number(minimumDeposit) : null,
      minimum_deposit_currency: minimumDeposit.trim() ? minimumDepositCurrency.trim().toUpperCase() || 'USD' : null,
      regulation_summary: regulationSummary.trim() || null,
      regulation_source_url: regulationSourceUrl.trim() || null,
      is_featured: isFeatured,
      display_order: Number(displayOrder || 100),
    }, { onConflict: 'platform_id' })
    if (details.error) return fail(details.error.message)
    const translation = await db.from('platform_translations').upsert({ platform_id: platformId, language: 'es', short_description: description.trim() || null }, { onConflict: 'platform_id,language' })
    if (translation.error) return fail(translation.error.message)
    if (!await syncRelations('platform_markets', 'market', initial?.markets ?? [], markets, (value) => ({ platform_id: platformId, market: value }))) return
    if (!await syncRelations('platform_trading_platforms', 'trading_platform_id', initial?.tradingPlatformIds ?? [], selectedTradingPlatforms, (value) => ({ platform_id: platformId, trading_platform_id: value }))) return
    router.push('/admin/brokers'); router.refresh()
  }

  async function syncRelations(table: string, column: string, previous: string[], current: string[], row: (value: string) => Record<string, unknown>) {
    const removed = previous.filter((value) => !current.includes(value)), added = current.filter((value) => !previous.includes(value))
    if (removed.length) { const result = await db.from(table).delete().eq('platform_id', initial?.id ?? '').in(column, removed); if (result.error) { setError(result.error.message); setSaving(false); return false } }
    if (added.length) { const result = await db.from(table).insert(added.map(row)); if (result.error) { setError(result.error.message); setSaving(false); return false } }
    return true
  }

  return <form onSubmit={submit} className="space-y-8 rounded-xl bg-white p-6 shadow sm:p-8">
    <Section title="Información" /><div className="grid gap-5 md:grid-cols-2"><Field label="Nombre"><input required value={name} onChange={(event) => setName(event.target.value)} className={INPUT} /></Field><Field label="Slug"><input required value={slug} onChange={(event) => setSlug(event.target.value)} className={INPUT} /></Field><Field label="País"><select value={countryCode} onChange={(event) => setCountryCode(event.target.value)} className={INPUT}><option value="">Sin verificar</option>{countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}</select></Field><Field label="Año de fundación"><input type="number" min="1800" max="2200" value={foundedYear} onChange={(event) => setFoundedYear(event.target.value)} className={INPUT} /></Field><Field label="Sitio web"><input type="url" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} className={INPUT} /></Field></div><Field label="Descripción corta"><textarea value={description} onChange={(event) => setDescription(event.target.value)} className={`${INPUT} min-h-28`} /></Field>
    <Section title="Operación" /><div className="grid gap-5 md:grid-cols-2"><Field label="Depósito mínimo"><input type="number" min="0" step="0.01" value={minimumDeposit} onChange={(event) => setMinimumDeposit(event.target.value)} className={INPUT} /></Field><Field label="Moneda"><input maxLength={3} value={minimumDepositCurrency} onChange={(event) => setMinimumDepositCurrency(event.target.value)} className={INPUT} placeholder="USD" /></Field></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{MARKET_OPTIONS.map(([value, label]) => <Check key={value} label={label} checked={markets.includes(value)} onChange={() => setMarkets(toggle(markets, value))} />)}</div><p className="text-sm font-medium">Plataformas de trading</p><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{tradingPlatforms.map((item) => <Check key={item.id} label={item.name} checked={selectedTradingPlatforms.includes(item.id)} onChange={() => setSelectedTradingPlatforms(toggle(selectedTradingPlatforms, item.id))} />)}</div>
    <Section title="Regulación" /><Field label="Resumen corto"><input value={regulationSummary} onChange={(event) => setRegulationSummary(event.target.value)} className={INPUT} placeholder="ASIC · FCA · CySEC" /></Field><Field label="Fuente oficial"><input type="url" value={regulationSourceUrl} onChange={(event) => setRegulationSourceUrl(event.target.value)} className={INPUT} /></Field>
    <Section title="Presentación" /><MediaPicker label="Logo" value={logo} onChange={setLogo} /><div className="grid gap-5 md:grid-cols-2"><Field label="Orden editorial"><input type="number" min="0" value={displayOrder} onChange={(event) => setDisplayOrder(event.target.value)} className={INPUT} /></Field><Check label="Broker destacado" checked={isFeatured} onChange={() => setIsFeatured(!isFeatured)} /></div>
    <Section title="Estado" /><Field label="Estado"><select value={status} onChange={(event) => setStatus(event.target.value)} className={INPUT}><option value="active">Activo</option><option value="draft">Borrador</option><option value="inactive">Inactivo</option></select></Field>
    {error && <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}<div className="flex justify-end gap-3 border-t pt-6"><button type="button" onClick={() => router.push('/admin/brokers')} className="rounded-lg border px-5 py-2.5 text-sm font-medium">Cancelar</button><button disabled={saving} className="rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear broker'}</button></div>
  </form>
}

function Section({ title }: { title: string }) { return <h2 className="border-b pb-3 text-xl font-semibold">{title}</h2> }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-sm font-medium">{label}</span>{children}</label> }
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) { return <label className="flex items-center gap-3 rounded-lg border p-4 text-sm"><input type="checkbox" checked={checked} onChange={onChange} />{label}</label> }
function toggle(values: string[], value: string) { return values.includes(value) ? values.filter((item) => item !== value) : [...values, value] }
