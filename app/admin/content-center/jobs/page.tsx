import Link from 'next/link'
import { Activity, AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, CircleDashed, Clock3, Gauge, ServerCog, TextCursorInput, Timer, Wifi, WifiOff } from 'lucide-react'
import { getCurrentAdminPermissions } from '@/lib/admin-permissions-server'
import { getTranslationJobsMonitor, resourceModuleLabel, type TranslationJobRow, type TranslationWorkerStatus } from '@/lib/admin-content-center'
import { allowedTranslationResources, TRANSLATION_RESOURCES } from '@/lib/admin-translation-inventory-policy'
import { normalizeTranslationJobFilters, TRANSLATION_JOB_STATUSES, TRANSLATION_METRICS_PERIODS, type TranslationJobFilters } from '@/lib/admin-translation-jobs-policy'
import { publicAiEngineStatus } from '@/lib/admin-translation-ai'

type SearchParams = Record<string, string | string[] | undefined>
const STATUS_LABELS: Record<string, string> = { queued: 'En cola', running: 'Procesando', retry_wait: 'Esperando reintento', succeeded: 'Completado', failed: 'Fallido', cancelled: 'Cancelado' }
const ERROR_LABELS: Record<string, string> = { local_provider_unavailable: 'Proveedor local no disponible', lease_expired: 'Ejecución interrumpida', translation_failed: 'La traducción no superó la validación' }

export default async function ContentCenterJobsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const raw = await searchParams, filters = normalizeTranslationJobFilters(raw), access = await getCurrentAdminPermissions()
  const data = await getTranslationJobsMonitor(filters, access.permissions), queue = publicAiEngineStatus()
  const allowed = allowedTranslationResources(access.permissions), query = stringQuery(raw), returnTo = jobsHref(stringQuery(raw))
  return <section className="mt-6">
    <WorkerPanel worker={data.worker} queueEnabled={queue.enabled} />
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
      <Metric title="Total" value={data.summary.total} /><Metric title="En cola" value={data.summary.queued} icon={Clock3} tone="amber" />
      <Metric title="Procesando" value={data.summary.running} icon={ServerCog} tone="blue" /><Metric title="Reintentos" value={data.summary.retry_wait} icon={CircleDashed} tone="amber" />
      <Metric title="Completados" value={data.summary.succeeded} icon={CheckCircle2} tone="green" /><Metric title="Fallidos" value={data.summary.failed} icon={AlertTriangle} tone="red" />
      <Metric title="Cancelados" value={data.summary.cancelled} /><Metric title="Recuperables" value={data.summary.recoverable} tone="amber" />
    </div>
    <OperationalMetrics metrics={data.metrics} available={data.metricsAvailable} />
    <JobFilters filters={filters} allowed={allowed} />
    <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col justify-between gap-2 border-b border-slate-200 p-4 sm:flex-row sm:items-center"><div><h2 className="font-bold">Inventario de trabajos</h2><p className="mt-1 text-xs text-slate-500">{data.total.toLocaleString('es-CO')} resultados con los filtros actuales.</p></div><p className="text-xs text-slate-500">Página {filters.page}{data.pages ? ` de ${data.pages}` : ''}</p></div>
      <div className="divide-y divide-slate-100">{data.rows.map((job) => <JobRow key={job.id} job={job} returnTo={returnTo} />)}{!data.rows.length && <div className="p-10 text-center"><CircleDashed className="mx-auto size-8 text-slate-300" /><p className="mt-3 font-semibold">No hay trabajos con estos filtros</p><p className="mt-1 text-sm text-slate-500">La cola no se modifica desde esta pantalla.</p></div>}</div>
    </div>
    <Pagination page={filters.page} pages={data.pages} query={query} />
  </section>
}

function WorkerPanel({ worker, queueEnabled }: { worker: TranslationWorkerStatus; queueEnabled: boolean }) {
  const presentation = workerPresentation(worker.availability)
  return <section className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr]" aria-label="Estado de traducción local">
    <div className={`rounded-2xl border p-5 ${presentation.className}`}><div className="flex items-start gap-3">{presentation.connected ? <Wifi className="mt-0.5 size-5" /> : <WifiOff className="mt-0.5 size-5" />}<div><p className="font-bold">{presentation.label}</p><p className="mt-1 text-sm">{presentation.description}</p>{worker.last_seen_at && <p className="mt-2 text-xs">Última actividad: {formatDate(worker.last_seen_at)}</p>}</div></div></div>
    <StatusCard label="Cola de solicitudes" value={queueEnabled ? 'Habilitada' : 'Deshabilitada'} detail={queueEnabled ? 'Acepta solicitudes y las conserva hasta que el worker esté disponible.' : 'No acepta nuevas solicitudes en este entorno.'} ok={queueEnabled} />
    <StatusCard label="LibreTranslate local" value={worker.availability === 'available' ? 'Disponible' : worker.availability === 'degraded' ? 'Con problemas' : 'Sin conexión'} detail={worker.supported_languages?.length ? `Idiomas informados: ${worker.supported_languages.map((code) => code.toUpperCase()).join(', ')}` : 'Sin compatibilidad reportada todavía.'} ok={worker.availability === 'available'} />
  </section>
}

function StatusCard({ label, value, detail, ok }: { label: string; value: string; detail: string; ok: boolean }) { return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-2 font-bold ${ok ? 'text-emerald-700' : 'text-amber-700'}`}>{value}</p><p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p></div> }

function JobFilters({ filters, allowed }: { filters: TranslationJobFilters; allowed: ReturnType<typeof allowedTranslationResources> }) {
  return <form className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-5" method="get">
    <Select name="status" label="Estado" value={filters.status} options={TRANSLATION_JOB_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }))} />
    <Select name="module" label="Módulo" value={filters.resourceType} options={allowed.map((value) => ({ value, label: TRANSLATION_RESOURCES[value].label }))} />
    <Input name="resource" label="Recurso" value={filters.resourceId} placeholder="UUID, clave o ID exacto" /><Input name="sourceLanguage" label="Idioma fuente" value={filters.sourceLanguage} placeholder="Ej. es" /><Input name="targetLanguage" label="Idioma destino" value={filters.targetLanguage} placeholder="Ej. en" />
    <Input name="provider" label="Proveedor" value={filters.provider} placeholder="Ej. libretranslate" /><Input name="error" label="Código de error" value={filters.errorCode} placeholder="Ej. translation_failed" /><Input name="from" label="Desde" value={filters.createdFrom} type="date" /><Input name="to" label="Hasta" value={filters.createdTo} type="date" />
    <Select name="sort" label="Orden" value={filters.sort} options={[{ value: 'created_desc', label: 'Más recientes' }, { value: 'created_asc', label: 'Más antiguos' }, { value: 'updated_desc', label: 'Actualizados recientemente' }]} />
    <Select name="metricsPeriod" label="Periodo de métricas" value={filters.metricsPeriod} options={TRANSLATION_METRICS_PERIODS.map((value) => ({ value, label: value === '24h' ? 'Últimas 24 horas' : value === '7d' ? 'Últimos 7 días' : 'Últimos 30 días' }))} />
    <div className="flex gap-2 md:col-span-2 xl:col-span-5"><button className="admin-primary-button justify-center px-5 py-2.5 text-sm" type="submit">Aplicar filtros</button><Link href="/admin/content-center/jobs" className="admin-secondary-button px-4 py-2.5 text-sm">Limpiar</Link></div>
  </form>
}

function OperationalMetrics({ metrics, available }: { metrics: Awaited<ReturnType<typeof getTranslationJobsMonitor>>['metrics']; available: boolean }) {
  if (!available) return <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950"><p className="font-bold">Métricas operativas pendientes de habilitar</p><p className="mt-1">El inventario continúa disponible. Aplica la migración versionada de 3.2B antes de desplegar esta vista.</p></section>
  const hasTerminalData = metrics.terminal_jobs > 0
  const errors = Object.entries(metrics.error_distribution ?? {}).sort((a, b) => b[1] - a[1])
  return <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="operational-metrics-title">
    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><h2 id="operational-metrics-title" className="font-bold">Métricas operativas</h2><p className="mt-1 text-xs text-slate-500">Periodo {metrics.period === '24h' ? 'de 24 horas' : metrics.period === '7d' ? 'de 7 días' : 'de 30 días'}; respeta módulo, recurso, idiomas y proveedor. No depende de la página actual.</p></div><p className="text-xs text-slate-500">{metrics.period_started_at && metrics.period_ended_at ? `${formatDate(metrics.period_started_at)} — ${formatDate(metrics.period_ended_at)}` : 'Periodo no disponible'}</p></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <OperationalDatum icon={Clock3} label="Pendiente más antiguo" value={metrics.oldest_pending_age_seconds === null ? 'Sin trabajos pendientes' : formatAge(metrics.oldest_pending_age_seconds)} detail={metrics.oldest_pending_created_at ? `Creado ${formatDate(metrics.oldest_pending_created_at)}` : undefined} />
      <OperationalDatum icon={Gauge} label="Tasa de éxito" value={metrics.success_rate === null ? 'Sin datos' : formatPercent(metrics.success_rate)} detail={hasTerminalData ? `${metrics.succeeded_jobs} exitosos de ${metrics.terminal_jobs} finalizados` : 'No hay éxitos o fallos en el periodo.'} />
      <OperationalDatum icon={AlertTriangle} label="Tasa de fallo" value={metrics.failure_rate === null ? 'Sin datos' : formatPercent(metrics.failure_rate)} detail={hasTerminalData ? `${metrics.failed_jobs} fallidos de ${metrics.terminal_jobs} finalizados` : 'No hay éxitos o fallos en el periodo.'} />
      <OperationalDatum icon={CheckCircle2} label="Trabajos completados" value={hasTerminalData ? metrics.completed_jobs.toLocaleString('es-CO') : 'Sin datos'} detail="Solo trabajos succeeded dentro del periodo." />
      <OperationalDatum icon={Timer} label="Duración media" value={metrics.average_duration_seconds === null ? 'Sin datos' : formatDuration(metrics.average_duration_seconds)} detail={metrics.duration_samples ? `${metrics.duration_samples} ejecuciones válidas` : 'Requiere timestamps de inicio y finalización.'} />
      <OperationalDatum icon={Activity} label="Percentil 50" value={metrics.p50_duration_seconds === null ? 'Datos insuficientes' : formatDuration(metrics.p50_duration_seconds)} detail="Disponible desde 2 duraciones válidas." />
      <OperationalDatum icon={Activity} label="Percentil 95" value={metrics.p95_duration_seconds === null ? 'Datos insuficientes' : formatDuration(metrics.p95_duration_seconds)} detail="Disponible desde 5 duraciones válidas." />
      <OperationalDatum icon={TextCursorInput} label="Caracteres procesados" value={metrics.processed_characters === null ? 'Sin datos' : metrics.processed_characters.toLocaleString('es-CO')} detail="Entrada + salida registradas en trabajos completados." />
    </div>
    <div className="mt-4 border-t border-slate-100 pt-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Fallos por categoría segura</p>{errors.length ? <div className="mt-2 flex flex-wrap gap-2">{errors.map(([category, count]) => <span key={category} className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800">{safeErrorCategory(category)} · {count.toLocaleString('es-CO')}</span>)}</div> : <p className="mt-2 text-sm text-slate-500">No hay fallos clasificados en este periodo.</p>}</div>
  </section>
}

function OperationalDatum({ icon: Icon, label, value, detail }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; detail?: string }) { return <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"><div className="flex items-center gap-2 text-slate-500"><Icon className="size-4"/><p className="text-xs font-semibold">{label}</p></div><p className="mt-2 text-xl font-bold text-slate-900">{value}</p>{detail && <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>}</div> }

function JobRow({ job, returnTo }: { job: TranslationJobRow; returnTo: string }) {
  const resourceHref = `/admin/content-center/translations/${job.resource_type}/${encodeURIComponent(job.resource_id)}?returnTo=${encodeURIComponent(returnTo)}`
  const detailHref = `/admin/content-center/jobs/${job.id}?returnTo=${encodeURIComponent(returnTo)}`
  const provider = job.provider_used ?? job.requested_provider ?? 'Local'
  return <article className="grid gap-4 p-4 text-sm xl:grid-cols-[minmax(260px,1.4fr)_130px_150px_180px_minmax(180px,1fr)_auto] xl:items-center">
    <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-amber-700">{resourceModuleLabel(job.resource_type)}</p><p className="mt-1 truncate font-semibold" title={job.field_name}>{friendlyField(job.field_name)}</p><p className="mt-1 truncate font-mono text-[11px] text-slate-400" title={job.resource_id}>{job.resource_id}</p></div>
    <p className="font-semibold text-slate-600">{job.source_language.toUpperCase()} → {job.target_language.toUpperCase()}</p><Status status={job.status} />
    <div><p className="font-semibold text-slate-700">{provider}</p><p className="mt-1 text-xs text-slate-500">Intentos {job.attempt_count}/{job.max_attempts}</p></div>
    <div className="text-xs leading-5 text-slate-500"><p>Creado: {formatDate(job.created_at)}</p>{job.started_at && <p>Iniciado: {formatDate(job.started_at)}</p>}{job.completed_at && <p>Finalizado: {formatDate(job.completed_at)}</p>}{job.error_code && <p className="font-semibold text-red-700" title={job.error_code}>{ERROR_LABELS[job.error_code] ?? `Error: ${job.error_code}`}</p>}</div>
    <div className="flex flex-col gap-2"><Link href={detailHref} className="admin-primary-button justify-center px-3 py-2 text-xs">Ver detalle</Link><Link href={resourceHref} className="admin-secondary-button justify-center px-3 py-2 text-xs">Abrir recurso</Link></div>
  </article>
}

function Status({ status }: { status: string }) { const tone = status === 'succeeded' ? 'bg-emerald-50 text-emerald-800' : status === 'failed' ? 'bg-red-50 text-red-800' : status === 'running' ? 'bg-blue-50 text-blue-800' : status === 'queued' || status === 'retry_wait' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-700'; return <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{STATUS_LABELS[status] ?? status}</span> }
function Metric({ title,value,icon:Icon=CircleDashed,tone='slate' }:{title:string;value:number;icon?:React.ComponentType<{className?:string}>;tone?:string}) { const colors:Record<string,string>={slate:'text-slate-700 bg-slate-100',amber:'text-amber-700 bg-amber-50',red:'text-red-700 bg-red-50',green:'text-emerald-700 bg-emerald-50',blue:'text-blue-700 bg-blue-50'};return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-slate-500">{title}</p><span className={`rounded-xl p-2 ${colors[tone]}`}><Icon className="size-4" /></span></div><p className="mt-3 text-2xl font-bold">{value.toLocaleString('es-CO')}</p></div> }
function Select({ name,label,value,options }:{name:string;label:string;value?:string;options:{value:string;label:string}[]}){return <label className="text-xs font-semibold text-slate-600">{label}<select name={name} defaultValue={value??''} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal"><option value="">Todos</option>{options.map((option)=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}
function Input({ name,label,value,placeholder,type='text' }:{name:string;label:string;value?:string;placeholder?:string;type?:string}){return <label className="text-xs font-semibold text-slate-600">{label}<input name={name} defaultValue={value} placeholder={placeholder} type={type} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal" /></label>}
function Pagination({ page,pages,query }:{page:number;pages:number;query:Record<string,string>}){if(pages<=1)return null;return <nav className="mt-5 flex items-center justify-between text-sm" aria-label="Paginación de trabajos"><Link href={page>1?jobsHref(query,{page:String(page-1)}):'#'} aria-disabled={page<=1} className={`admin-secondary-button gap-1 px-3 py-2 ${page<=1?'pointer-events-none opacity-40':''}`}><ArrowLeft className="size-4"/>Anterior</Link><span className="text-slate-500">Página {page} de {pages}</span><Link href={page<pages?jobsHref(query,{page:String(page+1)}):'#'} aria-disabled={page>=pages} className={`admin-secondary-button gap-1 px-3 py-2 ${page>=pages?'pointer-events-none opacity-40':''}`}>Siguiente<ArrowRight className="size-4"/></Link></nav>}
function workerPresentation(value:TranslationWorkerStatus['availability']){if(value==='available')return{label:'Worker disponible',description:'El worker local mantiene contacto y LibreTranslate respondió correctamente.',className:'border-emerald-200 bg-emerald-50 text-emerald-900',connected:true};if(value==='degraded')return{label:'Worker con problemas',description:'El worker reportó actividad, pero LibreTranslate o su compatibilidad requieren atención.',className:'border-amber-200 bg-amber-50 text-amber-950',connected:true};if(value==='offline')return{label:'Worker desconectado',description:'El último heartbeat superó el umbral de 120 segundos. Los trabajos permanecen en cola.',className:'border-red-200 bg-red-50 text-red-900',connected:false};return{label:'Worker nunca conectado',description:'Todavía no se ha recibido un heartbeat desde Windows.',className:'border-slate-200 bg-slate-50 text-slate-700',connected:false}}
function friendlyField(value:string){return value.replaceAll('_',' ').replace(/^./,(letter)=>letter.toUpperCase())}
function formatDate(value:string){return new Intl.DateTimeFormat('es-CO',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Bogota'}).format(new Date(value))}
function formatPercent(value:number){return new Intl.NumberFormat('es-CO',{style:'percent',maximumFractionDigits:1}).format(value)}
function formatDuration(seconds:number){if(seconds<60)return `${Math.round(seconds)} s`;if(seconds<3600)return `${Math.floor(seconds/60)} min ${Math.round(seconds%60)} s`;return `${Math.floor(seconds/3600)} h ${Math.round(seconds%3600/60)} min`}
function formatAge(seconds:number){if(seconds<3600)return `${Math.max(1,Math.floor(seconds/60))} min`;if(seconds<86400)return `${Math.floor(seconds/3600)} h ${Math.floor(seconds%3600/60)} min`;return `${Math.floor(seconds/86400)} d ${Math.floor(seconds%86400/3600)} h`}
function safeErrorCategory(value:string){return({recoverable_connectivity:'Conectividad recuperable',lease_expired:'Lease vencido',source_unavailable:'Fuente modificada o no disponible',editorial_conflict:'Conflicto editorial',protected_content_validation:'Contenido protegido o inválido',unknown:'Error desconocido'} as Record<string,string>)[value]??'Error desconocido'}
function stringQuery(raw:SearchParams){return Object.fromEntries(Object.entries(raw).flatMap(([key,value])=>typeof value==='string'?[[key,value]]:[]))}
function jobsHref(current:Record<string,string>,changes:Record<string,string|undefined>={}){const params=new URLSearchParams(current);for(const[key,value]of Object.entries(changes)){if(value)params.set(key,value);else params.delete(key)}const query=params.toString();return `/admin/content-center/jobs${query?`?${query}`:''}`}
