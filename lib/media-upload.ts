import type { SupabaseClient } from '@supabase/supabase-js'

export type UploadedMedia = { id: string; file_name: string; file_url: string; alt_text: string | null }

export async function uploadMediaFile({ supabase, file, userId, categoryId, altText = null }: { supabase: SupabaseClient; file: File; userId: string; categoryId: string | null; altText?: string | null }): Promise<{ media: UploadedMedia | null; error: string | null }> {
  const validation = validateMediaFile(file)
  if (validation) return { media: null, error: validation }
  const extension = file.name.split('.').pop()?.toLowerCase() || 'bin'
  const filePath = `uploads/${crypto.randomUUID()}.${extension}`
  const upload = await supabase.storage.from('media').upload(filePath, file, { cacheControl: '3600', upsert: false })
  if (upload.error) return { media: null, error: friendlyUploadError(upload.error.message, file.name) }
  const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(filePath)
  const database = await supabase.from('media').insert({ file_name: file.name, file_url: publicUrl, file_type: file.type || null, alt_text: altText?.trim() || null, uploaded_by: userId, category_id: categoryId }).select('id, file_name, file_url, alt_text').single()
  if (database.error) {
    await supabase.storage.from('media').remove([filePath])
    return { media: null, error: database.error.message }
  }
  return { media: database.data as UploadedMedia, error: null }
}

export function validateMediaFile(file: File) {
  if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) return `${file.name}: SVG no está permitido porque puede contener contenido activo.`
  return ''
}

function friendlyUploadError(message: string, fileName: string) {
  const lower = message.toLowerCase()
  if (lower.includes('maximum') || lower.includes('too large') || lower.includes('size')) return `${fileName} supera el tamaño máximo permitido por el bucket.`
  if (lower.includes('mime') || lower.includes('type')) return `${fileName} usa un formato no permitido por el bucket.`
  return `${fileName}: ${message}`
}
