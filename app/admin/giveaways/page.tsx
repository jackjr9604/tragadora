import Link from 'next/link'
import { AdminAction } from '@/components/admin/AdminPermissionsProvider'
import { AdminFirmIdentity } from '@/components/admin/AdminDirectory'
import { createClient } from '@/lib/supabase/server'

export default async function AdminGiveawaysPage() {
  const db = await createClient()
  const result = await db.from('giveaways').select('id, title, slug, status, starts_at, ends_at, is_featured, media:cover_media_id(file_url, alt_text)').order('ends_at', { ascending: false })
  if (result.error) throw new Error(result.error.message)
  return <main className="min-h-screen bg-slate-100 p-4 sm:p-8"><div className="mx-auto max-w-6xl"><header className="mb-8 flex justify-between"><div><h1 className="text-3xl font-bold">Giveaways</h1><p className="text-slate-500">Campañas, vigencia y resultados.</p></div><AdminAction permission="giveaways.create"><Link href="/admin/giveaways/new" className="rounded-lg bg-black px-5 py-3 text-sm font-semibold text-white">+ Nuevo giveaway</Link></AdminAction></header><div className="divide-y rounded-xl bg-white shadow">{(result.data ?? []).map((item) => <div key={item.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_160px_90px] md:items-center"><div><AdminFirmIdentity name={item.title} media={item.media} /><p className="ml-[52px] text-xs text-slate-500">/{item.slug} · finaliza {new Date(item.ends_at).toLocaleDateString('es-CO')}</p></div><span className="text-sm">{item.status}</span><AdminAction permission="giveaways.update"><Link href={`/admin/giveaways/${item.id}/edit`} className="rounded-lg border px-3 py-2 text-center text-sm">Editar</Link></AdminAction></div>)}{!result.data?.length && <p className="p-10 text-center text-slate-500">Todavía no hay giveaways.</p>}</div></div></main>
}
