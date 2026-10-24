'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminPermission } from '@/components/admin/AdminPermissionsProvider'
import { MediaPicker, type PickedMedia } from '@/components/admin/MediaPicker'
import { TOOL_ICON_OPTIONS, ToolIcon } from '@/components/tools/ToolIcon'
import type { ToolPricingModel, ToolStatus, ToolType } from '@/lib/tools'
import { deleteToolSource, saveToolSource } from '@/app/admin/catalog-actions'

export type ToolFormValue = {
  id: string
  slug: string
  name: string
  shortDescription: string
  toolType: ToolType
  category: string
  iconKey: string
  badge: string
  internalPath: string
  externalUrl: string
  isFeatured: boolean
  displayOrder: string
  status: ToolStatus
  openInNewTab: boolean
  pricingModel: ToolPricingModel | ''
  hasFreePlan: boolean
  priceLabel: string
  availability: string
  authorName: string
  promoCode: string
  promoLabel: string
  isOurs: boolean
  logo: PickedMedia | null
}

const INPUT = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200'

export function ToolForm({ initial, mode = 'tool' }: { initial?: ToolFormValue; mode?: 'tool' | 'calculator' }) {
  const router = useRouter(), editing = Boolean(initial)
  const calculatorMode = mode === 'calculator'
  const returnPath = calculatorMode ? '/admin/calculators' : '/admin/tools'
  const canDelete = useAdminPermission('tools.delete')
  const [name, setName] = useState(initial?.name ?? ''), [slug, setSlug] = useState(initial?.slug ?? ''), [description, setDescription] = useState(initial?.shortDescription ?? '')
  const [toolType, setToolType] = useState<ToolType>(initial?.toolType ?? 'external'), [category, setCategory] = useState(initial?.category ?? ''), [iconKey, setIconKey] = useState(initial?.iconKey ?? 'calculator'), [badge, setBadge] = useState(initial?.badge ?? '')
  const [internalPath, setInternalPath] = useState(initial?.internalPath ?? ''), [externalUrl, setExternalUrl] = useState(initial?.externalUrl ?? ''), [openInNewTab, setOpenInNewTab] = useState(initial?.openInNewTab ?? false)
  const [isFeatured, setIsFeatured] = useState(initial?.isFeatured ?? false), [displayOrder, setDisplayOrder] = useState(initial?.displayOrder ?? '100'), [status, setStatus] = useState<ToolStatus>(initial?.status ?? 'draft')
  const [pricingModel, setPricingModel] = useState<ToolPricingModel | ''>(initial?.pricingModel ?? ''), [hasFreePlan, setHasFreePlan] = useState(initial?.hasFreePlan ?? false), [priceLabel, setPriceLabel] = useState(initial?.priceLabel ?? '')
  const [availability, setAvailability] = useState(initial?.availability ?? ''), [authorName, setAuthorName] = useState(initial?.authorName ?? ''), [promoCode, setPromoCode] = useState(initial?.promoCode ?? ''), [promoLabel, setPromoLabel] = useState(initial?.promoLabel ?? '')
  const [isOurs, setIsOurs] = useState(initial?.isOurs ?? false), [logo, setLogo] = useState<PickedMedia | null>(initial?.logo ?? null)
  const [saving, setSaving] = useState(false), [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('')
    const fail = (message: string) => { setError(message); setSaving(false) }
    const cleanSlug = slug.trim().toLocaleLowerCase('en-US')
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleanSlug)) return fail('El slug solo puede contener letras minúsculas, números y guiones.')
    if (toolType === 'internal' && !internalPath.trim().startsWith('/')) return fail('La ruta interna debe comenzar por /.')
    if (toolType === 'external' && !isUrl(externalUrl)) return fail('Ingresa una URL externa válida.')
    const payload = {
      id: initial?.id, slug: cleanSlug, name: name.trim(), shortDescription: description.trim() || null, toolType, category: category.trim() || null,
      iconKey: iconKey || null, badge: badge.trim() || null,
      internalPath: toolType === 'internal' ? internalPath.trim() : null,
      externalUrl: toolType === 'external' ? externalUrl.trim() : null,
      featured: isFeatured, displayOrder: Number(displayOrder || 100), status,
      openInNewTab: toolType === 'external' ? openInNewTab : false,
      pricingModel: pricingModel || null, hasFreePlan: pricingModel === 'free' || hasFreePlan,
      priceLabel: priceLabel.trim() || null, availability: availability.trim() || null,
      authorName: authorName.trim() || null, promoCode: promoCode.trim() || null,
      promoLabel: promoLabel.trim() || null, isOurs, logoMediaId: logo?.id ?? null,
    }
    const result = await saveToolSource(payload)
    if (!result.ok) return fail(result.message)
    router.push(returnPath); router.refresh()
  }

  async function remove() {
    if (!initial || !window.confirm(`¿Eliminar ${initial.name}?`)) return
    setSaving(true); setError('')
    const result = await deleteToolSource(initial.id)
    if (!result.ok) { setError(result.message); setSaving(false); return }
    router.push(returnPath); router.refresh()
  }

  return <form onSubmit={submit} className="space-y-8 rounded-xl bg-white p-6 shadow sm:p-8">
    <Section title="Información" /><div className="grid gap-5 md:grid-cols-2"><Field label="Nombre"><input required value={name} onChange={(event) => setName(event.target.value)} className={INPUT} /></Field><Field label="Slug"><input required readOnly={calculatorMode} value={slug} onChange={(event) => setSlug(event.target.value)} className={`${INPUT} ${calculatorMode ? 'bg-slate-100 text-slate-500' : ''}`} placeholder="profit-split" /></Field></div><Field label="Descripción corta"><textarea value={description} onChange={(event) => setDescription(event.target.value)} className={`${INPUT} min-h-24`} /></Field>
    {!calculatorMode && <><Section title="Clasificación" /><div className="grid gap-5 md:grid-cols-2"><Field label="Tipo"><select value={toolType} onChange={(event) => setToolType(event.target.value as ToolType)} className={INPUT}><option value="external">Recurso externo</option><option value="coming_soon">Próximamente</option></select></Field><Field label="Categoría"><select value={category} onChange={(event) => setCategory(event.target.value)} className={INPUT}><option value="">Sin categoría</option><option>Gráficos y datos</option><option>Indicadores</option><option>Noticias y calendario</option><option>Plataformas</option><option>Diario de trading</option></select></Field><Field label="Icono fallback"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-lg bg-slate-900 text-amber-300"><ToolIcon iconKey={iconKey} /></span><select value={iconKey} onChange={(event) => setIconKey(event.target.value)} className={INPUT}>{TOOL_ICON_OPTIONS.map((key) => <option key={key} value={key}>{key}</option>)}</select></div></Field><Field label="Badge opcional"><input value={badge} onChange={(event) => setBadge(event.target.value)} className={INPUT} placeholder="Nuevo" /></Field></div></>}
    {calculatorMode && <div className="grid gap-5 md:grid-cols-2"><Field label="Categoría"><select value={category} onChange={(event) => setCategory(event.target.value)} className={INPUT}><option>Riesgo</option><option>Payouts</option><option>Challenges</option></select></Field><Field label="Badge opcional"><input value={badge} onChange={(event) => setBadge(event.target.value)} className={INPUT} /></Field></div>}
    <MediaPicker label={calculatorMode ? 'Imagen de la calculadora' : 'Logo de la herramienta'} value={logo} onChange={setLogo} defaultCategory="logos-generales" imagesOnly />
    {!calculatorMode && <><Section title="Destino" />{toolType === 'internal' && <Field label="Ruta interna"><input required value={internalPath} onChange={(event) => setInternalPath(event.target.value)} className={INPUT} placeholder="/calculadoras/drawdown" /></Field>}{toolType === 'external' && <><Field label="URL externa"><input required type="url" value={externalUrl} onChange={(event) => setExternalUrl(event.target.value)} className={INPUT} /></Field><Check label="Abrir en nueva pestaña" checked={openInNewTab} onChange={() => setOpenInNewTab(!openInNewTab)} /></>}{toolType === 'coming_soon' && <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Las herramientas próximas no tienen destino y no generan enlaces rotos.</p>}<Section title="Datos de la tarjeta" /><div className="grid gap-5 md:grid-cols-2"><Field label="Modelo de precio"><select value={pricingModel} onChange={(event) => setPricingModel(event.target.value as ToolPricingModel | '')} className={INPUT}><option value="">Sin especificar</option><option value="free">Gratis</option><option value="freemium">Freemium</option><option value="paid">De pago</option></select></Field><Field label="Precio visible"><input value={priceLabel} onChange={(event) => setPriceLabel(event.target.value)} className={INPUT} placeholder="Gratis · Desde $14.99/mes" /></Field><Field label="Dónde funciona"><input value={availability} onChange={(event) => setAvailability(event.target.value)} className={INPUT} placeholder="Web · Windows · macOS" /></Field><Field label="Autor"><input value={authorName} onChange={(event) => setAuthorName(event.target.value)} className={INPUT} /></Field><Field label="Promoción"><input value={promoLabel} onChange={(event) => setPromoLabel(event.target.value)} className={INPUT} placeholder="20% de descuento" /></Field><Field label="Código promocional"><input value={promoCode} onChange={(event) => setPromoCode(event.target.value)} className={INPUT} /></Field></div><div className="grid gap-3 md:grid-cols-2"><Check label="Tiene plan gratis" checked={hasFreePlan} onChange={() => setHasFreePlan(!hasFreePlan)} /><Check label="Herramienta propia de Tradagora" checked={isOurs} onChange={() => setIsOurs(!isOurs)} /></div></>}
    <Section title="Presentación" /><div className="grid gap-5 md:grid-cols-2"><Field label="Orden"><input type="number" min="0" value={displayOrder} onChange={(event) => setDisplayOrder(event.target.value)} className={INPUT} /></Field><Check label="Herramienta destacada" checked={isFeatured} onChange={() => setIsFeatured(!isFeatured)} /></div>
    <Section title={calculatorMode ? 'Visibilidad' : 'Publicación'} /><Field label="Estado"><select value={status} onChange={(event) => setStatus(event.target.value as ToolStatus)} className={INPUT}><option value="draft">{calculatorMode ? 'Oculta' : 'Borrador'}</option><option value="published">{calculatorMode ? 'Visible' : 'Publicada'}</option></select></Field>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}<div className="flex flex-wrap justify-between gap-3 border-t pt-6"><div>{initial && canDelete && !calculatorMode && <button type="button" disabled={saving} onClick={remove} className="rounded-lg border border-red-200 px-5 py-2.5 text-sm font-medium text-red-700 disabled:opacity-50">Eliminar</button>}</div><div className="flex gap-3"><button type="button" onClick={() => router.push(returnPath)} className="rounded-lg border px-5 py-2.5 text-sm font-medium">Cancelar</button><button disabled={saving} className="rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear herramienta'}</button></div></div>
  </form>
}

function Section({ title }: { title: string }) { return <h2 className="border-b pb-3 text-xl font-semibold">{title}</h2> }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-sm font-medium">{label}</span>{children}</label> }
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) { return <label className="flex items-center gap-3 rounded-lg border p-4 text-sm"><input type="checkbox" checked={checked} onChange={onChange} />{label}</label> }
function isUrl(value: string) { try { const url = new URL(value); return url.protocol === 'http:' || url.protocol === 'https:' } catch { return false } }
