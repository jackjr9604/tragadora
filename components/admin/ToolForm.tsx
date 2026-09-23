'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAdminPermission } from '@/components/admin/AdminPermissionsProvider'
import { TOOL_ICON_OPTIONS, ToolIcon } from '@/components/tools/ToolIcon'
import type { ToolStatus, ToolType } from '@/lib/tools'

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
}

const INPUT = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200'

export function ToolForm({ initial }: { initial?: ToolFormValue }) {
  const router = useRouter(), db = createClient(), editing = Boolean(initial)
  const canDelete = useAdminPermission('tools.delete')
  const [name, setName] = useState(initial?.name ?? ''), [slug, setSlug] = useState(initial?.slug ?? ''), [description, setDescription] = useState(initial?.shortDescription ?? '')
  const [toolType, setToolType] = useState<ToolType>(initial?.toolType ?? 'internal'), [category, setCategory] = useState(initial?.category ?? ''), [iconKey, setIconKey] = useState(initial?.iconKey ?? 'calculator'), [badge, setBadge] = useState(initial?.badge ?? '')
  const [internalPath, setInternalPath] = useState(initial?.internalPath ?? ''), [externalUrl, setExternalUrl] = useState(initial?.externalUrl ?? ''), [openInNewTab, setOpenInNewTab] = useState(initial?.openInNewTab ?? false)
  const [isFeatured, setIsFeatured] = useState(initial?.isFeatured ?? false), [displayOrder, setDisplayOrder] = useState(initial?.displayOrder ?? '100'), [status, setStatus] = useState<ToolStatus>(initial?.status ?? 'draft')
  const [saving, setSaving] = useState(false), [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('')
    const fail = (message: string) => { setError(message); setSaving(false) }
    const cleanSlug = slug.trim().toLocaleLowerCase('en-US')
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleanSlug)) return fail('El slug solo puede contener letras minúsculas, números y guiones.')
    if (toolType === 'internal' && !internalPath.trim().startsWith('/')) return fail('La ruta interna debe comenzar por /.')
    if (toolType === 'external' && !isUrl(externalUrl)) return fail('Ingresa una URL externa válida.')
    const payload = {
      slug: cleanSlug, name: name.trim(), short_description: description.trim() || null, tool_type: toolType, category: category.trim() || null,
      icon_key: iconKey || null, badge: badge.trim() || null,
      internal_path: toolType === 'internal' ? internalPath.trim() : null,
      external_url: toolType === 'external' ? externalUrl.trim() : null,
      is_featured: isFeatured, display_order: Number(displayOrder || 100), status,
      open_in_new_tab: toolType === 'external' ? openInNewTab : false,
    }
    const result = initial ? await db.from('tools').update(payload).eq('id', initial.id) : await db.from('tools').insert(payload)
    if (result.error) return fail(result.error.message)
    router.push('/admin/tools'); router.refresh()
  }

  async function remove() {
    if (!initial || !window.confirm(`¿Eliminar ${initial.name}?`)) return
    setSaving(true); setError('')
    const result = await db.from('tools').delete().eq('id', initial.id)
    if (result.error) { setError(result.error.message); setSaving(false); return }
    router.push('/admin/tools'); router.refresh()
  }

  return <form onSubmit={submit} className="space-y-8 rounded-xl bg-white p-6 shadow sm:p-8">
    <Section title="Información" /><div className="grid gap-5 md:grid-cols-2"><Field label="Nombre"><input required value={name} onChange={(event) => setName(event.target.value)} className={INPUT} /></Field><Field label="Slug"><input required value={slug} onChange={(event) => setSlug(event.target.value)} className={INPUT} placeholder="profit-split" /></Field></div><Field label="Descripción corta"><textarea value={description} onChange={(event) => setDescription(event.target.value)} className={`${INPUT} min-h-24`} /></Field>
    <Section title="Clasificación" /><div className="grid gap-5 md:grid-cols-2"><Field label="Tipo"><select value={toolType} onChange={(event) => setToolType(event.target.value as ToolType)} className={INPUT}><option value="internal">Interna</option><option value="external">Externa</option><option value="coming_soon">Próximamente</option></select></Field><Field label="Categoría"><input value={category} onChange={(event) => setCategory(event.target.value)} className={INPUT} placeholder="Riesgo" /></Field><Field label="Icono"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-lg bg-slate-900 text-amber-300"><ToolIcon iconKey={iconKey} /></span><select value={iconKey} onChange={(event) => setIconKey(event.target.value)} className={INPUT}>{TOOL_ICON_OPTIONS.map((key) => <option key={key} value={key}>{key}</option>)}</select></div></Field><Field label="Badge opcional"><input value={badge} onChange={(event) => setBadge(event.target.value)} className={INPUT} placeholder="Nuevo" /></Field></div>
    <Section title="Destino" />{toolType === 'internal' && <Field label="Ruta interna"><input required value={internalPath} onChange={(event) => setInternalPath(event.target.value)} className={INPUT} placeholder="/herramientas/drawdown" /></Field>}{toolType === 'external' && <><Field label="URL externa"><input required type="url" value={externalUrl} onChange={(event) => setExternalUrl(event.target.value)} className={INPUT} /></Field><Check label="Abrir en nueva pestaña" checked={openInNewTab} onChange={() => setOpenInNewTab(!openInNewTab)} /></>}{toolType === 'coming_soon' && <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Las herramientas próximas no tienen destino y no generan enlaces rotos.</p>}
    <Section title="Presentación" /><div className="grid gap-5 md:grid-cols-2"><Field label="Orden"><input type="number" min="0" value={displayOrder} onChange={(event) => setDisplayOrder(event.target.value)} className={INPUT} /></Field><Check label="Herramienta destacada" checked={isFeatured} onChange={() => setIsFeatured(!isFeatured)} /></div>
    <Section title="Publicación" /><Field label="Estado"><select value={status} onChange={(event) => setStatus(event.target.value as ToolStatus)} className={INPUT}><option value="draft">Borrador</option><option value="published">Publicada</option></select></Field>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}<div className="flex flex-wrap justify-between gap-3 border-t pt-6"><div>{initial && canDelete && <button type="button" disabled={saving} onClick={remove} className="rounded-lg border border-red-200 px-5 py-2.5 text-sm font-medium text-red-700 disabled:opacity-50">Eliminar</button>}</div><div className="flex gap-3"><button type="button" onClick={() => router.push('/admin/tools')} className="rounded-lg border px-5 py-2.5 text-sm font-medium">Cancelar</button><button disabled={saving} className="rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear herramienta'}</button></div></div>
  </form>
}

function Section({ title }: { title: string }) { return <h2 className="border-b pb-3 text-xl font-semibold">{title}</h2> }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-sm font-medium">{label}</span>{children}</label> }
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) { return <label className="flex items-center gap-3 rounded-lg border p-4 text-sm"><input type="checkbox" checked={checked} onChange={onChange} />{label}</label> }
function isUrl(value: string) { try { const url = new URL(value); return url.protocol === 'http:' || url.protocol === 'https:' } catch { return false } }
