'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, CheckSquare, Copy, FileIcon, FolderInput, ImageIcon, Square, Trash2, Upload, X } from 'lucide-react'
import { MediaUploadQueue } from '@/components/admin/MediaUploadQueue'
import { MediaCategoryManager } from '@/components/admin/MediaCategoryManager'
import { SearchInput } from '@/components/shared/SearchInput'
import { useAdminPermission } from '@/components/admin/AdminPermissionsProvider'
import { createClient } from '@/lib/supabase/client'

type Category = { id: string; name: string; slug: string }
type Media = { id: string; file_name: string; file_url: string; file_type: string | null; alt_text: string | null; uploaded_by: string | null; created_at: string; category_id: string | null }
type TypeFilter = 'all' | 'image' | 'document' | 'other'

export default function MediaPage() {
  const canCreate = useAdminPermission('media.create')
  const canUpdate = useAdminPermission('media.update')
  const canDelete = useAdminPermission('media.delete')
  const supabase = useMemo(() => createClient(), [])
  const [media, setMedia] = useState<Media[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [selected, setSelected] = useState<Media | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showUpload, setShowUpload] = useState(false)
  const [detailCategory, setDetailCategory] = useState('')
  const [detailAlt, setDetailAlt] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [bulkCategory, setBulkCategory] = useState('')
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkReport, setBulkReport] = useState('')

  async function load() {
    setLoading(true); setError('')
    const [mediaResult, categoriesResult] = await Promise.all([
      supabase.from('media').select('id, file_name, file_url, file_type, alt_text, uploaded_by, created_at, category_id').order('created_at', { ascending: false }),
      supabase.from('media_categories').select('id, name, slug').order('name'),
    ])
    if (mediaResult.error || categoriesResult.error) setError(mediaResult.error?.message ?? categoriesResult.error?.message ?? 'No se pudo cargar Multimedia.')
    else { setMedia((mediaResult.data ?? []) as Media[]); setCategories((categoriesResult.data ?? []) as Category[]) }
    setLoading(false)
  }

  useEffect(() => { const task = window.setTimeout(() => { void load() }, 0); return () => window.clearTimeout(task) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const categoryMap = useMemo(() => new Map(categories.map((item) => [item.id, item.name])), [categories])
  const visible = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('es')
    return media
      .filter((item) => categoryFilter === 'all' || (categoryFilter === 'unclassified' ? !item.category_id : item.category_id === categoryFilter))
      .filter((item) => typeFilter === 'all' || mediaKind(item.file_type) === typeFilter)
      .filter((item) => !needle || `${item.file_name} ${item.alt_text ?? ''}`.toLocaleLowerCase('es').includes(needle))
  }, [media, search, categoryFilter, typeFilter])
  const allVisibleSelected = visible.length > 0 && visible.every((item) => selectedIds.has(item.id))

  function openDetail(item: Media) { setSelected(item); setDetailCategory(item.category_id ?? ''); setDetailAlt(item.alt_text ?? ''); setCopied(false) }

  function toggleSelection(id: string) { setSelectedIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next }) }
  function selectVisible() { setSelectedIds(new Set(visible.map((item) => item.id))) }
  function clearSelection() { setSelectedIds(new Set()); setBulkReport('') }

  async function runBulk(action: 'move' | 'delete') {
    const ids = [...selectedIds]
    if (!ids.length) return
    if (action === 'delete' && !window.confirm(`¿Eliminar ${ids.length} archivos seleccionados? Los archivos en uso serán protegidos y no se eliminarán.`)) return
    setBulkRunning(true); setError(''); setBulkReport('')
    const response = await fetch('/api/admin/media/bulk', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ids, categoryId: action === 'move' ? bulkCategory || null : undefined }) })
    const body = await response.json() as { error?: string; results?: { id: string; success: boolean; error?: string; warning?: string }[] }
    if (!response.ok || !body.results) setError(body.error ?? 'No se pudo completar la operación masiva.')
    else {
      const failed = body.results.filter((item) => !item.success)
      const warnings = body.results.filter((item) => item.warning)
      const succeeded = body.results.filter((item) => item.success).length
      setBulkReport([`${succeeded} de ${ids.length} procesados correctamente.`, ...failed.map((item) => `${media.find((entry) => entry.id === item.id)?.file_name ?? item.id}: ${item.error}`), ...warnings.map((item) => `${media.find((entry) => entry.id === item.id)?.file_name ?? item.id}: ${item.warning}`)].join('\n'))
      setSelectedIds(new Set(failed.map((item) => item.id)))
      await load()
    }
    setBulkRunning(false)
  }

  async function saveDetail() {
    if (!canUpdate || !selected) return
    setSaving(true); setError('')
    const result = await supabase.from('media').update({ category_id: detailCategory || null, alt_text: detailAlt.trim() || null }).eq('id', selected.id)
    if (result.error) setError(result.error.message)
    else { setSelected(null); await load() }
    setSaving(false)
  }

  async function deleteSelected() {
    if (!canDelete || !selected) return
    if (!window.confirm(`¿Eliminar ${selected.file_name}? Esta acción no se puede deshacer.`)) { setSaving(false); return }
    setSaving(true); setError('')
    const response = await fetch('/api/admin/media/bulk', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'delete', ids: [selected.id] }) })
    const body = await response.json() as { error?: string; results?: { success: boolean; error?: string; warning?: string }[] }
    const result = body.results?.[0]
    if (!response.ok || !result?.success) setError(result?.error ?? body.error ?? 'No se pudo eliminar el archivo.')
    else { if (result.warning) setBulkReport(result.warning); setSelected(null); await load() }
    setSaving(false)
  }

  async function copyUrl() { if (!selected) return; await navigator.clipboard.writeText(selected.file_url); setCopied(true) }

  return <main className="p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-[1500px]">
    <header className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="text-3xl font-bold">Multimedia</h1><p className="mt-1 text-sm text-slate-500">Organiza, reutiliza y administra archivos y categorías.</p></div><div className="flex flex-wrap gap-2"><MediaCategoryManager categories={categories} canCreate={canCreate} canUpdate={canUpdate} canDelete={canDelete} onChanged={load} />{canCreate && <button type="button" onClick={() => setShowUpload(true)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white"><Upload className="size-4" /> Subir archivos</button>}</div></header>
    <div className="mb-5 grid gap-3 rounded-xl bg-white p-3 shadow-sm sm:grid-cols-2 xl:grid-cols-[minmax(280px,1fr)_220px_180px]"><SearchInput value={search} onChange={setSearch} placeholder="Buscar archivos..." /><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded-lg border px-3"><option value="all">Todas las categorías</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}<option value="unclassified">Sin clasificar</option></select><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as TypeFilter)} className="rounded-lg border px-3"><option value="all">Todos los tipos</option><option value="image">Imágenes</option><option value="document">Documentos</option><option value="other">Otros</option></select></div>
    {error && <p className="mb-5 rounded-lg bg-red-50 p-4 text-sm text-red-600">{error}</p>}
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500"><span>{visible.length} {visible.length === 1 ? 'archivo' : 'archivos'}</span><div className="flex flex-wrap gap-3"><button type="button" onClick={allVisibleSelected ? clearSelection : selectVisible} className="inline-flex items-center gap-2 font-medium text-slate-700">{allVisibleSelected ? <CheckSquare className="size-4" /> : <Square className="size-4" />}{allVisibleSelected ? 'Deseleccionar' : 'Seleccionar todo'}</button>{(search || categoryFilter !== 'all' || typeFilter !== 'all') && <button type="button" onClick={() => { setSearch(''); setCategoryFilter('all'); setTypeFilter('all') }} className="font-medium text-slate-700">Limpiar filtros</button>}</div></div>
    {selectedIds.size > 0 && <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center"><strong className="text-sm">{selectedIds.size} seleccionados</strong><select value={bulkCategory} onChange={(event) => setBulkCategory(event.target.value)} className="rounded-lg border bg-white px-3 py-2 text-sm"><option value="">Sin clasificar</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{canUpdate && <button type="button" disabled={bulkRunning} onClick={() => void runBulk('move')} className="inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium"><FolderInput className="size-4" /> Cambiar categoría</button>}{canDelete && <button type="button" disabled={bulkRunning} onClick={() => void runBulk('delete')} className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700"><Trash2 className="size-4" /> Eliminar seleccionados</button>}<button type="button" onClick={clearSelection} className="px-2 py-2 text-sm font-medium">Deseleccionar</button></div></div>}
    {bulkReport && <pre className="mb-5 whitespace-pre-wrap rounded-lg bg-slate-900 p-4 text-xs text-slate-100">{bulkReport}</pre>}
    {loading ? <p className="rounded-xl bg-white p-10 text-center text-slate-500">Cargando archivos…</p> : visible.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-7">{visible.map((item) => <article key={item.id} className={`group relative min-w-0 overflow-hidden rounded-xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md ${selectedIds.has(item.id) ? 'border-amber-500 ring-2 ring-amber-200' : ''}`}><button type="button" onClick={() => toggleSelection(item.id)} className="absolute left-2 top-2 z-10 rounded-md border bg-white/95 p-1.5 shadow" aria-label={`${selectedIds.has(item.id) ? 'Deseleccionar' : 'Seleccionar'} ${item.file_name}`}>{selectedIds.has(item.id) ? <CheckSquare className="size-4 text-amber-700" /> : <Square className="size-4 text-slate-500" />}</button><button type="button" onClick={() => openDetail(item)} className="block w-full text-left"><MediaPreview media={item} /><div className="p-3"><p className="truncate text-sm font-medium" title={item.file_name}>{item.file_name}</p><p className="mt-1 truncate text-xs text-slate-500">{item.category_id ? categoryMap.get(item.category_id) ?? 'Categoría' : 'Sin clasificar'}</p></div></button></article>)}</div> : <div className="rounded-xl border border-dashed bg-white p-12 text-center"><ImageIcon className="mx-auto size-8 text-slate-300" /><p className="mt-3 font-medium">No hay archivos para estos filtros</p><p className="mt-1 text-sm text-slate-500">Prueba otra búsqueda o sube el primer archivo.</p></div>}
  </div>
  {showUpload && <Modal title="Subir archivos" onClose={() => setShowUpload(false)} wide><MediaUploadQueue categories={categories} onClose={() => setShowUpload(false)} onComplete={load} /></Modal>}
  {selected && <Modal title="Detalle del archivo" onClose={() => setSelected(null)} wide><div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]"><div className="flex min-h-72 items-center justify-center rounded-xl bg-slate-100 p-4"><MediaImage media={selected} className="max-h-[55vh] max-w-full object-contain" /></div><div className="min-w-0 space-y-4"><div><p className="truncate font-semibold" title={selected.file_name}>{selected.file_name}</p><p className="mt-1 text-xs text-slate-500">{selected.file_type || 'Tipo desconocido'} · {new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(selected.created_at))}</p></div><Field label="Categoría"><select value={detailCategory} onChange={(event) => setDetailCategory(event.target.value)} className="w-full rounded-lg border p-3"><option value="">Sin clasificar</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Texto alternativo"><textarea value={detailAlt} onChange={(event) => setDetailAlt(event.target.value)} className="min-h-24 w-full rounded-lg border p-3" /></Field><div><p className="mb-2 text-sm font-medium">URL</p><div className="flex gap-2"><input readOnly value={selected.file_url} className="min-w-0 flex-1 rounded-lg border bg-slate-50 p-2.5 text-xs" /><button type="button" onClick={() => void copyUrl()} className="inline-flex items-center gap-2 rounded-lg border px-3 text-sm">{copied ? <Check className="size-4" /> : <Copy className="size-4" />}{copied ? 'Copiada' : 'Copiar'}</button></div></div><div className="flex flex-wrap justify-end gap-3 border-t pt-4">{canDelete && <button type="button" onClick={() => void deleteSelected()} disabled={saving} className="mr-auto inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-red-700"><Trash2 className="size-4" /> Eliminar</button>}<button type="button" onClick={() => setSelected(null)} className="rounded-lg border px-4 py-2.5">Cerrar</button>{canUpdate && <button type="button" onClick={() => void saveDetail()} disabled={saving} className="rounded-lg bg-black px-4 py-2.5 text-white disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar cambios'}</button>}</div></div></div></Modal>}
  </main>
}

function mediaKind(type: string | null): Exclude<TypeFilter, 'all'> { if (type?.startsWith('image/')) return 'image'; if (type?.includes('pdf') || type?.includes('document') || type?.includes('text')) return 'document'; return 'other' }
function MediaPreview({ media }: { media: Media }) { return <div className="flex aspect-square items-center justify-center overflow-hidden bg-slate-100">{mediaKind(media.file_type) === 'image' ? <MediaImage media={media} className="h-full w-full object-contain p-2" /> : <FileIcon className="size-10 text-slate-300" />}</div> }
function MediaImage({ media, className }: { media: Media; className: string }) {
  // URLs dinámicas administradas por Supabase Storage.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={media.file_url} alt={media.alt_text || media.file_name} className={className} />
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-sm font-medium">{label}</span>{children}</label> }
function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) { return <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"><div className={`max-h-[92vh] w-full overflow-y-auto rounded-2xl bg-white shadow-2xl ${wide ? 'max-w-5xl' : 'max-w-xl'}`}><header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-4"><h2 className="text-lg font-semibold">{title}</h2><button type="button" onClick={onClose} className="rounded-lg border p-2" aria-label="Cerrar"><X className="size-4" /></button></header><div className="p-5">{children}</div></div></div> }
