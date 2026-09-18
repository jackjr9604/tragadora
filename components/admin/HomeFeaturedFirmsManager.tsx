'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SearchInput } from '@/components/shared/SearchInput'
import { useAdminPermission } from '@/components/admin/AdminPermissionsProvider'

type Platform = { id: string; name: string; status: string }
type FeaturedRow = {
  id: string
  platform_id: string
  active: boolean
  sort_order: number
  badge: string | null
  description: string | null
  cta_label: string | null
  starts_at: string | null
  ends_at: string | null
}

type Props = { platforms: Platform[]; initialRows: FeaturedRow[]; loadError: string | null }
const controlClass = 'mt-1 w-full rounded-lg border p-2 text-sm text-black'

export function HomeFeaturedFirmsManager({ platforms, initialRows, loadError }: Props) {
  const canCreate = useAdminPermission('home.create')
  const canUpdate = useAdminPermission('home.update')
  const canDelete = useAdminPermission('home.delete')
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState(initialRows)
  const [platformId, setPlatformId] = useState('')
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState(loadError ?? '')
  const names = new Map(platforms.map((platform) => [platform.id, platform.name]))
  const available = platforms.filter((platform) => !rows.some((row) => row.platform_id === platform.id))
  const matchingAvailable = available.filter((platform) => platform.id === platformId || platform.name.toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es')))

  function change(id: string, values: Partial<FeaturedRow>) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...values } : row))
  }

  async function add() {
    if (!canCreate) return
    if (!platformId) return
    setError('')
    const { data, error: insertError } = await supabase
      .from('home_featured_platforms')
      .insert({ platform_id: platformId, sort_order: rows.length + 1 })
      .select('id, platform_id, active, sort_order, badge, description, cta_label, starts_at, ends_at')
      .single()
    if (insertError) return setError(insertError.message)
    setRows([...rows, data])
    setPlatformId('')
    setMessage('Firma destacada agregada.')
  }

  async function save(row: FeaturedRow) {
    if (!canUpdate) return
    setError('')
    setMessage('')
    const { error: updateError } = await supabase.from('home_featured_platforms').update({
      active: row.active,
      sort_order: row.sort_order,
      badge: row.badge || null,
      description: row.description || null,
      cta_label: row.cta_label || null,
      starts_at: row.starts_at || null,
      ends_at: row.ends_at || null,
    }).eq('id', row.id)
    if (updateError) return setError(updateError.message)
    setMessage('Cambios guardados. El Home se actualizará al vencer su caché.')
  }

  async function remove(row: FeaturedRow) {
    if (!canDelete) return
    if (!window.confirm(`¿Quitar ${names.get(row.platform_id) ?? 'esta firma'} de destacadas?`)) return
    const { error: deleteError } = await supabase.from('home_featured_platforms').delete().eq('id', row.id)
    if (deleteError) return setError(deleteError.message)
    setRows(rows.filter((item) => item.id !== row.id))
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><h1 className="text-3xl font-bold">Home</h1><p className="mt-1 text-slate-500">Control editorial de las Prop Firms destacadas.</p></div>
          <Link href="/admin/content/home" className="rounded-lg border bg-white px-4 py-3 text-sm font-medium">Editar textos y secciones</Link>
        </div>
        <section className="mt-8 rounded-xl bg-white p-6 shadow">
          <h2 className="text-xl font-semibold">Firmas destacadas</h2>
          <div className="mt-4 max-w-md"><SearchInput value={search} onChange={setSearch} placeholder="Buscar firma para destacar..." /></div>
          {canCreate && <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <select value={platformId} onChange={(event) => setPlatformId(event.target.value)} className="min-w-0 flex-1 rounded-lg border p-3">
              <option value="">Selecciona una Prop Firm</option>
              {matchingAvailable.map((platform) => <option key={platform.id} value={platform.id}>{platform.name}{platform.status !== 'active' ? ' (inactiva)' : ''}</option>)}
            </select>
            <button type="button" onClick={() => void add()} disabled={!platformId} className="rounded-lg bg-black px-5 py-3 text-white disabled:opacity-40">+ Agregar firma destacada</button>
          </div>}
          <div className="mt-6 space-y-3">
            {rows.map((row, index) => (
              <article key={row.id} className="grid gap-3 rounded-lg border p-4 lg:grid-cols-6">
                <div><p className="font-semibold">{names.get(row.platform_id) ?? 'Plataforma no encontrada'}</p><p className="text-xs text-slate-500">Posición {index + 1}</p></div>
                <Field label="Estado"><select value={String(row.active)} onChange={(event) => change(row.id, { active: event.target.value === 'true' })} className={controlClass}><option value="true">Activa</option><option value="false">Inactiva</option></select></Field>
                <Field label="Orden"><input type="number" min="1" value={row.sort_order} onChange={(event) => change(row.id, { sort_order: Number(event.target.value) })} className={controlClass} /></Field>
                <Field label="Badge"><input value={row.badge ?? ''} onChange={(event) => change(row.id, { badge: event.target.value })} className={controlClass} /></Field>
                <Field label="CTA"><input value={row.cta_label ?? ''} onChange={(event) => change(row.id, { cta_label: event.target.value })} className={controlClass} /></Field>
                <div className="flex items-end gap-2">{canUpdate && <button type="button" onClick={() => void save(row)} className="rounded-lg bg-black px-3 py-2 text-sm text-white">Guardar</button>}{canDelete && <button type="button" onClick={() => void remove(row)} className="rounded-lg border px-3 py-2 text-sm text-red-600">Quitar</button>}</div>
                <label className="text-xs text-slate-500 lg:col-span-3">Descripción editorial<textarea rows={3} maxLength={240} value={row.description ?? ''} onChange={(event) => change(row.id, { description: event.target.value })} placeholder="Opcional; si queda vacía se usa la descripción pública de la firma." className={`${controlClass} resize-y`} /><span className="mt-1 block text-right">{row.description?.length ?? 0}/240</span></label>
                <Field label="Visible desde"><input type="datetime-local" value={toLocalInput(row.starts_at)} onChange={(event) => change(row.id, { starts_at: fromLocalInput(event.target.value) })} className={controlClass} /></Field>
                <Field label="Visible hasta"><input type="datetime-local" value={toLocalInput(row.ends_at)} onChange={(event) => change(row.id, { ends_at: fromLocalInput(event.target.value) })} className={controlClass} /></Field>
              </article>
            ))}
            {!rows.length && <p className="rounded-lg bg-slate-50 p-5 text-sm text-slate-500">No hay firmas destacadas configuradas. La sección pública permanecerá oculta.</p>}
          </div>
        </section>
        {error && <p className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        {message && <p className="mt-4 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-700">{message}</p>}
      </div>
    </main>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-xs text-slate-500">{label}{children}</label>
}

function toLocalInput(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function fromLocalInput(value: string) {
  return value ? new Date(value).toISOString() : null
}
