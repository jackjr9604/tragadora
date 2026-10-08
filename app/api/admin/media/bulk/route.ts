import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentAdminPermissions, hasPermission } from '@/lib/admin-permissions-server'
import { mediaStoragePath, sanitizeMediaIds } from '@/lib/media-admin'

type Payload = { action?: 'move' | 'delete'; ids?: string[]; categoryId?: string | null }
type ItemResult = { id: string; success: boolean; error?: string; warning?: string }

const REFERENCES = [
  ['branding_assets', 'media_id', 'Identidad visual'],
  ['platforms', 'logo_media_id', 'firmas, brokers o exchanges'],
  ['tools', 'logo_media_id', 'herramientas o calculadoras'],
  ['communities', 'logo_media_id', 'comunidades'],
  ['blog_posts', 'cover_media_id', 'Blog'],
  ['giveaways', 'cover_media_id', 'Giveaways'],
] as const

export async function POST(request: Request) {
  const body = await request.json() as Payload
  const ids = sanitizeMediaIds(body.ids ?? [])
  if (!body.action || !ids.length) return NextResponse.json({ success: false, error: 'Operación o archivos inválidos.' }, { status: 400 })

  const access = await getCurrentAdminPermissions()
  const permission = body.action === 'delete' ? 'media.delete' : 'media.update'
  if (!access.userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(access, permission)) return NextResponse.json({ success: false, error: 'No tienes permiso para esta operación.' }, { status: 403 })

  const db = createAdminClient()
  if (body.action === 'move' && body.categoryId) {
    const category = await db.from('media_categories').select('id').eq('id', body.categoryId).maybeSingle()
    if (category.error || !category.data) return NextResponse.json({ success: false, error: 'La categoría seleccionada no existe.' }, { status: 400 })
  }

  const results: ItemResult[] = []
  for (const id of ids) results.push(body.action === 'move'
    ? await moveMedia(db, id, body.categoryId ?? null)
    : await deleteMedia(db, id))

  return NextResponse.json({ success: results.every((item) => item.success), results })
}

async function moveMedia(db: ReturnType<typeof createAdminClient>, id: string, categoryId: string | null): Promise<ItemResult> {
  const result = await db.from('media').update({ category_id: categoryId }).eq('id', id).select('id').maybeSingle()
  if (result.error) return { id, success: false, error: result.error.message }
  if (!result.data) return { id, success: false, error: 'Archivo no encontrado o sin permiso.' }
  return { id, success: true }
}

async function deleteMedia(db: ReturnType<typeof createAdminClient>, id: string): Promise<ItemResult> {
  const media = await db.from('media').select('id, file_url').eq('id', id).maybeSingle()
  if (media.error) return { id, success: false, error: media.error.message }
  if (!media.data) return { id, success: false, error: 'Archivo no encontrado.' }

  const references: string[] = []
  for (const [table, column, label] of REFERENCES) {
    const result = await db.from(table).select('*', { count: 'exact', head: true }).eq(column, id)
    if (result.error) return { id, success: false, error: `No se pudo verificar referencias en ${label}: ${result.error.message}` }
    if ((result.count ?? 0) > 0) references.push(label)
  }
  const content = await db.from('site_content').select('*', { count: 'exact', head: true }).eq('value', media.data.file_url)
  if (content.error) return { id, success: false, error: `No se pudo verificar contenido: ${content.error.message}` }
  if ((content.count ?? 0) > 0) references.push('Contenido')
  if (references.length) return { id, success: false, error: `Archivo en uso por: ${references.join(', ')}.` }

  const deletion = await db.from('media').delete().eq('id', id).select('id').maybeSingle()
  if (deletion.error) return { id, success: false, error: deletion.error.code === '23503' ? 'El archivo todavía tiene referencias.' : deletion.error.message }
  if (!deletion.data) return { id, success: false, error: 'No se eliminó el registro.' }

  const storagePath = mediaStoragePath(media.data.file_url)
  if (!storagePath) return { id, success: true, warning: 'Registro eliminado; la URL no pertenece al bucket Media.' }
  const storage = await db.storage.from('media').remove([storagePath])
  return storage.error ? { id, success: true, warning: `Registro eliminado, pero Storage respondió: ${storage.error.message}` } : { id, success: true }
}
