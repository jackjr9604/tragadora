'use client'

import { useState } from 'react'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export type MediaCategory = { id: string; name: string; slug: string }

export function MediaCategoryManager({ categories, canCreate, canUpdate, canDelete, onChanged }: { categories: MediaCategory[]; canCreate: boolean; canUpdate: boolean; canDelete: boolean; onChanged: () => Promise<void> }) {
  const db = createClient()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<MediaCategory | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    const clean = name.trim()
    if (!clean) return setError('Escribe un nombre para la categoría.')
    setSaving(true); setError('')
    const result = editing
      ? await db.from('media_categories').update({ name: clean }).eq('id', editing.id)
      : await db.from('media_categories').insert({ name: clean, slug: uniqueSlug(clean) })
    if (result.error) setError(result.error.code === '23505' ? 'Ya existe una categoría con ese nombre o slug.' : result.error.message)
    else { setName(''); setEditing(null); await onChanged() }
    setSaving(false)
  }

  async function remove(category: MediaCategory) {
    if (!canDelete || !window.confirm(`¿Eliminar la categoría “${category.name}”? Los archivos se conservarán como Sin clasificar.`)) return
    setSaving(true); setError('')
    const result = await db.from('media_categories').delete().eq('id', category.id)
    if (result.error) setError(result.error.message)
    else await onChanged()
    setSaving(false)
  }

  return <><button type="button" onClick={() => setOpen(true)} className="admin-secondary-button px-4 py-2.5 text-sm">Gestionar categorías</button>{open && <div role="dialog" aria-modal="true" aria-label="Gestionar categorías" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"><header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-4"><div><h2 className="text-lg font-semibold">Categorías de Multimedia</h2><p className="text-sm text-slate-500">Crea, renombra o elimina categorías sin borrar sus archivos.</p></div><button type="button" onClick={() => setOpen(false)} className="rounded-lg border p-2" aria-label="Cerrar"><X className="size-4" /></button></header><div className="space-y-5 p-5">{(canCreate || (canUpdate && editing)) && <div className="flex flex-col gap-2 sm:flex-row"><input value={name} onChange={(event) => setName(event.target.value)} placeholder={editing ? 'Nuevo nombre' : 'Nueva categoría'} className="min-w-0 flex-1 rounded-lg border px-3 py-2.5" /><button type="button" disabled={saving} onClick={() => void save()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Plus className="size-4" />{editing ? 'Guardar nombre' : 'Crear categoría'}</button>{editing && <button type="button" onClick={() => { setEditing(null); setName('') }} className="rounded-lg border px-4 py-2.5 text-sm">Cancelar</button>}</div>}{error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="divide-y rounded-xl border">{categories.map((category) => <div key={category.id} className="flex items-center gap-3 px-4 py-3"><div className="min-w-0 flex-1"><p className="truncate font-medium">{category.name}</p><p className="truncate text-xs text-slate-500">{category.slug}</p></div>{canUpdate && <button type="button" onClick={() => { setEditing(category); setName(category.name); setError('') }} className="rounded-lg border p-2" aria-label={`Renombrar ${category.name}`}><Pencil className="size-4" /></button>}{canDelete && <button type="button" disabled={saving} onClick={() => void remove(category)} className="rounded-lg border border-red-200 p-2 text-red-700" aria-label={`Eliminar ${category.name}`}><Trash2 className="size-4" /></button>}</div>)}</div></div></div></div>}</>
}

function uniqueSlug(name: string) {
  const slug = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'categoria'
  return slug
}
