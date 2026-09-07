'use client'

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy, FileIcon, ImageIcon, Search, Upload, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Category = { id: string; name: string; slug: string }
type Media = { id: string; file_name: string; file_url: string; file_type: string | null; alt_text: string | null; uploaded_by: string | null; created_at: string; category_id: string | null }
type TypeFilter = 'all' | 'image' | 'document' | 'other'

export default function MediaPage() {
  const supabase = useMemo(() => createClient(), [])
  const fileInput = useRef<HTMLInputElement>(null)
  const [media, setMedia] = useState<Media[]>([]), [categories, setCategories] = useState<Category[]>([])
  const [search, setSearch] = useState(''), [categoryFilter, setCategoryFilter] = useState('all'), [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [selected, setSelected] = useState<Media | null>(null), [showUpload, setShowUpload] = useState(false)
  const [file, setFile] = useState<File | null>(null), [uploadCategory, setUploadCategory] = useState(''), [uploadAlt, setUploadAlt] = useState('')
  const [detailCategory, setDetailCategory] = useState(''), [detailAlt, setDetailAlt] = useState('')
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState(''), [copied, setCopied] = useState(false)

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

  useEffect(() => {
    const task = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(task)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const categoryMap = useMemo(() => new Map(categories.map((item) => [item.id, item.name])), [categories])
  const visible = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('es')
    return media.filter((item) => categoryFilter === 'all' || (categoryFilter === 'unclassified' ? !item.category_id : item.category_id === categoryFilter)).filter((item) => typeFilter === 'all' || mediaKind(item.file_type) === typeFilter).filter((item) => !needle || `${item.file_name} ${item.alt_text ?? ''}`.toLocaleLowerCase('es').includes(needle))
  }, [media, search, categoryFilter, typeFilter])

  function openDetail(item: Media) { setSelected(item); setDetailCategory(item.category_id ?? ''); setDetailAlt(item.alt_text ?? ''); setCopied(false) }
  function handleFileChange(event: ChangeEvent<HTMLInputElement>) { setFile(event.target.files?.[0] ?? null) }

  async function uploadFile() {
    if (!file) { setError('Selecciona un archivo.'); return }
    setSaving(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Debes iniciar sesión.'); setSaving(false); return }
    const extension = file.name.split('.').pop()?.toLowerCase() || 'bin'
    const filePath = `uploads/${crypto.randomUUID()}.${extension}`
    const { error: uploadError } = await supabase.storage.from('media').upload(filePath, file, { cacheControl: '3600', upsert: false })
    if (uploadError) { setError(uploadError.message); setSaving(false); return }
    const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(filePath)
    const fallbackCategory = categories.find((item) => item.slug === 'sin-clasificar')?.id ?? null
    const { error: databaseError } = await supabase.from('media').insert({ file_name: file.name, file_url: publicUrl, file_type: file.type || null, alt_text: uploadAlt.trim() || null, uploaded_by: user.id, category_id: uploadCategory || fallbackCategory })
    if (databaseError) { setError(databaseError.message); setSaving(false); return }
    setFile(null); setUploadAlt(''); setUploadCategory(''); setShowUpload(false); if (fileInput.current) fileInput.current.value = ''
    await load(); setSaving(false)
  }

  async function saveDetail() {
    if (!selected) return
    setSaving(true); setError('')
    const { error: updateError } = await supabase.from('media').update({ category_id: detailCategory || null, alt_text: detailAlt.trim() || null }).eq('id', selected.id)
    if (updateError) setError(updateError.message)
    else { setSelected(null); await load() }
    setSaving(false)
  }

  async function copyUrl() { if (!selected) return; await navigator.clipboard.writeText(selected.file_url); setCopied(true) }

  return <main className="p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-[1500px]">
    <header className="mb-6"><h1 className="text-3xl font-bold">Multimedia</h1><p className="mt-1 text-sm text-slate-500">Organiza y reutiliza los archivos de Tradagora.</p></header>
    <div className="mb-5 grid gap-3 rounded-xl bg-white p-3 shadow-sm sm:grid-cols-2 xl:grid-cols-[minmax(280px,1fr)_220px_180px_auto]"><label className="relative"><Search className="absolute left-3 top-3 size-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar archivos..." className="w-full rounded-lg border py-2.5 pl-9 pr-3" /></label><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded-lg border px-3"><option value="all">Todas las categorías</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}<option value="unclassified">Sin clasificar</option></select><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as TypeFilter)} className="rounded-lg border px-3"><option value="all">Todos los tipos</option><option value="image">Imágenes</option><option value="document">Documentos</option><option value="other">Otros</option></select><button type="button" onClick={() => setShowUpload(true)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white"><Upload className="size-4" /> Subir archivo</button></div>
    {error && <p className="mb-5 rounded-lg bg-red-50 p-4 text-sm text-red-600">{error}</p>}
    <div className="mb-3 flex items-center justify-between text-sm text-slate-500"><span>{visible.length} {visible.length === 1 ? 'archivo' : 'archivos'}</span>{(search || categoryFilter !== 'all' || typeFilter !== 'all') && <button type="button" onClick={() => { setSearch(''); setCategoryFilter('all'); setTypeFilter('all') }} className="font-medium text-slate-700">Limpiar filtros</button>}</div>
    {loading ? <p className="rounded-xl bg-white p-10 text-center text-slate-500">Cargando archivos…</p> : visible.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-7">{visible.map((item) => <button type="button" key={item.id} onClick={() => openDetail(item)} className="group min-w-0 overflow-hidden rounded-xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md"><MediaPreview media={item} /><div className="p-3"><p className="truncate text-sm font-medium" title={item.file_name}>{item.file_name}</p><p className="mt-1 truncate text-xs text-slate-500">{item.category_id ? categoryMap.get(item.category_id) ?? 'Categoría' : 'Sin clasificar'}</p></div></button>)}</div> : <div className="rounded-xl border border-dashed bg-white p-12 text-center"><ImageIcon className="mx-auto size-8 text-slate-300" /><p className="mt-3 font-medium">No hay archivos para estos filtros</p><p className="mt-1 text-sm text-slate-500">Prueba otra búsqueda o sube el primer archivo.</p></div>}
  </div>
  {showUpload && <Modal title="Subir archivo" onClose={() => setShowUpload(false)}><div className="space-y-4"><input ref={fileInput} type="file" onChange={handleFileChange} className="w-full rounded-lg border p-3" /><Field label="Categoría"><select value={uploadCategory} onChange={(event) => setUploadCategory(event.target.value)} className="w-full rounded-lg border p-3"><option value="">Sin clasificar</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Texto alternativo"><input value={uploadAlt} onChange={(event) => setUploadAlt(event.target.value)} className="w-full rounded-lg border p-3" placeholder="Descripción breve de la imagen" /></Field>{file && <p className="text-sm text-slate-500">Seleccionado: {file.name}</p>}<div className="flex justify-end gap-3"><button type="button" onClick={() => setShowUpload(false)} className="rounded-lg border px-4 py-2.5">Cancelar</button><button type="button" onClick={uploadFile} disabled={saving} className="rounded-lg bg-black px-4 py-2.5 text-white disabled:opacity-50">{saving ? 'Subiendo…' : 'Subir archivo'}</button></div></div></Modal>}
  {selected && <Modal title="Detalle del archivo" onClose={() => setSelected(null)} wide><div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]"><div className="flex min-h-72 items-center justify-center rounded-xl bg-slate-100 p-4"><MediaImage media={selected} className="max-h-[55vh] max-w-full object-contain" /></div><div className="min-w-0 space-y-4"><div><p className="truncate font-semibold" title={selected.file_name}>{selected.file_name}</p><p className="mt-1 text-xs text-slate-500">{selected.file_type || 'Tipo desconocido'} · {new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(selected.created_at))}</p></div><Field label="Categoría"><select value={detailCategory} onChange={(event) => setDetailCategory(event.target.value)} className="w-full rounded-lg border p-3"><option value="">Sin clasificar</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Texto alternativo"><textarea value={detailAlt} onChange={(event) => setDetailAlt(event.target.value)} className="min-h-24 w-full rounded-lg border p-3" /></Field><div><p className="mb-2 text-sm font-medium">URL</p><div className="flex gap-2"><input readOnly value={selected.file_url} className="min-w-0 flex-1 rounded-lg border bg-slate-50 p-2.5 text-xs" /><button type="button" onClick={copyUrl} className="inline-flex items-center gap-2 rounded-lg border px-3 text-sm">{copied ? <Check className="size-4" /> : <Copy className="size-4" />}{copied ? 'Copiada' : 'Copiar'}</button></div></div><div className="flex justify-end gap-3 border-t pt-4"><button type="button" onClick={() => setSelected(null)} className="rounded-lg border px-4 py-2.5">Cerrar</button><button type="button" onClick={saveDetail} disabled={saving} className="rounded-lg bg-black px-4 py-2.5 text-white disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar cambios'}</button></div></div></div></Modal>}
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
