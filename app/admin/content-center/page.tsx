import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BriefcaseBusiness, CheckCircle2, Clock3, FileText, Languages, ServerCog } from 'lucide-react'
import { getCurrentAdminPermissions } from '@/lib/admin-permissions-server'
import { CONTENT_CENTER_BUCKETS, CONTENT_CENTER_BUCKET_LABELS, bucketCount, normalizeContentCenterParams } from '@/lib/admin-content-center-policy'
import { getContentCenterData, getTranslationLanguageCoverage, resourceModuleLabel } from '@/lib/admin-content-center'

type SearchParams = Record<string, string | string[] | undefined>

export default async function ContentCenterPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const raw = await searchParams
  const legacyView = first(raw.view)
  if (legacyView && legacyView !== 'summary') redirect(legacyContentCenterHref(raw))
  const access = await getCurrentAdminPermissions()
  const [data, coverage] = await Promise.all([
    getContentCenterData(normalizeContentCenterParams({}), access.permissions),
    getTranslationLanguageCoverage(access.permissions),
  ])

  return <>
    {!data.rpcAvailable && <section className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950"><strong>Centro pendiente de activar.</strong> Los administradores compatibles continúan disponibles.</section>}
    <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Resumen global"><Metric title="Recursos" value={data.summary.resources} icon={BriefcaseBusiness} /><Metric title="Campos traducibles" value={data.summary.fields} icon={FileText} /><Metric title="Listos y publicados" value={data.summary.published} icon={CheckCircle2} tone="green" /><Metric title="Trabajos esperando" value={data.summary.queued_jobs + data.summary.retry_jobs} icon={Clock3} tone="amber" /></section>
    <section className="mt-8"><div className="mb-3"><h2 className="text-xl font-bold">Bandejas editoriales</h2><p className="mt-1 text-sm text-slate-500">Conteos globales de los módulos a los que tienes acceso.</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{CONTENT_CENTER_BUCKETS.map((bucket) => <Link key={bucket} href={bucket === 'in_review' ? '/admin/content-center/review' : bucket === 'approved' ? '/admin/content-center/publication' : `/admin/content-center/translations?bucket=${bucket}`} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md"><div className="flex items-center justify-between"><span className="text-sm font-semibold text-slate-600">{CONTENT_CENTER_BUCKET_LABELS[bucket]}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold group-hover:bg-amber-100">{bucketCount(data.summary, bucket).toLocaleString('es-CO')}</span></div><p className="mt-4 text-xs text-slate-400">Abrir bandeja →</p></Link>)}</div></section>
    <CoverageReport rows={coverage.rows} available={coverage.available} />
    <section className="mt-8 grid gap-4 lg:grid-cols-3">{access.permissions.has('content.view') && <QuickLink title="Editar contenido" description="Abre páginas y secciones de site_content." href="/admin/content-center/content" icon={FileText} />}<QuickLink title="Gestionar traducciones" description="Abre el inventario y editor integral por recurso." href="/admin/content-center/translations" icon={Languages} />{access.permissions.has('content.view') && <QuickLink title="Configurar idiomas" description="Administra registro, preparación y publicación segura." href="/admin/content-center/languages" icon={ServerCog} />}</section>
  </>
}

function CoverageReport({ rows, available }: { rows: Awaited<ReturnType<typeof getTranslationLanguageCoverage>>['rows']; available: boolean }) {
  if (!available) return <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950"><strong>Reporte de cobertura pendiente de activar.</strong> Aplica la migración versionada antes de usar estas cifras.</section>
  const languages = [...new Set(rows.map((row) => row.target_language))].sort()
  return <section className="mt-8"><div className="mb-3"><h2 className="text-xl font-bold">Cobertura editorial por idioma</h2><p className="mt-1 text-sm text-slate-500">Cifras reales de campos. “Completado” exige publicación vigente y revisión humana, o una importación histórica protegida.</p></div><div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"><table className="min-w-[900px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Módulo</th><th className="px-4 py-3">Idioma</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Completados</th><th className="px-4 py-3">Pendientes</th><th className="px-4 py-3">Automáticas por revisar</th><th className="px-4 py-3">Obsoletas</th><th className="px-4 py-3">Protegidas</th><th className="px-4 py-3">Errores</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={`${row.resource_type}:${row.target_language}`}><td className="px-4 py-3 font-semibold">{resourceModuleLabel(row.resource_type)}</td><td className="px-4 py-3 font-bold uppercase">{row.target_language}</td><td className="px-4 py-3">{row.total_fields}</td><td className="px-4 py-3 text-emerald-700">{row.completed_fields}</td><td className="px-4 py-3 text-amber-700">{row.pending_fields}</td><td className="px-4 py-3">{row.automatic_review_fields}</td><td className="px-4 py-3 text-orange-700">{row.stale_fields}</td><td className="px-4 py-3 text-blue-700">{row.protected_fields}</td><td className="px-4 py-3 text-red-700">{row.error_fields}</td></tr>)}{!rows.length&&<tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">No hay idiomas de destino publicados para los módulos permitidos.</td></tr>}</tbody></table></div><p className="mt-2 text-xs text-slate-500">Idiomas incluidos: {languages.map((language) => language.toUpperCase()).join(', ') || 'ninguno'}.</p></section>
}

function legacyContentCenterHref(raw: SearchParams) {
  const view = first(raw.view)
  const base = view === 'jobs' ? '/admin/content-center/jobs' : view === 'languages' ? '/admin/content-center/languages' : first(raw.bucket) === 'in_review' ? '/admin/content-center/review' : first(raw.bucket) === 'approved' ? '/admin/content-center/publication' : '/admin/content-center/translations'
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(raw)) if (key !== 'view' && typeof value === 'string' && value) query.set(key, value)
  return `${base}${query.size ? `?${query}` : ''}`
}
function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value }
function Metric({ title, value, icon: Icon, tone='slate' }: { title:string;value:number;icon:React.ComponentType<{className?:string}>;tone?:string }) { const color=tone==='green'?'text-emerald-700 bg-emerald-50':tone==='amber'?'text-amber-700 bg-amber-50':'text-slate-700 bg-slate-100'; return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-500">{title}</p><span className={`rounded-xl p-2 ${color}`}><Icon className="size-4" /></span></div><p className="mt-4 text-3xl font-bold">{value.toLocaleString('es-CO')}</p></div> }
function QuickLink({ title, description, href, icon: Icon }: { title:string;description:string;href:string;icon:React.ComponentType<{className?:string}> }) { return <Link href={href} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-amber-300"><Icon className="size-5 text-amber-700" /><h3 className="mt-4 font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{description}</p><p className="mt-4 text-sm font-semibold">Abrir <span className="transition group-hover:ml-1">→</span></p></Link> }
