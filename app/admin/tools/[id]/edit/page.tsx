import { notFound } from 'next/navigation'
import { ToolForm, type ToolFormValue } from '@/components/admin/ToolForm'
import { createClient } from '@/lib/supabase/server'
import type { ToolStatus, ToolType } from '@/lib/tools'

export default async function EditToolPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = await createClient()
  const result = await db.from('tools').select('id, slug, name, short_description, tool_type, category, icon_key, badge, internal_path, external_url, is_featured, display_order, status, open_in_new_tab').eq('id', id).maybeSingle()
  if (result.error) throw new Error(result.error.message)
  if (!result.data) notFound()
  const row = result.data
  const initial: ToolFormValue = { id: row.id, slug: row.slug, name: row.name, shortDescription: row.short_description ?? '', toolType: row.tool_type as ToolType, category: row.category ?? '', iconKey: row.icon_key ?? 'calculator', badge: row.badge ?? '', internalPath: row.internal_path ?? '', externalUrl: row.external_url ?? '', isFeatured: row.is_featured, displayOrder: String(row.display_order), status: row.status as ToolStatus, openInNewTab: row.open_in_new_tab }
  return <main className="min-h-screen bg-slate-100 p-4 sm:p-8"><div className="mx-auto max-w-4xl"><header className="mb-8"><h1 className="text-3xl font-bold">Editar herramienta</h1><p className="mt-1 text-slate-500">Actualiza el catálogo y la presentación de {row.name}.</p></header><ToolForm initial={initial} /></div></main>
}
