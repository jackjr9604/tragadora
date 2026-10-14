'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowUp, Languages } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { ContentPageSchema } from '@/lib/content-schema'
import { savePageSourceContent } from '@/app/admin/content/[page]/actions'

type Language = { code: string; native_name: string; is_default: boolean }
type Config = Record<string, { enabled: boolean; order: string; align: string; titleSize: string }>
const CONFIG_FIELDS = new Set(['enabled', 'order', 'align', 'title_size'])
const supabase = createClient()

export function PageContentEditor({ page }: { page: ContentPageSchema }) {
  const [sourceLanguage, setSourceLanguage] = useState<Language | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [config, setConfig] = useState<Config>(() => createInitialConfig(page))
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(''), [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [languageResult, contentResult] = await Promise.all([
        supabase.from('languages').select('code,native_name,is_default').eq('is_default', true).eq('is_active', true).maybeSingle(),
        supabase.from('site_content').select('key,language,value').like('key', `${page.slug}.%`),
      ])
      if (cancelled) return
      if (languageResult.error || !languageResult.data) { setError('No existe un idioma fuente activo.'); setLoading(false); return }
      const language = languageResult.data, nextValues: Record<string, string> = {}, nextConfig = createInitialConfig(page)
      for (const section of page.sections) for (const field of section.translatableFields) nextValues[key(page.slug, section.name, field.name)] = field.fallback
      for (const row of contentResult.data ?? []) {
        const [, sectionName, fieldName] = row.key.split('.')
        if (!nextConfig[sectionName]) continue
        if (row.language === 'global' && CONFIG_FIELDS.has(fieldName)) applyConfig(nextConfig[sectionName], fieldName, row.value)
        else if (row.language === language.code && row.key in nextValues) nextValues[row.key] = row.value
      }
      setSourceLanguage(language); setValues(nextValues); setConfig(nextConfig); setLoading(false)
      if (contentResult.error) setError(contentResult.error.message)
    }
    void load()
    return () => { cancelled = true }
  }, [page])

  const orderedSections = [...page.sections].sort((a, b) => Number(config[a.name]?.order) - Number(config[b.name]?.order))
  function moveSection(sectionName: string, direction: -1 | 1) {
    const index = orderedSections.findIndex((section) => section.name === sectionName), target = orderedSections[index + direction]
    if (!target) return
    setConfig((current) => ({ ...current, [sectionName]: { ...current[sectionName], order: current[target.name].order }, [target.name]: { ...current[target.name], order: current[sectionName].order } }))
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setMessage('')
    const result = await savePageSourceContent(page.slug, { values, config })
    if (result.ok) setMessage(result.message); else setError(result.message)
    setSaving(false)
  }

  if (loading) return <p className="rounded-xl bg-white p-6 text-slate-500 shadow">Cargando contenido…</p>
  if (!sourceLanguage) return <p className="rounded-xl bg-red-50 p-6 text-red-700">{error || 'No hay un idioma fuente disponible.'}</p>

  return <form onSubmit={submit} className="space-y-6">
    <section className="rounded-xl border border-emerald-200 bg-white p-6 shadow"><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center"><div><p className="text-sm text-slate-500">{page.label}</p><h2 className="mt-1 text-2xl font-bold">Contenido fuente · {sourceLanguage.native_name}</h2><p className="mt-2 max-w-3xl text-sm text-slate-600">Aquí solo se editan el idioma fuente y la configuración global. Las traducciones se solicitan, revisan y publican exclusivamente mediante el workflow editorial.</p></div><Link href={`/admin/translations?module=site_content&q=${encodeURIComponent(`${page.slug}.`)}`} className="admin-primary-button gap-2 px-4 py-3 text-sm"><Languages className="size-4" /> Gestionar traducciones de la página</Link></div></section>

    {orderedSections.map((section, index) => { const current = config[section.name], fieldKey = (field: string) => key(page.slug, section.name, field); return <section key={section.name} className={`overflow-hidden rounded-xl bg-white shadow ${current.enabled ? '' : 'opacity-70'}`}>
      <div className="flex flex-col justify-between gap-4 border-b p-6 sm:flex-row sm:items-center"><div><div className="flex flex-wrap items-center gap-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">#{current.order}</span><h2 className="text-xl font-semibold">{section.label}</h2>{!current.enabled && <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs text-red-700">Inactiva</span>}</div><p className="mt-1 text-sm text-slate-500">{section.description}</p></div><div className="flex flex-wrap gap-2"><Link href={`/admin/translations?module=site_content&q=${encodeURIComponent(`${page.slug}.${section.name}.`)}`} className="admin-secondary-button gap-2 px-3 py-2 text-sm"><Languages className="size-4" /> Traducciones</Link><button type="button" disabled={index === 0} onClick={() => moveSection(section.name, -1)} className="rounded-lg border p-2 disabled:opacity-30" aria-label="Subir sección"><ArrowUp className="size-4" /></button><button type="button" disabled={index === orderedSections.length - 1} onClick={() => moveSection(section.name, 1)} className="rounded-lg border p-2 disabled:opacity-30" aria-label="Bajar sección"><ArrowDown className="size-4" /></button></div></div>
      <div className="grid gap-8 p-6 xl:grid-cols-[.75fr_1.25fr]"><div><p className="mb-3 text-xs font-semibold uppercase text-slate-400">Vista previa · {sourceLanguage.code.toUpperCase()}</p><div className={`rounded-xl bg-slate-950 p-7 text-white ${current.align === 'center' ? 'text-center' : current.align === 'right' ? 'text-right' : 'text-left'}`}><p className="text-xs uppercase tracking-[.18em] text-cyan-300">{values[fieldKey('badge')] || section.label}</p><h3 className={`mt-4 font-bold ${current.titleSize === 'small' ? 'text-2xl' : current.titleSize === 'xlarge' ? 'text-4xl' : 'text-3xl'}`}>{values[fieldKey('title')] || section.label}</h3><p className="mt-3 text-sm leading-6 text-slate-400">{values[fieldKey('subtitle')] || section.description}</p></div></div>
        <div className="space-y-5"><div><p className="mb-3 text-xs font-semibold uppercase text-slate-400">Configuración global de la sección</p><div className="grid gap-4 sm:grid-cols-4"><label className="flex items-center gap-2 rounded-lg border p-3 text-sm"><input type="checkbox" checked={current.enabled} onChange={(event) => setConfig((old) => ({ ...old, [section.name]: { ...old[section.name], enabled: event.target.checked } }))} /> Activa</label><label className="text-sm">Orden<input readOnly value={current.order} className="mt-1 w-full rounded-lg border bg-slate-50 p-2.5" /></label><label className="text-sm">Alineación<select value={current.align} onChange={(event) => setConfig((old) => ({ ...old, [section.name]: { ...old[section.name], align: event.target.value } }))} className="mt-1 w-full rounded-lg border p-2.5"><option value="left">Izquierda</option><option value="center">Centro</option><option value="right">Derecha</option></select></label><label className="text-sm">Título<select value={current.titleSize} onChange={(event) => setConfig((old) => ({ ...old, [section.name]: { ...old[section.name], titleSize: event.target.value } }))} className="mt-1 w-full rounded-lg border p-2.5"><option value="small">Pequeño</option><option value="large">Grande</option><option value="xlarge">Extra grande</option></select></label></div></div>
          {section.translatableFields.map((field) => { const resourceId = fieldKey(field.name); return <label key={field.name} className="block"><span className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm font-medium"><span>{field.label}</span><Link href={`/admin/translations?selected=site_content:${encodeURIComponent(resourceId)}#editor`} className="text-xs font-semibold text-amber-700">Abrir workflow de traducción</Link></span>{field.type === 'textarea' ? <textarea value={values[resourceId] ?? ''} onChange={(event) => setValues((old) => ({ ...old, [resourceId]: event.target.value }))} className="min-h-24 w-full rounded-lg border p-3" /> : <input value={values[resourceId] ?? ''} onChange={(event) => setValues((old) => ({ ...old, [resourceId]: event.target.value }))} className="w-full rounded-lg border p-3" />}</label> })}
        </div></div>
    </section> })}
    {error && <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}{message && <p className="rounded-lg bg-green-50 p-4 text-sm text-green-700">{message}</p>}
    <div className="sticky bottom-4 flex justify-end gap-3 rounded-xl border bg-white/95 p-4 shadow-lg backdrop-blur"><Link href="/admin/content" className="rounded-lg border px-5 py-3">Volver</Link><button disabled={saving} className="rounded-lg bg-black px-6 py-3 font-medium text-white disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar fuente y configuración'}</button></div>
  </form>
}

function key(page: string, section: string, field: string) { return `${page}.${section}.${field}` }
function createInitialConfig(page: ContentPageSchema): Config { return Object.fromEntries(page.sections.map((section, index) => [section.name, { enabled: section.globalConfig.enabled, order: String(index + 1), align: section.globalConfig.align, titleSize: section.globalConfig.titleSize }])) }
function applyConfig(config: Config[string], field: string, value: string) { if (field === 'enabled') config.enabled = value !== 'false'; else if (field === 'order') config.order = value; else if (field === 'align') config.align = value; else if (field === 'title_size') config.titleSize = value }
