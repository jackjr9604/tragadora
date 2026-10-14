import Link from 'next/link'
import { AlertTriangle, ArrowLeft, ArrowRight, BriefcaseBusiness, CheckCircle2, CircleDashed, Clock3, ExternalLink, FileText, Languages, Search, ServerCog } from 'lucide-react'
import { getCurrentAdminPermissions } from '@/lib/admin-permissions-server'
import { CONTENT_CENTER_BUCKETS, CONTENT_CENTER_BUCKET_LABELS, bucketCount, normalizeContentCenterParams, type ContentCenterBucket } from '@/lib/admin-content-center-policy'
import { getContentCenterData, getRecentTranslationJobs, resourceEditorHref, resourceModuleLabel, type ContentCenterResourceRow } from '@/lib/admin-content-center'
import { TRANSLATION_RESOURCES } from '@/lib/admin-translation-inventory-policy'
import { publicAiEngineStatus } from '@/lib/admin-translation-ai'
import { getAdminLanguages } from '@/lib/admin-languages'
import { ContentCenterLanguages } from '@/components/admin/content/ContentCenterLanguages'

type SearchParams = Record<string, string | string[] | undefined>

export default async function ContentCenterPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const raw = await searchParams
  const filters = normalizeContentCenterParams(raw)
  const access = await getCurrentAdminPermissions()
  const data = await getContentCenterData(filters, access.permissions)
  const jobs = filters.view === 'jobs' ? await getRecentTranslationJobs(access.permissions) : []
  const languageData = filters.view === 'languages' ? await getAdminLanguages() : null
  const ai = publicAiEngineStatus()
  const query = Object.fromEntries(Object.entries(raw).flatMap(([key, value]) => typeof value === 'string' ? [[key, value]] : []))

  return <main className="min-h-screen p-4 sm:p-8"><div className="mx-auto max-w-[1500px]">
    <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
      <div><p className="text-xs font-bold uppercase tracking-[.18em] text-amber-700">Centro editorial</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Contenido e idiomas</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Localiza contenido, traducciones y trabajo editorial desde una sola vista. Los editores existentes continúan siendo la fuente de escritura.</p></div>
      <div className={`max-w-md rounded-2xl border px-4 py-3 text-sm ${ai.enabled ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-950'}`}><div className="flex items-start gap-3"><ServerCog className="mt-0.5 size-5 shrink-0" /><div><p className="font-semibold">{ai.provider}</p><p className="mt-1 text-xs leading-5">{ai.message}</p></div></div></div>
    </header>

    <CenterNavigation active={filters.view} />

    {!data.rpcAvailable && <section className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950"><strong>Centro pendiente de activar.</strong> Aplica manualmente la migración local <code>202610140001_content_center_read_models.sql</code>. Los administradores anteriores siguen disponibles.</section>}

    {filters.view === 'summary' && <>
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Resumen global"><Metric title="Recursos" value={data.summary.resources} icon={BriefcaseBusiness} /><Metric title="Campos traducibles" value={data.summary.fields} icon={FileText} /><Metric title="Listos y publicados" value={data.summary.published} icon={CheckCircle2} tone="green" /><Metric title="Trabajos esperando" value={data.summary.queued_jobs + data.summary.retry_jobs} icon={Clock3} tone="amber" /></section>
      <BucketGrid summary={data.summary} />
      <section className="mt-8 grid gap-4 lg:grid-cols-3"><QuickLink title="Editar contenido" description="Abre páginas y secciones de site_content." href="/admin/content" icon={FileText} /><QuickLink title="Gestionar traducciones" description="Abre el inventario y editor integral 3E.4." href="/admin/translations" icon={Languages} /><QuickLink title="Configurar idiomas" description="Administra registro, preparación y publicación segura." href="/admin/content-center?view=languages" icon={ServerCog} /></section>
    </>}

    {filters.view === 'translations' && <>
      <BucketTabs active={filters.bucket} summary={data.summary} query={query} />
      <FilterForm filters={filters} languages={data.languages} />
      <section className="mt-5 space-y-3" aria-label="Recursos editoriales">{data.rows.map((row) => <ResourceCard key={`${row.resource_type}:${row.resource_id}`} row={row} />)}</section>
      {!data.rows.length && data.rpcAvailable && <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center"><CircleDashed className="mx-auto size-9 text-slate-300" /><p className="mt-3 font-semibold">No hay recursos en esta bandeja</p><p className="mt-1 text-sm text-slate-500">Prueba otro idioma, módulo o término de búsqueda.</p></div>}
      <Pagination page={filters.page} pages={data.pages} query={query} />
    </>}

    {filters.view === 'jobs' && <JobsPanel jobs={jobs} summary={data.summary} aiEnabled={ai.enabled} />}
    {filters.view === 'languages' && languageData && <>{!languageData.rpcAvailable&&<section className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950"><strong>Administración segura pendiente.</strong> Aplica manualmente <code>202610140002_language_administration.sql</code>. El editor antiguo queda bloqueado para evitar escrituras no transaccionales.</section>}{languageData.rpcAvailable&&<ContentCenterLanguages languages={languageData.languages} canCreate={access.permissions.has('content.create')} canUpdate={access.permissions.has('content.update')} canDelete={access.permissions.has('content.delete')}/>}</>}
  </div></main>
}

function CenterNavigation({ active }: { active: string }) {
  const links = [
    { label: 'Resumen', href: '/admin/content-center', match: 'summary' },
    { label: 'Contenido', href: '/admin/content' },
    { label: 'Traducciones', href: '/admin/content-center?view=translations', match: 'translations' },
    { label: 'Revisión', href: '/admin/content-center?view=translations&bucket=in_review' },
    { label: 'Publicación', href: '/admin/content-center?view=translations&bucket=approved' },
    { label: 'Trabajos', href: '/admin/content-center?view=jobs', match: 'jobs' },
    { label: 'Idiomas', href: '/admin/content-center?view=languages', match: 'languages' },
  ]
  return <nav className="mt-7 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm" aria-label="Centro de contenido">{links.map((link) => <Link key={link.label} href={link.href} aria-current={link.match === active ? 'page' : undefined} className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${link.match === active ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}>{link.label}</Link>)}</nav>
}

function BucketGrid({ summary }: { summary: Awaited<ReturnType<typeof getContentCenterData>>['summary'] }) {
  return <section className="mt-8"><div className="mb-3 flex items-end justify-between"><div><h2 className="text-xl font-bold">Bandejas editoriales</h2><p className="mt-1 text-sm text-slate-500">Conteos globales de los módulos a los que tienes acceso.</p></div></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{CONTENT_CENTER_BUCKETS.map((bucket) => <Link key={bucket} href={`/admin/content-center?view=translations&bucket=${bucket}`} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md"><div className="flex items-center justify-between"><span className="text-sm font-semibold text-slate-600">{CONTENT_CENTER_BUCKET_LABELS[bucket]}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold group-hover:bg-amber-100">{bucketCount(summary, bucket).toLocaleString('es-CO')}</span></div><p className="mt-4 text-xs text-slate-400">Abrir bandeja →</p></Link>)}</div></section>
}

function BucketTabs({ active, summary, query }: { active?: ContentCenterBucket; summary: Awaited<ReturnType<typeof getContentCenterData>>['summary']; query: Record<string, string> }) {
  return <nav className="mt-6 flex gap-2 overflow-x-auto pb-1" aria-label="Bandejas editoriales"><Link href={withQuery(query, { view: 'translations', bucket: undefined, page: undefined })} className={tabClass(!active)}>Todos <Count value={summary.resources} /></Link>{CONTENT_CENTER_BUCKETS.map((bucket) => <Link key={bucket} href={withQuery(query, { view: 'translations', bucket, page: undefined })} className={tabClass(active === bucket)}>{CONTENT_CENTER_BUCKET_LABELS[bucket]} <Count value={bucketCount(summary, bucket)} /></Link>)}</nav>
}

function FilterForm({ filters, languages }: { filters: ReturnType<typeof normalizeContentCenterParams>; languages: { code: string; native_name: string }[] }) {
  return <form method="get" className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[minmax(260px,1fr)_220px_180px_auto]"><input type="hidden" name="view" value="translations" />{filters.bucket && <input type="hidden" name="bucket" value={filters.bucket} />}<label className="relative"><span className="sr-only">Buscar recursos</span><Search className="pointer-events-none absolute left-3 top-3 size-4 text-slate-400" /><input name="q" defaultValue={filters.query} placeholder="Buscar por nombre, título o ID" className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm" /></label><label><span className="sr-only">Módulo</span><select name="module" defaultValue={filters.resourceType ?? ''} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"><option value="">Todos los módulos</option>{Object.entries(TRANSLATION_RESOURCES).map(([value, config]) => <option key={value} value={value}>{config.label}</option>)}</select></label><label><span className="sr-only">Idioma</span><select name="language" defaultValue={filters.language ?? ''} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"><option value="">Todos los idiomas</option>{languages.filter((language) => language.code).map((language) => <option key={language.code} value={language.code}>{language.native_name} ({language.code.toUpperCase()})</option>)}</select></label><button className="admin-primary-button justify-center px-5 py-2.5 text-sm">Aplicar filtros</button></form>
}

function ResourceCard({ row }: { row: ContentCenterResourceRow }) {
  const progress = row.total_fields ? Math.round((Number(row.published_count) / Number(row.total_fields)) * 100) : 0
  const languages = Object.entries(row.language_progress ?? {})
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="grid gap-5 xl:grid-cols-[minmax(240px,1fr)_minmax(300px,1fr)_auto] xl:items-center"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-amber-700">{resourceModuleLabel(row.resource_type)}</p><h2 className="mt-1 truncate text-lg font-bold" title={row.resource_label}>{row.resource_label}</h2><p className="mt-1 truncate font-mono text-[11px] text-slate-400">{row.resource_id}</p></div><div><div className="flex items-center justify-between text-xs font-semibold"><span>Publicación general</span><span>{row.published_count}/{row.total_fields} · {progress}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} /></div><div className="mt-3 flex flex-wrap gap-2">{languages.map(([language, value]) => <span key={language} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">{language.toUpperCase()} {Number(value.published)}/{Number(value.total)}</span>)}{Number(row.pending_count)>0&&<Badge>{row.pending_count} pendientes</Badge>}{Number(row.draft_count)>0&&<Badge>{row.draft_count} borradores</Badge>}{Number(row.stale_count)>0&&<Badge tone="orange">{row.stale_count} stale</Badge>}{Number(row.error_count)>0&&<Badge tone="red">{row.error_count} errores</Badge>}</div></div><div className="flex flex-wrap gap-2 xl:justify-end"><Link href={row.origin_href} className="admin-secondary-button gap-2 px-3 py-2 text-sm">Abrir origen <ExternalLink className="size-4" /></Link><Link href={resourceEditorHref(row)} className="admin-primary-button gap-2 px-3 py-2 text-sm">Gestionar traducciones <Languages className="size-4" /></Link></div></div></article>
}

function JobsPanel({ jobs, summary, aiEnabled }: { jobs: Awaited<ReturnType<typeof getRecentTranslationJobs>>; summary: Awaited<ReturnType<typeof getContentCenterData>>['summary']; aiEnabled: boolean }) {
  return <section className="mt-6"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric title="En cola" value={summary.queued_jobs} icon={Clock3} tone="amber" /><Metric title="Procesando" value={summary.running_jobs} icon={ServerCog} /><Metric title="Reintentos" value={summary.retry_jobs} icon={CircleDashed} tone="amber" /><Metric title="Fallidos" value={summary.failed_jobs} icon={AlertTriangle} tone="red" /></div><div className={`mt-5 rounded-2xl border p-4 text-sm ${aiEnabled ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-950'}`}>{aiEnabled ? 'Las solicitudes se guardan en Supabase y esperan de forma segura al worker local de Windows. Esta página no intenta conectarse directamente con LibreTranslate.' : 'La cola local está desactivada en este entorno. Los trabajos existentes se conservan; no se intentará contactar LibreTranslate desde Vercel.'}</div><div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 p-4"><h2 className="font-bold">Trabajos recientes</h2></div><div className="divide-y divide-slate-100">{jobs.map((job) => <article key={job.id} className="grid gap-2 p-4 text-sm md:grid-cols-[1fr_160px_130px] md:items-center"><div className="min-w-0"><p className="truncate font-semibold">{resourceModuleLabel(job.resource_type)} · {job.field_name}</p><p className="mt-1 truncate font-mono text-xs text-slate-400">{job.resource_id}</p></div><p className="text-slate-600">{job.source_language.toUpperCase()} → {job.target_language.toUpperCase()}</p><span className="w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">{job.status}</span></article>)}{!jobs.length&&<p className="p-8 text-center text-sm text-slate-500">No hay trabajos registrados para los módulos disponibles.</p>}</div></div></section>
}

function Metric({ title, value, icon: Icon, tone='slate' }: { title: string; value: number; icon: React.ComponentType<{className?:string}>; tone?: string }) { const color=tone==='green'?'text-emerald-700 bg-emerald-50':tone==='amber'?'text-amber-700 bg-amber-50':tone==='red'?'text-red-700 bg-red-50':'text-slate-700 bg-slate-100'; return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-500">{title}</p><span className={`rounded-xl p-2 ${color}`}><Icon className="size-4" /></span></div><p className="mt-4 text-3xl font-bold">{value.toLocaleString('es-CO')}</p></div> }
function QuickLink({ title, description, href, icon: Icon }: { title:string;description:string;href:string;icon:React.ComponentType<{className?:string}> }) { return <Link href={href} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-amber-300"><Icon className="size-5 text-amber-700" /><h3 className="mt-4 font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{description}</p><p className="mt-4 text-sm font-semibold">Abrir <span className="transition group-hover:ml-1">→</span></p></Link> }
function Badge({ children, tone='amber' }: { children:React.ReactNode;tone?:string }) { return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone==='red'?'bg-red-50 text-red-700':tone==='orange'?'bg-orange-50 text-orange-700':'bg-amber-50 text-amber-700'}`}>{children}</span> }
function Count({ value }: { value:number }) { return <span className="ml-1 rounded-full bg-black/10 px-2 py-0.5 text-xs">{value}</span> }
function tabClass(active:boolean) { return `inline-flex shrink-0 items-center rounded-xl border px-3 py-2 text-sm font-semibold ${active?'border-slate-950 bg-slate-950 text-white':'border-slate-200 bg-white text-slate-600 hover:border-amber-300'}` }
function Pagination({ page,pages,query }:{page:number;pages:number;query:Record<string,string>}) { if(pages<=1)return null; return <nav className="mt-5 flex items-center justify-between text-sm" aria-label="Paginación"><Link href={page>1?withQuery(query,{page:String(page-1)}):'#'} aria-disabled={page<=1} className={`admin-secondary-button gap-1 px-3 py-2 ${page<=1?'pointer-events-none opacity-40':''}`}><ArrowLeft className="size-4"/>Anterior</Link><span className="text-slate-500">Página {page} de {pages}</span><Link href={page<pages?withQuery(query,{page:String(page+1)}):'#'} aria-disabled={page>=pages} className={`admin-secondary-button gap-1 px-3 py-2 ${page>=pages?'pointer-events-none opacity-40':''}`}>Siguiente<ArrowRight className="size-4"/></Link></nav> }
function withQuery(current:Record<string,string>,changes:Record<string,string|undefined>){const params=new URLSearchParams(current);for(const [key,value] of Object.entries(changes)){if(value)params.set(key,value);else params.delete(key)}const result=params.toString();return `/admin/content-center${result?`?${result}`:''}`}
