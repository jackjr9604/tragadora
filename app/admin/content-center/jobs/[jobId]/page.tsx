import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertTriangle, ArrowLeft, CheckCircle2, ExternalLink, ShieldAlert } from 'lucide-react'
import { getCurrentAdminPermissions } from '@/lib/admin-permissions-server'
import { getTranslationJobDetail, resourceModuleLabel } from '@/lib/admin-content-center'
import { safeTranslationJobsReturn } from '@/lib/admin-translation-jobs-policy'
import { translationFieldLabel } from '@/lib/admin-translation-resource-policy'
import { translationJobActionEligibility } from '@/lib/admin-translation-job-actions'
import { TranslationJobActions } from '@/components/admin/translations/TranslationJobActions'

type SearchParams = Record<string, string | string[] | undefined>

export default async function TranslationJobDetailPage({ params, searchParams }: { params: Promise<{ jobId: string }>; searchParams: Promise<SearchParams> }) {
  const [{ jobId }, raw, access] = await Promise.all([params, searchParams, getCurrentAdminPermissions()])
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobId)) notFound()
  const job = await getTranslationJobDetail(jobId, access.permissions)
  if (!job) notFound()
  const returnTo = safeTranslationJobsReturn(first(raw.returnTo))
  const resourceHref = `/admin/content-center/translations/${job.resource_type}/${encodeURIComponent(job.resource_id)}?returnTo=${encodeURIComponent(`/admin/content-center/jobs/${job.id}?returnTo=${encodeURIComponent(returnTo)}`)}`
  const timeline = jobTimeline(job)
  const eligibility = translationJobActionEligibility(job)

  return <section className="mt-6 space-y-5">
    <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-amber-700">{resourceModuleLabel(job.resource_type)}</p><h1 className="mt-1 text-2xl font-bold">{translationFieldLabel(job.field_name)}</h1><p className="mt-1 break-all font-mono text-xs text-slate-400">{job.resource_id}</p></div><div className="flex flex-wrap gap-2"><Link href={returnTo} className="admin-secondary-button gap-2 px-4 py-2 text-sm"><ArrowLeft className="size-4"/>Volver a trabajos</Link><Link href={resourceHref} className="admin-primary-button gap-2 px-4 py-2 text-sm">Abrir recurso<ExternalLink className="size-4"/></Link></div></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Datum label="Estado técnico" value={statusLabel(job.status)}/><Datum label="Idiomas" value={`${job.source_language.toUpperCase()} → ${job.target_language.toUpperCase()}`}/><Datum label="Proveedor" value={job.provider_used ?? job.requested_provider ?? 'Local no registrado'}/><Datum label="Intentos" value={`${job.attempt_count} de ${job.max_attempts}`}/></div>
      <p className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-900"><strong>Estado técnico ≠ publicación.</strong> Un trabajo completado solo indica que el worker produjo un resultado; la traducción continúa su revisión y publicación humana por separado.</p>
    </header>

    <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-bold">Estado editorial relacionado</h2>{job.editorial_state_exists?<div className="mt-4 grid gap-3 sm:grid-cols-2"><Datum label="Traducción" value={editorialStatus(job.editorial_status)}/><Datum label="Workflow" value={workflowStatus(job.workflow_status)}/><Datum label="Publicación" value={job.publication_status==='published'?'Publicada':'Sin publicar'}/><Datum label="Protección manual" value={job.is_protected?'Protegida':'Sin protección'}/><Datum label="Vigencia de fuente" value={job.source_is_current?'Misma revisión':'Fuente modificada'}/><Datum label="Actualización editorial" value={formatDate(job.editorial_updated_at)}/></div>:<p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">El estado editorial relacionado ya no existe o no está disponible. El trabajo se conserva como registro técnico.</p>}</section>
      <ErrorPanel job={job}/>
    </div>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className="font-bold">Línea temporal disponible</h2><p className="mt-1 text-xs text-slate-500">Se muestran únicamente timestamps persistidos; no se reconstruyen eventos inexistentes.</p></div>{job.duration_seconds!==null&&<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">Duración registrada: {formatDuration(job.duration_seconds)}</span>}</div><ol className="mt-5 space-y-4 border-l-2 border-slate-200 pl-5">{timeline.map((event)=><li key={`${event.label}:${event.value}`} className="relative"><span className="absolute -left-[27px] top-1 size-3 rounded-full bg-amber-500 ring-4 ring-white"/><p className="font-semibold">{event.label}</p><time className="text-sm text-slate-500">{formatDate(event.value)}</time>{event.detail&&<p className="mt-1 text-xs text-slate-500">{event.detail}</p>}</li>)}</ol></section>

    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Datum label="Prioridad" value={String(job.priority)}/><Datum label="Entrada" value={job.input_characters===null?'No registrada':`${job.input_characters.toLocaleString('es-CO')} caracteres`}/><Datum label="Salida" value={job.output_characters===null?'No registrada':`${job.output_characters.toLocaleString('es-CO')} caracteres`}/><Datum label="Código técnico" value={job.error_code??'Sin error'}/></section>
    {job.editorial_lock_version !== null && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-bold">Acciones administrativas</h2><p className="mt-1 text-sm text-slate-500">Las acciones se vuelven a validar en el servidor y nunca publican traducciones.</p><div className="mt-4"><TranslationJobActions jobId={job.id} jobUpdatedAt={job.updated_at} stateLockVersion={job.editorial_lock_version} eligibility={eligibility}/></div></section>}
  </section>
}

function ErrorPanel({ job }: { job: NonNullable<Awaited<ReturnType<typeof getTranslationJobDetail>>> }) {
  if (!job.error_category) return <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950"><div className="flex gap-3"><CheckCircle2 className="mt-0.5 size-5"/><div><h2 className="font-bold">Sin error registrado</h2><p className="mt-1 text-sm">El trabajo no tiene una causa de error asociada.</p></div></div></section>
  const protectedFailure=job.error_category==='protected_content_validation'||job.error_category==='editorial_conflict'
  return <section className={`rounded-2xl border p-5 ${job.error_recoverable?'border-amber-200 bg-amber-50 text-amber-950':'border-red-200 bg-red-50 text-red-950'}`}><div className="flex gap-3">{protectedFailure?<ShieldAlert className="mt-0.5 size-5"/>:<AlertTriangle className="mt-0.5 size-5"/>}<div><p className="text-xs font-bold uppercase tracking-wide">{errorCategory(job.error_category)}</p><h2 className="mt-1 font-bold">{job.error_recoverable?'Recuperable de forma segura':'No reintentar automáticamente'}</h2><p className="mt-2 text-sm leading-6">{job.error_summary}</p>{job.requires_human_review&&<p className="mt-2 text-xs font-semibold">Requiere intervención humana antes de solicitar otro intento.</p>}</div></div></section>
}

function Datum({label,value}:{label:string;value:string}){return <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</p></div>}
function first(value:string|string[]|undefined){return Array.isArray(value)?value[0]:value}
function formatDate(value:string|null){return value?new Intl.DateTimeFormat('es-CO',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Bogota'}).format(new Date(value)):'No registrada'}
function formatDuration(seconds:number){if(seconds<60)return `${seconds} s`;if(seconds<3600)return `${Math.floor(seconds/60)} min ${seconds%60} s`;return `${Math.floor(seconds/3600)} h ${Math.floor(seconds%3600/60)} min`}
function statusLabel(value:string){return({queued:'En cola',running:'Procesando',retry_wait:'Esperando reintento',succeeded:'Completado',failed:'Fallido',cancelled:'Cancelado'} as Record<string,string>)[value]??value}
function editorialStatus(value:string|null){return({missing:'Pendiente',queued:'En cola',machine_translated:'Traducida automáticamente',imported_unreviewed:'Importada sin revisar',reviewed:'Revisada',stale:'Desactualizada',error:'Error'} as Record<string,string>)[value??'']??'Sin estado'}
function workflowStatus(value:string|null){return({none:'Sin borrador',draft:'Borrador',in_review:'En revisión',approved:'Aprobada'} as Record<string,string>)[value??'']??'Sin workflow'}
function errorCategory(value:string){return({recoverable_connectivity:'Conectividad recuperable',lease_expired:'Lease vencido',source_unavailable:'Fuente modificada o no disponible',editorial_conflict:'Contenido protegido o conflicto editorial',protected_content_validation:'Validación de Markdown o contenido protegido',unknown:'Error desconocido'} as Record<string,string>)[value]??'Error desconocido'}
function jobTimeline(job:NonNullable<Awaited<ReturnType<typeof getTranslationJobDetail>>>){const items=[{label:'Creado',value:job.created_at,detail:'Solicitud registrada en la cola.'}];if(job.started_at)items.push({label:'Iniciado',value:job.started_at,detail:'El worker reclamó el trabajo.'});if(job.next_attempt_at&&['queued','retry_wait'].includes(job.status))items.push({label:'Próxima ejecución elegible',value:job.next_attempt_at,detail:'Fecha programada; depende de que el worker esté disponible.'});if(job.lease_expires_at&&job.status==='running')items.push({label:'Vencimiento del lease',value:job.lease_expires_at,detail:'Límite vigente de la ejecución actual.'});if(job.completed_at)items.push({label:job.status==='succeeded'?'Completado':'Finalizado',value:job.completed_at,detail:'Estado terminal persistido por la cola.'});if(job.updated_at!==job.created_at&&job.updated_at!==job.completed_at)items.push({label:'Última actualización técnica',value:job.updated_at,detail:'No implica publicación editorial.'});return items.sort((a,b)=>new Date(a.value).getTime()-new Date(b.value).getTime())}
