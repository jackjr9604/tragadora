'use client'
/* eslint-disable @next/next/no-img-element -- previews use dynamic Supabase and blob URLs. */

import Link from 'next/link'
import { ChangeEvent, useMemo, useRef, useState } from 'react'
import { MediaPicker, type PickedMedia } from '@/components/admin/MediaPicker'
import { BRANDING_SLOTS, type BrandingAsset, type BrandingSlotKey } from '@/lib/branding-config'
import { createClient } from '@/lib/supabase/client'
import { uploadMediaFile } from '@/lib/media-upload'

type Assignment = PickedMedia & { alt_text: string | null }

export function BrandingManager({ initial, resolved, canCreate, canUpdate, canDelete, canUploadMedia }: {
  initial: Partial<Record<BrandingSlotKey, Assignment>>
  resolved: Record<BrandingSlotKey, BrandingAsset>
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
  canUploadMedia: boolean
}) {
  const supabase = useMemo(() => createClient(), [])
  const uploadInput = useRef<HTMLInputElement>(null)
  const [values, setValues] = useState(initial)
  const [assigned, setAssigned] = useState<Partial<Record<BrandingSlotKey, boolean>>>(() => Object.fromEntries(Object.keys(initial).map((key) => [key, true])))
  const [alt, setAlt] = useState<Partial<Record<BrandingSlotKey, string>>>(() => Object.fromEntries(Object.entries(initial).map(([key, value]) => [key, value?.alt_text ?? ''])))
  const [saving, setSaving] = useState<BrandingSlotKey | null>(null)
  const [uploadTarget, setUploadTarget] = useState<BrandingSlotKey | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function save(key: BrandingSlotKey) {
    const media = values[key]
    if (!media) { setError('Selecciona una imagen de Multimedia antes de guardar.'); return }
    setSaving(key); setError(''); setMessage('')
    const response = await fetch('/api/admin/branding', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key, mediaId: media.id, altText: alt[key]?.trim() || null }) })
    const result = await response.json() as { success?: boolean; error?: string }
    if (!response.ok) setError(result.error ?? 'No se pudo guardar el recurso.')
    else { setAssigned((current) => ({ ...current, [key]: true })); setMessage('Recurso actualizado. La caché pública fue invalidada.') }
    setSaving(null)
  }

  async function uploadAndAssign(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !uploadTarget) return
    const key = uploadTarget
    setSaving(key); setError(''); setMessage('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Debes iniciar sesión.'); setSaving(null); return }
    const categoryResult = await supabase.from('media_categories').select('id').eq('slug', 'logos-generales').maybeSingle()
    const uploaded = await uploadMediaFile({ supabase, file, userId: user.id, categoryId: categoryResult.data?.id ?? null, altText: alt[key] || 'Tradagora' })
    if (!uploaded.media || uploaded.error) { setError(uploaded.error ?? 'No se pudo subir el archivo.'); setSaving(null); return }
    const media = uploaded.media
    setValues((current) => ({ ...current, [key]: media }))
    const response = await fetch('/api/admin/branding', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key, mediaId: media.id, altText: alt[key]?.trim() || null }) })
    const result = await response.json() as { error?: string }
    if (!response.ok) setError(result.error ?? 'El archivo se subió, pero no pudo asignarse al slot.')
    else { setAssigned((current) => ({ ...current, [key]: true })); setMessage('Archivo subido a Multimedia y asignado al slot.') }
    setSaving(null); setUploadTarget(null)
  }

  async function reset(key: BrandingSlotKey) {
    setSaving(key); setError(''); setMessage('')
    const response = await fetch('/api/admin/branding', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key }) })
    const result = await response.json() as { success?: boolean; error?: string }
    if (!response.ok) setError(result.error ?? 'No se pudo restablecer el recurso.')
    else { setValues((current) => ({ ...current, [key]: undefined })); setAssigned((current) => ({ ...current, [key]: false })); setAlt((current) => ({ ...current, [key]: '' })); setMessage('Slot restablecido a su fallback seguro.') }
    setSaving(null)
  }

  return <div className="space-y-5">
    <input ref={uploadInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" onChange={(event) => void uploadAndAssign(event)} className="sr-only" />
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"><span>Los archivos se administran en Multimedia; aquí se asigna su propósito global.</span><Link href="/admin/media" className="admin-secondary-button px-3 py-2">Subir nuevo archivo</Link></div>
    {message && <p className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-700">{message}</p>}
    {error && <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <div className="grid gap-5 xl:grid-cols-2">{BRANDING_SLOTS.map((slot) => {
      const selected = values[slot.key]
      const fallback = resolved[slot.key] ?? (slot.fallback.startsWith('/') ? { url: slot.fallback, alt: 'Tradagora', fileName: slot.fallback.split('/').pop() ?? 'Tradagora' } : resolved[slot.fallback as BrandingSlotKey]) ?? { url: '/brand/tradagora-icon.png', alt: 'Tradagora', fileName: 'tradagora-icon.png' }
      const preview = selected ? { url: selected.file_url, alt: alt[slot.key] || selected.alt_text || 'Tradagora', fileName: selected.file_name } : { url: fallback.url, alt: fallback.alt, fileName: fallback.fileName }
      const canSave = selected ? (assigned[slot.key] ? canUpdate : canCreate) : false
      return <article key={slot.key} className="rounded-2xl border bg-white p-5 shadow-sm">
        <div><p className="text-xs font-bold uppercase tracking-[.14em] text-amber-700">{slot.key}</p><h2 className="mt-1 text-lg font-semibold text-slate-950">{slot.label}</h2><p className="mt-1 text-sm text-slate-500">{slot.description}</p></div>
        <BrandPreview src={preview.url} alt={preview.alt} />
        <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600"><p className="truncate"><strong>Archivo:</strong> {preview.fileName}</p><p className="mt-1"><strong>Estado:</strong> {selected ? 'Configurado' : 'Fallback activo'}</p></div>
        <div className="mt-4"><MediaPicker label="Archivo asignado" value={selected ?? null} onChange={(media) => setValues((current) => ({ ...current, [slot.key]: media ?? undefined }))} defaultCategory="logos-generales" imagesOnly /></div>
        {canUploadMedia && <button type="button" onClick={() => { setUploadTarget(slot.key); window.setTimeout(() => uploadInput.current?.click(), 0) }} disabled={saving === slot.key} className="admin-secondary-button mt-3 px-3 py-2 text-sm">Subir nuevo y asignar</button>}
        <label className="mt-4 block text-sm font-medium">Texto alternativo<input value={alt[slot.key] ?? ''} onChange={(event) => setAlt((current) => ({ ...current, [slot.key]: event.target.value }))} placeholder="Tradagora" className="mt-2 w-full rounded-lg border p-3" /></label>
        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t pt-4">{assigned[slot.key] && canDelete && <button type="button" onClick={() => void reset(slot.key)} disabled={saving === slot.key} className="admin-secondary-button px-4 py-2 text-sm">Usar fallback</button>}<button type="button" onClick={() => void save(slot.key)} disabled={!canSave || saving === slot.key} className="admin-primary-button px-4 py-2 text-sm disabled:opacity-50">{saving === slot.key ? 'Guardando…' : 'Guardar asignación'}</button></div>
      </article>
    })}</div>
  </div>
}

function BrandPreview({ src, alt }: { src: string; alt: string }) {
  const [dimensions, setDimensions] = useState('')
  return <div className="mt-5"><div className="grid grid-cols-2 overflow-hidden rounded-xl border"><div className="flex h-36 items-center justify-center bg-white p-4"><img src={src} alt={alt} onLoad={(event) => setDimensions(`${event.currentTarget.naturalWidth} × ${event.currentTarget.naturalHeight}px`)} className="max-h-full max-w-full object-contain" /></div><div className="flex h-36 items-center justify-center bg-[#07111e] p-4"><img src={src} alt="" aria-hidden="true" className="max-h-full max-w-full object-contain" /></div></div><div className="mt-2 flex justify-between text-xs text-slate-500"><span>Fondo claro · Fondo oscuro</span><span>{dimensions || 'Dimensiones al cargar'}</span></div></div>
}
