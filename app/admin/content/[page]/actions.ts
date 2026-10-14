'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getContentPage } from '@/lib/content-schema'
import { revalidateSiteContent } from '@/lib/admin-content-revalidation'

type SourcePayload = {
  values: Record<string, string>
  config: Record<string, { enabled: boolean; order: string; align: string; titleSize: string }>
}

export async function savePageSourceContent(pageSlug: string, payload: SourcePayload) {
  const page = getContentPage(pageSlug)
  if (!page || !payload || typeof payload !== 'object') return { ok: false, message: 'Página de contenido inválida.' }
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return { ok: false, message: 'La sesión expiró. Vuelve a iniciar sesión.' }
  const { data: allowed } = await db.rpc('has_admin_permission', { permission_key: 'content.update' })
  if (allowed !== true) return { ok: false, message: 'No tienes permiso para editar contenido.' }
  const languageResult = await db.from('languages').select('code').eq('is_default', true).eq('is_active', true).maybeSingle()
  if (languageResult.error || !languageResult.data) return { ok: false, message: 'No existe un idioma fuente activo.' }
  const sourceLanguage = languageResult.data.code

  const now = new Date().toISOString()
  const sourceRows = page.sections.flatMap((section) => section.translatableFields.map((field) => {
    const key = `${page.slug}.${section.name}.${field.name}`
    const value = typeof payload.values?.[key] === 'string' ? payload.values[key] : ''
    return { key, language: sourceLanguage, value, type: field.type ?? 'text', updated_by: user.id, updated_at: now }
  }))
  const configRows = page.sections.flatMap((section, index) => {
    const current = payload.config?.[section.name]
    const align = ['left', 'center', 'right'].includes(current?.align) ? current.align : section.globalConfig.align
    const titleSize = ['small', 'large', 'xlarge'].includes(current?.titleSize) ? current.titleSize : section.globalConfig.titleSize
    const order = /^\d+$/.test(current?.order ?? '') ? current.order : String(index + 1)
    return [
      ['enabled', String(current?.enabled ?? section.globalConfig.enabled)], ['order', order],
      ['align', align], ['title_size', titleSize],
    ].map(([name, value]) => ({ key: `${page.slug}.${section.name}.${name}`, language: 'global', value, type: 'config', updated_by: user.id, updated_at: now }))
  })
  const rows = [...sourceRows, ...configRows]
  const existing = await db.from('site_content').select('key,language').in('key', rows.map((row) => row.key))
  if (existing.error) return { ok: false, message: existing.error.message }
  const existingIds = new Set((existing.data ?? []).map((row) => `${row.key}:${row.language}`))
  if (rows.some((row) => !existingIds.has(`${row.key}:${row.language}`))) {
    const { data: canCreate } = await db.rpc('has_admin_permission', { permission_key: 'content.create' })
    if (canCreate !== true) return { ok: false, message: 'Falta permiso para crear campos de contenido que todavía no existen.' }
  }
  const result = await createAdminClient().from('site_content').upsert(rows, { onConflict: 'key,language' })
  if (result.error) return { ok: false, message: result.error.message }
  revalidateSiteContent(page.slug)
  return { ok: true, message: 'Contenido fuente y configuración global actualizados. Las traducciones conservan su workflow editorial.' }
}
