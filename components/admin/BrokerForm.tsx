'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MediaPicker, type PickedMedia } from '@/components/admin/MediaPicker'
import { deleteBrokerSource, saveBrokerSource } from '@/app/admin/platform-actions'

type CatalogItem = { id: string; name: string; status: boolean }
type Country = { code: string; name: string }
export type BrokerFormValue = {
  id: string
  updatedAt: string
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
    const result = await saveBrokerSource({ id: initial?.id, expectedUpdatedAt: initial?.updatedAt, name: name.trim(), slug: slug.trim(), websiteUrl: websiteUrl.trim() || null,
      status: status as 'active' | 'draft' | 'inactive', countryCode: countryCode || null, description: description.trim() || null,
      logoMediaId: logo?.id ?? null, foundedYear: foundedYear.trim() ? Number(foundedYear) : null,
      minimumDeposit: minimumDeposit.trim() ? Number(minimumDeposit) : null,
      minimumDepositCurrency: minimumDeposit.trim() ? minimumDepositCurrency.trim().toUpperCase() || 'USD' : null,
      regulationSummary: regulationSummary.trim() || null, regulationSourceUrl: regulationSourceUrl.trim() || null,
      featured: isFeatured, displayOrder: Number(displayOrder || 100), markets, tradingPlatformIds: selectedTradingPlatforms })
    if (!result.ok) return fail(result.message)
    router.push('/admin/brokers'); router.refresh()
  }

  async function remove() {
    if (!initial || !window.confirm('¿Seguro que quieres eliminar este broker?')) return
    setSaving(true); setError('')
    const result = await deleteBrokerSource({ id: initial.id, type: 'broker', slug: initial.slug, expectedUpdatedAt: initial.updatedAt })
    if (!result.ok) { setError(result.message); setSaving(false); return }
    router.push('/admin/brokers'); router.refresh()
  }

  return <form onSubmit={submit} className="space-y-8 rounded-xl bg-white p-6 shadow sm:p-8">
    <Section title="Información" /><div className="grid gap-5 md:grid-cols-2"><Field label="Nombre"><input required value={name} onChange={(event) => setName(event.target.value)} className={INPUT} /></Field><Field label="Slug"><input required value={slug} onChange={(event) => setSlug(event.target.value)} className={INPUT} /></Field><Field label="País"><select value={countryCode} onChange={(event) => setCountryCode(event.target.value)} className={INPUT}><option value="">Sin verificar</option>{countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}</select></Field><Field label="Año de fundación"><input type="number" min="1800" max="2200" value={foundedYear} onChange={(event) => setFoundedYear(event.target.value)} className={INPUT} /></Field><Field label="Sitio web"><input type="url" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} className={INPUT} /></Field></div><Field label="Descripción corta"><textarea value={description} onChange={(event) => setDescription(event.target.value)} className={`${INPUT} min-h-28`} /></Field>
    <Section title="Operación" /><div className="grid gap-5 md:grid-cols-2"><Field label="Depósito mínimo"><input type="number" min="0" step="0.01" value={minimumDeposit} onChange={(event) => setMinimumDeposit(event.target.value)} className={INPUT} /></Field><Field label="Moneda"><input maxLength={3} value={minimumDepositCurrency} onChange={(event) => setMinimumDepositCurrency(event.target.value)} className={INPUT} placeholder="USD" /></Field></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{MARKET_OPTIONS.map(([value, label]) => <Check key={value} label={label} checked={markets.includes(value)} onChange={() => setMarkets(toggle(markets, value))} />)}</div><p className="text-sm font-medium">Plataformas de trading</p><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{tradingPlatforms.map((item) => <Check key={item.id} label={item.name} checked={selectedTradingPlatforms.includes(item.id)} onChange={() => setSelectedTradingPlatforms(toggle(selectedTradingPlatforms, item.id))} />)}</div>
    <Section title="Regulación" /><Field label="Resumen corto"><input value={regulationSummary} onChange={(event) => setRegulationSummary(event.target.value)} className={INPUT} placeholder="ASIC · FCA · CySEC" /></Field><Field label="Fuente oficial"><input type="url" value={regulationSourceUrl} onChange={(event) => setRegulationSourceUrl(event.target.value)} className={INPUT} /></Field>
    <Section title="Presentación" /><MediaPicker label="Logo" value={logo} onChange={setLogo} /><div className="grid gap-5 md:grid-cols-2"><Field label="Orden editorial"><input type="number" min="0" value={displayOrder} onChange={(event) => setDisplayOrder(event.target.value)} className={INPUT} /></Field><Check label="Broker destacado" checked={isFeatured} onChange={() => setIsFeatured(!isFeatured)} /></div>
    <Section title="Estado" /><Field label="Estado"><select value={status} onChange={(event) => setStatus(event.target.value)} className={INPUT}><option value="active">Activo</option><option value="draft">Borrador</option><option value="inactive">Inactivo</option></select></Field>
    {error && <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}<div className="flex justify-between gap-3 border-t pt-6">{editing ? <button type="button" onClick={remove} disabled={saving} className="rounded-lg border border-red-300 px-5 py-2.5 text-sm font-medium text-red-700">Eliminar</button> : <span />}<div className="flex gap-3"><button type="button" onClick={() => router.push('/admin/brokers')} className="rounded-lg border px-5 py-2.5 text-sm font-medium">Cancelar</button><button disabled={saving} className="rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear broker'}</button></div></div>
  </form>
}

function Section({ title }: { title: string }) { return <h2 className="border-b pb-3 text-xl font-semibold">{title}</h2> }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-sm font-medium">{label}</span>{children}</label> }
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) { return <label className="flex items-center gap-3 rounded-lg border p-4 text-sm"><input type="checkbox" checked={checked} onChange={onChange} />{label}</label> }
function toggle(values: string[], value: string) { return values.includes(value) ? values.filter((item) => item !== value) : [...values, value] }
