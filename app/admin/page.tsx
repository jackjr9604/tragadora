import Link from 'next/link'
import { BadgeDollarSign, BookOpen, BriefcaseBusiness, Building2, Gift, Image, Link2, Newspaper, Tags, Users, Wrench } from 'lucide-react'
import { redirect } from 'next/navigation'
import type { PermissionKey } from '@/lib/admin-permissions'
import { getCurrentAdminPermissions, hasPermission } from '@/lib/admin-permissions-server'
import { createClient } from '@/lib/supabase/server'

type CountResult = { count: number | null; error: { message: string } | null }
type DashboardCount = { value: number | null; available: boolean }
type RecentItem = { id: string; title: string; meta: string; status: string; createdAt: string; href: string }

export default async function AdminDashboard() {
  const [supabase, access] = await Promise.all([createClient(), getCurrentAdminPermissions()])
  if (!access.userId) redirect('/login')
  const can = (permission: PermissionKey) => hasPermission(access, permission)
  const count = async (enabled: boolean, query: PromiseLike<CountResult>): Promise<DashboardCount> => {
    if (!enabled) return { value: null, available: false }
    const result = await query
    return result.error ? { value: null, available: false } : { value: result.count ?? 0, available: true }
  }

  const [propFirms, activePropFirms, draftPropFirms, brokers, exchanges, challenges, activeOffers, affiliateClicks, media, tools, publishedTools, communities, publishedCommunities, blogPosts, publishedBlogPosts, giveaways, publishedGiveaways, endedGiveaways, docs, publishedDocs] = await Promise.all([
    count(can('platforms.view'), supabase.from('platforms').select('id', { count: 'exact', head: true }).eq('type', 'prop_firm')),
    count(can('platforms.view'), supabase.from('platforms').select('id', { count: 'exact', head: true }).eq('type', 'prop_firm').eq('status', 'active')),
    count(can('platforms.view'), supabase.from('platforms').select('id', { count: 'exact', head: true }).eq('type', 'prop_firm').eq('status', 'draft')),
    count(can('platforms.view'), supabase.from('platforms').select('id', { count: 'exact', head: true }).eq('type', 'broker')),
    count(can('platforms.view'), supabase.from('platforms').select('id', { count: 'exact', head: true }).eq('type', 'exchange')),
    count(can('challenges.view'), supabase.from('challenges').select('id', { count: 'exact', head: true })),
    count(can('offers.view'), supabase.from('offers').select('id', { count: 'exact', head: true }).eq('status', true)),
    count(can('affiliate_links.view'), supabase.from('affiliate_clicks').select('id', { count: 'exact', head: true })),
    count(can('media.view'), supabase.from('media').select('id', { count: 'exact', head: true })),
    count(can('tools.view'), supabase.from('tools').select('id', { count: 'exact', head: true })),
    count(can('tools.view'), supabase.from('tools').select('id', { count: 'exact', head: true }).eq('status', 'published')),
    count(can('communities.view'), supabase.from('communities').select('id', { count: 'exact', head: true })),
    count(can('communities.view'), supabase.from('communities').select('id', { count: 'exact', head: true }).eq('status', 'published')),
    count(can('blog.view'), supabase.from('blog_posts').select('id', { count: 'exact', head: true })),
    count(can('blog.view'), supabase.from('blog_posts').select('id', { count: 'exact', head: true }).eq('status', 'published')),
    count(can('giveaways.view'), supabase.from('giveaways').select('id', { count: 'exact', head: true })),
    count(can('giveaways.view'), supabase.from('giveaways').select('id', { count: 'exact', head: true }).eq('status', 'published')),
    count(can('giveaways.view'), supabase.from('giveaways').select('id', { count: 'exact', head: true }).eq('status', 'ended')),
    count(can('docs.view'), supabase.from('documentation_articles').select('id', { count: 'exact', head: true })),
    count(can('docs.view'), supabase.from('documentation_articles').select('id', { count: 'exact', head: true }).eq('status', 'published')),
  ])

  const primaryStats = [
    metric('Prop Firms', propFirms, '/admin/platforms', Building2, detailParts([activePropFirms, 'activas'], [draftPropFirms, 'borrador'])),
    metric('Challenges', challenges, '/admin/challenges', BriefcaseBusiness),
    metric('Ofertas activas', activeOffers, '/admin/offers', Tags),
    metric('Clicks afiliados', affiliateClicks, '/admin/affiliate-links', Link2),
    metric('Brokers', brokers, '/admin/brokers', Building2),
    metric('Exchanges', exchanges, '/admin/exchanges', BadgeDollarSign),
  ].filter((item) => item.count.available)

  const catalogStats = [
    metric('Brokers', brokers, '/admin/brokers', Building2),
    metric('Exchanges', exchanges, '/admin/exchanges', BadgeDollarSign),
    metric('Herramientas', tools, '/admin/tools', Wrench, publishedDetail(publishedTools, tools)),
    metric('Comunidades', communities, '/admin/communities', Users, publishedDetail(publishedCommunities, communities)),
    metric('Blog', blogPosts, '/admin/blog', Newspaper, publishedDetail(publishedBlogPosts, blogPosts)),
    metric('Giveaways', giveaways, '/admin/giveaways', Gift, detailParts([publishedGiveaways, 'publicados'], [endedGiveaways, 'finalizados'])),
    metric('Multimedia', media, '/admin/media', Image),
    metric('Documentación', docs, '/admin/docs', BookOpen, publishedDetail(publishedDocs, docs)),
  ].filter((item) => item.count.available)

  const quickActions = [
    can('platforms.create') && { label: '+ Prop Firm', href: '/admin/platforms/new', primary: true },
    can('offers.create') && { label: '+ Oferta', href: '/admin/offers/new' },
    can('platforms.create') && { label: '+ Broker', href: '/admin/brokers/new' },
    can('blog.create') && { label: '+ Blog', href: '/admin/blog/new' },
    can('giveaways.create') && { label: '+ Giveaway', href: '/admin/giveaways/new' },
    can('media.create') && { label: 'Subir imagen', href: '/admin/media' },
  ].filter(Boolean) as { label: string; href: string; primary?: boolean }[]

  const [platformRows, offerRows, blogRows, giveawayRows] = await Promise.all([
    can('platforms.view') ? supabase.from('platforms').select('id, name, type, status, created_at').order('created_at', { ascending: false }).limit(6) : Promise.resolve({ data: [] }),
    can('offers.view') ? supabase.from('offers').select('id, title, status, created_at').order('created_at', { ascending: false }).limit(4) : Promise.resolve({ data: [] }),
    can('blog.view') ? supabase.from('blog_posts').select('id, title, status, created_at').order('created_at', { ascending: false }).limit(4) : Promise.resolve({ data: [] }),
    can('giveaways.view') ? supabase.from('giveaways').select('id, title, status, created_at').order('created_at', { ascending: false }).limit(4) : Promise.resolve({ data: [] }),
  ])

  const recentPlatforms: RecentItem[] = (platformRows.data ?? []).map((row) => ({ id: row.id, title: row.name, meta: platformType(row.type), status: row.status, createdAt: row.created_at, href: platformHref(row.type) }))
  const recentContent: RecentItem[] = [
    ...(offerRows.data ?? []).map((row) => ({ id: `offer-${row.id}`, title: row.title, meta: 'Oferta', status: row.status ? 'Activa' : 'Inactiva', createdAt: row.created_at, href: '/admin/offers' })),
    ...(blogRows.data ?? []).map((row) => ({ id: `blog-${row.id}`, title: row.title, meta: 'Blog', status: row.status, createdAt: row.created_at, href: `/admin/blog/${row.id}/edit` })),
    ...(giveawayRows.data ?? []).map((row) => ({ id: `giveaway-${row.id}`, title: row.title, meta: 'Giveaway', status: row.status, createdAt: row.created_at, href: `/admin/giveaways/${row.id}/edit` })),
  ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 6)

  return <main className="min-h-screen p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-[1500px] space-y-8">
    <header><p className="text-xs font-bold uppercase tracking-[.15em] text-amber-700">Vista general</p><h1 className="mt-1 text-3xl font-bold">Dashboard</h1><p className="mt-1 text-slate-500">Estado actual del catálogo y accesos de administración.</p></header>
    <section aria-labelledby="main-metrics"><h2 id="main-metrics" className="sr-only">Métricas principales</h2><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">{primaryStats.map((stat) => <MetricCard key={stat.label} {...stat} />)}</div></section>
    {quickActions.length > 0 && <section className="rounded-xl bg-white p-5 shadow-sm sm:p-6"><div className="mb-4"><h2 className="text-lg font-semibold">Acciones rápidas</h2><p className="text-sm text-slate-500">Crea y publica contenido frecuente.</p></div><div className="flex flex-wrap gap-2.5">{quickActions.map((action) => <Link key={action.href} href={action.href} className={action.primary ? 'admin-button-primary' : 'admin-button-secondary'}>{action.label}</Link>)}</div></section>}
    {catalogStats.length > 0 && <section><div className="mb-4"><h2 className="text-xl font-semibold">Catálogo y contenido</h2><p className="text-sm text-slate-500">Cantidad y estado editorial de los módulos disponibles.</p></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{catalogStats.map((stat) => <MetricCard key={stat.label} {...stat} compact />)}</div></section>}
    {(recentPlatforms.length > 0 || recentContent.length > 0) && <section><div className="mb-4"><h2 className="text-xl font-semibold">Actividad reciente</h2><p className="text-sm text-slate-500">Últimos registros incorporados al sistema.</p></div><div className="grid gap-6 lg:grid-cols-2">{recentPlatforms.length > 0 && <RecentCard title="Últimas plataformas" items={recentPlatforms} />}{recentContent.length > 0 && <RecentCard title="Contenido reciente" items={recentContent} />}</div></section>}
  </div></main>
}

function metric(label: string, count: DashboardCount, href: string, icon: typeof Building2, detail?: string) { return { label, count, href, icon, detail } }
function MetricCard({ label, count, href, icon: Icon, detail, compact = false }: ReturnType<typeof metric> & { compact?: boolean }) { return <Link href={href} className={`admin-dashboard-metric group ${compact ? 'compact' : ''}`}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.1em] text-slate-500">{label}</p><p className={`${compact ? 'mt-2 text-2xl' : 'mt-3 text-3xl'} font-bold text-slate-950`}>{count.value ?? '—'}</p></div><span className="admin-dashboard-icon"><Icon className="size-4" /></span></div>{detail && <p className="mt-2 text-xs text-slate-500">{detail}</p>}</Link> }
function RecentCard({ title, items }: { title: string; items: RecentItem[] }) { return <div className="overflow-hidden rounded-xl border bg-white shadow-sm"><div className="border-b px-5 py-4"><h3 className="font-semibold">{title}</h3></div><div>{items.map((item) => <Link key={item.id} href={item.href} className="flex items-center justify-between gap-4 border-b px-5 py-3.5 last:border-0 hover:bg-[#fcfaf4]"><div className="min-w-0"><p className="truncate text-sm font-semibold">{item.title}</p><p className="mt-0.5 text-xs text-slate-500">{item.meta} · {new Date(item.createdAt).toLocaleDateString('es-CO')}</p></div><span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{item.status}</span></Link>)}</div></div> }
function detailParts(...parts: [DashboardCount, string][]) { return parts.filter(([count]) => count.available).map(([count, label]) => `${count.value ?? 0} ${label}`).join(' · ') || undefined }
function publishedDetail(published: DashboardCount, total: DashboardCount) { if (!published.available || !total.available) return undefined; return `${published.value ?? 0} publicados · ${Math.max(0, (total.value ?? 0) - (published.value ?? 0))} borrador` }
function platformType(type: string) { return type === 'prop_firm' ? 'Prop Firm' : type === 'broker' ? 'Broker' : type === 'exchange' ? 'Exchange' : type }
function platformHref(type: string) { return type === 'broker' ? '/admin/brokers' : type === 'exchange' ? '/admin/exchanges' : '/admin/platforms' }
