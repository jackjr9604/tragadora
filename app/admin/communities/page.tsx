import Link from 'next/link'
import { AdminAction } from '@/components/admin/AdminPermissionsProvider'
import { AdminFirmIdentity } from '@/components/admin/AdminDirectory'
import { createClient } from '@/lib/supabase/server'

export default async function AdminCommunitiesPage() {
  const db = await createClient()
  const result = await db.from('communities').select('id, name, slug, community_type, category, is_featured, display_order, status, media:logo_media_id(file_url, alt_text)').order('display_order').order('name')
  if (result.error) throw new Error(result.error.message)
  return <main className="min-h-screen bg-slate-100 p-4 sm:p-8"><div className="mx-auto max-w-6xl"><header className="mb-8 flex justify-between gap-4"><div><h1 className="text-3xl font-bold">Comunidades</h1><p className="text-slate-500">Catálogo público de comunidades.</p></div><AdminAction permission="communities.create"><Link href="/admin/communities/new" className="rounded-lg bg-black px-5 py-3 text-sm font-semibold text-white">+ Nuevo</Link></AdminAction></header><div className="divide-y rounded-xl bg-white shadow">{(result.data ?? []).map((item) => <div key={item.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_120px_90px] md:items-center"><div><AdminFirmIdentity name={item.name} media={item.media} /><p className="ml-[52px] text-xs text-slate-500">{item.community_type} · {item.category || 'Sin categoría'} · orden {item.display_order}</p></div><span className="text-sm">{item.status === 'published' ? 'Publicada' : 'Borrador'}</span><AdminAction permission="communities.update"><Link href={`/admin/communities/${item.id}/edit`} className="rounded-lg border px-3 py-2 text-center text-sm">Editar</Link></AdminAction></div>)}{!result.data?.length && <p className="p-10 text-center text-slate-500">Todavía no hay comunidades.</p>}</div></div></main>
}
