'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentAdminPermissions } from '@/lib/admin-permissions-server'
import { invalidatePublicBlogSource } from '@/lib/admin-public-blog-revalidation'
import { createClient } from '@/lib/supabase/server'
import { isBlogSourceInput, isSafeBlogSlug, isUuid, type BlogSourceInput } from '@/lib/admin-blog-source-policy'

type BlogSourceActionResult = { ok: boolean; message: string }

export async function saveBlogSource(input: BlogSourceInput): Promise<BlogSourceActionResult> {
  const access = await getCurrentAdminPermissions()
  if (!access.userId) return failure('La sesión expiró. Vuelve a iniciar sesión.')
  if (!isBlogSourceInput(input)) return failure('Los datos del artículo no son válidos.')
  const editing = Boolean(input.id)
  if (!access.permissions.has(editing ? 'blog.update' : 'blog.create')) return failure('No tienes permiso para guardar artículos.')
  if (editing && !isUuid(input.id)) return failure('El artículo no es válido.')
  const title = input.title.trim(), slug = input.slug.trim(), body = input.bodyMarkdown
  if (!title || !slug || !body || !isSafeBlogSlug(slug)) return failure('Título, slug y contenido son obligatorios; revisa el formato del slug.')
  if (!['draft', 'published'].includes(input.status)) return failure('El estado de publicación no es válido.')
  if (input.coverMediaId && !isUuid(input.coverMediaId)) return failure('La imagen seleccionada no es válida.')
  const publishedAt = input.publishedAt ? new Date(input.publishedAt) : null
  if (publishedAt && Number.isNaN(publishedAt.getTime())) return failure('La fecha de publicación no es válida.')
  const payload = {
    title, slug, excerpt: clean(input.excerpt), body_markdown: body, category: clean(input.category),
    tags: input.tags.map((tag) => tag.trim()).filter(Boolean).slice(0, 50), cover_media_id: input.coverMediaId,
    author_name: clean(input.authorName), is_featured: Boolean(input.featured), status: input.status,
    published_at: publishedAt?.toISOString() ?? null,
  }
  const db = await createClient()
  const result = editing
    ? await db.from('blog_posts').update(payload).eq('id', input.id!)
    : await db.from('blog_posts').insert(payload)
  if (result.error) return failure('No se pudo guardar el artículo. Revisa los datos e inténtalo de nuevo.')
  invalidatePublicBlogSource()
  revalidatePath('/blog')
  revalidatePath(`/blog/${slug}`)
  revalidatePath('/admin/blog')
  return { ok: true, message: editing ? 'Artículo actualizado.' : 'Artículo creado.' }
}

export async function deleteBlogSource(id: string): Promise<BlogSourceActionResult> {
  const access = await getCurrentAdminPermissions()
  if (!access.userId) return failure('La sesión expiró. Vuelve a iniciar sesión.')
  if (!access.permissions.has('blog.delete')) return failure('No tienes permiso para eliminar artículos.')
  if (!isUuid(id)) return failure('El artículo no es válido.')
  const db = await createClient()
  const existing = await db.from('blog_posts').select('slug').eq('id', id).maybeSingle()
  if (existing.error || !existing.data) return failure('El artículo ya no existe.')
  const result = await db.from('blog_posts').delete().eq('id', id)
  if (result.error) return failure('No se pudo eliminar el artículo.')
  invalidatePublicBlogSource()
  revalidatePath('/blog')
  revalidatePath(`/blog/${existing.data.slug}`)
  revalidatePath('/admin/blog')
  return { ok: true, message: 'Artículo eliminado.' }
}

function clean(value: string | null) { const normalized = value?.trim(); return normalized || null }
function failure(message: string): BlogSourceActionResult { return { ok: false, message } }
