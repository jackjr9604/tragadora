import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { TranslationResourceEditor } from '@/components/admin/translations/TranslationResourceEditor'
import { getCurrentAdminPermissions } from '@/lib/admin-permissions-server'
import { publicAiEngineStatus } from '@/lib/admin-translation-ai'
import { getTranslationResourceDetail, getTranslationResourceJobs, makeResourceKey } from '@/lib/admin-translation-inventory'
import { TRANSLATION_RESOURCES, type TranslationResourceType } from '@/lib/admin-translation-inventory-policy'
import { safeContentCenterReturn } from '@/lib/admin-content-center-navigation'
import { summarizeEditorialStages, translationFieldLabel } from '@/lib/admin-translation-resource-policy'

export default async function TranslationResourcePage({ params, searchParams }: { params: Promise<{ resourceType: string; resourceId: string }>; searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const [{ resourceType, resourceId }, raw, access] = await Promise.all([params, searchParams, getCurrentAdminPermissions()])
  if (!(resourceType in TRANSLATION_RESOURCES)) notFound()
  const type = resourceType as TranslationResourceType
  const resourceKey=makeResourceKey(type,resourceId)
  const [detail,jobs] = await Promise.all([getTranslationResourceDetail(resourceKey, access.permissions),getTranslationResourceJobs(resourceKey,access.permissions)])
  if (!detail) notFound()
  const requestedReturn = first(raw.returnTo)
  const returnTo = requestedReturn?.split('#')[0] === detail.origin.href ? requestedReturn : safeContentCenterReturn(requestedReturn)
  const ai = publicAiEngineStatus()
  const progress=detail.summary.total?Math.round(detail.summary.published/detail.summary.total*100):0
  const stages=summarizeEditorialStages(detail.fields.map((field)=>field.state))
  return <section className="mt-6"><header className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-amber-700">{TRANSLATION_RESOURCES[detail.resourceType].label}</p><h2 className="mt-1 truncate text-2xl font-bold">{detail.origin.label}</h2><div className="mt-3 flex flex-wrap gap-2"><Stage label="Pendientes" value={stages.pending}/><Stage label="Borradores" value={stages.drafts}/><Stage label="En revisión" value={stages.inReview}/><Stage label="Aprobados" value={stages.approved}/><Stage label="Publicados" value={stages.published} tone="green"/><Stage label="Desactualizados" value={stages.stale} tone="orange"/></div></div><div className="flex flex-wrap gap-2"><Link href={detail.origin.href} className="admin-secondary-button gap-2 px-4 py-2 text-sm">Contenido original <ExternalLink className="size-4" /></Link><Link href={returnTo} className="admin-secondary-button gap-2 px-4 py-2 text-sm"><ArrowLeft className="size-4"/>Volver</Link></div></div><div className="mt-4 flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{width:`${progress}%`}}/></div><strong className="text-sm">{progress}% publicado</strong></div></header><TranslationResourceEditor resourceKey={resourceKey} fields={detail.fields} languages={detail.languages} canEdit={detail.canEdit} workflowAvailable={detail.workflowAvailable} aiEnabled={ai.enabled}/><ResourceJobs jobs={jobs}/></section>
}

function first(value:string|string[]|undefined) { return Array.isArray(value)?value[0]:value }

function Stage({label,value,tone='slate'}:{label:string;value:number;tone?:'slate'|'green'|'orange'}){const color=tone==='green'?'bg-emerald-50 text-emerald-800 ring-emerald-200':tone==='orange'?'bg-orange-50 text-orange-800 ring-orange-200':'bg-slate-50 text-slate-700 ring-slate-200';return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${color}`}>{label}: {value}</span>}

function ResourceJobs({jobs}:{jobs:Awaited<ReturnType<typeof getTranslationResourceJobs>>}){return <details className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><summary className="cursor-pointer font-bold">Actividad de traducción ({jobs.length})</summary><p className="mt-2 text-sm text-slate-500">Últimos trabajos de este recurso. La gestión completa permanece en la sección Trabajos.</p><div className="mt-4 divide-y divide-slate-100">{jobs.map((job)=><article key={job.id} className="grid gap-2 py-3 text-sm sm:grid-cols-[1fr_120px_140px] sm:items-center"><div><p className="font-semibold">{translationFieldLabel(job.field_name)} · {job.target_language.toUpperCase()}</p><p className="font-mono text-[11px] text-slate-400">{job.field_name}</p><p className="text-xs text-slate-500">{job.provider_used??job.requested_provider??'Proveedor no registrado'} · intento {job.attempt_count}/{job.max_attempts}</p></div><span className="w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold" title={`Estado técnico: ${job.status}`}>{jobStatusLabel(job.status)}</span><time className="text-xs text-slate-500">{new Date(job.created_at).toLocaleString('es-CO')}</time></article>)}{!jobs.length&&<p className="py-5 text-sm text-slate-500">Este recurso todavía no tiene trabajos registrados.</p>}</div></details>}

function jobStatusLabel(status:string){return({queued:'En cola',running:'Procesando',retry_wait:'Esperando reintento',succeeded:'Completado',failed:'Fallido',cancelled:'Cancelado'} as Record<string,string>)[status]??status}
