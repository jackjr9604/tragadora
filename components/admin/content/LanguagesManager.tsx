'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Language = {
  code: string
  name: string
  native_name: string
  is_active: boolean
  is_default: boolean
  sort_order: number
  auto_translate: boolean
}

const supabase = createClient()

export function LanguagesManager({ translationProviderConfigured }: { translationProviderConfigured: boolean }) {
  const [languages, setLanguages] = useState<Language[]>([])
  const [contentCounts, setContentCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({ code: '', name: '', nativeName: '', active: true, autoTranslate: false, generateInitial: false })

  async function load() {
    const [languagesResult, contentResult] = await Promise.all([
      supabase.from('languages').select('code, name, native_name, is_active, is_default, sort_order, auto_translate').order('sort_order').order('name'),
      supabase.from('site_content').select('language'),
    ])
    if (languagesResult.error) { setError(languagesResult.error.message); setLoading(false); return }
    const counts: Record<string, number> = {}
    for (const row of contentResult.data ?? []) counts[row.language] = (counts[row.language] ?? 0) + 1
    setLanguages(languagesResult.data ?? []); setContentCounts(counts); setLoading(false)
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timeout)
  }, [])

  async function addLanguage(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage('')
    const code = form.code.trim().toLowerCase()
    const result = await supabase.from('languages').insert({ code, name: form.name.trim(), native_name: form.nativeName.trim(), is_active: form.active, is_default: false, sort_order: languages.length * 10, auto_translate: form.autoTranslate })
    if (result.error) { setError(result.error.message); return }
    if (form.generateInitial && translationProviderConfigured) {
      const baseLanguage = languages.find((language) => language.is_default) ?? languages[0]
      const { data: { user } } = await supabase.auth.getUser()
      const sourceResult = await supabase.from('site_content').select('key, value, type, updated_at').eq('language', baseLanguage.code).neq('type', 'config')
      if (!user || sourceResult.error) { setError(sourceResult.error?.message ?? 'No se pudo iniciar la traducción inicial.'); await load(); return }
      for (const source of sourceResult.data ?? []) {
        if (!source.value?.trim()) continue
        const response = await fetch('/api/admin/content/translate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sourceText: source.value, sourceLang: baseLanguage.code, targetLang: code }) })
        const translated = await response.json() as { translation?: string; error?: string }
        if (!response.ok || !translated.translation) { setError(translated.error ?? 'No se pudo generar la traducción inicial.'); await load(); return }
        const now = new Date().toISOString()
        const contentResult = await supabase.from('site_content').insert({ key: source.key, language: code, value: translated.translation, type: source.type, updated_by: user.id, updated_at: now })
        if (contentResult.error) { setError(contentResult.error.message); await load(); return }
        const metaResult = await supabase.from('content_translation_meta').upsert({ key: source.key, language: code, source_language: baseLanguage.code, source_updated_at: source.updated_at, translated_at: now, translation_method: 'auto_generated', manually_edited: false, updated_at: now }, { onConflict: 'key,language' })
        if (metaResult.error) { setError(metaResult.error.message); await load(); return }
      }
    }
    setForm({ code: '', name: '', nativeName: '', active: true, autoTranslate: false, generateInitial: false })
    setMessage(form.generateInitial && !translationProviderConfigured ? 'Idioma agregado. Proveedor de traducción no configurado; la traducción inicial quedó pendiente.' : 'Idioma agregado correctamente.')
    await load()
  }

  async function updateLanguage(code: string, values: Partial<Language>) {
    setError(''); setMessage('')
    const result = await supabase.from('languages').update(values).eq('code', code)
    if (result.error) { setError(result.error.message); return }
    await load()
  }

  async function setDefault(code: string) {
    const selected = languages.find((language) => language.code === code)
    if (!selected || selected.is_default) return
    setError(''); setMessage('')
    const clearResult = await supabase.from('languages').update({ is_default: false }).eq('is_default', true)
    if (clearResult.error) { setError(clearResult.error.message); return }
    const setResult = await supabase.from('languages').update({ is_default: true, is_active: true }).eq('code', code)
    if (setResult.error) { setError(setResult.error.message); return }
    setMessage(`${selected.native_name} es ahora el idioma base.`); await load()
  }

  async function removeLanguage(language: Language) {
    if (language.is_default) { setError('No puedes eliminar el idioma base. Selecciona otro primero.'); return }
    const count = contentCounts[language.code] ?? 0
    if (count > 0) {
      const confirmation = window.prompt(`Este idioma tiene ${count} contenidos. Escribe ELIMINAR ${language.code.toUpperCase()} para borrarlo definitivamente. Recomendamos desactivarlo.`)
      if (confirmation !== `ELIMINAR ${language.code.toUpperCase()}`) return
    } else if (!window.confirm(`¿Eliminar el idioma ${language.native_name}?`)) return
    const metaResult = await supabase.from('content_translation_meta').delete().or(`language.eq.${language.code},source_language.eq.${language.code}`)
    if (metaResult.error) { setError(metaResult.error.message); return }
    if (count > 0) {
      const contentResult = await supabase.from('site_content').delete().eq('language', language.code)
      if (contentResult.error) { setError(contentResult.error.message); return }
    }
    const result = await supabase.from('languages').delete().eq('code', language.code)
    if (result.error) { setError(result.error.message); return }
    setMessage('Idioma eliminado.'); await load()
  }

  if (loading) return <p className="rounded-xl bg-white p-6 shadow">Cargando idiomas…</p>

  return <div className="space-y-6">
    <section className="overflow-hidden rounded-xl bg-white shadow"><div className="overflow-x-auto"><table className="w-full min-w-[900px]"><thead className="border-b bg-slate-50"><tr><th className="p-4 text-left">Idioma</th><th className="p-4 text-left">Código</th><th className="p-4 text-left">Activo</th><th className="p-4 text-left">Base</th><th className="p-4 text-left">Orden</th><th className="p-4 text-left">Auto traducción</th><th className="p-4 text-left">Contenido</th><th className="p-4 text-left">Acciones</th></tr></thead><tbody>{languages.map((language) => <tr key={language.code} className="border-b last:border-0"><td className="p-4"><p className="font-semibold">{language.native_name}</p><p className="text-sm text-slate-500">{language.name}</p></td><td className="p-4 font-mono uppercase">{language.code}</td><td className="p-4"><input type="checkbox" checked={language.is_active} disabled={language.is_default} onChange={(event) => void updateLanguage(language.code, { is_active: event.target.checked })} /></td><td className="p-4"><input type="radio" name="default-language" checked={language.is_default} onChange={() => void setDefault(language.code)} /></td><td className="p-4"><input type="number" value={language.sort_order} onChange={(event) => setLanguages((current) => current.map((item) => item.code === language.code ? { ...item, sort_order: Number(event.target.value) } : item))} onBlur={() => void updateLanguage(language.code, { sort_order: language.sort_order })} className="w-20 rounded-lg border p-2" /></td><td className="p-4"><input type="checkbox" checked={language.auto_translate} onChange={(event) => void updateLanguage(language.code, { auto_translate: event.target.checked })} /></td><td className="p-4">{contentCounts[language.code] ?? 0}</td><td className="p-4"><button type="button" onClick={() => void removeLanguage(language)} className="text-sm text-red-600 underline">Eliminar</button></td></tr>)}</tbody></table></div></section>
    <section className="rounded-xl bg-white p-6 shadow"><h2 className="text-xl font-semibold">Agregar idioma</h2><form onSubmit={addLanguage} className="mt-5 grid gap-4 md:grid-cols-3"><label className="text-sm">Código ISO<input required pattern="[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})?" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="fr" className="mt-1 w-full rounded-lg border p-3" /></label><label className="text-sm">Nombre<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="French" className="mt-1 w-full rounded-lg border p-3" /></label><label className="text-sm">Nombre nativo<input required value={form.nativeName} onChange={(event) => setForm({ ...form, nativeName: event.target.value })} placeholder="Français" className="mt-1 w-full rounded-lg border p-3" /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Activo</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.autoTranslate} onChange={(event) => setForm({ ...form, autoTranslate: event.target.checked })} /> Permitir auto traducción</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.generateInitial} onChange={(event) => setForm({ ...form, generateInitial: event.target.checked })} /> Generar traducción inicial desde el idioma base</label><div className="md:col-span-3"><p className={`mb-4 text-sm ${translationProviderConfigured ? 'text-emerald-700' : 'text-amber-700'}`}>{translationProviderConfigured ? 'Proveedor de traducción configurado.' : 'Proveedor de traducción no configurado.'}</p><button className="rounded-lg bg-black px-5 py-3 text-sm font-medium text-white">Agregar idioma</button></div></form></section>
    {error && <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}{message && <p className="rounded-lg bg-green-50 p-4 text-sm text-green-700">{message}</p>}
    <Link href="/admin/content" className="inline-flex rounded-lg border bg-white px-5 py-3">Volver a contenido</Link>
  </div>
}
