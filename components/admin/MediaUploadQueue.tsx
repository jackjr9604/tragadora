'use client'
/* eslint-disable @next/next/no-img-element -- local blob previews are not compatible with next/image. */

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, LoaderCircle, RotateCcw, Upload, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { uploadMediaFile } from '@/lib/media-upload'

type Category = { id: string; name: string; slug: string }
type Status = 'pending' | 'uploading' | 'completed' | 'error'
type QueueItem = { id: string; file: File; status: Status; error: string; preview: string | null }

export function MediaUploadQueue({ categories, onClose, onComplete }: { categories: Category[]; onClose: () => void; onComplete: () => Promise<void> }) {
  const supabase = useMemo(() => createClient(), [])
  const input = useRef<HTMLInputElement>(null)
  const previews = useRef<string[]>([])
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [category, setCategory] = useState('')
  const [running, setRunning] = useState(false)
  const fallbackCategory = categories.find((item) => item.slug === 'sin-clasificar')?.id ?? null

  useEffect(() => () => { previews.current.forEach((preview) => URL.revokeObjectURL(preview)) }, [])

  function addFiles(files: File[]) {
    const additions = files.map((file): QueueItem => {
      const preview = file.type.startsWith('image/') && file.type !== 'image/svg+xml' ? URL.createObjectURL(file) : null
      if (preview) previews.current.push(preview)
      return { id: crypto.randomUUID(), file, status: 'pending', error: '', preview }
    })
    setQueue((current) => [...current, ...additions])
  }
  function choose(event: ChangeEvent<HTMLInputElement>) { addFiles(Array.from(event.target.files ?? [])); event.target.value = '' }
  function drop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); addFiles(Array.from(event.dataTransfer.files)) }
  function update(id: string, patch: Partial<QueueItem>) { setQueue((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item)) }
  function remove(id: string) { setQueue((current) => { const item = current.find((entry) => entry.id === id); if (item?.preview) URL.revokeObjectURL(item.preview); return current.filter((entry) => entry.id !== id) }) }

  async function uploadAll() {
    const pending = queue.filter((item) => item.status === 'pending' || item.status === 'error')
    if (!pending.length) return
    setRunning(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setQueue((current) => current.map((item) => pending.some((entry) => entry.id === item.id) ? { ...item, status: 'error', error: 'Debes iniciar sesión.' } : item)); setRunning(false); return
    }
    for (const item of pending) {
      update(item.id, { status: 'uploading', error: '' })
      const result = await uploadMediaFile({ supabase, file: item.file, userId: user.id, categoryId: category || fallbackCategory })
      if (result.error) { update(item.id, { status: 'error', error: result.error }); continue }
      update(item.id, { status: 'completed' })
    }
    await onComplete()
    setRunning(false)
  }

  const completed = queue.filter((item) => item.status === 'completed').length
  const errors = queue.filter((item) => item.status === 'error').length
  return <div className="space-y-5">
    <div onDragOver={(event) => event.preventDefault()} onDrop={drop} className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-7 text-center"><Upload className="mx-auto size-7 text-slate-400" /><p className="mt-2 font-medium">Arrastra uno o varios archivos</p><p className="mt-1 text-xs text-slate-500">O selecciona archivos desde tu equipo. SVG permanece bloqueado por seguridad.</p><input ref={input} type="file" multiple onChange={choose} className="sr-only" /><button type="button" onClick={() => input.current?.click()} className="admin-secondary-button mt-4 px-4 py-2 text-sm">Seleccionar archivos</button></div>
    <label className="block text-sm font-medium">Categoría<select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 w-full rounded-lg border p-3"><option value="">Sin clasificar</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    {queue.length > 0 && <><div className="flex items-center justify-between text-sm"><span>{running ? `Subiendo ${completed + 1} de ${queue.length}` : `${completed} de ${queue.length} completados`}</span>{errors > 0 && <span className="text-red-600">{errors} con error</span>}</div><div className="max-h-80 space-y-2 overflow-y-auto">{queue.map((item) => <QueueRow key={item.id} item={item} onRemove={() => remove(item.id)} onRetry={() => update(item.id, { status: 'pending', error: '' })} />)}</div></>}
    <div className="flex flex-wrap justify-end gap-3 border-t pt-4"><button type="button" onClick={onClose} disabled={running} className="rounded-lg border px-4 py-2.5">Cerrar</button>{errors > 0 && <button type="button" onClick={() => setQueue((current) => current.map((item) => item.status === 'error' ? { ...item, status: 'pending', error: '' } : item))} disabled={running} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5"><RotateCcw className="size-4" /> Preparar reintento</button>}<button type="button" onClick={() => void uploadAll()} disabled={running || !queue.some((item) => item.status === 'pending' || item.status === 'error')} className="rounded-lg bg-black px-4 py-2.5 text-white disabled:opacity-50">{running ? 'Subiendo…' : 'Subir todos'}</button></div>
  </div>
}

function QueueRow({ item, onRemove, onRetry }: { item: QueueItem; onRemove: () => void; onRetry: () => void }) {
  return <div className="flex items-center gap-3 rounded-lg border p-3">{item.preview ? <img src={item.preview} alt="" className="size-12 rounded bg-slate-100 object-contain" /> : <span className="flex size-12 items-center justify-center rounded bg-slate-100 text-xs font-bold text-slate-400">FILE</span>}<div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.file.name}</p><p className="text-xs text-slate-500">{formatBytes(item.file.size)} · {item.file.type || 'Tipo desconocido'}</p>{item.error && <p className="mt-1 text-xs text-red-600">{item.error}</p>}</div><StatusIcon status={item.status} />{item.status === 'error' && <button type="button" onClick={onRetry} className="inline-flex items-center gap-1.5 rounded border px-2.5 py-2 text-xs font-semibold" aria-label={`Reintentar ${item.file.name}`}><RotateCcw className="size-4" />Reintentar</button>}{item.status !== 'uploading' && <button type="button" onClick={onRemove} className="rounded border p-2" aria-label={`Quitar ${item.file.name}`}><X className="size-4" /></button>}</div>
}

function StatusIcon({ status }: { status: Status }) { if (status === 'uploading') return <LoaderCircle className="size-5 animate-spin text-amber-600" />; if (status === 'completed') return <CheckCircle2 className="size-5 text-emerald-600" />; if (status === 'error') return <AlertCircle className="size-5 text-red-600" />; return <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">Pendiente</span> }
function formatBytes(bytes: number) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / (1024 * 1024)).toFixed(1)} MB` }
