'use client'

import { useEffect, useMemo, useState } from 'react'
import { ImageIcon, Search, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export type PickedMedia = { id: string; file_name: string; file_url: string; alt_text: string | null }
type Category = { id: string; name: string; slug: string }
type MediaRow = PickedMedia & { category_id: string | null }

export function MediaPicker({ value, onChange, defaultCategory = 'logos-firmas', label = 'Imagen' }: { value: PickedMedia | null; onChange: (media: PickedMedia | null) => void; defaultCategory?: string; label?: string }) {
  const [open, setOpen] = useState(false)
  const [media, setMedia] = useState<MediaRow[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    async function load() {
      setLoading(true); setError('')
      const supabase = createClient()
      const [mediaResult, categoryResult] = await Promise.all([
        supabase.from('media').select('id, file_name, file_url, alt_text, category_id').order('created_at', { ascending: false }),
        supabase.from('media_categories').select('id, name, slug').order('name'),
      ])
      if (cancelled) return
      if (mediaResult.error || categoryResult.error) setError(mediaResult.error?.message ?? categoryResult.error?.message ?? 'No se pudo cargar Multimedia.')
      else {
        const loadedCategories = (categoryResult.data ?? []) as Category[]
        setMedia((mediaResult.data ?? []) as MediaRow[]); setCategories(loadedCategories)
        const preferred = loadedCategories.find((item) => item.slug === defaultCategory)
        setCategory(preferred?.id ?? 'all')
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [open, defaultCategory])

  const visible = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('es')
    return media.filter((item) => category === 'all' || item.category_id === category).filter((item) => !needle || `${item.file_name} ${item.alt_text ?? ''}`.toLocaleLowerCase('es').includes(needle))
  }, [media, search, category])

  return <div>
    <p className="mb-2 text-sm font-medium">{label}</p>
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-slate-50 p-3">{value ? <MediaThumb media={value} className="size-16" /> : <span className="flex size-16 items-center justify-center rounded-lg border border-dashed bg-white text-slate-400"><ImageIcon /></span>}<div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{value?.file_name ?? 'Sin archivo seleccionado'}</p><p className="mt-1 text-xs text-slate-500">Selecciona un archivo de la biblioteca.</p></div><button type="button" onClick={() => setOpen(true)} className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white">{value ? 'Cambiar' : 'Seleccionar'}</button>{value && <button type="button" onClick={() => onChange(null)} className="rounded-lg border px-3 py-2 text-sm">Quitar</button>}</div>
    {open && <div role="dialog" aria-modal="true" aria-label="Seleccionar multimedia" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"><div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b px-5 py-4"><div><h2 className="text-lg font-semibold">Seleccionar multimedia</h2><p className="text-sm text-slate-500">Busca y elige un archivo existente.</p></div><button type="button" onClick={() => setOpen(false)} className="rounded-lg border p-2" aria-label="Cerrar"><X className="size-4" /></button></div><div className="grid gap-3 border-b p-4 sm:grid-cols-[1fr_220px]"><label className="relative"><Search className="absolute left-3 top-3 size-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar archivos..." className="w-full rounded-lg border py-2.5 pl-9 pr-3" /></label><select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-lg border px-3"><option value="all">Todas las categorías</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div className="overflow-y-auto p-4">{loading ? <p className="py-12 text-center text-slate-500">Cargando archivos…</p> : error ? <p className="rounded-lg bg-red-50 p-4 text-sm text-red-600">{error}</p> : visible.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">{visible.map((item) => <button type="button" key={item.id} onClick={() => { onChange(item); setOpen(false) }} className="overflow-hidden rounded-xl border bg-white text-left transition hover:border-black hover:shadow"><MediaThumb media={item} className="aspect-square w-full" /><p className="truncate p-2 text-xs font-medium">{item.file_name}</p></button>)}</div> : <p className="py-12 text-center text-slate-500">No hay archivos para estos filtros.</p>}</div></div></div>}
  </div>
}

function MediaThumb({ media, className }: { media: PickedMedia; className: string }) {
  // URLs administradas por Supabase Storage.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={media.file_url} alt={media.alt_text || media.file_name} className={`${className} rounded-lg bg-slate-100 object-contain`} />
}
