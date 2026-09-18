import Link from 'next/link'
import { AdminAction } from '@/components/admin/AdminPermissionsProvider'
import { SearchInput } from '@/components/shared/SearchInput'
import { redirect } from 'next/navigation'
import { AdminDirectoryHeader, AdminFirmIdentity, AdminPagination, StatusBadge } from '@/components/admin/AdminDirectory'
import { MondoTradersStatusPanel } from '@/components/admin/MondoTradersStatusPanel'
import { createClient } from '@/lib/supabase/server'

const PAGE_SIZE = 25
type Params = { q?: string | string[]; data?: string | string[]; sort?: string | string[]; page?: string | string[] }

export default async function PayoutsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect('/login')
  const params = await searchParams, q = scalar(params.q), dataFilter = scalar(params.data), sort = scalar(params.sort) || 'name', page = positiveInt(scalar(params.page))
  const [sourcesAll, payoutsAll, metricsAll, mappingsAll] = await Promise.all([
    supabase.from('payout_sources').select('platform_id'), supabase.from('platform_payout_summary').select('platform_id, verified_payout_count, verified_last_payout_at').gt('verified_payout_count', 0), supabase.from('platform_payout_metrics').select('platform_id'), supabase.from('external_platform_mappings').select('platform_id'),
  ])
  const related = new Set<string>(); for (const result of [sourcesAll, payoutsAll, metricsAll, mappingsAll]) { if (result.error) throw new Error(result.error.message); for (const row of result.data ?? []) related.add(row.platform_id) }
  let query = supabase.from('platforms').select('id, name, logo_url, media:logo_media_id(file_url, alt_text)', { count: 'exact' }).eq('type', 'prop_firm')
  if (q) query = query.ilike('name', `%${q}%`)
  if (dataFilter === 'with') query = related.size ? query.in('id', [...related]) : query.in('id', ['00000000-0000-0000-0000-000000000000'])
  if (dataFilter === 'without' && related.size) query = query.not('id', 'in', `(${[...related].join(',')})`)
  query = query.order('name', { ascending: sort !== 'za' })
  const { data: firms, count, error } = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1); if (error) throw new Error(error.message)
  const ids = (firms ?? []).map((firm) => firm.id)
  const [payouts, sources, mappings, metrics] = ids.length ? await Promise.all([
    supabase.from('platform_payout_summary').select('platform_id, verified_payout_count, verified_last_payout_at').in('platform_id', ids),
    supabase.from('payout_sources').select('platform_id, id, status, last_sync_at').in('platform_id', ids),
    supabase.from('external_platform_mappings').select('platform_id, active').in('platform_id', ids),
    supabase.from('platform_payout_metrics').select('platform_id, updated_at').in('platform_id', ids).eq('is_current', true),
  ]) : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }]
  const payoutStats = new Map((payouts.data ?? []).map((row) => [row.platform_id, { count: Number(row.verified_payout_count ?? 0), last: row.verified_last_payout_at as string | null }]))
  const sourceMap = groupCount(sources.data ?? []), mappingMap = groupCount(mappings.data ?? []), metricMap = groupCount(metrics.data ?? [])
  const total = count ?? 0, href = (next: number) => paramsUrl('/admin/payouts', { q, data: dataFilter, sort, page: String(next) })
  return <main className="p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-[1500px]"><AdminDirectoryHeader title="Payouts" description="Selecciona una Prop Firm para revisar sus pagos, fuentes y métricas." count={total} action={<AdminAction permission="payouts.create"><Link href="/admin/payouts/sources/new" className="rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white">+ Nueva fuente</Link></AdminAction>} /><MondoTradersStatusPanel />
    <form className="my-5 grid gap-3 rounded-xl bg-white p-3 shadow-sm md:grid-cols-[minmax(240px,1fr)_220px_180px_auto]"><SearchInput key={q} value={q} placeholder="Buscar firma..." /><select name="data" defaultValue={dataFilter} className="rounded-lg border px-3"><option value="">Todos los estados</option><option value="with">Con datos</option><option value="without">Sin datos</option></select><select name="sort" defaultValue={sort} className="rounded-lg border px-3"><option value="name">Nombre A-Z</option><option value="za">Nombre Z-A</option></select><button className="rounded-lg bg-black px-4 py-2.5 text-sm text-white">Aplicar</button></form>
    <div className="overflow-hidden rounded-xl border bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="border-b bg-slate-50 text-left"><tr><th className="px-4 py-3">Firma</th><th className="px-4 py-3">Tracker</th><th className="px-4 py-3">Payouts verificados</th><th className="px-4 py-3">Fuentes</th><th className="px-4 py-3">Mappings</th><th className="px-4 py-3">Última actividad</th><th className="px-4 py-3 text-right">Acción</th></tr></thead><tbody>{(firms ?? []).map((firm) => { const stats = payoutStats.get(firm.id), hasData = related.has(firm.id); return <tr key={firm.id} className="border-b last:border-0 hover:bg-slate-50"><td className="px-4 py-3"><AdminFirmIdentity name={firm.name} media={firm.media} legacyUrl={firm.logo_url} /></td><td className="px-4 py-3"><StatusBadge tone={metricMap.get(firm.id) ? 'success' : 'neutral'}>{metricMap.get(firm.id) ? 'Disponible' : 'Sin métricas'}</StatusBadge></td><td className="px-4 py-3">{stats?.count ?? 0}</td><td className="px-4 py-3">{sourceMap.get(firm.id) ?? 0}</td><td className="px-4 py-3">{mappingMap.get(firm.id) ?? 0}</td><td className="px-4 py-3 text-slate-500">{stats?.last ? new Date(stats.last).toLocaleDateString('es-CO') : hasData ? 'Datos configurados' : 'Sin datos'}</td><td className="px-4 py-3 text-right"><Link href={`/admin/payouts/platform/${firm.id}?returnTo=${encodeURIComponent(href(page))}`} className="rounded-lg border px-3 py-2 font-medium">Gestionar</Link></td></tr>})}{!firms?.length && <tr><td colSpan={7} className="p-12 text-center text-slate-500">No encontramos firmas con estos filtros.</td></tr>}</tbody></table></div></div><AdminPagination page={page} total={total} pageSize={PAGE_SIZE} href={href} />
  </div></main>
}

function groupCount(rows: Array<{ platform_id: string }>) { const map = new Map<string, number>(); for (const row of rows) map.set(row.platform_id, (map.get(row.platform_id) ?? 0) + 1); return map }
function scalar(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] ?? '' : value ?? '' }
function positiveInt(value: string) { const number = Number(value); return Number.isInteger(number) && number > 0 ? number : 1 }
function paramsUrl(path: string, values: Record<string, string>) { const query = new URLSearchParams(); for (const [key, value] of Object.entries(values)) if (value && !(key === 'page' && value === '1')) query.set(key, value); return query.size ? `${path}?${query}` : path }
