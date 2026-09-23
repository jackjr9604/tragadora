import Link from 'next/link'
import { AdminAction } from '@/components/admin/AdminPermissionsProvider'
import { createClient } from '@/lib/supabase/server'
import type { ToolRecord } from '@/lib/tools'

export default async function AdminToolsPage() {
  const db = await createClient()
  const result = await db.from('tools').select('id, slug, name, short_description, tool_type, category, icon_key, badge, internal_path, external_url, is_featured, display_order, status, open_in_new_tab').order('display_order').order('name')
  if (result.error) throw new Error(result.error.message)
  const tools = (result.data ?? []) as ToolRecord[]
  return <main className="min-h-screen bg-slate-100 p-4 sm:p-8"><div className="mx-auto max-w-6xl"><header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="text-3xl font-bold">Herramientas</h1><p className="mt-1 text-slate-500">Catálogo, destinos y presentación pública.</p></div><AdminAction permission="tools.create"><Link href="/admin/tools/new" className="rounded-lg bg-black px-5 py-3 text-center text-sm font-semibold text-white">+ Nueva herramienta</Link></AdminAction></header>
    <div className="overflow-hidden rounded-xl bg-white shadow"><div className="hidden grid-cols-[1.4fr_.7fr_.8fr_90px_90px_90px] gap-4 border-b bg-slate-50 px-5 py-3 text-xs font-semibold uppercase text-slate-500 md:grid"><span>Nombre</span><span>Tipo</span><span>Categoría</span><span>Destacada</span><span>Estado</span><span></span></div>{tools.map((tool) => <div key={tool.id} className="grid gap-3 border-b px-5 py-4 last:border-0 md:grid-cols-[1.4fr_.7fr_.8fr_90px_90px_90px] md:items-center"><div><p className="font-semibold">{tool.name}</p><p className="text-xs text-slate-500">/{tool.slug} · orden {tool.display_order}</p></div><span className="text-sm text-slate-600">{typeLabel(tool.tool_type)}</span><span className="text-sm text-slate-600">{tool.category || '—'}</span><span className="text-sm">{tool.is_featured ? 'Sí' : 'No'}</span><span className="text-sm">{tool.status === 'published' ? 'Publicada' : 'Borrador'}</span><AdminAction permission="tools.update"><Link href={`/admin/tools/${tool.id}/edit`} className="rounded-lg border px-3 py-2 text-center text-sm font-medium">Editar</Link></AdminAction></div>)}{!tools.length && <p className="p-10 text-center text-slate-500">Todavía no hay herramientas registradas.</p>}</div>
  </div></main>
}

function typeLabel(value: string) { return ({ internal: 'Interna', external: 'Externa', coming_soon: 'Próximamente' } as Record<string, string>)[value] ?? value }
