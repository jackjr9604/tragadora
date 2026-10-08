import Link from 'next/link'
import { AdminAction } from '@/components/admin/AdminPermissionsProvider'
import { AdminFirmIdentity } from '@/components/admin/AdminDirectory'
import { createClient } from '@/lib/supabase/server'

export default async function AdminExchangesPage() {
  const db = await createClient()
  const platforms = await db.from('platforms').select('id, name, slug, status, origin_country_code, logo_url, media:logo_media_id(file_url, alt_text)').eq('type', 'exchange').order('name')
  if (platforms.error) throw new Error(platforms.error.message)
  const ids = (platforms.data ?? []).map((item) => item.id)
  const details = ids.length ? await db.from('exchange_details').select('platform_id, exchange_type, is_featured, display_order').in('platform_id', ids) : { data: [], error: null }
  if (details.error) throw new Error(details.error.message)
  const detailMap = new Map((details.data ?? []).map((item) => [item.platform_id, item]))

  return <main className="min-h-screen bg-slate-100 p-4 sm:p-8"><div className="mx-auto max-w-6xl"><header className="mb-8 flex justify-between"><div><h1 className="text-3xl font-bold">Exchanges</h1><p className="text-slate-500">Identidad y presentación pública.</p></div><AdminAction permission="platforms.create"><Link href="/admin/exchanges/new" className="rounded-lg bg-black px-5 py-3 text-sm font-semibold text-white">+ Nuevo exchange</Link></AdminAction></header><div className="divide-y rounded-xl bg-white shadow">{(platforms.data ?? []).map((exchange) => { const detail = detailMap.get(exchange.id); return <div key={exchange.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_130px_100px_90px] md:items-center"><div><AdminFirmIdentity name={exchange.name} media={exchange.media} legacyUrl={exchange.logo_url} /><p className="ml-[52px] text-xs text-slate-500">/{exchange.slug} · orden {detail?.display_order ?? 100}</p></div><span className="text-sm">{detail?.exchange_type === 'decentralized' ? 'Descentralizado' : 'Centralizado'}</span><span className="text-sm">{exchange.status}</span><AdminAction permission="platforms.update"><Link href={`/admin/exchanges/${exchange.id}/edit`} className="rounded-lg border px-3 py-2 text-center text-sm">Editar</Link></AdminAction></div>})}{!platforms.data?.length && <p className="p-10 text-center text-slate-500">Todavía no hay exchanges registrados.</p>}</div></div></main>
}
