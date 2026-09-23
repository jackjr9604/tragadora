import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function AdminBrokersPage() {
  const db = await createClient()
  const platforms = await db.from('platforms').select('id, name, slug, status, origin_country_code, logo_url, media:logo_media_id(file_url, alt_text)').eq('type', 'broker').order('name')
  if (platforms.error) throw new Error(platforms.error.message)
  const ids = (platforms.data ?? []).map((row) => row.id)
  const [details, markets, countries] = await Promise.all([
    ids.length ? db.from('broker_details').select('platform_id, is_featured, display_order').in('platform_id', ids) : Promise.resolve({ data: [], error: null }),
    ids.length ? db.from('platform_markets').select('platform_id, market').in('platform_id', ids) : Promise.resolve({ data: [], error: null }),
    db.from('countries').select('code, name'),
  ])
  const error = details.error ?? markets.error ?? countries.error
  if (error) throw new Error(error.message)
  const detailMap = new Map((details.data ?? []).map((row) => [row.platform_id, row]))
  const countryMap = new Map((countries.data ?? []).map((row) => [row.code, row.name]))
  const marketMap = new Map<string, string[]>()
  for (const row of markets.data ?? []) marketMap.set(row.platform_id, [...(marketMap.get(row.platform_id) ?? []), row.market])

  return <main className="min-h-screen bg-slate-100 p-4 sm:p-8"><div className="mx-auto max-w-6xl"><header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="text-3xl font-bold">Brokers</h1><p className="mt-1 text-slate-500">Información esencial y presentación pública de brokers.</p></div><Link href="/admin/brokers/new" className="rounded-lg bg-black px-5 py-3 text-center text-sm font-semibold text-white">+ Nuevo broker</Link></header>
    <div className="overflow-hidden rounded-xl bg-white shadow"><div className="hidden grid-cols-[1.2fr_.8fr_1fr_100px_100px_100px] gap-4 border-b bg-slate-50 px-5 py-3 text-xs font-semibold uppercase text-slate-500 md:grid"><span>Nombre</span><span>País</span><span>Mercados</span><span>Destacado</span><span>Estado</span><span></span></div>{(platforms.data ?? []).map((broker) => { const detail = detailMap.get(broker.id); return <div key={broker.id} className="grid gap-3 border-b px-5 py-4 last:border-0 md:grid-cols-[1.2fr_.8fr_1fr_100px_100px_100px] md:items-center"><div><p className="font-semibold">{broker.name}</p><p className="text-xs text-slate-500">/{broker.slug}</p></div><span className="text-sm text-slate-600">{broker.origin_country_code ? countryMap.get(broker.origin_country_code) ?? broker.origin_country_code : '—'}</span><span className="text-sm text-slate-600">{(marketMap.get(broker.id) ?? []).map(marketLabel).join(' · ') || '—'}</span><span className="text-sm">{detail?.is_featured ? 'Sí' : 'No'}</span><span className="text-sm">{broker.status === 'active' ? 'Activo' : broker.status}</span><Link href={`/admin/brokers/${broker.id}/edit`} className="rounded-lg border px-3 py-2 text-center text-sm font-medium">Editar</Link></div>})}{!platforms.data?.length && <p className="p-10 text-center text-slate-500">Todavía no hay brokers registrados.</p>}</div>
  </div></main>
}

function marketLabel(value: string) { return ({ cfd: 'CFD / Forex', futures: 'Futures', crypto: 'Crypto', options: 'Opciones' } as Record<string, string>)[value] ?? value }
