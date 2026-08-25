'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowUp, Languages } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { ContentPageSchema } from '@/lib/content-schema'
import { automaticTranslationConfigured } from '@/lib/content-translation'

const languages = [{ code: 'es', label: 'ES' }, { code: 'en', label: 'EN' }, { code: 'pt', label: 'PT' }] as const
type Language = typeof languages[number]['code']
type Values = Record<string, Record<Language, string>>
type Config = Record<string, { enabled: boolean; order: string; align: string; titleSize: string }>

export function PageContentEditor({ page }: { page: ContentPageSchema }) {
  const supabase = useMemo(() => createClient(), [])
  const [values, setValues] = useState<Values>({})
  const [config, setConfig] = useState<Config>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data, error: loadError } = await supabase.from('site_content').select('key, language, value').like('key', `${page.slug}.%`)
      if (loadError) { setError(loadError.message); setLoading(false); return }
      const nextValues: Values = {}
      const nextConfig: Config = {}
      page.sections.forEach((section, index) => {
        nextConfig[section.name] = { enabled: true, order: String(index + 1), align: 'left', titleSize: 'large' }
        for (const field of section.fields) nextValues[`${page.slug}.${section.name}.${field.name}`] = { es: field.fallback, en: '', pt: '' }
      })
      for (const row of data ?? []) {
        const [, sectionName, fieldName] = row.key.split('.')
        if (!nextConfig[sectionName]) continue
        if (fieldName === 'enabled') nextConfig[sectionName].enabled = row.value !== 'false'
        else if (fieldName === 'order') nextConfig[sectionName].order = row.value
        else if (fieldName === 'align') nextConfig[sectionName].align = row.value
        else if (fieldName === 'title_size') nextConfig[sectionName].titleSize = row.value
        else if (nextValues[row.key] && languages.some((language) => language.code === row.language)) nextValues[row.key][row.language as Language] = row.value
      }
      setValues(nextValues); setConfig(nextConfig); setLoading(false)
    }
    void load()
  }, [page, supabase])

  const orderedSections = loading ? [] : [...page.sections].sort((a, b) => Number(config[a.name].order) - Number(config[b.name].order))

  function moveSection(sectionName: string, direction: -1 | 1) {
    const index = orderedSections.findIndex((section) => section.name === sectionName)
    const target = orderedSections[index + direction]
    if (!target) return
    setConfig((current) => ({
      ...current,
      [sectionName]: { ...current[sectionName], order: current[target.name].order },
      [target.name]: { ...current[target.name], order: current[sectionName].order },
    }))
  }

  async function saveRow(key: string, language: string, value: string, type: string, userId: string) {
    const existing = await supabase.from('site_content').select('id').eq('key', key).eq('language', language).maybeSingle()
    const payload = { key, language, value, type, updated_by: userId, updated_at: new Date().toISOString() }
    return existing.data ? supabase.from('site_content').update(payload).eq('id', existing.data.id) : supabase.from('site_content').insert(payload)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(''); setMessage('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Debes iniciar sesión.'); setSaving(false); return }
    for (const section of page.sections) {
      const current = config[section.name]
      for (const [name, value] of [['enabled', String(current.enabled)], ['order', current.order], ['align', current.align], ['title_size', current.titleSize]]) {
        const result = await saveRow(`${page.slug}.${section.name}.${name}`, 'es', value, 'config', user.id)
        if (result.error) { setError(result.error.message); setSaving(false); return }
      }
      for (const field of section.fields) {
        const key = `${page.slug}.${section.name}.${field.name}`
        for (const language of languages) {
          const result = await saveRow(key, language.code, values[key]?.[language.code] ?? '', field.type ?? 'text', user.id)
          if (result.error) { setError(result.error.message); setSaving(false); return }
        }
      }
    }
    setMessage('Contenido y orden guardados correctamente.'); setSaving(false)
  }

  if (loading) return <p className="rounded-xl bg-white p-6 text-slate-500 shadow">Cargando contenido…</p>

  return <form onSubmit={submit} className="space-y-6">
    {orderedSections.map((section, index) => {
      const sectionConfig = config[section.name]
      const key = (field: string) => `${page.slug}.${section.name}.${field}`
      return <section key={section.name} className={`overflow-hidden rounded-xl bg-white shadow ${sectionConfig.enabled ? '' : 'opacity-70'}`}>
        <div className="flex flex-col justify-between gap-4 border-b p-6 sm:flex-row sm:items-center"><div><div className="flex flex-wrap items-center gap-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">#{sectionConfig.order}</span><h2 className="text-xl font-semibold">{section.label}</h2>{!sectionConfig.enabled && <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">Inactiva</span>}</div><p className="mt-1 text-sm text-slate-500">{section.description}</p></div><div className="flex gap-2"><button type="button" disabled={index === 0} onClick={() => moveSection(section.name, -1)} className="move-up inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-30"><ArrowUp className="size-4" /> Subir</button><button type="button" disabled={index === orderedSections.length - 1} onClick={() => moveSection(section.name, 1)} className="move-down inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-30"><ArrowDown className="size-4" /> Bajar</button></div></div>
        <div className="grid gap-8 p-6 xl:grid-cols-[.8fr_1.2fr]"><div><p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Vista previa · orden {sectionConfig.order}</p><div className={`relative rounded-xl bg-slate-950 p-7 text-white ${sectionConfig.enabled ? '' : 'grayscale'} ${sectionConfig.align === 'center' ? 'text-center' : sectionConfig.align === 'right' ? 'text-right' : 'text-left'}`}><p className="text-xs uppercase tracking-[.18em] text-cyan-300">{values[key('badge')]?.es || section.label}</p><h3 className={`mt-4 font-bold ${sectionConfig.titleSize === 'small' ? 'text-2xl' : sectionConfig.titleSize === 'xlarge' ? 'text-4xl' : 'text-3xl'}`}>{values[key('title')]?.es || section.label}</h3><p className="mt-3 text-sm leading-6 text-slate-400">{values[key('subtitle')]?.es || section.description}</p><div className={`mt-5 flex gap-2 ${sectionConfig.align === 'center' ? 'justify-center' : sectionConfig.align === 'right' ? 'justify-end' : ''}`}><span className="rounded-lg bg-amber-300 px-3 py-2 text-xs font-bold text-slate-950">{values[key('cta')]?.es || values[key('primary_cta')]?.es || 'Acción principal'}</span>{values[key('secondary_cta')]?.es && <span className="rounded-lg border border-white/20 px-3 py-2 text-xs">{values[key('secondary_cta')].es}</span>}</div>{!sectionConfig.enabled && <span className="absolute right-3 top-3 rounded-full bg-red-500/20 px-2 py-1 text-[10px] font-bold uppercase text-red-200">No visible</span>}</div></div>
          <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-4"><label className="flex items-center gap-2 rounded-lg border p-3 text-sm"><input type="checkbox" checked={sectionConfig.enabled} onChange={(event) => setConfig((current) => ({ ...current, [section.name]: { ...current[section.name], enabled: event.target.checked } }))} /> Activa</label><label className="text-sm">Orden<input readOnly value={sectionConfig.order} className="mt-1 w-full rounded-lg border bg-slate-50 p-2.5" /></label><label className="text-sm">Alineación<select value={sectionConfig.align} onChange={(event) => setConfig((current) => ({ ...current, [section.name]: { ...current[section.name], align: event.target.value } }))} className="mt-1 w-full rounded-lg border p-2.5"><option value="left">Izquierda</option><option value="center">Centro</option><option value="right">Derecha</option></select></label><label className="text-sm">Título<select value={sectionConfig.titleSize} onChange={(event) => setConfig((current) => ({ ...current, [section.name]: { ...current[section.name], titleSize: event.target.value } }))} className="mt-1 w-full rounded-lg border p-2.5"><option value="small">Pequeño</option><option value="large">Grande</option><option value="xlarge">Extra grande</option></select></label></div>
            {section.fields.map((field) => <div key={field.name}><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">{field.label}</p><button type="button" disabled={!automaticTranslationConfigured} title="Requiere configurar un proveedor" className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs text-slate-500 disabled:cursor-not-allowed disabled:opacity-50"><Languages className="size-3.5" /> Generar traducción · Próximamente</button></div><div className="grid gap-3 lg:grid-cols-3">{languages.map((language) => <label key={language.code} className="text-xs font-semibold text-slate-500">{language.label}{language.code !== 'es' && !values[key(field.name)]?.[language.code] && <span className="ml-2 font-normal text-amber-600">Pendiente de traducción</span>}{field.type === 'textarea' ? <textarea value={values[key(field.name)]?.[language.code] ?? ''} onChange={(event) => setValues((current) => ({ ...current, [key(field.name)]: { ...current[key(field.name)], [language.code]: event.target.value } }))} className="mt-1 min-h-24 w-full rounded-lg border p-3 text-sm font-normal text-slate-900" /> : <input value={values[key(field.name)]?.[language.code] ?? ''} onChange={(event) => setValues((current) => ({ ...current, [key(field.name)]: { ...current[key(field.name)], [language.code]: event.target.value } }))} className="mt-1 w-full rounded-lg border p-3 text-sm font-normal text-slate-900" />}</label>)}</div></div>)}
          </div></div>
      </section>
    })}
    {error && <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}{message && <p className="rounded-lg bg-green-50 p-4 text-sm text-green-700">{message}</p>}
    <div className="sticky bottom-4 flex justify-end gap-3 rounded-xl border bg-white/95 p-4 shadow-lg backdrop-blur"><Link href="/admin/content" className="rounded-lg border px-5 py-3">Volver</Link><button disabled={saving} className="rounded-lg bg-black px-6 py-3 font-medium text-white disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar página'}</button></div>
  </form>
}
